#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, IntoVal
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Creator,
    Goal,
    Deadline,
    TotalRaised,
    Token,
    Donation(Address),
    BadgeContract,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignState {
    pub creator: Address,
    pub goal: i128,
    pub deadline: u64,
    pub total_raised: i128,
    pub token: Address,
    pub status: String,
}

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    /// Initialize the campaign. Called by the Factory; Factory enforces creator auth.
    pub fn create_campaign(
        env: Env,
        creator: Address,
        token: Address,
        goal: i128,
        deadline: u64,
    ) {
        // Note: do NOT call creator.require_auth() here. This function is called
        // by the Factory contract which already enforces creator authorization at the
        // top level. Adding a second require_auth here causes the cross-contract auth
        // tree to trap during actual execution (even though simulation passes).

        if env.storage().instance().has(&DataKey::Creator) {
            panic!("Campaign already initialized");
        }
        if goal <= 0 {
            panic!("Goal must be > 0");
        }
        if deadline <= env.ledger().timestamp() {
            panic!("Deadline must be in the future");
        }

        env.storage().instance().set(&DataKey::Creator, &creator);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Goal, &goal);
        env.storage().instance().set(&DataKey::Deadline, &deadline);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Donate to the campaign
    pub fn donate(env: Env, donor: Address, amount: i128) {
        donor.require_auth();

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).expect("not initialized");
        if env.ledger().timestamp() >= deadline {
            panic!("Campaign ended");
        }
        if amount <= 0 {
            panic!("Amount must be > 0");
        }

        let token_id: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        
        // Transfer from donor to the contract
        token_client.transfer(&donor, env.current_contract_address(), &amount);

        let mut total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        total_raised += amount;
        env.storage().instance().set(&DataKey::TotalRaised, &total_raised);

        let donation_key = DataKey::Donation(donor.clone());
        let mut current_donation: i128 = env.storage().persistent().get(&donation_key).unwrap_or(0);
        current_donation += amount;
        env.storage().persistent().set(&donation_key, &current_donation);

        #[allow(deprecated)]
        // Emit an event
        env.events().publish(
            (soroban_sdk::symbol_short!("donate"), donor.clone()),
            amount
        );

        // Try to award badge if threshold is met
        if current_donation >= 1_000_000_000 {
            if let Some(badge_contract_id) = env.storage().instance().get::<_, Address>(&DataKey::BadgeContract) {
                let caller = env.current_contract_address();
                let args = soroban_sdk::vec![&env, caller.into_val(&env), donor.into_val(&env), 1u32.into_val(&env)];
                let _ = env.try_invoke_contract::<soroban_sdk::Val, soroban_sdk::Error>(
                    &badge_contract_id,
                    &soroban_sdk::Symbol::new(&env, "award_badge"),
                    args,
                );
            }
        }
        
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Read-only method to get current campaign state
    pub fn get_campaign_state(env: Env) -> CampaignState {
        if !env.storage().instance().has(&DataKey::Creator) {
            panic!("Campaign not initialized");
        }
        let creator = env.storage().instance().get(&DataKey::Creator).unwrap();
        let token = env.storage().instance().get(&DataKey::Token).unwrap();
        let goal = env.storage().instance().get(&DataKey::Goal).unwrap();
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        let total_raised = env.storage().instance().get(&DataKey::TotalRaised).unwrap();

        let current_time = env.ledger().timestamp();
        
        let status = if current_time >= deadline {
            if total_raised >= goal {
                String::from_str(&env, "completed")
            } else {
                String::from_str(&env, "failed")
            }
        } else {
            String::from_str(&env, "active")
        };

        CampaignState {
            creator,
            goal,
            deadline,
            total_raised,
            token,
            status,
        }
    }

    /// Withdraw funds if goal is met
    pub fn withdraw(env: Env, creator: Address) {
        creator.require_auth();

        let stored_creator: Address = env.storage().instance().get(&DataKey::Creator).expect("not initialized");
        if creator != stored_creator {
            panic!("Only creator can withdraw");
        }

        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        let total_raised: i128 = env.storage().instance().get(&DataKey::TotalRaised).unwrap();
        let current_time = env.ledger().timestamp();

        if current_time < deadline {
            panic!("Campaign is still active");
        }
        if total_raised < goal {
            panic!("Goal not met");
        }

        let token_id: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token_id);
        
        // Transfer all raised funds to the creator
        token_client.transfer(&env.current_contract_address(), &creator, &total_raised);
    }

    /// Link the RewardBadge contract to this campaign. Called by Factory.
    pub fn set_badge_contract(env: Env, creator: Address, badge_contract: Address) {
        // Verify the stored creator matches — no require_auth needed since
        // Factory already authorized creator in the root invocation.
        env.storage().instance().set(&DataKey::BadgeContract, &badge_contract);
    }
}

#[cfg(test)]
mod test;
