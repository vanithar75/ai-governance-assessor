#!/usr/bin/env tsx
/**
 * Ingest markdown/text sources from standards/sources/{framework}/ into Supabase.
 *
 * Usage:
 *   npm run ingest-sources -- [--dry-run] [--framework=slug]
 *
 * Optional:
 *   OPENAI_API_KEY — generate text-embedding-3-small vectors for chunks
 *
 * Requires (unless --dry-run):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  chunkText,
  createAdminClient,
  embedText,
  projectRoot,
  requireSupabaseEnv,
  sha256,
} from "../lib/standards/script-utils";
import type { SupabaseClient } from "@supabase/supabase-js";

type CliOptions = {
  dryRun: boolean;
  framework?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg.startsWith("--framework=")) {
      options.framework = arg.slice("--framework=".length);
    }
  }

  return options;
}

type SourceFile = {
  frameworkSlug: string;
  path: string;
  title: string;
  content: string;
};

function discoverSourceFiles(
  sourcesDir: string,
  frameworkFilter?: string,
): SourceFile[] {
  if (!existsSync(sourcesDir)) return [];

  const files: SourceFile[] = [];

  for (const entry of readdirSync(sourcesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (frameworkFilter && entry.name !== frameworkFilter) continue;

    const frameworkDir = join(sourcesDir, entry.name);
    for (const file of readdirSync(frameworkDir, { withFileTypes: true })) {
      if (!file.isFile()) continue;
      if (!/\.(md|txt)$/i.test(file.name)) continue;

      const path = join(frameworkDir, file.name);
      const content = readFileSync(path, "utf8");
      const title =
        content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? file.name.replace(/\.[^.]+$/, "");

      files.push({
        frameworkSlug: entry.name,
        path,
        title,
        content,
      });
    }
  }

  return files;
}

async function ingestFile(
  supabase: SupabaseClient | null,
  source: SourceFile,
  dryRun: boolean,
): Promise<number> {
  const contentHash = sha256(source.content);
  const chunks = chunkText(source.content);

  console.log(
    `\n→ ${source.frameworkSlug}/${source.title} (${chunks.length} chunk(s), hash=${contentHash.slice(0, 8)}…)`,
  );

  if (chunks.length === 0) {
    console.warn("  ⚠ empty file, skipping");
    return 0;
  }

  if (dryRun) {
    for (const [index, chunk] of chunks.entries()) {
      const preview = chunk.slice(0, 80).replace(/\n/g, " ");
      console.log(`  [dry-run] chunk ${index}: ${preview}…`);
    }
    return chunks.length;
  }

  const { data: existing } = await supabase!
    .from("source_documents")
    .select("id")
    .eq("framework_slug", source.frameworkSlug)
    .eq("content_hash", contentHash)
    .maybeSingle();

  let documentId = existing?.id as string | undefined;

  if (!documentId) {
    const { data: doc, error: docError } = await supabase!
      .from("source_documents")
      .insert({
        framework_slug: source.frameworkSlug,
        title: source.title,
        source_url: null,
        content_hash: contentHash,
      })
      .select("id")
      .single();

    if (docError || !doc) {
      throw new Error(`source_documents insert failed: ${docError?.message}`);
    }
    documentId = doc.id;
  } else {
    await supabase!
      .from("document_chunks")
      .delete()
      .eq("source_document_id", documentId);
  }

  const hasEmbeddings = Boolean(process.env.OPENAI_API_KEY);
  if (!hasEmbeddings) {
    console.log("  ℹ OPENAI_API_KEY not set — storing chunks without embeddings");
  }

  for (const [index, chunk] of chunks.entries()) {
    const embedding = hasEmbeddings ? await embedText(chunk) : null;

    const { error } = await supabase!.from("document_chunks").insert({
      source_document_id: documentId,
      chunk_index: index,
      content: chunk,
      embedding: embedding,
      metadata: {
        source_path: source.path,
        char_count: chunk.length,
      },
    });

    if (error) {
      throw new Error(`document_chunks insert failed: ${error.message}`);
    }
  }

  console.log(`  ✓ ingested ${chunks.length} chunk(s)`);
  return chunks.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcesDir = resolve(projectRoot, "standards/sources");

  console.log("AI Governance Assessor — source ingestion pipeline");
  if (options.dryRun) console.log("  mode: dry-run (no database writes)");

  const sources = discoverSourceFiles(sourcesDir, options.framework);

  if (sources.length === 0) {
    console.error("No source files found under standards/sources/");
    process.exit(1);
  }

  let totalChunks = 0;

  if (options.dryRun) {
    for (const source of sources) {
      totalChunks += await ingestFile(null, source, true);
    }
  } else {
    const { url, serviceKey } = requireSupabaseEnv();
    const supabase = createAdminClient(url, serviceKey);

    for (const source of sources) {
      totalChunks += await ingestFile(supabase, source, false);
    }
  }

  console.log(`\nSummary: ${sources.length} document(s), ${totalChunks} chunk(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
