import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { example, solve, verifyPlan, ONE } from '../reference/model.js';
const { projects, pledges } = example();
const extra = { owner: 'donor6.near', amount: ONE, allowed: ['D'], requires: [] };
const scenario = process.argv.includes('--topup') ? [...pledges, extra] : pledges;
const result = solve(projects, scenario);
if (!result) throw Error('No feasible allocation');
verifyPlan(projects, scenario, result.allocations);
const certificate = {
  type: 'PACT-LOCAL-REFERENCE-CERTIFICATE',
  version: 1,
  network: 'OFFLINE-NOT-ONCHAIN',
  projects: projects.map(p=>({ id:p.id, beneficiary:p.beneficiary, requiredYocto:p.required.toString(), dependencies:p.deps })),
  pledges: scenario.map((p,i)=>({ index:i, owner:p.owner, amountYocto:p.amount.toString(), allowed:p.allowed, requires:p.requires })),
  allocations: result.allocations,
  funded: result.funded.slice().sort(),
  creditedProjectsYocto: result.allocated.toString(),
  refundsYocto: (scenario.reduce((a,p)=>a+p.amount,0n)-result.allocated).toString(),
  evaluation: 'exhaustive, bounded: max projects then max allocated volume',
};
const canonical = JSON.stringify(certificate);
certificate.sha256 = createHash('sha256').update(canonical).digest('hex');
const output = JSON.stringify(certificate, null, 2)+'\n';
if (process.argv.includes('--write')) {
  const outfile = process.argv.includes('--topup') ? 'docs/certificate-with-topup.json' : 'docs/certificate-before-topup.json';
  fs.writeFileSync(new URL(`../${outfile}`, import.meta.url), output);
  process.stdout.write(`Written ${outfile}\n`);
} else process.stdout.write(output);
