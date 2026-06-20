#!/usr/bin/env tsx
/**
 * Publish standards/mappings/*.yaml crosswalk files to control_mappings.
 *
 * Usage:
 *   npm run publish-mappings -- [--dry-run] [--file=nist-iso-eu-crosswalk.yaml]
 *
 * Requires (unless --dry-run):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import {
  crosswalkFileSchema,
  type ControlRef,
  type CrosswalkMapping,
} from "../lib/standards/schema";
import {
  createAdminClient,
  discoverYamlFiles,
  loadYaml,
  projectRoot,
  requireSupabaseEnv,
} from "../lib/standards/script-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type CliOptions = {
  dryRun: boolean;
  file?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--file=")) {
      options.file = arg.slice("--file=".length);
    }
  }

  return options;
}

type ControlKey = string;

function controlKey(ref: ControlRef): ControlKey {
  return `${ref.framework}@${ref.version}:${ref.control_id}`;
}

async function loadControlIdMap(
  supabase: SupabaseClient,
): Promise<Map<ControlKey, string>> {
  const { data, error } = await supabase
    .from("controls")
    .select(
      "id, control_id, framework_versions!inner(version, frameworks!inner(slug))",
    );

  if (error) {
    throw new Error(`failed to load controls: ${error.message}`);
  }

  const map = new Map<ControlKey, string>();

  for (const row of data ?? []) {
    const fv = row.framework_versions as {
      version: string;
      frameworks: { slug: string };
    };
    const slug = fv.frameworks.slug;
    map.set(controlKey({ framework: slug, version: fv.version, control_id: row.control_id }), row.id);
  }

  return map;
}

async function publishMappings(
  supabase: SupabaseClient | null,
  mappings: CrosswalkMapping[],
  controlIds: Map<ControlKey, string>,
  dryRun: boolean,
): Promise<number> {
  let upserted = 0;

  for (const mapping of mappings) {
    const sourceId = controlIds.get(controlKey(mapping.source));
    const targetId = controlIds.get(controlKey(mapping.target));

    if (dryRun) {
      console.log(
        `  [dry-run] ${mapping.source.framework}:${mapping.source.control_id} → ${mapping.target.framework}:${mapping.target.control_id} (${mapping.mapping_type})`,
      );
      upserted += 1;
      continue;
    }

    if (!sourceId || !targetId) {
      const missing = [
        !sourceId ? controlKey(mapping.source) : null,
        !targetId ? controlKey(mapping.target) : null,
      ]
        .filter(Boolean)
        .join(", ");
      console.warn(`  ⚠ Skipping mapping — control not found: ${missing}`);
      continue;
    }

    const row = {
      source_control_id: sourceId,
      target_control_id: targetId,
      mapping_type: mapping.mapping_type,
      notes: mapping.notes ?? null,
    };

    const { error } = await supabase!
      .from("control_mappings")
      .upsert(row, { onConflict: "source_control_id,target_control_id" });

    if (error) {
      throw new Error(`mapping upsert failed: ${error.message}`);
    }

    upserted += 1;
  }

  return upserted;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const mappingsDir = resolve(projectRoot, "standards/mappings");

  console.log("AI Governance Assessor — mappings publish pipeline");
  if (options.dryRun) console.log("  mode: dry-run (no database writes)");

  if (!existsSync(mappingsDir)) {
    console.error(`Mappings directory not found: ${mappingsDir}`);
    process.exit(1);
  }

  const files = discoverYamlFiles(mappingsDir).filter((file) =>
    options.file ? basename(file) === options.file : true,
  );

  if (files.length === 0) {
    console.error("No mapping YAML files found.");
    process.exit(1);
  }

  let totalMappings = 0;

  if (options.dryRun) {
    const controlIds = new Map<ControlKey, string>();
    for (const file of files) {
      const crosswalk = crosswalkFileSchema.parse(loadYaml(file));
      console.log(`\n→ ${basename(file)} (${crosswalk.mappings.length} mapping(s))`);
      totalMappings += await publishMappings(null, crosswalk.mappings, controlIds, true);
    }
  } else {
    const { url, serviceKey } = requireSupabaseEnv();
    const supabase = createAdminClient(url, serviceKey);
    const controlIds = await loadControlIdMap(supabase);

    for (const file of files) {
      const crosswalk = crosswalkFileSchema.parse(loadYaml(file));
      console.log(`\n→ ${basename(file)} (${crosswalk.mappings.length} mapping(s))`);
      totalMappings += await publishMappings(
        supabase,
        crosswalk.mappings,
        controlIds,
        false,
      );
    }
  }

  console.log(`\nSummary: ${totalMappings} mapping(s) processed.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
