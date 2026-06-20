#!/usr/bin/env tsx
/**
 * Publish standards/ YAML files to Supabase.
 *
 * Usage:
 *   npm run publish-standards -- [--dry-run] [--framework=slug] [--version=1.0] [--status=published]
 *
 * Requires (unless --dry-run):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  controlsFileSchema,
  frameworkMetadataSchema,
  frameworkVersionStatusSchema,
  standardBundleSchema,
  versionManifestSchema,
  type StandardBundle,
  type VersionManifest,
} from "../lib/standards/schema";
import {
  createAdminClient,
  loadYaml,
  projectRoot,
  requireSupabaseEnv,
} from "../lib/standards/script-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type CliOptions = {
  dryRun: boolean;
  framework?: string;
  version?: string;
  status?: VersionManifest["status"];
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--framework=")) {
      options.framework = arg.slice("--framework=".length);
    } else if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
    } else if (arg.startsWith("--status=")) {
      const status = arg.slice("--status=".length);
      options.status = frameworkVersionStatusSchema.parse(status);
    }
  }

  return options;
}

function discoverStandards(
  standardsDir: string,
  filter?: { framework?: string; version?: string },
): StandardBundle[] {
  if (!existsSync(standardsDir)) {
    throw new Error(`standards directory not found: ${standardsDir}`);
  }

  const bundles: StandardBundle[] = [];

  for (const slug of readdirSync(standardsDir, { withFileTypes: true })) {
    if (!slug.isDirectory() || slug.name.startsWith("_")) continue;
    if (slug.name === "mappings" || slug.name === "sources" || slug.name === "drafts") {
      continue;
    }
    if (filter?.framework && slug.name !== filter.framework) continue;

    const frameworkPath = join(standardsDir, slug.name, "framework.yaml");
    if (!existsSync(frameworkPath)) continue;

    const framework = frameworkMetadataSchema.parse(loadYaml(frameworkPath));
    const versionsDir = join(standardsDir, slug.name, "versions");
    if (!existsSync(versionsDir)) continue;

    for (const versionEntry of readdirSync(versionsDir, {
      withFileTypes: true,
    })) {
      if (!versionEntry.isDirectory()) continue;
      if (filter?.version && versionEntry.name !== filter.version) continue;

      const versionDir = join(versionsDir, versionEntry.name);
      const manifestPath = join(versionDir, "manifest.yaml");
      const controlsPath = join(versionDir, "controls.yaml");

      if (!existsSync(manifestPath) || !existsSync(controlsPath)) {
        console.warn(`  ⚠ Skipping ${slug.name}/${versionEntry.name}: missing files`);
        continue;
      }

      const manifest = versionManifestSchema.parse(loadYaml(manifestPath));
      const controls = controlsFileSchema.parse(loadYaml(controlsPath));

      bundles.push(
        standardBundleSchema.parse({ framework, manifest, controls }),
      );
    }
  }

  return bundles;
}

type PublishStats = {
  frameworks: number;
  versions: number;
  controls: number;
};

function resolveStatus(
  manifest: VersionManifest,
  statusOverride?: VersionManifest["status"],
): VersionManifest["status"] {
  return statusOverride ?? manifest.status;
}

async function publishBundle(
  supabase: SupabaseClient,
  bundle: StandardBundle,
  dryRun: boolean,
  statusOverride?: VersionManifest["status"],
): Promise<number> {
  const { framework, manifest, controls } = bundle;
  const status = resolveStatus(manifest, statusOverride);
  const label = `${framework.slug}@${manifest.version}`;

  console.log(
    `\n→ ${label} (${status}${statusOverride ? `, manifest=${manifest.status}` : ""})`,
  );

  if (status === "archived" && !statusOverride) {
    console.log("  ⊘ skipping archived version (use --status to override)");
    return 0;
  }

  const frameworkRow = {
    ...(framework.id ? { id: framework.id } : {}),
    slug: framework.slug,
    name: framework.name,
    description: framework.description,
    publisher: framework.publisher ?? null,
    jurisdiction: framework.jurisdiction ?? null,
    website_url: framework.website_url ?? null,
  };

  if (dryRun) {
    const controlCount = controls.sections.reduce(
      (n, s) => n + s.controls.length,
      0,
    );
    console.log(
      `  [dry-run] would upsert framework + version (${status}) + ${controlCount} controls`,
    );
    return controlCount;
  }

  const { data: fw, error: fwError } = await supabase
    .from("frameworks")
    .upsert(frameworkRow, { onConflict: "slug" })
    .select("id")
    .single();

  if (fwError || !fw) {
    throw new Error(`framework upsert failed for ${label}: ${fwError?.message}`);
  }

  const versionRow = {
    framework_id: fw.id,
    version: manifest.version,
    status,
    changelog: manifest.changelog ?? null,
    published_at:
      status === "published"
        ? manifest.published_at ?? new Date().toISOString()
        : null,
  };

  if (status === "published") {
    const { error: archiveError } = await supabase
      .from("framework_versions")
      .update({ status: "archived" })
      .eq("framework_id", fw.id)
      .eq("status", "published");

    if (archiveError) {
      throw new Error(
        `failed to archive prior published versions for ${label}: ${archiveError.message}`,
      );
    }
  }

  const { data: fv, error: fvError } = await supabase
    .from("framework_versions")
    .upsert(versionRow, { onConflict: "framework_id,version" })
    .select("id")
    .single();

  if (fvError || !fv) {
    throw new Error(`version upsert failed for ${label}: ${fvError?.message}`);
  }

  if (status === "published") {
    await supabase
      .from("framework_versions")
      .update({
        status: "published",
        published_at: versionRow.published_at,
      })
      .eq("id", fv.id);
  }

  const { error: deleteError } = await supabase
    .from("controls")
    .delete()
    .eq("framework_version_id", fv.id);

  if (deleteError) {
    throw new Error(`control delete failed for ${label}: ${deleteError.message}`);
  }

  let sortOrder = 0;
  const controlRows = controls.sections.flatMap((section) =>
    section.controls.map((control) => {
      sortOrder += 1;
      return {
        framework_version_id: fv.id,
        control_id: control.control_id,
        title: control.title,
        description: control.description ?? null,
        category: section.id,
        category_title: section.title,
        category_description: section.description,
        severity: control.severity,
        question_type: control.question_type,
        options: control.options ?? [],
        weight: control.weight,
        guidance: control.guidance ?? null,
        required: control.required,
        sort_order: control.sort_order ?? sortOrder,
      };
    }),
  );

  const { error: insertError } = await supabase
    .from("controls")
    .insert(controlRows);

  if (insertError) {
    throw new Error(`control insert failed for ${label}: ${insertError.message}`);
  }

  console.log(`  ✓ published ${controlRows.length} controls`);
  return controlRows.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const standardsDir = resolve(projectRoot, "standards");

  console.log("AI Governance Assessor — standards publish pipeline");
  if (options.dryRun) console.log("  mode: dry-run (no database writes)");
  if (options.status) console.log(`  status override: ${options.status}`);

  const bundles = discoverStandards(standardsDir, {
    framework: options.framework,
    version: options.version,
  });

  if (bundles.length === 0) {
    console.error("No standards bundles found. Run: npm run generate-standards");
    process.exit(1);
  }

  console.log(`Found ${bundles.length} bundle(s) to publish.`);

  const stats: PublishStats = { frameworks: 0, versions: 0, controls: 0 };
  const seenFrameworks = new Set<string>();

  if (options.dryRun) {
    for (const bundle of bundles) {
      if (!seenFrameworks.has(bundle.framework.slug)) {
        seenFrameworks.add(bundle.framework.slug);
        stats.frameworks += 1;
      }
      stats.versions += 1;
      stats.controls += await publishBundle(
        null as unknown as SupabaseClient,
        bundle,
        true,
        options.status,
      );
    }
  } else {
    const { url, serviceKey } = requireSupabaseEnv();
    const supabase = createAdminClient(url, serviceKey);

    for (const bundle of bundles) {
      if (!seenFrameworks.has(bundle.framework.slug)) {
        seenFrameworks.add(bundle.framework.slug);
        stats.frameworks += 1;
      }
      stats.versions += 1;
      stats.controls += await publishBundle(
        supabase,
        bundle,
        false,
        options.status,
      );
    }
  }

  console.log(
    `\nSummary: ${stats.frameworks} framework(s), ${stats.versions} version(s), ${stats.controls} control(s).`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
