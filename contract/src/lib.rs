//! PACT Atlas experimental contract, one immutable campaign per deployed account.
//! NOT AUDITED. Do not deploy with valuable funds.
//!
//! The off-chain solver proposes an allocation. The contract independently checks
//! deposits, no double-use, exact project funding, and all dependency conditions.
//! The campaign is configured at initialization and cannot be modified later.

use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise};
use std::collections::{BTreeMap, BTreeSet};

const MAX_PROJECTS: usize = 8;
const MAX_PLEDGES: usize = 32;
const MIN_PLEDGE_YOCTO: u128 = 1_000_000_000_000_000_000_000; // 0.001 NEAR
                                                              // Additional buffer above observed storage stake. Deployment must sponsor storage.
const STORAGE_BUFFER: u128 = 200_000_000_000_000_000_000_000; // 0.2 NEAR
const CALLBACK_TGAS: u64 = 40;

#[near(serializers = [json])]
#[derive(Clone)]
pub struct ProjectInput {
    pub id: String,
    pub beneficiary: AccountId,
    pub required: U128,
    pub dependencies: Vec<String>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Project {
    pub id: String,
    pub beneficiary: AccountId,
    pub required: u128,
    pub dependencies: Vec<String>,
}

/// Immutable project facts exposed for independent campaign-link verification.
/// Project names intentionally remain off-chain presentation metadata; funding
/// decisions are bound to these identifiers, beneficiaries, requirements and
/// dependencies.
#[near(serializers = [json])]
#[derive(Clone)]
pub struct ProjectView {
    pub id: String,
    pub beneficiary: AccountId,
    pub required: U128,
    pub dependencies: Vec<String>,
}

#[near(serializers = [json])]
pub struct CampaignConfig {
    pub projects: Vec<ProjectView>,
    pub deadline_ms: u64,
    pub activate_after_ms: u64,
    pub min_funded_projects: u32,
    pub required_for_activation: Vec<String>,
    pub activation_authorities: Vec<AccountId>,
}

/// Canonical on-chain pledge records. The vector order is the contract's
/// allocation index order and is part of the public certificate input.
#[near(serializers = [json])]
#[derive(Clone)]
pub struct PledgeView {
    pub index: u32,
    pub owner: AccountId,
    pub amount: U128,
    pub allowed: Vec<String>,
    pub requires: Vec<String>,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub struct Pledge {
    pub owner: AccountId,
    pub amount: u128,
    pub allowed: Vec<String>,
    pub requires: Vec<String>,
}

#[near(serializers = [json])]
#[derive(Clone)]
pub struct Allocation {
    pub pledge_index: u32,
    pub project_id: String,
}

#[near(serializers = [json])]
pub struct Status {
    pub phase: String,
    pub deadline_ms: u64,
    pub activate_after_ms: u64,
    pub min_funded_projects: u32,
    pub activation_authorities: Vec<AccountId>,
    pub pledge_count: u32,
    pub liabilities: U128,
    pub project_ids: Vec<String>,
    pub required_for_activation: Vec<String>,
    pub funded_project_ids: Vec<String>,
}

/// Machine-readable conservation evidence. `locked_pledges` is non-zero only
/// while the campaign is OPEN; after activation or expiry the same liability
/// is represented by `credits` and/or `pending` withdrawals.
#[near(serializers = [json])]
pub struct Accounting {
    pub phase: String,
    pub locked_pledges: U128,
    pub credits: U128,
    pub pending: U128,
    pub accounted: U128,
    pub liabilities: U128,
    pub contract_balance: U128,
    pub storage_reserve: U128,
    pub solvent: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct PactAtlas {
    projects: Vec<Project>,
    pledges: Vec<Pledge>,
    deadline_ms: u64,
    activate_after_ms: u64,
    min_funded_projects: u32,
    activation_authorities: Vec<AccountId>,
    required_for_activation: Vec<String>,
    // Immutable record of the accepted certificate for auditability.
    activated_allocations: Vec<(u32, String)>,
    funded_project_ids: Vec<String>,
    // 0 = OPEN, 1 = ACTIVATED, 2 = EXPIRED
    phase: u8,
    // Pull payments: unclaimed balances for project beneficiaries / contributors.
    credits: BTreeMap<AccountId, u128>,
    // In-flight withdrawals. Amounts remain counted in `liabilities`.
    pending: BTreeMap<AccountId, u128>,
    // Sum of unspent contributions (including queued and in-flight withdrawals).
    liabilities: u128,
}

#[near]
impl PactAtlas {
    #[init]
    pub fn new(
        #[serializer(json)] projects: Vec<ProjectInput>,
        #[serializer(json)] deadline_ms: u64,
        #[serializer(json)] activate_after_ms: u64,
        #[serializer(json)] min_funded_projects: u32,
        #[serializer(json)] required_for_activation: Vec<String>,
        #[serializer(json)] activation_authorities: Vec<AccountId>,
    ) -> Self {
        // Initialization must be signed by the contract account itself or by
        // the account that owns its direct subaccount. NEAR executes a
        // CreateAccount + DeployContract + FunctionCall sequence with the
        // parent as predecessor, so accepting only the contract account would
        // make the safe self-service deployment request impossible. The
        // direct-parent check remains bound to the namespace owner and cannot
        // be satisfied by an unrelated front-runner.
        require!(
            initialization_is_authorized(),
            "initialization must be authorized by contract account or its parent owner"
        );
        require!(
            !projects.is_empty() && projects.len() <= MAX_PROJECTS,
            "invalid project count"
        );
        require!(
            deadline_ms > env::block_timestamp_ms(),
            "deadline must be future"
        );
        require!(
            activate_after_ms > env::block_timestamp_ms() && activate_after_ms < deadline_ms,
            "invalid activation window"
        );
        require!(
            min_funded_projects > 0 && min_funded_projects as usize <= projects.len(),
            "invalid minimum projects"
        );
        require!(
            !activation_authorities.is_empty()
                && activation_authorities.len() <= MAX_PROJECTS
                && activation_authorities.iter().collect::<BTreeSet<_>>().len()
                    == activation_authorities.len(),
            "invalid activation authorities"
        );
        let ids: BTreeSet<_> = projects.iter().map(|p| p.id.as_str()).collect();
        require!(ids.len() == projects.len(), "duplicate project id");
        require!(
            required_for_activation.len() <= projects.len(),
            "too many required projects"
        );
        require!(
            required_for_activation
                .iter()
                .collect::<BTreeSet<_>>()
                .len()
                == required_for_activation.len(),
            "duplicate activation requirement"
        );
        require!(
            required_for_activation
                .iter()
                .all(|id| ids.contains(id.as_str())),
            "unknown activation requirement"
        );
        for p in &projects {
            require!(!p.id.is_empty() && p.id.len() <= 40, "bad project id");
            require!(p.required.0 >= MIN_PLEDGE_YOCTO, "project amount too small");
            require!(
                p.dependencies.len() <= MAX_PROJECTS,
                "too many dependencies"
            );
            let ds: BTreeSet<_> = p.dependencies.iter().collect();
            require!(ds.len() == p.dependencies.len(), "repeated dependency");
            for dep in &p.dependencies {
                require!(
                    ids.contains(dep.as_str()) && dep != &p.id,
                    "invalid dependency"
                );
            }
        }
        Self {
            projects: projects
                .into_iter()
                .map(|p| Project {
                    id: p.id,
                    beneficiary: p.beneficiary,
                    required: p.required.0,
                    dependencies: p.dependencies,
                })
                .collect(),
            pledges: Vec::new(),
            deadline_ms,
            activate_after_ms,
            min_funded_projects,
            activation_authorities,
            required_for_activation,
            activated_allocations: Vec::new(),
            funded_project_ids: Vec::new(),
            phase: 0,
            credits: BTreeMap::new(),
            pending: BTreeMap::new(),
            liabilities: 0,
        }
    }

    /// Sponsor storage with an ordinary NEAR transfer to the contract account.
    /// Do NOT attach storage sponsorship to the `commit` method: that deposit
    /// represents a participant's fully refundable funding liability.
    #[payable]
    pub fn sponsor_storage(&mut self) {
        require!(env::attached_deposit().as_yoctonear() > 0, "no deposit");
    }

    /// Deposits are real attached native NEAR. Contributions cannot be altered
    /// once accepted; the `activate` verifier can choose one allowed project.
    #[payable]
    pub fn commit(
        &mut self,
        #[serializer(json)] allowed: Vec<String>,
        #[serializer(json)] requires: Vec<String>,
    ) -> u32 {
        // Freeze deposits before anyone can activate. No contributor can be
        // surprised by a valid plan foreclosing the rest of the funding period.
        require!(
            self.phase == 0 && env::block_timestamp_ms() < self.activate_after_ms,
            "funding window closed"
        );
        require!(self.pledges.len() < MAX_PLEDGES, "pledge limit reached");
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount >= MIN_PLEDGE_YOCTO, "pledge too small");
        require!(!allowed.is_empty(), "no allowed project");
        require!(
            allowed.len() <= self.projects.len() && requires.len() <= self.projects.len(),
            "too many constraints"
        );
        require!(
            allowed
                .iter()
                .all(|id| self.projects.iter().any(|p| &p.id == id))
                && requires
                    .iter()
                    .all(|id| self.projects.iter().any(|p| &p.id == id)),
            "unknown project"
        );
        require!(
            allowed.iter().collect::<BTreeSet<_>>().len() == allowed.len(),
            "duplicate allowed project"
        );
        require!(
            requires.iter().collect::<BTreeSet<_>>().len() == requires.len(),
            "duplicate required project"
        );
        let index = self.pledges.len() as u32;
        self.pledges.push(Pledge {
            owner: env::predecessor_account_id(),
            amount,
            allowed,
            requires,
        });
        self.liabilities = self.liabilities.checked_add(amount).expect("overflow");
        self.check_solvency();
        index
    }

    /// The solver supplies one entry for each used pledge; pledged amounts are
    /// ALL-OR-NOTHING (never split across projects in this proof-of-concept).
    /// Any unallocated pledge becomes claimable immediately after activation.
    pub fn activate(&mut self, #[serializer(json)] allocations: Vec<Allocation>) {
        require!(
            self.phase == 0 && env::block_timestamp_ms() < self.deadline_ms,
            "not open"
        );
        require!(
            self.activation_authorities
                .contains(&env::predecessor_account_id()),
            "activation unauthorized"
        );
        require!(
            env::block_timestamp_ms() >= self.activate_after_ms,
            "activation not yet permitted"
        );
        let mut used = vec![false; self.pledges.len()];
        let mut totals: BTreeMap<String, u128> =
            self.projects.iter().map(|p| (p.id.clone(), 0)).collect();
        for a in &allocations {
            let index = a.pledge_index as usize;
            require!(
                index < used.len() && !used[index],
                "invalid or repeated pledge"
            );
            let pledge = &self.pledges[index];
            require!(
                pledge.allowed.contains(&a.project_id),
                "disallowed allocation"
            );
            let total = totals
                .get_mut(&a.project_id)
                .expect("unknown allocation project");
            *total = total.checked_add(pledge.amount).expect("sum overflow");
            used[index] = true;
        }
        let funded: BTreeSet<String> = self
            .projects
            .iter()
            .filter(|p| totals[&p.id] == p.required)
            .map(|p| p.id.clone())
            .collect();
        require!(
            funded.len() >= self.min_funded_projects as usize,
            "too few funded projects"
        );
        require!(
            self.required_for_activation
                .iter()
                .all(|id| funded.contains(id)),
            "required coalition project missing"
        );
        for p in &self.projects {
            let value = totals[&p.id];
            require!(
                value == 0 || value == p.required,
                "partially funded or overfunded project"
            );
            if value != 0 {
                require!(
                    p.dependencies.iter().all(|d| funded.contains(d.as_str())),
                    "project dependency unmet"
                );
            }
        }
        for (index, pledge) in self.pledges.iter().enumerate() {
            if used[index] {
                require!(
                    pledge.requires.iter().all(|d| funded.contains(d.as_str())),
                    "pledge condition unmet"
                );
            }
        }
        // Credit all beneficiaries and refund unused pledges. No external calls
        // occur while verifying/activating, so credits cannot be partially issued.
        let beneficiary_credits: Vec<_> = self
            .projects
            .iter()
            .filter(|p| funded.contains(p.id.as_str()))
            .map(|p| (p.beneficiary.clone(), p.required))
            .collect();
        for (beneficiary, amount) in beneficiary_credits {
            self.add_credit(beneficiary, amount);
        }
        for (index, pledge) in self.pledges.clone().iter().enumerate() {
            if !used[index] {
                self.add_credit(pledge.owner.clone(), pledge.amount);
            }
        }
        self.activated_allocations = allocations
            .iter()
            .map(|a| (a.pledge_index, a.project_id.clone()))
            .collect();
        self.funded_project_ids = funded.into_iter().collect();
        self.phase = 1;
        self.check_solvency();
    }

    /// After the deadline, EVERY contribution becomes a recoverable credit.
    pub fn expire(&mut self) {
        require!(
            self.phase == 0 && env::block_timestamp_ms() >= self.deadline_ms,
            "not expirable"
        );
        for p in self.pledges.clone() {
            self.add_credit(p.owner, p.amount);
        }
        self.phase = 2;
        self.check_solvency();
    }

    /// Pull withdrawals prevent an unsuccessful recipient transfer from blocking
    /// any other participant's recovery.
    pub fn withdraw(&mut self) -> Promise {
        let owner = env::predecessor_account_id();
        let amount = self.credits.remove(&owner).unwrap_or(0);
        require!(amount > 0, "nothing to withdraw");
        require!(
            !self.pending.contains_key(&owner),
            "withdrawal already pending"
        );
        self.pending.insert(owner.clone(), amount);
        self.check_solvency();
        Promise::new(owner.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(CALLBACK_TGAS))
                    .on_withdraw_result(owner, U128(amount)),
            )
    }

    /// Callback is callable only by this contract. A failed transfer restores
    /// the claim in full, without changing liabilities or freezing the campaign.
    #[private]
    pub fn on_withdraw_result(
        &mut self,
        #[serializer(json)] owner: AccountId,
        #[serializer(json)] amount: U128,
    ) -> bool {
        // Validate before mutating the pending record. NEAR rolls back a
        // panicking receipt, but keeping the check-before-remove order makes
        // this fail closed even in local harnesses and future refactors.
        let pending = *self.pending.get(&owner).expect("no pending withdrawal");
        require!(pending == amount.0, "pending amount mismatch");
        require!(
            env::promise_results_count() == 1,
            "unexpected callback results"
        );
        self.pending.remove(&owner);
        if env::promise_result_checked(0, 0).is_ok() {
            // Keep this callback intentionally minimal. An O(n) storage/solvency
            // audit here would increase the risk of an unrecoverable pending state.
            self.liabilities = self
                .liabilities
                .checked_sub(amount.0)
                .expect("liabilities underflow");
            true
        } else {
            self.add_credit(owner, amount.0);
            false
        }
    }

    pub fn status(&self) -> Status {
        Status {
            phase: match self.phase {
                0 => "OPEN",
                1 => "ACTIVATED",
                _ => "EXPIRED",
            }
            .to_string(),
            deadline_ms: self.deadline_ms,
            activate_after_ms: self.activate_after_ms,
            min_funded_projects: self.min_funded_projects,
            activation_authorities: self.activation_authorities.clone(),
            pledge_count: self.pledges.len() as u32,
            liabilities: U128(self.liabilities),
            project_ids: self.projects.iter().map(|p| p.id.clone()).collect(),
            required_for_activation: self.required_for_activation.clone(),
            funded_project_ids: self.funded_project_ids.clone(),
        }
    }

    /// Public evidence of the on-chain verified allocation. Empty until activation.
    pub fn activation_certificate(&self) -> Vec<Allocation> {
        self.activated_allocations
            .iter()
            .map(|(pledge_index, project_id)| Allocation {
                pledge_index: *pledge_index,
                project_id: project_id.clone(),
            })
            .collect()
    }

    /// Public immutable campaign facts used to authenticate share-link
    /// configuration before any contribution or activation control is shown.
    pub fn campaign_config(&self) -> CampaignConfig {
        CampaignConfig {
            projects: self
                .projects
                .iter()
                .map(|project| ProjectView {
                    id: project.id.clone(),
                    beneficiary: project.beneficiary.clone(),
                    required: U128(project.required),
                    dependencies: project.dependencies.clone(),
                })
                .collect(),
            deadline_ms: self.deadline_ms,
            activate_after_ms: self.activate_after_ms,
            min_funded_projects: self.min_funded_projects,
            required_for_activation: self.required_for_activation.clone(),
            activation_authorities: self.activation_authorities.clone(),
        }
    }

    /// Public canonical pledge facts. No state is changed and no authorization
    /// surface is added; the returned indexes are the exact values accepted by
    /// `activate`.
    pub fn pledge_records(&self) -> Vec<PledgeView> {
        self.pledges
            .iter()
            .enumerate()
            .map(|(index, pledge)| PledgeView {
                index: index as u32,
                owner: pledge.owner.clone(),
                amount: U128(pledge.amount),
                allowed: pledge.allowed.clone(),
                requires: pledge.requires.clone(),
            })
            .collect()
    }

    pub fn claimable(&self, #[serializer(json)] account_id: AccountId) -> U128 {
        U128(*self.credits.get(&account_id).unwrap_or(&0))
    }

    pub fn pending_withdrawal(&self, #[serializer(json)] account_id: AccountId) -> U128 {
        U128(*self.pending.get(&account_id).unwrap_or(&0))
    }

    /// Exposes the accounting identity used by every state-changing method so
    /// an independent verifier can check conservation without reading private
    /// storage. This is evidence only; it is not an authorization surface.
    pub fn accounting(&self) -> Accounting {
        let locked_pledges = if self.phase == 0 {
            self.sum_pledges()
        } else {
            0
        };
        let credits = self.sum_map(&self.credits);
        let pending = self.sum_map(&self.pending);
        let accounted = locked_pledges
            .checked_add(credits)
            .and_then(|value| value.checked_add(pending))
            .expect("accounting overflow");
        let storage_cost = (env::storage_usage() as u128)
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .expect("storage overflow");
        let storage_reserve = storage_cost
            .checked_add(STORAGE_BUFFER)
            .expect("reserve overflow");
        let balance = env::account_balance().as_yoctonear();
        let required_balance = self
            .liabilities
            .checked_add(storage_reserve)
            .expect("balance overflow");
        Accounting {
            phase: match self.phase {
                0 => "OPEN",
                1 => "ACTIVATED",
                _ => "EXPIRED",
            }
            .to_string(),
            locked_pledges: U128(locked_pledges),
            credits: U128(credits),
            pending: U128(pending),
            accounted: U128(accounted),
            liabilities: U128(self.liabilities),
            contract_balance: U128(balance),
            storage_reserve: U128(storage_reserve),
            solvent: accounted == self.liabilities && balance >= required_balance,
        }
    }

    fn add_credit(&mut self, account: AccountId, amount: u128) {
        let current = self.credits.get(&account).copied().unwrap_or(0);
        self.credits.insert(
            account,
            current.checked_add(amount).expect("credit overflow"),
        );
    }

    fn sum_pledges(&self) -> u128 {
        self.pledges.iter().fold(0u128, |value, pledge| {
            value.checked_add(pledge.amount).expect("pledge overflow")
        })
    }

    fn sum_map(&self, values: &BTreeMap<AccountId, u128>) -> u128 {
        values.values().fold(0u128, |value, amount| {
            value.checked_add(*amount).expect("credit overflow")
        })
    }

    fn check_solvency(&self) {
        // Economic conservation must hold regardless of the NEAR balance.
        // Activation/expiry converts liabilities from locked pledges to credits.
        let accounted = if self.phase == 0 {
            self.sum_pledges()
        } else {
            self.sum_map(&self.credits)
                .checked_add(self.sum_map(&self.pending))
                .expect("credit overflow")
        };
        require!(
            accounted == self.liabilities,
            "liability conservation failed"
        );
        let storage_cost = (env::storage_usage() as u128)
            .checked_mul(env::storage_byte_cost().as_yoctonear())
            .expect("storage overflow");
        let reserve = storage_cost
            .checked_add(STORAGE_BUFFER)
            .expect("reserve overflow");
        require!(
            env::account_balance().as_yoctonear()
                >= self
                    .liabilities
                    .checked_add(reserve)
                    .expect("balance overflow"),
            "contract storage reserve insufficient: sponsor before pledging"
        );
    }
}

fn initialization_is_authorized() -> bool {
    let current = env::current_account_id();
    let predecessor = env::predecessor_account_id();
    if predecessor == current {
        return true;
    }
    current
        .as_str()
        .split_once('.')
        .map(|(_, parent)| parent == predecessor.as_str())
        .unwrap_or(false)
}

// These tests are deliberately separate from the JavaScript model. They must
// compile and run under a Rust-enabled host before any deployment is attempted.
#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::{testing_env, PromiseResult};

    fn account(value: &str) -> AccountId {
        value.parse().expect("test account")
    }

    fn context(predecessor: &str, timestamp_ms: u64, deposit: u128) {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("pact.testnet"))
            .predecessor_account_id(account(predecessor))
            .block_timestamp(timestamp_ms * 1_000_000)
            // Mock host balance includes the developer-sponsored storage reserve.
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(deposit));
        testing_env!(builder.build());
    }

    fn project(id: &str, required: u128, dependencies: Vec<&str>) -> ProjectInput {
        ProjectInput {
            id: id.into(),
            beneficiary: account(&format!("{id}.testnet")),
            required: U128(required),
            dependencies: dependencies.iter().map(|d| d.to_string()).collect(),
        }
    }

    fn campaign() -> PactAtlas {
        context("pact.testnet", 1_000, 0);
        PactAtlas::new(
            vec![
                project(
                    "a",
                    4 * NearToken::from_near(1).as_yoctonear(),
                    vec!["b", "c"],
                ),
                project("b", 3 * NearToken::from_near(1).as_yoctonear(), vec!["a"]),
                project("c", 3 * NearToken::from_near(1).as_yoctonear(), vec!["a"]),
                project("d", 3 * NearToken::from_near(1).as_yoctonear(), vec![]),
            ],
            4_000,
            3_000,
            3,
            vec!["a".into(), "b".into(), "c".into()],
            vec![account("observer.testnet")],
        )
    }

    fn funded_campaign() -> PactAtlas {
        let mut c = campaign();
        let one = NearToken::from_near(1).as_yoctonear();
        for (who, amount, allowed, requires) in [
            ("donor1.testnet", 3, vec!["a", "d"], vec![]),
            ("donor2.testnet", 1, vec!["a"], vec!["b", "c"]),
            ("donor3.testnet", 3, vec!["b"], vec!["a"]),
            ("donor4.testnet", 3, vec!["c"], vec!["a"]),
            ("donor5.testnet", 2, vec!["d"], vec![]),
        ] {
            context(who, 1_500, amount * one);
            c.commit(
                allowed.iter().map(|x| x.to_string()).collect(),
                requires.iter().map(|x| x.to_string()).collect(),
            );
        }
        c
    }

    fn abc() -> Vec<Allocation> {
        vec![
            Allocation {
                pledge_index: 0,
                project_id: "a".into(),
            },
            Allocation {
                pledge_index: 1,
                project_id: "a".into(),
            },
            Allocation {
                pledge_index: 2,
                project_id: "b".into(),
            },
            Allocation {
                pledge_index: 3,
                project_id: "c".into(),
            },
        ]
    }

    #[test]
    fn json_new_arguments_deserialize_like_an_external_call() {
        #[near(serializers = [json])]
        struct NewArgs {
            projects: Vec<ProjectInput>,
            deadline_ms: u64,
            activate_after_ms: u64,
            min_funded_projects: u32,
            required_for_activation: Vec<String>,
            activation_authorities: Vec<AccountId>,
        }

        let payload = r#"{
            "projects":[
                {"id":"a","beneficiary":"a.testnet","required":"4000000000000000000000000","dependencies":["b","c"]},
                {"id":"b","beneficiary":"b.testnet","required":"3000000000000000000000000","dependencies":["a"]},
                {"id":"c","beneficiary":"c.testnet","required":"3000000000000000000000000","dependencies":["a"]},
                {"id":"d","beneficiary":"d.testnet","required":"3000000000000000000000000","dependencies":[]}
            ],
            "deadline_ms":1793377063496,
            "activate_after_ms":1793376913496,
            "min_funded_projects":3,
            "required_for_activation":["a","b","c"],
            "activation_authorities":["observer.testnet"]
        }"#;
        let args: NewArgs = near_sdk::serde_json::from_str(payload).expect("valid new args");
        assert_eq!(args.projects.len(), 4);
        assert_eq!(args.deadline_ms, 1_793_377_063_496);
        assert_eq!(args.activate_after_ms, 1_793_376_913_496);
        assert_eq!(args.min_funded_projects, 3);
        assert_eq!(args.required_for_activation, vec!["a", "b", "c"]);
        assert_eq!(
            args.activation_authorities,
            vec![account("observer.testnet")]
        );
    }

    #[test]
    #[should_panic(
        expected = "initialization must be authorized by contract account or its parent owner"
    )]
    fn initialization_cannot_be_front_run() {
        context("attacker.testnet", 1_000, 0);
        PactAtlas::new(
            vec![project("a", NearToken::from_near(1).as_yoctonear(), vec![])],
            4_000,
            3_000,
            1,
            vec!["a".into()],
            vec![account("pact.testnet")],
        );
    }

    #[test]
    fn direct_parent_can_initialize_a_new_campaign_account() {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("campaign.pact.testnet"))
            .predecessor_account_id(account("pact.testnet"))
            .block_timestamp(1_000 * 1_000_000)
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(builder.build());
        let campaign = PactAtlas::new(
            vec![project("a", NearToken::from_near(1).as_yoctonear(), vec![])],
            4_000,
            3_000,
            1,
            vec!["a".into()],
            vec![account("observer.testnet")],
        );
        assert_eq!(campaign.status().phase, "OPEN");
    }

    #[test]
    fn connected_projects_activate_and_certificate_is_public() {
        let mut c = funded_campaign();
        context("observer.testnet", 3_100, 0);
        c.activate(abc());
        assert_eq!(c.status().phase, "ACTIVATED");
        assert_eq!(c.activation_certificate().len(), 4);
        assert_eq!(c.status().funded_project_ids, vec!["a", "b", "c"]);
        assert_eq!(
            c.claimable(account("a.testnet")).0,
            NearToken::from_near(4).as_yoctonear()
        );
        assert_eq!(
            c.claimable(account("donor5.testnet")).0,
            NearToken::from_near(2).as_yoctonear()
        );
        assert_eq!(
            c.status().liabilities.0,
            NearToken::from_near(12).as_yoctonear()
        );
        let accounting = c.accounting();
        assert_eq!(accounting.locked_pledges.0, 0);
        assert_eq!(accounting.accounted.0, accounting.liabilities.0);
        assert!(accounting.solvent);
    }

    #[test]
    fn public_config_and_pledges_are_canonical_read_only_facts() {
        let c = funded_campaign();
        let config = c.campaign_config();
        assert_eq!(config.projects[0].id, "a");
        assert_eq!(config.projects[0].beneficiary, account("a.testnet"));
        assert_eq!(
            config.projects[0].required.0,
            4 * NearToken::from_near(1).as_yoctonear()
        );
        assert_eq!(config.deadline_ms, 4_000);
        assert_eq!(config.activate_after_ms, 3_000);
        assert_eq!(
            config.activation_authorities,
            vec![account("observer.testnet")]
        );

        let pledges = c.pledge_records();
        assert_eq!(pledges.len(), 5);
        assert_eq!(
            pledges
                .iter()
                .map(|pledge| pledge.index)
                .collect::<Vec<_>>(),
            vec![0, 1, 2, 3, 4]
        );
        assert_eq!(pledges[0].owner, account("donor1.testnet"));
        assert_eq!(
            pledges[0].amount.0,
            3 * NearToken::from_near(1).as_yoctonear()
        );
        assert_eq!(pledges[1].allowed, vec!["a"]);
        assert_eq!(pledges[1].requires, vec!["b", "c"]);
    }

    #[test]
    fn activation_is_allowed_at_the_exact_start_boundary() {
        let mut c = funded_campaign();
        // The contract intentionally freezes new deposits at this boundary,
        // while activation becomes valid inclusively at the same timestamp.
        context("observer.testnet", 3_000, 0);
        c.activate(abc());
        assert_eq!(c.status().phase, "ACTIVATED");
        assert_eq!(
            c.status().liabilities.0,
            12 * NearToken::from_near(1).as_yoctonear()
        );
    }

    #[test]
    #[should_panic(expected = "funding window closed")]
    fn contributions_are_frozen_before_activation() {
        let mut c = campaign();
        context(
            "late.testnet",
            3_000,
            NearToken::from_near(1).as_yoctonear(),
        );
        c.commit(vec!["d".into()], vec![]);
    }

    #[test]
    #[should_panic(expected = "invalid or repeated pledge")]
    fn repeated_pledge_is_rejected() {
        let mut c = funded_campaign();
        let mut plan = abc();
        plan.push(Allocation {
            pledge_index: 0,
            project_id: "a".into(),
        });
        context("observer.testnet", 3_100, 0);
        c.activate(plan);
    }

    #[test]
    fn failed_campaign_creates_full_refund_credits() {
        let mut c = funded_campaign();
        context("observer.testnet", 4_001, 0);
        c.expire();
        assert_eq!(c.status().phase, "EXPIRED");
        assert_eq!(
            c.claimable(account("donor1.testnet")).0,
            NearToken::from_near(3).as_yoctonear()
        );
        assert_eq!(
            c.claimable(account("donor5.testnet")).0,
            NearToken::from_near(2).as_yoctonear()
        );
    }

    #[test]
    fn expiry_is_allowed_at_the_exact_deadline_boundary() {
        let mut c = funded_campaign();
        context("observer.testnet", 4_000, 0);
        c.expire();
        assert_eq!(c.status().phase, "EXPIRED");
        assert_eq!(
            c.status().liabilities.0,
            12 * NearToken::from_near(1).as_yoctonear()
        );
        assert_eq!(c.accounting().accounted.0, c.status().liabilities.0);
    }

    #[test]
    fn maximum_projects_and_pledges_preserve_conservation() {
        let one = NearToken::from_yoctonear(MIN_PLEDGE_YOCTO);
        let projects: Vec<_> = (0..MAX_PROJECTS)
            .map(|index| project(&format!("p{index}"), MIN_PLEDGE_YOCTO, vec![]))
            .collect();
        let required: Vec<_> = (0..MAX_PROJECTS).map(|index| format!("p{index}")).collect();

        context("pact.testnet", 1_000, 0);
        let mut c = PactAtlas::new(
            projects,
            4_000,
            3_000,
            MAX_PROJECTS as u32,
            required,
            vec![account("observer.testnet")],
        );

        for index in 0..MAX_PLEDGES {
            context(&format!("donor{index}.testnet"), 1_500, MIN_PLEDGE_YOCTO);
            c.commit(vec![format!("p{}", index % MAX_PROJECTS)], vec![]);
        }
        assert_eq!(c.status().pledge_count, MAX_PLEDGES as u32);
        let expected = one.as_yoctonear() * MAX_PLEDGES as u128;
        assert_eq!(c.status().liabilities.0, expected);
        let open = c.accounting();
        assert_eq!(open.locked_pledges.0, expected);
        assert_eq!(open.accounted.0, expected);
        assert_eq!(open.credits.0, 0);
        assert!(open.solvent);

        // One pledge per project is an exact certificate; the other 24
        // pledges become refundable credits. The eight beneficiaries also
        // receive credits, so every one of the 32 deposits remains accounted
        // for after the largest configured activation.
        context("observer.testnet", 3_000, 0);
        c.activate(
            (0..MAX_PROJECTS)
                .map(|index| Allocation {
                    pledge_index: index as u32,
                    project_id: format!("p{index}"),
                })
                .collect(),
        );
        assert_eq!(c.status().phase, "ACTIVATED");
        let activated = c.accounting();
        assert_eq!(activated.locked_pledges.0, 0);
        assert_eq!(activated.credits.0, expected);
        assert_eq!(activated.accounted.0, expected);
        assert_eq!(activated.liabilities.0, expected);
        assert!(activated.solvent);
    }

    #[test]
    #[should_panic(expected = "pledge limit reached")]
    fn thirty_third_pledge_is_rejected_without_changing_the_limit() {
        let mut c = campaign();
        let one = NearToken::from_yoctonear(MIN_PLEDGE_YOCTO);
        for index in 0..MAX_PLEDGES {
            context(&format!("donor{index}.testnet"), 1_500, one.as_yoctonear());
            c.commit(vec!["d".into()], vec![]);
        }
        context("overflow-donor.testnet", 1_500, one.as_yoctonear());
        c.commit(vec!["d".into()], vec![]);
    }

    #[test]
    fn failed_withdrawal_callback_restores_credit_without_changing_liability() {
        let mut c = funded_campaign();
        context("observer.testnet", 3_100, 0);
        c.activate(abc());

        context("a.testnet", 3_200, 0);
        let _ = c.withdraw();
        assert_eq!(c.claimable(account("a.testnet")).0, 0);
        assert_eq!(
            c.pending_withdrawal(account("a.testnet")).0,
            NearToken::from_near(4).as_yoctonear()
        );
        assert_eq!(
            c.status().liabilities.0,
            NearToken::from_near(12).as_yoctonear()
        );
        let accounting = c.accounting();
        assert_eq!(accounting.credits.0, NearToken::from_near(8).as_yoctonear());
        assert_eq!(accounting.pending.0, NearToken::from_near(4).as_yoctonear());
        assert_eq!(accounting.accounted.0, accounting.liabilities.0);

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("pact.testnet"))
            .predecessor_account_id(account("pact.testnet"))
            .block_timestamp(3_200 * 1_000_000)
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Failed],
        );

        assert!(!c.on_withdraw_result(
            account("a.testnet"),
            U128(NearToken::from_near(4).as_yoctonear())
        ));
        assert_eq!(
            c.claimable(account("a.testnet")).0,
            NearToken::from_near(4).as_yoctonear()
        );
        assert_eq!(c.pending_withdrawal(account("a.testnet")).0, 0);
        assert_eq!(
            c.status().liabilities.0,
            NearToken::from_near(12).as_yoctonear()
        );
        let accounting = c.accounting();
        assert_eq!(
            accounting.credits.0,
            NearToken::from_near(12).as_yoctonear()
        );
        assert_eq!(accounting.pending.0, 0);
        assert_eq!(accounting.accounted.0, accounting.liabilities.0);
    }

    #[test]
    fn successful_withdrawal_callback_reduces_liability_once() {
        let mut c = funded_campaign();
        context("observer.testnet", 3_100, 0);
        c.activate(abc());

        context("a.testnet", 3_200, 0);
        let _ = c.withdraw();

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("pact.testnet"))
            .predecessor_account_id(account("pact.testnet"))
            .block_timestamp(3_200 * 1_000_000)
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])],
        );

        assert!(c.on_withdraw_result(
            account("a.testnet"),
            U128(NearToken::from_near(4).as_yoctonear())
        ));
        assert_eq!(c.claimable(account("a.testnet")).0, 0);
        assert_eq!(c.pending_withdrawal(account("a.testnet")).0, 0);
        assert_eq!(
            c.status().liabilities.0,
            NearToken::from_near(8).as_yoctonear()
        );
        let accounting = c.accounting();
        assert_eq!(accounting.accounted.0, accounting.liabilities.0);
        assert!(accounting.solvent);
    }

    #[test]
    fn callback_amount_mismatch_fails_before_pending_record_is_removed() {
        let mut c = funded_campaign();
        context("observer.testnet", 3_100, 0);
        c.activate(abc());

        context("a.testnet", 3_200, 0);
        let _ = c.withdraw();

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("pact.testnet"))
            .predecessor_account_id(account("pact.testnet"))
            .block_timestamp(3_200 * 1_000_000)
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])],
        );

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            c.on_withdraw_result(
                account("a.testnet"),
                U128(NearToken::from_near(3).as_yoctonear()),
            )
        }));
        assert!(result.is_err());
        assert_eq!(
            c.pending_withdrawal(account("a.testnet")).0,
            NearToken::from_near(4).as_yoctonear()
        );
        assert_eq!(
            c.status().liabilities.0,
            NearToken::from_near(12).as_yoctonear()
        );
    }

    #[test]
    #[should_panic(expected = "no pending withdrawal")]
    fn duplicate_withdrawal_callback_cannot_change_liability() {
        let mut c = funded_campaign();
        context("observer.testnet", 3_100, 0);
        c.activate(abc());

        context("a.testnet", 3_200, 0);
        let _ = c.withdraw();

        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(account("pact.testnet"))
            .predecessor_account_id(account("pact.testnet"))
            .block_timestamp(3_200 * 1_000_000)
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(0));
        testing_env!(
            builder.build(),
            near_sdk::test_vm_config(),
            near_sdk::RuntimeFeesConfig::test(),
            Default::default(),
            vec![PromiseResult::Successful(vec![])],
        );

        assert!(c.on_withdraw_result(
            account("a.testnet"),
            U128(NearToken::from_near(4).as_yoctonear())
        ));
        // A second callback has no pending record and therefore cannot reduce
        // liabilities a second time.
        let _ = c.on_withdraw_result(
            account("a.testnet"),
            U128(NearToken::from_near(4).as_yoctonear()),
        );
    }
}
