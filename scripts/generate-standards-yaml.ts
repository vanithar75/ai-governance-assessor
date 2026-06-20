/**
 * One-time utility: extract seed JSON from supabase/schema.sql and emit
 * standards/ YAML files. Safe to re-run (overwrites generated files).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { stringify as yamlStringify } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const schemaPath = join(root, "supabase", "schema.sql");
const standardsRoot = join(root, "standards");

type SeedFramework = {
  key: string;
  slug: string;
  marker: string;
  meta: {
    id: string;
    name: string;
    description: string;
    publisher: string;
    jurisdiction: string;
    website_url?: string;
  };
};

const FRAMEWORKS: SeedFramework[] = [
  {
    key: "nist",
    slug: "nist-ai-rmf",
    marker: "nist",
    meta: {
      id: "f0000001-0000-4000-8000-000000000001",
      name: "NIST AI RMF",
      description:
        "NIST Artificial Intelligence Risk Management Framework (AI RMF 1.0) — structured around Govern, Map, Measure, and Manage to help organizations identify, assess, and mitigate AI risks throughout the system lifecycle.",
      publisher: "NIST",
      jurisdiction: "US",
      website_url: "https://www.nist.gov/itl/ai-risk-management-framework",
    },
  },
  {
    key: "eu",
    slug: "eu-ai-act",
    marker: "euai",
    meta: {
      id: "f0000001-0000-4000-8000-000000000002",
      name: "EU AI Act",
      description:
        "European Union Artificial Intelligence Act — risk-based obligations for AI systems placed on the EU market, covering prohibited practices, high-risk requirements, transparency, and general-purpose AI model rules.",
      publisher: "European Commission",
      jurisdiction: "EU",
      website_url: "https://artificialintelligenceact.eu/",
    },
  },
  {
    key: "iso",
    slug: "iso-42001",
    marker: "iso",
    meta: {
      id: "f0000001-0000-4000-8000-000000000003",
      name: "ISO/IEC 42001",
      description:
        "ISO/IEC 42001:2023 — Artificial Intelligence Management System (AIMS) standard specifying requirements to establish, implement, maintain, and continually improve responsible AI management within organizations.",
      publisher: "ISO/IEC",
      jurisdiction: "International",
      website_url: "https://www.iso.org/standard/81230.html",
    },
  },
];

type LegacyQuestion = {
  id: string;
  text: string;
  type: string;
  weight: number;
  required: boolean;
  guidance?: string;
  options?: string[];
};

type LegacySection = {
  id: string;
  title: string;
  description: string;
  questions: LegacyQuestion[];
};

type LegacyQuestions = {
  version: string;
  framework: string;
  sections: LegacySection[];
};

function extractJson(schema: string, marker: string): LegacyQuestions {
  const pattern = new RegExp(`\\$${marker}\\$\\s*([\\s\\S]*?)\\s*\\$${marker}\\$`, "i");
  const match = schema.match(pattern);
  if (!match) {
    throw new Error(`Could not find $${marker}$ block in schema.sql`);
  }
  return JSON.parse(match[1]) as LegacyQuestions;
}

function writeYaml(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, yamlStringify(data, { lineWidth: 0 }), "utf8");
}

function migrateFramework(seed: SeedFramework, questions: LegacyQuestions) {
  const base = join(standardsRoot, seed.slug);

  writeYaml(join(base, "framework.yaml"), {
    id: seed.meta.id,
    slug: seed.slug,
    name: seed.meta.name,
    description: seed.meta.description,
    publisher: seed.meta.publisher,
    jurisdiction: seed.meta.jurisdiction,
    website_url: seed.meta.website_url,
  });

  const versionDir = join(base, "versions", questions.version);
  writeYaml(join(versionDir, "manifest.yaml"), {
    version: questions.version,
    status: "published",
    changelog: "Initial release migrated from legacy seed data.",
    published_at: new Date("2024-06-01T00:00:00.000Z").toISOString(),
  });

  let sortOrder = 0;
  const sections = questions.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    controls: section.questions.map((q) => {
      sortOrder += 1;
      return {
        control_id: q.id,
        title: q.text,
        question_type: q.type,
        weight: q.weight,
        required: q.required,
        guidance: q.guidance,
        ...(q.options?.length ? { options: q.options } : {}),
        severity: q.weight >= 3 ? "high" : q.weight >= 2 ? "medium" : "low",
        sort_order: sortOrder,
      };
    }),
  }));

  writeYaml(join(versionDir, "controls.yaml"), { sections });
  console.log(`  ✓ ${seed.slug} v${questions.version} (${sortOrder} controls)`);
}

const schema = readFileSync(schemaPath, "utf8");
console.log("Generating standards/ YAML from supabase/schema.sql …");

for (const seed of FRAMEWORKS) {
  const questions = extractJson(schema, seed.marker);
  migrateFramework(seed, questions);
}

console.log("Done.");
