import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashContract, ONE_NEAR, Worker } from "near-workspaces";
import { Sandbox } from "near-sandbox-modern";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_WASM_PATH = path.join(
  REPO_DIR,
  "contract",
  "target",
  "near-build",
  "pact_atlas_poc.wasm",
);
const WASM_PATH = process.env.PACT_WASM_PATH
  ? path.resolve(process.env.PACT_WASM_PATH)
  : DEFAULT_WASM_PATH;
const SPUTNIK_WASM_PATH = process.env.PACT_SPUTNIK_WASM_PATH
  ? path.resolve(process.env.PACT_SPUTNIK_WASM_PATH)
  : path.join(REPO_DIR, "vendor", "sputnik", "sputnikdao2_original.wasm");
const EVIDENCE_PATH = process.env.PACT_EVIDENCE_PATH
  ? path.resolve(process.env.PACT_EVIDENCE_PATH)
  : path.resolve(REPO_DIR, "..", "..", "outputs", "pact-atlas-sandbox-evidence.json");

const YOCTO_PER_NEAR = ONE_NEAR;
const GAS = 300n * 10n ** 12n;
const SANDBOX_VERSION = process.env.PACT_SANDBOX_VERSION ?? "2.13.4";
const PROJECTS = [
  { id: "a", required: 4n * YOCTO_PER_NEAR, dependencies: ["b", "c"] },
  { id: "b", required: 3n * YOCTO_PER_NEAR, dependencies: ["a"] },
  { id: "c", required: 3n * YOCTO_PER_NEAR, dependencies: ["a"] },
  { id: "d", required: 3n * YOCTO_PER_NEAR, dependencies: [] },
];

function jsonValue(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]));
  }
  return value;
}

function receiptHash(result) {
  return result?.transactionReceipt?.hash ?? null;
}

function assertSucceeded(result, label) {
  assert.equal(result.failed, false, `${label} failed: ${result.summary()}`);
  return result;
}

async function blockTimestampMs(worker) {
  const block = await worker.provider.block({ finality: "optimistic" });
  return Number(BigInt(block.header.timestamp) / 1_000_000n);
}

async function prepareSandboxBinary() {
  const binaryRoot = process.env.PACT_SANDBOX_BINARY_DIR ?? "/tmp/pact-atlas-near-sandbox";
  const binaryPath = path.join(binaryRoot, `near-sandbox-${SANDBOX_VERSION}`, "near-sandbox");
  process.env.DIR_TO_DOWNLOAD_BINARY = binaryRoot;
  await Sandbox.initConfigsWithVersion(SANDBOX_VERSION);
  await fs.access(binaryPath);
  process.env.NEAR_SANDBOX_BIN_PATH = binaryPath;
  process.env.NEAR_SANDBOX_BINARY_PATH = path.dirname(binaryPath);
  return binaryPath;
}

async function fastForwardUntil(worker, targetMs) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await blockTimestampMs(worker) >= targetMs) return;
    await worker.provider.fastForward(100);
  }
  throw new Error(`sandbox did not reach timestamp ${targetMs}`);
}

async function createAccounts(worker, specs) {
  const accounts = {};
  for (const [name, initialBalance] of specs) {
    accounts[name] = await worker.rootAccount.createSubAccount(name, { initialBalance });
  }
  return accounts;
}

async function deployCampaign(worker, accounts, options = {}) {
  const startedAt = await blockTimestampMs(worker);
  const activateAfterMs = startedAt + (options.activateAfterMs ?? 30_000);
  const deadlineMs = startedAt + (options.deadlineDurationMs ?? 180_000);
  const minFundedProjects = options.minFundedProjects ?? 3;
  const requiredForActivation = options.requiredForActivation ?? ["a", "b", "c"];
  const activationAuthorities = options.activationAuthorities ?? [
    (accounts.observer ?? accounts.donor6 ?? accounts.donor1).accountId,
  ];
  const projects = PROJECTS.map((project) => ({
    id: project.id,
    beneficiary: accounts[project.id].accountId,
    required: project.required.toString(),
    dependencies: project.dependencies,
  }));

  const contract = await worker.rootAccount.devCreateAccount({ initialBalance: 20n * YOCTO_PER_NEAR });
  const deployResult = assertSucceeded(await contract.deploy(WASM_PATH), "deploy");
  const initResult = assertSucceeded(
    await contract.callRaw(
      contract,
      "new",
      {
        projects,
        deadline_ms: deadlineMs,
        activate_after_ms: activateAfterMs,
        min_funded_projects: minFundedProjects,
        required_for_activation: requiredForActivation,
        activation_authorities: activationAuthorities,
      },
      { gas: GAS },
    ),
    "new",
  );
  const sponsorResult = assertSucceeded(
    await worker.rootAccount.callRaw(
      contract,
      "sponsor_storage",
      {},
      { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
    ),
    "sponsor_storage",
  );
  const config = await contract.view("campaign_config", {});
  assert.deepEqual(config.projects.map((project) => project.id), projects.map((project) => project.id));
  assert.deepEqual(config.projects.map((project) => project.beneficiary), projects.map((project) => project.beneficiary));
  assert.deepEqual(config.projects.map((project) => project.required), projects.map((project) => project.required));
  assert.equal(config.deadline_ms, deadlineMs);
  assert.equal(config.activate_after_ms, activateAfterMs);
  assert.equal(config.min_funded_projects, minFundedProjects);
  assert.deepEqual(config.required_for_activation, requiredForActivation);
  assert.deepEqual(config.activation_authorities, activationAuthorities);
  assert.deepEqual(await contract.view("pledge_records", {}), []);
  return {
    contract,
    activateAfterMs,
    deadlineMs,
    config,
    receipts: {
      deploy: receiptHash(deployResult),
      initialize: receiptHash(initResult),
      sponsorStorage: receiptHash(sponsorResult),
    },
  };
}

async function status(contract) {
  const raw = await contract.view("status", {});
  return { ...raw, liabilities: BigInt(raw.liabilities) };
}

async function claimable(contract, account) {
  return BigInt(await contract.view("claimable", { account_id: account.accountId }));
}

async function pendingWithdrawal(contract, account) {
  return BigInt(await contract.view("pending_withdrawal", { account_id: account.accountId }));
}

async function accounting(contract) {
  const raw = await contract.view("accounting", {});
  return {
    ...raw,
    locked_pledges: BigInt(raw.locked_pledges),
    credits: BigInt(raw.credits),
    pending: BigInt(raw.pending),
    accounted: BigInt(raw.accounted),
    liabilities: BigInt(raw.liabilities),
    contract_balance: BigInt(raw.contract_balance),
    storage_reserve: BigInt(raw.storage_reserve),
  };
}

async function assertAccounting(contract, label) {
  const snapshot = await accounting(contract);
  assert.equal(
    snapshot.locked_pledges + snapshot.credits + snapshot.pending,
    snapshot.accounted,
    `${label}: accounting components do not sum`,
  );
  assert.equal(snapshot.accounted, snapshot.liabilities, `${label}: liabilities not conserved`);
  assert.equal(snapshot.solvent, true, `${label}: contract is not solvent`);
  return snapshot;
}

async function balance(account) {
  return await account.balance();
}

async function commitStandard(contract, accounts, includeTopup = false) {
  const pledges = [
    ["donor1", 3n, ["a", "d"], []],
    ["donor2", 1n, ["a"], ["b", "c"]],
    ["donor3", 3n, ["b"], ["a"]],
    ["donor4", 3n, ["c"], ["a"]],
    ["donor5", 2n, ["d"], []],
  ];
  if (includeTopup) pledges.push(["donor6", 1n, ["d"], []]);
  const receipts = [];
  for (const [name, amount, allowed, requires] of pledges) {
    const result = assertSucceeded(
      await accounts[name].callRaw(
        contract,
        "commit",
        { allowed, requires },
        { gas: GAS, attachedDeposit: amount * YOCTO_PER_NEAR },
      ),
      `commit ${name}`,
    );
    receipts.push({ name, hash: receiptHash(result), amountNear: amount.toString() });
  }
  const records = await contract.view("pledge_records", {});
  assert.deepEqual(records.map((record) => record.index), pledges.map((_, index) => index));
  assert.deepEqual(records.map((record) => record.owner), pledges.map(([name]) => accounts[name].accountId));
  assert.deepEqual(records.map((record) => record.amount), pledges.map(([, amount]) => (amount * YOCTO_PER_NEAR).toString()));
  return receipts;
}

async function expectFailure(account, contract, method, args, label) {
  const result = await account.callRaw(contract, method, args, { gas: GAS });
  assert.equal(result.failed, true, `${label} unexpectedly succeeded: ${result.summary()}`);
  return {
    label,
    hash: receiptHash(result),
    failure: result.failureMessage ?? result.Failure,
  };
}

async function assertFailedActivationPreservesState(contract, caller, allocations, label) {
  const beforeStatus = await status(contract);
  const beforeBalance = await balance(contract);
  const failure = await expectFailure(caller, contract, "activate", { allocations }, label);
  const afterStatus = await status(contract);
  const afterBalance = await balance(contract);
  assert.equal(afterStatus.phase, beforeStatus.phase, `${label}: phase changed`);
  assert.equal(afterStatus.liabilities, beforeStatus.liabilities, `${label}: liabilities changed`);
  assert.equal(afterBalance.stateStaked, beforeBalance.stateStaked, `${label}: storage stake changed`);
  return {
    ...failure,
    balanceBefore: beforeBalance,
    balanceAfter: afterBalance,
    balanceDeltaYocto: (BigInt(afterBalance.total) - BigInt(beforeBalance.total)).toString(),
  };
}

async function withdrawAndMeasure(contract, account, amount, receipts) {
  const before = await balance(account);
  const result = assertSucceeded(
    await account.callRaw(contract, "withdraw", {}, { gas: GAS }),
    `withdraw ${account.accountId}`,
  );
  assert.equal(await claimable(contract, account), 0n, "claimable did not clear");
  assert.equal(await pendingWithdrawal(contract, account), 0n, "pending did not clear");
  const after = await balance(account);
  assert(
    BigInt(after.total) > BigInt(before.total),
    `withdrawal did not increase recipient total balance for ${account.accountId}`,
  );
  receipts.push({
    account: account.accountId,
    amountNear: (amount / YOCTO_PER_NEAR).toString(),
    hash: receiptHash(result),
    beforeTotal: before.total,
    afterTotal: after.total,
  });
}

/**
 * Reproduce the exact multi-action request emitted by the self-service
 * campaign builder. This is deliberately separate from the historical five
 * campaign evidence so a failure cannot be hidden by the older deployment
 * helper, which creates and funds accounts in separate transactions.
 */
async function scenarioAtomicCampaignDeployment() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["atomic-beneficiary", 3n * YOCTO_PER_NEAR],
      ["atomic-authority", 3n * YOCTO_PER_NEAR],
      ["atomic-donor", 3n * YOCTO_PER_NEAR],
    ]);
    const startedAt = await blockTimestampMs(worker);
    const activateAfterMs = startedAt + 30_000;
    const deadlineMs = startedAt + 180_000;
    const campaign = worker.rootAccount.getSubAccount("atomic-campaign");
    const deploymentTransaction = await worker.rootAccount
      .batch(campaign)
      .createAccount()
      .transfer(3n * YOCTO_PER_NEAR)
      .deployContractFile(WASM_PATH);
    deploymentTransaction
      .functionCall("new", {
          projects: [{ id: "atomic", beneficiary: accounts["atomic-beneficiary"].accountId, required: YOCTO_PER_NEAR.toString(), dependencies: [] }],
          deadline_ms: deadlineMs,
          activate_after_ms: activateAfterMs,
          min_funded_projects: 1,
          required_for_activation: ["atomic"],
          activation_authorities: [accounts["atomic-authority"].accountId],
        }, { gas: GAS });
    deploymentTransaction.functionCall("sponsor_storage", {}, { gas: GAS, attachedDeposit: 2n * YOCTO_PER_NEAR });
    const deployment = assertSucceeded(
      await deploymentTransaction.transact(),
      "atomic campaign CreateAccount → Transfer → DeployContract → new → sponsor_storage",
    );
    const codeHash = hashContract(await campaign.viewCode());
    const config = await campaign.view("campaign_config", {});
    const initial = await status(campaign);
    assert.equal(initial.phase, "OPEN");
    assert.equal(initial.pledge_count, 0);
    assert.equal(config.projects[0].beneficiary, accounts["atomic-beneficiary"].accountId);
    const commit = assertSucceeded(
      await accounts["atomic-donor"].callRaw(campaign, "commit", { allowed: ["atomic"], requires: [] }, { gas: GAS, attachedDeposit: YOCTO_PER_NEAR }),
      "atomic campaign contribution",
    );
    await fastForwardUntil(worker, activateAfterMs + 1);
    const activation = assertSucceeded(
      await accounts["atomic-authority"].callRaw(campaign, "activate", { allocations: [{ pledge_index: 0, project_id: "atomic" }] }, { gas: GAS }),
      "atomic campaign activation",
    );
    const beneficiaryCredit = await claimable(campaign, accounts["atomic-beneficiary"]);
    assert.equal(beneficiaryCredit, YOCTO_PER_NEAR);
    const withdrawal = assertSucceeded(
      await accounts["atomic-beneficiary"].callRaw(campaign, "withdraw", {}, { gas: GAS }),
      "atomic campaign beneficiary withdrawal",
    );
    const finalAccounting = await assertAccounting(campaign, "atomic campaign final reconciliation");
    assert.equal(finalAccounting.liabilities, 0n);
    return {
      name: "atomic self-service deployment and lifecycle compatibility",
      contract: campaign.accountId,
      wasmCodeHash: codeHash,
      deploymentFundingNear: { beforeDeploy: "3", storageSponsor: "2" },
      receipts: {
        deployment: receiptHash(deployment),
        commit: receiptHash(commit),
        activation: receiptHash(activation),
        withdrawal: receiptHash(withdrawal),
      },
      initialStatus: initial,
      finalStatus: await status(campaign),
      finalAccounting,
    };
  } finally {
    await worker.tearDown();
  }
}

async function scenarioCycleAndInvalidPlans() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["a", 2n * YOCTO_PER_NEAR], ["b", 2n * YOCTO_PER_NEAR],
      ["c", 2n * YOCTO_PER_NEAR], ["d", 2n * YOCTO_PER_NEAR], ["observer", 2n * YOCTO_PER_NEAR],
      ["donor1", 5n * YOCTO_PER_NEAR], ["donor2", 5n * YOCTO_PER_NEAR],
      ["donor3", 5n * YOCTO_PER_NEAR], ["donor4", 5n * YOCTO_PER_NEAR], ["donor5", 5n * YOCTO_PER_NEAR],
    ]);
    const campaign = await deployCampaign(worker, accounts, { deadlineDurationMs: 600_000 });
    const commitReceipts = await commitStandard(campaign.contract, accounts);
    await assertAccounting(campaign.contract, "open after standard commits");
    const invalidPlans = [];
    invalidPlans.push(
      await assertFailedActivationPreservesState(
        campaign.contract,
        accounts.observer,
        [{ pledge_index: 0, project_id: "a" }],
        "premature activation",
      ),
    );
    await fastForwardUntil(worker, campaign.activateAfterMs + 1);
    invalidPlans.push(
      await assertFailedActivationPreservesState(
        campaign.contract,
        accounts.observer,
        [
          { pledge_index: 0, project_id: "a" },
          { pledge_index: 0, project_id: "a" },
          { pledge_index: 1, project_id: "a" },
          { pledge_index: 2, project_id: "b" },
          { pledge_index: 3, project_id: "c" },
        ],
        "duplicate pledge index",
      ),
    );
    invalidPlans.push(
      await assertFailedActivationPreservesState(
        campaign.contract,
        accounts.observer,
        [
          { pledge_index: 0, project_id: "a" },
          { pledge_index: 2, project_id: "b" },
          { pledge_index: 3, project_id: "c" },
        ],
        "underfunded allocation",
      ),
    );
    invalidPlans.push(
      await assertFailedActivationPreservesState(
        campaign.contract,
        accounts.observer,
        [
          { pledge_index: 1, project_id: "d" },
          { pledge_index: 0, project_id: "a" },
          { pledge_index: 2, project_id: "b" },
          { pledge_index: 3, project_id: "c" },
        ],
        "disallowed project target",
      ),
    );

    const dependencyRawAccounts = await createAccounts(worker, [
      ["dep-a", 2n * YOCTO_PER_NEAR], ["dep-b", 2n * YOCTO_PER_NEAR],
      ["dep-c", 2n * YOCTO_PER_NEAR], ["dep-d", 2n * YOCTO_PER_NEAR],
      ["dep-donor1", 5n * YOCTO_PER_NEAR], ["dep-donor2", 5n * YOCTO_PER_NEAR],
      ["dep-donor3", 5n * YOCTO_PER_NEAR], ["dep-donor4", 5n * YOCTO_PER_NEAR],
      ["dep-donor5", 5n * YOCTO_PER_NEAR],
    ]);
    const dependencyAccounts = {
      a: dependencyRawAccounts["dep-a"],
      b: dependencyRawAccounts["dep-b"],
      c: dependencyRawAccounts["dep-c"],
      d: dependencyRawAccounts["dep-d"],
      donor1: dependencyRawAccounts["dep-donor1"],
      donor2: dependencyRawAccounts["dep-donor2"],
      donor3: dependencyRawAccounts["dep-donor3"],
      donor4: dependencyRawAccounts["dep-donor4"],
      donor5: dependencyRawAccounts["dep-donor5"],
    };
    const dependencyCampaign = await deployCampaign(worker, dependencyAccounts, {
      deadlineDurationMs: 600_000,
      minFundedProjects: 2,
      requiredForActivation: [],
      activationAuthorities: [accounts.observer.accountId],
    });
    await commitStandard(dependencyCampaign.contract, dependencyAccounts);
    await fastForwardUntil(worker, dependencyCampaign.activateAfterMs + 1);
    invalidPlans.push(
      await assertFailedActivationPreservesState(
        dependencyCampaign.contract,
        accounts.observer,
        [
          { pledge_index: 0, project_id: "a" },
          { pledge_index: 1, project_id: "a" },
          { pledge_index: 2, project_id: "b" },
        ],
        "broken dependency cycle",
      ),
    );

    const activationResult = assertSucceeded(
      await accounts.observer.callRaw(
        campaign.contract,
        "activate",
        {
          allocations: [
            { pledge_index: 0, project_id: "a" },
            { pledge_index: 1, project_id: "a" },
            { pledge_index: 2, project_id: "b" },
            { pledge_index: 3, project_id: "c" },
          ],
        },
        { gas: GAS },
      ),
      "activate A+B+C",
    );
    const activated = await status(campaign.contract);
    const activatedAccounting = await assertAccounting(campaign.contract, "activated A+B+C");
    assert.equal(activated.phase, "ACTIVATED");
    assert.deepEqual(activated.funded_project_ids, ["a", "b", "c"]);
    assert.equal(activated.liabilities, 12n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.a), 4n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.b), 3n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.c), 3n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.donor5), 2n * YOCTO_PER_NEAR);

    const withdrawals = [];
    await withdrawAndMeasure(campaign.contract, accounts.a, 4n * YOCTO_PER_NEAR, withdrawals);
    await withdrawAndMeasure(campaign.contract, accounts.b, 3n * YOCTO_PER_NEAR, withdrawals);
    await withdrawAndMeasure(campaign.contract, accounts.c, 3n * YOCTO_PER_NEAR, withdrawals);
    await withdrawAndMeasure(campaign.contract, accounts.donor5, 2n * YOCTO_PER_NEAR, withdrawals);
    const settled = await status(campaign.contract);
    assert.equal(settled.liabilities, 0n);
    const settledAccounting = await assertAccounting(campaign.contract, "settled A+B+C");
    return {
      name: "three-project dependency cycle with adversarial plans",
      contract: campaign.contract.accountId,
      wasmCodeHash: hashContract(await campaign.contract.viewCode()),
      receipts: { ...campaign.receipts, commits: commitReceipts, invalidPlans, activation: receiptHash(activationResult) },
      finalStatus: settled,
      accounting: { activated: activatedAccounting, settled: settledAccounting },
      withdrawals,
      finalContractBalance: await balance(campaign.contract),
    };
  } finally {
    await worker.tearDown();
  }
}

async function scenarioAllFourWithTopup() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["a", 2n * YOCTO_PER_NEAR], ["b", 2n * YOCTO_PER_NEAR],
      ["c", 2n * YOCTO_PER_NEAR], ["d", 2n * YOCTO_PER_NEAR],
      ["donor1", 5n * YOCTO_PER_NEAR], ["donor2", 5n * YOCTO_PER_NEAR],
      ["donor3", 5n * YOCTO_PER_NEAR], ["donor4", 5n * YOCTO_PER_NEAR],
      ["donor5", 5n * YOCTO_PER_NEAR], ["donor6", 5n * YOCTO_PER_NEAR],
    ]);
    const campaign = await deployCampaign(worker, accounts);
    const commits = await commitStandard(campaign.contract, accounts, true);
    await fastForwardUntil(worker, campaign.activateAfterMs + 1);
    const activation = assertSucceeded(
      await accounts.donor6.callRaw(
        campaign.contract,
        "activate",
        {
          allocations: [
            { pledge_index: 0, project_id: "a" },
            { pledge_index: 1, project_id: "a" },
            { pledge_index: 2, project_id: "b" },
            { pledge_index: 3, project_id: "c" },
            { pledge_index: 4, project_id: "d" },
            { pledge_index: 5, project_id: "d" },
          ],
        },
        { gas: GAS },
      ),
      "activate A+B+C+D",
    );
    const activated = await status(campaign.contract);
    const activatedAccounting = await assertAccounting(campaign.contract, "activated A+B+C+D");
    assert.deepEqual(activated.funded_project_ids, ["a", "b", "c", "d"]);
    assert.equal(activated.liabilities, 13n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.a), 4n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.b), 3n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.c), 3n * YOCTO_PER_NEAR);
    assert.equal(await claimable(campaign.contract, accounts.d), 3n * YOCTO_PER_NEAR);
    const withdrawals = [];
    for (const [name, amount] of [["a", 4n], ["b", 3n], ["c", 3n], ["d", 3n]]) {
      await withdrawAndMeasure(campaign.contract, accounts[name], amount * YOCTO_PER_NEAR, withdrawals);
    }
    const finalStatus = await status(campaign.contract);
    assert.equal(finalStatus.liabilities, 0n);
    const finalAccounting = await assertAccounting(campaign.contract, "settled A+B+C+D");
    return {
      name: "all-four coalition after sixth donor topup",
      contract: campaign.contract.accountId,
      wasmCodeHash: hashContract(await campaign.contract.viewCode()),
      receipts: { ...campaign.receipts, commits, activation: receiptHash(activation) },
      finalStatus,
      accounting: { activated: activatedAccounting, settled: finalAccounting },
      withdrawals,
      finalContractBalance: await balance(campaign.contract),
    };
  } finally {
    await worker.tearDown();
  }
}

async function scenarioExpiryRefunds() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["a", 2n * YOCTO_PER_NEAR], ["b", 2n * YOCTO_PER_NEAR],
      ["c", 2n * YOCTO_PER_NEAR], ["d", 2n * YOCTO_PER_NEAR],
      ["donor1", 5n * YOCTO_PER_NEAR], ["donor2", 5n * YOCTO_PER_NEAR],
      ["donor3", 5n * YOCTO_PER_NEAR], ["donor4", 5n * YOCTO_PER_NEAR], ["donor5", 5n * YOCTO_PER_NEAR],
    ]);
    const campaign = await deployCampaign(worker, accounts);
    const commits = await commitStandard(campaign.contract, accounts);
    await fastForwardUntil(worker, campaign.deadlineMs + 1);
    const expiry = assertSucceeded(
      await accounts.d.callRaw(campaign.contract, "expire", {}, { gas: GAS }),
      "expire",
    );
    const expired = await status(campaign.contract);
    const expiredAccounting = await assertAccounting(campaign.contract, "expired campaign");
    assert.equal(expired.phase, "EXPIRED");
    assert.equal(expired.liabilities, 12n * YOCTO_PER_NEAR);
    for (const [name, amount] of [["donor1", 3n], ["donor2", 1n], ["donor3", 3n], ["donor4", 3n], ["donor5", 2n]]) {
      assert.equal(await claimable(campaign.contract, accounts[name]), amount * YOCTO_PER_NEAR);
    }
    const withdrawals = [];
    for (const [name, amount] of [["donor1", 3n], ["donor2", 1n], ["donor3", 3n], ["donor4", 3n], ["donor5", 2n]]) {
      await withdrawAndMeasure(campaign.contract, accounts[name], amount * YOCTO_PER_NEAR, withdrawals);
    }
    const finalStatus = await status(campaign.contract);
    assert.equal(finalStatus.liabilities, 0n);
    const finalAccounting = await assertAccounting(campaign.contract, "settled expired campaign");
    return {
      name: "expired campaign refunds every contributor",
      contract: campaign.contract.accountId,
      wasmCodeHash: hashContract(await campaign.contract.viewCode()),
      receipts: { ...campaign.receipts, commits, expiry: receiptHash(expiry) },
      finalStatus,
      accounting: { expired: expiredAccounting, settled: finalAccounting },
      withdrawals,
      finalContractBalance: await balance(campaign.contract),
    };
  } finally {
    await worker.tearDown();
  }
}

async function deploySingleProjectCampaign(worker, beneficiary, options = {}) {
  const startedAt = await blockTimestampMs(worker);
  const activateAfterMs = startedAt + (options.activateAfterMs ?? 30_000);
  const deadlineMs = startedAt + (options.deadlineDurationMs ?? 120_000);
  const contract = await worker.rootAccount.devCreateAccount({ initialBalance: 20n * YOCTO_PER_NEAR });
  const deployResult = assertSucceeded(await contract.deploy(WASM_PATH), "single-project deploy");
  const initResult = assertSucceeded(
    await contract.callRaw(
      contract,
      "new",
      {
        projects: [{
          id: "commitment",
          beneficiary: beneficiary.accountId,
          required: (options.required ?? 3n * YOCTO_PER_NEAR).toString(),
          dependencies: [],
        }],
        deadline_ms: deadlineMs,
        activate_after_ms: activateAfterMs,
        min_funded_projects: 1,
        required_for_activation: ["commitment"],
        activation_authorities: options.activationAuthorities ?? [beneficiary.accountId],
      },
      { gas: GAS },
    ),
    "single-project new",
  );
  const sponsorResult = assertSucceeded(
    await worker.rootAccount.callRaw(
      contract,
      "sponsor_storage",
      {},
      { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
    ),
    "single-project sponsor_storage",
  );
  const config = await contract.view("campaign_config", {});
  assert.equal(config.projects[0].id, "commitment");
  assert.equal(config.projects[0].beneficiary, beneficiary.accountId);
  assert.equal(config.projects[0].required, (options.required ?? 3n * YOCTO_PER_NEAR).toString());
  assert.equal(config.deadline_ms, deadlineMs);
  assert.equal(config.activate_after_ms, activateAfterMs);
  assert.deepEqual(await contract.view("pledge_records", {}), []);
  return {
    contract,
    activateAfterMs,
    deadlineMs,
    config,
    receipts: {
      deploy: receiptHash(deployResult),
      initialize: receiptHash(initResult),
      sponsorStorage: receiptHash(sponsorResult),
    },
  };
}

async function scenarioConcurrentActivationAndWithdrawals() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["beneficiary", 2n * YOCTO_PER_NEAR],
      ["donor1", 5n * YOCTO_PER_NEAR],
      ["donor2", 5n * YOCTO_PER_NEAR],
      ["activator1", 2n * YOCTO_PER_NEAR],
      ["activator2", 2n * YOCTO_PER_NEAR],
    ]);
    const campaign = await deploySingleProjectCampaign(worker, accounts.beneficiary, {
      deadlineDurationMs: 600_000,
      activationAuthorities: [accounts.activator1.accountId, accounts.activator2.accountId],
    });
    const deposits = await Promise.all([
      accounts.donor1.callRaw(
        campaign.contract,
        "commit",
        { allowed: ["commitment"], requires: [] },
        { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
      ),
      accounts.donor2.callRaw(
        campaign.contract,
        "commit",
        { allowed: ["commitment"], requires: [] },
        { gas: GAS, attachedDeposit: 2n * YOCTO_PER_NEAR },
      ),
    ]);
    deposits.forEach((result, index) => assertSucceeded(result, `concurrent deposit ${index}`));
    const pledgeRecords = await campaign.contract.view("pledge_records", {});
    assert.deepEqual(pledgeRecords.map((record) => record.index), [0, 1]);
    assert.equal(new Set(pledgeRecords.map((record) => record.owner)).size, 2);
    assert.deepEqual(pledgeRecords.map((record) => record.allowed), [["commitment"], ["commitment"]]);
    const openAccounting = await assertAccounting(campaign.contract, "concurrent deposits");
    assert.equal(openAccounting.locked_pledges, 3n * YOCTO_PER_NEAR);

    await fastForwardUntil(worker, campaign.activateAfterMs + 1);
    const allocations = [
      { pledge_index: 0, project_id: "commitment" },
      { pledge_index: 1, project_id: "commitment" },
    ];
    const unauthorizedActivation = await expectFailure(
      accounts.donor1,
      campaign.contract,
      "activate",
      { allocations },
      "unauthorized activation",
    );
    const competing = await Promise.all([
      accounts.activator1.callRaw(campaign.contract, "activate", { allocations }, { gas: GAS }),
      accounts.activator2.callRaw(campaign.contract, "activate", { allocations }, { gas: GAS }),
    ]);
    assert.equal(competing.filter((result) => !result.failed).length, 1, "exactly one activation must win");
    assert.equal(competing.filter((result) => result.failed).length, 1, "competing activation must fail");
    const activated = await status(campaign.contract);
    assert.equal(activated.phase, "ACTIVATED");
    const activatedAccounting = await assertAccounting(campaign.contract, "competing activation");
    assert.equal(await claimable(campaign.contract, accounts.beneficiary), 3n * YOCTO_PER_NEAR);

    const firstWithdrawal = assertSucceeded(
      await accounts.beneficiary.callRaw(campaign.contract, "withdraw", {}, { gas: GAS }),
      "first withdrawal",
    );
    const repeatedWithdrawal = await expectFailure(
      accounts.beneficiary,
      campaign.contract,
      "withdraw",
      {},
      "repeated withdrawal",
    );
    assert.equal(await claimable(campaign.contract, accounts.beneficiary), 0n);
    assert.equal(await pendingWithdrawal(campaign.contract, accounts.beneficiary), 0n);
    const unauthorizedCallback = await expectFailure(
      accounts.beneficiary,
      campaign.contract,
      "on_withdraw_result",
      { owner: accounts.beneficiary.accountId, amount: (3n * YOCTO_PER_NEAR).toString() },
      "unauthorized duplicate callback",
    );
    const settledAccounting = await assertAccounting(campaign.contract, "repeated withdrawal settlement");
    assert.equal(settledAccounting.liabilities, 0n);
    return {
      name: "concurrent deposits, competing activation, repeated withdrawal, and callback guard",
      contract: campaign.contract.accountId,
      wasmCodeHash: hashContract(await campaign.contract.viewCode()),
      receipts: {
        ...campaign.receipts,
        deposits: deposits.map((result) => receiptHash(result)),
        activations: competing.map((result) => ({ hash: receiptHash(result), failed: result.failed })),
        unauthorizedActivation,
        withdrawals: [
          { hash: receiptHash(firstWithdrawal), failed: firstWithdrawal.failed },
          repeatedWithdrawal,
        ],
        unauthorizedCallback,
      },
      accounting: { open: openAccounting, activated: activatedAccounting, settled: settledAccounting },
      finalStatus: await status(campaign.contract),
      finalContractBalance: await balance(campaign.contract),
    };
  } finally {
    await worker.tearDown();
  }
}

async function scenarioMaximumCapacityAndStorage() {
  const worker = await Worker.init({ rm: true });
  try {
    const beneficiarySpecs = Array.from({ length: 8 }, (_, index) => [`max-p${index}`, 3n * YOCTO_PER_NEAR]);
    const donorSpecs = Array.from({ length: 32 }, (_, index) => [`max-d${index}`, 3n * YOCTO_PER_NEAR]);
    const accounts = await createAccounts(worker, [
      ["max-observer", 3n * YOCTO_PER_NEAR],
      ...beneficiarySpecs,
      ...donorSpecs,
    ]);
    const startedAt = await blockTimestampMs(worker);
    // Thirty-two real sandbox transactions can take longer than the normal
    // demo window. Keep the boundary meaningful while ensuring the harness
    // does not race its own serial deposit setup.
    const activateAfterMs = startedAt + 300_000;
    const deadlineMs = startedAt + 900_000;
    const projects = Array.from({ length: 8 }, (_, index) => ({
      id: `p${index}`,
      beneficiary: accounts[`max-p${index}`].accountId,
      required: YOCTO_PER_NEAR.toString(),
      dependencies: [],
    }));
    const requiredForActivation = projects.map((project) => project.id);
    const contract = await worker.rootAccount.devCreateAccount({ initialBalance: 30n * YOCTO_PER_NEAR });
    const deploy = assertSucceeded(await contract.deploy(WASM_PATH), "maximum-capacity deploy");
    const initialize = assertSucceeded(
      await contract.callRaw(
        contract,
        "new",
        {
          projects,
          deadline_ms: deadlineMs,
          activate_after_ms: activateAfterMs,
          min_funded_projects: 8,
          required_for_activation: requiredForActivation,
          activation_authorities: [accounts["max-observer"].accountId],
        },
        { gas: GAS },
      ),
      "maximum-capacity new",
    );
    const sponsorStorage = assertSucceeded(
      await worker.rootAccount.callRaw(
        contract,
        "sponsor_storage",
        {},
        { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
      ),
      "maximum-capacity sponsor_storage",
    );

    const commitReceipts = [];
    for (let index = 0; index < 32; index += 1) {
      const result = assertSucceeded(
        await accounts[`max-d${index}`].callRaw(
          contract,
          "commit",
          { allowed: [`p${index % 8}`], requires: [] },
          { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
        ),
        `maximum-capacity commit ${index}`,
      );
      commitReceipts.push(receiptHash(result));
    }
    const pledgeRecords = await contract.view("pledge_records", {});
    assert.equal(pledgeRecords.length, 32);
    assert.deepEqual(pledgeRecords.map((record) => record.index), Array.from({ length: 32 }, (_, index) => index));
    assert.equal(new Set(pledgeRecords.map((record) => record.owner)).size, 32);
    const open = await assertAccounting(contract, "maximum capacity open");
    assert.equal(open.locked_pledges, 32n * YOCTO_PER_NEAR);
    assert.equal(open.credits, 0n);
    assert(open.storage_reserve > 200_000_000_000_000_000_000_000n, "storage reserve should include measured state cost");

    await fastForwardUntil(worker, activateAfterMs + 1);
    const activation = assertSucceeded(
      await accounts["max-observer"].callRaw(
        contract,
        "activate",
        {
          allocations: Array.from({ length: 8 }, (_, index) => ({
            pledge_index: index,
            project_id: `p${index}`,
          })),
        },
        { gas: GAS },
      ),
      "maximum-capacity activate",
    );
    const activated = await assertAccounting(contract, "maximum capacity activated");
    assert.equal(activated.locked_pledges, 0n);
    assert.equal(activated.credits, 32n * YOCTO_PER_NEAR);
    assert.equal(activated.accounted, 32n * YOCTO_PER_NEAR);
    assert.equal(activated.liabilities, 32n * YOCTO_PER_NEAR);

    const withdrawals = [];
    for (let index = 8; index < 32; index += 1) {
      await withdrawAndMeasure(contract, accounts[`max-d${index}`], YOCTO_PER_NEAR, withdrawals);
    }
    for (let index = 0; index < 8; index += 1) {
      await withdrawAndMeasure(contract, accounts[`max-p${index}`], YOCTO_PER_NEAR, withdrawals);
    }
    const settled = await assertAccounting(contract, "maximum capacity settled");
    assert.equal(settled.liabilities, 0n);
    const repeated = await expectFailure(
      accounts["max-d8"],
      contract,
      "withdraw",
      {},
      "maximum-capacity repeated withdrawal",
    );
    return {
      name: "maximum 8-project / 32-pledge campaign with storage reconciliation",
      contract: contract.accountId,
      wasmCodeHash: hashContract(await contract.viewCode()),
      receipts: {
        deploy: receiptHash(deploy),
        initialize: receiptHash(initialize),
        sponsorStorage: receiptHash(sponsorStorage),
        commits: commitReceipts,
        activation: receiptHash(activation),
        repeated,
      },
      accounting: { open, activated, settled },
      withdrawals,
      finalStatus: await status(contract),
      finalContractBalance: await balance(contract),
    };
  } finally {
    await worker.tearDown();
  }
}

function daoFunctionCallKind(receiverId, methodName, args, deposit = 0n, gas = 150n * 10n ** 12n) {
  return {
    FunctionCall: {
      receiver_id: receiverId,
      actions: [{
        method_name: methodName,
        args: Buffer.from(JSON.stringify(jsonValue(args))).toString("base64"),
        deposit: deposit.toString(),
        gas: gas.toString(),
      }],
    },
  };
}

async function deploySputnikDao(worker, council1, council2) {
  const dao = await worker.rootAccount.devCreateAccount({ initialBalance: 30n * YOCTO_PER_NEAR });
  const deploy = assertSucceeded(await dao.deploy(SPUTNIK_WASM_PATH), "Sputnik DAO deploy");
  const initialize = assertSucceeded(
    await dao.callRaw(
      dao,
      "new",
      {
        config: {
          name: "PACT Sandbox DAO",
          purpose: "Authorize sandbox-only PACT commitment funding",
          metadata: "",
        },
        policy: [council1.accountId, council2.accountId],
      },
      { gas: GAS },
    ),
    "Sputnik DAO new",
  );
  return {
    dao,
    receipts: { deploy: receiptHash(deploy), initialize: receiptHash(initialize) },
    codeSha256: createHash("sha256").update(await fs.readFile(SPUTNIK_WASM_PATH)).digest("hex"),
  };
}

async function addDaoProposal(dao, proposer, id, description, kind) {
  const result = assertSucceeded(
    await proposer.callRaw(
      dao,
      "add_proposal",
      { proposal: { description, kind } },
      { gas: GAS, attachedDeposit: YOCTO_PER_NEAR },
    ),
    `DAO add proposal ${id}`,
  );
  assert.equal(Number(result.parseResult()), id, `DAO proposal id ${id} was not returned`);
  const stored = await dao.view("get_proposal", { id });
  assert.equal(stored.status, "InProgress", `DAO proposal ${id} should begin unapproved`);
  return { id, kind, addReceipt: receiptHash(result), initialStatus: stored.status };
}

async function approveDaoProposal(dao, proposal, council1, council2) {
  const args = (council) => ({
    id: proposal.id,
    action: "VoteApprove",
    proposal: proposal.kind,
    memo: null,
  });
  const first = assertSucceeded(
    await council1.callRaw(dao, "act_proposal", args(council1), { gas: GAS }),
    `DAO council1 approval ${proposal.id}`,
  );
  const afterFirst = await dao.view("get_proposal", { id: proposal.id });
  assert.equal(afterFirst.status, "InProgress", `DAO proposal ${proposal.id} executed before quorum`);
  const second = assertSucceeded(
    await council2.callRaw(dao, "act_proposal", args(council2), { gas: GAS }),
    `DAO council2 approval ${proposal.id}`,
  );
  const afterSecond = await dao.view("get_proposal", { id: proposal.id });
  assert.equal(afterSecond.status, "Approved", `DAO proposal ${proposal.id} was not approved`);
  return {
    receipts: { first: receiptHash(first), second: receiptHash(second) },
    statusAfterFirst: afterFirst.status,
    statusAfterSecond: afterSecond.status,
  };
}

async function scenarioSputnikDaoFundingAndRefunds() {
  const worker = await Worker.init({ rm: true });
  try {
    const accounts = await createAccounts(worker, [
      ["council1", 8n * YOCTO_PER_NEAR],
      ["council2", 8n * YOCTO_PER_NEAR],
      ["attacker", 5n * YOCTO_PER_NEAR],
      ["beneficiary", 2n * YOCTO_PER_NEAR],
      ["refund-beneficiary", 2n * YOCTO_PER_NEAR],
      ["observer", 2n * YOCTO_PER_NEAR],
    ]);
    const daoDeployment = await deploySputnikDao(worker, accounts.council1, accounts.council2);
    const fundedCampaign = await deploySingleProjectCampaign(worker, accounts.beneficiary, {
      required: YOCTO_PER_NEAR,
      activateAfterMs: 120_000,
      deadlineDurationMs: 600_000,
      activationAuthorities: [accounts.observer.accountId],
    });
    const fundKind = daoFunctionCallKind(
      fundedCampaign.contract.accountId,
      "commit",
      { allowed: ["commitment"], requires: [] },
      YOCTO_PER_NEAR,
    );
    const fundProposal = await addDaoProposal(
      daoDeployment.dao,
      accounts.council1,
      0,
      "Fund a PACT commitment after two-council approval",
      fundKind,
    );
    const unauthorizedFunding = await expectFailure(
      accounts.attacker,
      daoDeployment.dao,
      "act_proposal",
      { id: 0, action: "VoteApprove", proposal: fundKind, memo: null },
      "non-council DAO approval",
    );
    const beforeFunding = await status(fundedCampaign.contract);
    assert.equal(beforeFunding.liabilities, 0n);
    const fundApproval = await approveDaoProposal(
      daoDeployment.dao,
      fundProposal,
      accounts.council1,
      accounts.council2,
    );
    const fundedStatus = await status(fundedCampaign.contract);
    assert.equal(fundedStatus.pledge_count, 1);
    assert.equal(fundedStatus.liabilities, YOCTO_PER_NEAR);
    const fundedAccounting = await assertAccounting(fundedCampaign.contract, "DAO-funded commitment");

    const unapprovedKind = daoFunctionCallKind(
      fundedCampaign.contract.accountId,
      "commit",
      { allowed: ["commitment"], requires: [] },
      YOCTO_PER_NEAR,
    );
    const unapprovedProposal = await addDaoProposal(
      daoDeployment.dao,
      accounts.attacker,
      1,
      "Unapproved funding attempt must remain inert",
      unapprovedKind,
    );
    const stillUnfunded = await status(fundedCampaign.contract);
    assert.equal(stillUnfunded.pledge_count, 1);
    assert.equal(stillUnfunded.liabilities, YOCTO_PER_NEAR);
    const unapprovedState = await daoDeployment.dao.view("get_proposal", { id: 1 });
    assert.equal(unapprovedState.status, "InProgress");

    await fastForwardUntil(worker, fundedCampaign.activateAfterMs + 1);
    const activation = assertSucceeded(
      await accounts.observer.callRaw(
        fundedCampaign.contract,
        "activate",
        { allocations: [{ pledge_index: 0, project_id: "commitment" }] },
        { gas: GAS },
      ),
      "activate DAO-funded commitment",
    );
    const activated = await status(fundedCampaign.contract);
    assert.equal(activated.phase, "ACTIVATED");
    assert.equal(await claimable(fundedCampaign.contract, accounts.beneficiary), YOCTO_PER_NEAR);
    const activatedAccounting = await assertAccounting(fundedCampaign.contract, "activated DAO-funded commitment");
    const beneficiaryWithdrawal = assertSucceeded(
      await accounts.beneficiary.callRaw(fundedCampaign.contract, "withdraw", {}, { gas: GAS }),
      "withdraw DAO-funded commitment",
    );
    const settledFundingAccounting = await assertAccounting(fundedCampaign.contract, "settled DAO-funded commitment");
    assert.equal(settledFundingAccounting.liabilities, 0n);

    const refundCampaign = await deploySingleProjectCampaign(worker, accounts["refund-beneficiary"], {
      required: 2n * YOCTO_PER_NEAR,
      activateAfterMs: 120_000,
      deadlineDurationMs: 600_000,
      activationAuthorities: [accounts.observer.accountId],
    });
    const refundKind = daoFunctionCallKind(
      refundCampaign.contract.accountId,
      "commit",
      { allowed: ["commitment"], requires: [] },
      YOCTO_PER_NEAR,
    );
    const refundProposal = await addDaoProposal(
      daoDeployment.dao,
      accounts.council1,
      2,
      "Fund an intentionally underfunded PACT commitment for expiry/refund",
      refundKind,
    );
    const refundApproval = await approveDaoProposal(
      daoDeployment.dao,
      refundProposal,
      accounts.council1,
      accounts.council2,
    );
    assert.equal((await status(refundCampaign.contract)).liabilities, YOCTO_PER_NEAR);
    await fastForwardUntil(worker, refundCampaign.deadlineMs + 1);
    const expiry = assertSucceeded(
      await accounts.observer.callRaw(refundCampaign.contract, "expire", {}, { gas: GAS }),
      "expire DAO-owned commitment",
    );
    const expired = await status(refundCampaign.contract);
    assert.equal(expired.phase, "EXPIRED");
    assert.equal(await claimable(refundCampaign.contract, daoDeployment.dao), YOCTO_PER_NEAR);
    const expiredAccounting = await assertAccounting(refundCampaign.contract, "expired DAO-owned commitment");
    const daoBeforeRefund = await balance(daoDeployment.dao);
    const withdrawKind = daoFunctionCallKind(refundCampaign.contract.accountId, "withdraw", {}, 0n);
    const withdrawProposal = await addDaoProposal(
      daoDeployment.dao,
      accounts.council1,
      3,
      "Withdraw the expired PACT commitment refund to the DAO",
      withdrawKind,
    );
    const withdrawApproval = await approveDaoProposal(
      daoDeployment.dao,
      withdrawProposal,
      accounts.council1,
      accounts.council2,
    );
    const refundSettled = await assertAccounting(refundCampaign.contract, "settled DAO refund");
    assert.equal(refundSettled.liabilities, 0n);
    assert.equal(await claimable(refundCampaign.contract, daoDeployment.dao), 0n);
    assert.equal(await pendingWithdrawal(refundCampaign.contract, daoDeployment.dao), 0n);
    const daoAfterRefund = await balance(daoDeployment.dao);
    assert(
      BigInt(daoAfterRefund.total) > BigInt(daoBeforeRefund.total),
      "DAO balance did not increase after its approved refund withdrawal",
    );
    return {
      name: "real Sputnik DAO proposal quorum funds PACT and recovers expired DAO-owned funds",
      dao: daoDeployment.dao.accountId,
      sputnikWasmSha256: daoDeployment.codeSha256,
      contracts: { funded: fundedCampaign.contract.accountId, refund: refundCampaign.contract.accountId },
      receipts: {
        dao: daoDeployment.receipts,
        unauthorizedFunding,
        fundProposal: { add: fundProposal.addReceipt, ...fundApproval },
        unapprovedProposal: { add: unapprovedProposal.addReceipt },
        activation: receiptHash(activation),
        beneficiaryWithdrawal: receiptHash(beneficiaryWithdrawal),
        refundProposal: { add: refundProposal.addReceipt, ...refundApproval },
        expiry: receiptHash(expiry),
        withdrawProposal: { add: withdrawProposal.addReceipt, ...withdrawApproval },
      },
      accounting: {
        funded: fundedAccounting,
        activated: activatedAccounting,
        fundedSettled: settledFundingAccounting,
        expired: expiredAccounting,
        refundSettled,
      },
      balances: { daoBeforeRefund, daoAfterRefund },
      finalStatuses: { funded: await status(fundedCampaign.contract), refund: await status(refundCampaign.contract) },
    };
  } finally {
    await worker.tearDown();
  }
}

async function main() {
  const sandboxBinaryPath = await prepareSandboxBinary();
  await fs.access(WASM_PATH);
  await fs.access(SPUTNIK_WASM_PATH);
  const selectedScenarios = new Set(
    (process.env.PACT_SCENARIOS ?? "cycle,all-four,expiry,concurrent,sputnik")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const evidence = {
    type: "PACT-LOCAL-SANDBOX-EVIDENCE",
    version: 2,
    network: "NEAR-SANDBOX",
    generatedAt: new Date().toISOString(),
    sandboxVersion: SANDBOX_VERSION,
    sandboxBinaryPath,
    wasmPath: WASM_PATH,
    sputnikWasmPath: SPUTNIK_WASM_PATH,
    selectedScenarios: [...selectedScenarios],
    scenarios: [],
    limitations: [
      "No mainnet or testnet calls are made by this runner.",
      "Native-transfer failure injection is not safely reachable through an ordinary authenticated sandbox transaction while preserving the predecessor account. The callback failure branch is tested with an explicit NEAR VM PromiseResult::Failed unit test; missing callback execution remains unresolved and blocks production use.",
      "Exact timestamp equality at the activation/deadline boundaries is not directly controllable through near-workspaces fast-forward; the campaign tests cross each boundary and verify the strict/open and inclusive/expiry predicates around it.",
      "Duplicate callback execution is tested as a private-method guard and in the Rust VM; a forged callback cannot be submitted by an external signer. A callback that never executes remains an unresolved operational recovery risk.",
      "The RC1 maximum-capacity campaign is a genuine sandbox run. It exercises all 8 project slots, all 32 pledge slots, measured storage reserve, activation, 32 credits, 32 successful withdrawals, and a repeated withdrawal failure. It does not prove behavior on testnet or mainnet.",
    ],
  };
  if (selectedScenarios.has("cycle")) evidence.scenarios.push(await scenarioCycleAndInvalidPlans());
  if (selectedScenarios.has("deployment")) evidence.scenarios.push(await scenarioAtomicCampaignDeployment());
  if (selectedScenarios.has("all-four")) evidence.scenarios.push(await scenarioAllFourWithTopup());
  if (selectedScenarios.has("expiry")) evidence.scenarios.push(await scenarioExpiryRefunds());
  if (selectedScenarios.has("concurrent")) evidence.scenarios.push(await scenarioConcurrentActivationAndWithdrawals());
  if (selectedScenarios.has("max-capacity")) evidence.scenarios.push(await scenarioMaximumCapacityAndStorage());
  if (selectedScenarios.has("sputnik")) evidence.scenarios.push(await scenarioSputnikDaoFundingAndRefunds());
  evidence.wasmSha256 = createHash("sha256").update(await fs.readFile(WASM_PATH)).digest("hex");
  evidence.sputnikWasmSha256 = createHash("sha256").update(await fs.readFile(SPUTNIK_WASM_PATH)).digest("hex");
  await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
  await fs.writeFile(EVIDENCE_PATH, `${JSON.stringify(jsonValue(evidence), null, 2)}\n`);
  console.log(JSON.stringify(jsonValue(evidence), null, 2));
  console.log(`Evidence written to ${EVIDENCE_PATH}`);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
