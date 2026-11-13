import { verifyTestnetProof } from "../web/testnet-proof.mjs";

/** Same-origin NEAR testnet read-only verification. No keys or signing. */
async function parseInput(request) {
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") return JSON.parse(request.body);
  let raw = "";
  for await (const chunk of request) {
    raw += chunk.toString();
    if (raw.length > 4096) throw new Error("Request too large.");
  }
  return JSON.parse(raw || "{}");
}

function send(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

export function createVerifyHandler({ verify = verifyTestnetProof } = {}) {
  return async function handler(request, response) {
    if (request.method !== "POST") {
      send(response, 405, { verified: false, reason: "POST only." });
      return;
    }
    try {
      const input = await parseInput(request);
      const result = await verify(input);
      send(response, result.verified ? 200 : 422, result);
    } catch {
      send(response, 400, { verified: false, reason: "The verification request was invalid." });
    }
  };
}

export default createVerifyHandler();
