import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the preserved ABI exposes independently verifiable campaign configuration and pledge records", async () => {
  const abi = JSON.parse(await readFile(new URL("../../evidence/pact_atlas_poc_abi.json", import.meta.url), "utf8"));
  const functions = new Set(abi.body.functions.map(fn => fn.name));
  assert.equal(functions.has("campaign_config"), true);
  assert.equal(functions.has("pledge_records"), true);
});
