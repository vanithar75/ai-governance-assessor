import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseYaml } from "yaml";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

config({ path: join(projectRoot, ".env.local") });
config({ path: join(projectRoot, ".env") });

export { projectRoot };

/**
 * REST-only scripts never open Realtime channels, but createClient still
 * constructs a RealtimeClient and resolves a WebSocket transport on init.
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

export function createAdminClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      transport: NoopWebSocket as unknown as typeof WebSocket,
    },
  });
}

export function requireSupabaseEnv(): { url: string; serviceKey: string } {
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
    );
  }

  console.error(lines.join("\n"));
  process.exit(1);
}

export function loadYaml<T>(path: string): T {
  return parseYaml(readFileSync(path, "utf8")) as T;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function discoverYamlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files.sort();
}

export function chunkText(text: string, maxChars = 1200): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 <= maxChars) {
      current = current ? `${current}\n\n${trimmed}` : trimmed;
      continue;
    }

    if (current) chunks.push(current);

    if (trimmed.length <= maxChars) {
      current = trimmed;
      continue;
    }

    let start = 0;
    while (start < trimmed.length) {
      chunks.push(trimmed.slice(start, start + maxChars));
      start += maxChars;
    }
    current = "";
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function embedText(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };
  return json.data[0]?.embedding ?? null;
}
