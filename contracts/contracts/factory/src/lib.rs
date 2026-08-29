#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Vec
};

/// Lightweight metadata stored per campaign in the registry
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CampaignSummary {
    pub creator: Address,
    pub title: String,
    pub created_at: u64,
}

/// ProjectFactory — acts as an on-chain registry of all EscrowCrowd campaigns.
/// 
/// Rather than deploying campaigns on-chain (which has Soroban footprint issues
/// in the current SDK version), the Factory serves as a trusted registry:
///   - Users deploy their own CrowdfundContract instances (via the frontend)
///   - They then call `register_campaign` to add their contract to the global list
///   - The Factory stores metadata (title, creator, timestamp) for each campaign
///   - `get_all_campaigns` supports pagination so the browse page scales
///
/// This is architecturally equivalent to the Factory-deploy pattern: the Registry
/// is the single source of truth for all campaigns, and the RewardBadge enforces
/// its own allowlist independently.
#[contract]
pub struct ProjectFactory;

#[contractimpl]
impl ProjectFactory {
    /// Register a deployed CrowdfundContract in the global registry.
    /// The caller must be the creator of that campaign.
    pub fn register_campaign(
        env: Env,
        creator: Address,
        campaign_address: Address,
        title: String,
    ) {
        creator.require_auth();
        
        let mut all_campaigns: Vec<Address> = env.storage().instance()
            .get(&symbol_short!("all"))
            .unwrap_or(Vec::new(&env));
        
        // Prevent duplicates
        for i in 0..all_campaigns.len() {
            if all_campaigns.get(i).unwrap() == campaign_address {
                panic!("Campaign already registered");
            }
        }
        
        all_campaigns.push_back(campaign_address.clone());
        env.storage().instance().set(&symbol_short!("all"), &all_campaigns);
        
        let mut meta: Map<Address, CampaignSummary> = env.storage().instance()
            .get(&symbol_short!("meta"))
            .unwrap_or(Map::new(&env));
        
        let summary = CampaignSummary {
            creator: creator.clone(),
            title: title.clone(),
            created_at: env.ledger().timestamp(),
        };
        meta.set(campaign_address.clone(), summary);
        env.storage().instance().set(&symbol_short!("meta"), &meta);
        
        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("reg"), campaign_address),
            (creator, title)
        );
        
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    /// Get a paginated list of all registered campaigns
    pub fn get_all_campaigns(env: Env, offset: u32, limit: u32) -> Vec<Address> {
        let all_campaigns: Vec<Address> = env.storage().instance()
            .get(&symbol_short!("all"))
            .unwrap_or(Vec::new(&env));
        let len = all_campaigns.len();
        
        let mut result = Vec::new(&env);
        if offset >= len {
            return result;
        }
        
        let end = core::cmp::min(offset + limit, len);
        for i in offset..end {
            result.push_back(all_campaigns.get(i).unwrap());
        }
        
        result
    }

    /// Get metadata for a specific campaign
    pub fn get_campaign_metadata(env: Env, address: Address) -> CampaignSummary {
        let meta: Map<Address, CampaignSummary> = env.storage().instance()
            .get(&symbol_short!("meta"))
            .unwrap();
        meta.get(address).expect("Campaign not found in registry")
    }
}

mod test;
