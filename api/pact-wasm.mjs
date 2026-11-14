import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wasmPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "evidence", "pact_atlas_poc.wasm");

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).setHeader("Allow", "GET").end("GET only");
    return;
  }
  try {
    const wasm = await readFile(wasmPath);
    response.status(200)
      .setHeader("Content-Type", "application/wasm")
      .setHeader("Cache-Control", "public, max-age=31536000, immutable")
      .setHeader("X-Content-Type-Options", "nosniff")
      .send(wasm);
  } catch {
    response.status(404).json({ error: "Preserved PACT Wasm artifact unavailable." });
  }
}
