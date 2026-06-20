#!/usr/bin/env tsx
/**
 * Draft control improvements using ingested source chunks and current controls YAML.
 *
 * Usage:
 *   npm run draft-control-updates -- [--framework=nist-ai-rmf] [--version=1.0] [--output=standards/drafts/]
 *
 * With OPENAI_API_KEY: LLM suggests title/guidance improvements.
 * Without: prints manual curation instructions.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  controlsFileSchema,
  frameworkMetadataSchema,
  versionManifestSchema,
} from "../lib/standards/schema";
import {
  chunkText,
  createAdminClient,
  loadYaml,
  projectRoot,
  requireSupabaseEnv,
} from "../lib/standards/script-utils";

type CliOptions = {
  framework?: string;
  version?: string;
  output?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (const arg of argv) {
    if (arg.startsWith("--framework=")) {
      options.framework = arg.slice("--framework=".length);
    } else if (arg.startsWith("--version=")) {
      options.version = arg.slice("--version=".length);
    } else if (arg.startsWith("--output=")) {
      options.output = arg.slice("--output=".length);
    }
  }

  return options;
}

async function loadSourceExcerpts(frameworkSlug: string): Promise<string[]> {
  const sourcesDir = resolve(projectRoot, "standards/sources", frameworkSlug);
  const localChunks: string[] = [];

  if (existsSync(sourcesDir)) {
    for (const file of readdirSync(sourcesDir, { withFileTypes: true })) {
      if (!file.isFile() || !/\.(md|txt)$/i.test(file.name)) continue;
      const content = readFileSync(join(sourcesDir, file.name), "utf8");
      localChunks.push(...chunkText(content, 800));
    }
  }

  if (localChunks.length > 0) return localChunks.slice(0, 6);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const { url, serviceKey } = requireSupabaseEnv();
      const supabase = createAdminClient(url, serviceKey);
      const { data } = await supabase
        .from("document_chunks")
        .select("content, source_documents!inner(framework_slug)")
        .eq("source_documents.framework_slug", frameworkSlug)
        .limit(6);

      return (data ?? []).map((row) => row.content as string);
    } catch {
      return [];
    }
  }

  return [];
}

async function suggestWithLlm(
  frameworkName: string,
  controlsYaml: string,
  sourceExcerpts: string[],
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }

  const prompt = `You are a compliance standards curator. Review the current controls YAML for ${frameworkName} and suggest improvements to question titles and guidance fields based on the source excerpts.

Return a unified diff style output showing proposed changes only. Keep control_id values unchanged. Focus on clarity and regulatory alignment.

## Source excerpts
${sourceExcerpts.map((e, i) => `### Excerpt ${i + 1}\n${e}`).join("\n\n")}

## Current controls.yaml
\`\`\`yaml
${controlsYaml}
\`\`\``;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You propose minimal, reviewable edits to compliance assessment controls. Output markdown with a short summary and a fenced yaml diff block.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI chat failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return json.choices[0]?.message?.content ?? "(no suggestions returned)";
}

function printManualInstructions(
  frameworkSlug: string,
  version: string,
  sourceCount: number,
) {
  console.log(`
Manual curation workflow (no OPENAI_API_KEY):

1. Read source excerpts in standards/sources/${frameworkSlug}/
   (${sourceCount} chunk(s) available locally or via ingest-sources)

2. Open standards/${frameworkSlug}/versions/${version}/controls.yaml
   — edit one section at a time; keep control_id values stable.

3. Set manifest status to draft while iterating:
   standards/${frameworkSlug}/versions/${version}/manifest.yaml

4. Validate:
   npm run validate-standards -- --framework=${frameworkSlug} --version=${version}

5. Open a PR for human review, then publish:
   npm run publish-standards -- --framework=${frameworkSlug} --version=${version}
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const standardsDir = resolve(projectRoot, "standards");

  const frameworkSlug = options.framework ?? "nist-ai-rmf";
  const version = options.version ?? "1.0";

  const frameworkPath = join(standardsDir, frameworkSlug, "framework.yaml");
  const controlsPath = join(
    standardsDir,
    frameworkSlug,
    "versions",
    version,
    "controls.yaml",
  );
  const manifestPath = join(
    standardsDir,
    frameworkSlug,
    "versions",
    version,
    "manifest.yaml",
  );

  if (!existsSync(controlsPath)) {
    console.error(`Controls file not found: ${controlsPath}`);
    process.exit(1);
  }

  const framework = frameworkMetadataSchema.parse(loadYaml(frameworkPath));
  const manifest = versionManifestSchema.parse(loadYaml(manifestPath));
  controlsFileSchema.parse(loadYaml(controlsPath));

  const controlsYaml = readFileSync(controlsPath, "utf8");
  const sourceExcerpts = await loadSourceExcerpts(frameworkSlug);

  console.log(
    `Draft control updates — ${framework.name} v${manifest.version} (${sourceExcerpts.length} source excerpt(s))`,
  );

  if (!process.env.OPENAI_API_KEY) {
    printManualInstructions(frameworkSlug, version, sourceExcerpts.length);
    return;
  }

  try {
    const suggestions = await suggestWithLlm(
      framework.name,
      controlsYaml,
      sourceExcerpts,
    );

    console.log("\n--- Proposed improvements ---\n");
    console.log(suggestions);

    if (options.output) {
      const outDir = resolve(projectRoot, options.output);
      mkdirSync(outDir, { recursive: true });
      const outFile = join(
        outDir,
        `${frameworkSlug}-${version}-suggestions.md`,
      );
      writeFileSync(outFile, suggestions, "utf8");
      console.log(`\nWrote suggestions to ${outFile}`);
    }
  } catch (error) {
    console.warn(
      `\nLLM suggestion failed: ${error instanceof Error ? error.message : error}`,
    );
    printManualInstructions(frameworkSlug, version, sourceExcerpts.length);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
