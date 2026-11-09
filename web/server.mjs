import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import verifyTestnet from "../api/verify-testnet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const checkpointRoot = path.resolve(root, "..");
const outputsRoot = path.resolve(root, "..", "..", "..", "outputs");
const port = Number(process.env.PORT ?? 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8", ".svg": "image/svg+xml" };

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  if (relative === "console") return path.join(root, "console.html");
  if (relative === "HACKATHON.md") return path.join(checkpointRoot, relative);
  if (relative.startsWith("outputs/")) {
    const candidate = path.resolve(outputsRoot, relative.slice("outputs/".length));
    return candidate.startsWith(`${outputsRoot}${path.sep}`) ? candidate : null;
  }
  const candidate = path.resolve(root, relative);
  return candidate.startsWith(`${root}${path.sep}`) ? candidate : null;
}

const server = http.createServer(async (request, response) => {
  if (request.url?.split("?")[0] === "/api/verify-testnet") {
    await verifyTestnet(request, response);
    return;
  }
  const filePath = safePath(request.url);
  if (!filePath) { response.writeHead(400); response.end("bad path"); return; }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404); response.end("not found");
  }
});

server.listen(port, "127.0.0.1", () => console.log(`PACT Atlas preview: http://127.0.0.1:${port}`));
