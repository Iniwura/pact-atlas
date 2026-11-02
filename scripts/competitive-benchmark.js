#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCompetitiveBenchmark, toJsonSafe } from '../reference/competitive.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const report = toJsonSafe(runCompetitiveBenchmark());
const output = `${JSON.stringify(report, null, 2)}\n`;

if (args.has('--write')) {
  const destination = process.argv[process.argv.indexOf('--write') + 1]
    ?? path.join(root, 'evidence', 'competitive-benchmark.json');
  const absolute = path.resolve(root, destination);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, output);
  console.log(`wrote ${path.relative(root, absolute)}`);
} else {
  process.stdout.write(output);
}

for (const result of report.results) {
  console.log([
    result.name,
    `independent=${result.independent.activatedProjects}`,
    `pool=${result.thresholdPool.activatedProjects}`,
    `pact=${result.pact.activatedProjects}`,
    `pactAllocated=${result.pact.allocated}`,
    `topUp=${result.pact.minimumAdditionalFunding ?? 'n/a'}`,
    `runtimeMs=${result.pact.runtimeMs.toFixed(3)}`,
  ].join(' '));
}
