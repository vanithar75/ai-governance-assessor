#!/usr/bin/env tsx
/**
 * Publish standards/ YAML files to Supabase.
 *
 * Usage:
 *   npm run publish-standards -- [--dry-run] [--framework=slug] [--version=1.0]
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  controlsFileSchema,
  frameworkMetadataSchema,
  standardBundleSchema,
  versionManifestSchema,
  type StandardBundle,
} from "../lib/standards/schema";
import { parse as parseYaml } from "yaml";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

/**
 * REST-only scripts never open Realtime channels, but createClient still
 * constructs a RealtimeClient and resolves a WebSocket transport on init.
 * Node.js < 22 has no native WebSocket — pass a no-op transport instead of ws.
 */
class NoopWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = NoopWebSocket.CLOSED;

  constructor(_address: string | URL, _protocols?: string | string[]) {}

  send(_data: unknown): void {}
  close(_code?: number, _reason?: string): void {}

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
}

function createAdminClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: NoopWebSocket as unknown as typeof WebSocket,
    },
  });
}

function requireSupabaseEnv(): { url: string; serviceKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing: string[] = [];

  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length === 0) {
    return { url: url!, serviceKey: serviceKey! };
  }

  const lines = [
    `Missing required environment variable(s): ${missing.join(", ")}.`,
    "",
    `Add them to ${join(projectRoot, ".env.local")}.`,
  ];

  if (missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    lines.push(
      "",
      "SUPABASE_SERVICE_ROLE_KEY is the service_role secret — not NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      "From the Supabase dashboard:",
      "  1. Open your project → Project Settings → API",
      '  2. Under "Project API keys", reveal and copy the service_role key',
      "  3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>",
      "",
      "Never commit this key or use it in client-side code.",
    );
  }

  if (missing.includes("NEXT_PUBLIC_SUPABASE_URL")) {
    lines.push(
      "",
      "NEXT_PUBLIC_SUPABASE_URL is the Project URL on the same API settings page.",
    );
  }

  console.error(lines.join("\n"));
  process.exit(1);
}

type CliOptions = {
  dryRun: boolean;
  framework?: string;
  version?: string;
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
    }
  }

  return options;
}

function loadYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, "utf8")) as T;
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

async function publishBundle(
  supabase: ReturnType<typeof createClient>,
  bundle: StandardBundle,
  dryRun: boolean,
): Promise<number> {
  const { framework, manifest, controls } = bundle;
  const label = `${framework.slug}@${manifest.version}`;

  console.log(`\n→ ${label} (${manifest.status})`);

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
    console.log(`  [dry-run] would upsert framework + version + ${controlCount} controls`);
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
    status: manifest.status,
    changelog: manifest.changelog ?? null,
    published_at:
      manifest.status === "published"
        ? manifest.published_at ?? new Date().toISOString()
        : null,
  };

  if (manifest.status === "published") {
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

  if (manifest.status === "published") {
    await supabase
      .from("framework_versions")
      .update({
        status: "published",
        published_at: versionRow.published_at,
      })
      .eq("id", fv.id);
  }

  // Replace controls for this version (idempotent publish)
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
  const standardsDir = resolve("standards");

  console.log("AI Governance Assessor — standards publish pipeline");
  if (options.dryRun) console.log("  mode: dry-run (no database writes)");

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
        null as unknown as ReturnType<typeof createClient>,
        bundle,
        true,
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
      stats.controls += await publishBundle(supabase, bundle, false);
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
