#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env,
};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StreamStatus {
    Active = 1,
    Settled = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub subscriber: Address,
    pub vendor: Address,
    pub operator: Address,
    pub token: Address,
    pub total_deposit: i128,
    pub duration_sec: u64,
    pub rate_per_sec: i128,
    pub start_time: u64,
    pub settled_amount: i128,
    pub status: StreamStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    NextStreamId,
    Stream(u64),
}

const TTL_THRESHOLD: u32 = 100_000;
const TTL_EXTEND: u32 = 100_000;

#[contract]
pub struct FlexEscrowContract;

#[contractimpl]
impl FlexEscrowContract {
    /// Lock deposited tokens into continuous streaming escrow.
    pub fn deposit_and_lock(
        env: Env,
        subscriber: Address,
        vendor: Address,
        operator: Address,
        duration_sec: u64,
        token: Address,
        total_amount: i128,
    ) -> u64 {
        subscriber.require_auth();

        if total_amount <= 0 {
            panic!("total_amount must be > 0");
        }
        if duration_sec == 0 {
            panic!("duration_sec must be > 0");
        }

        let stream_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1u64);

        env.storage()
            .instance()
            .set(&DataKey::NextStreamId, &(stream_id + 1));
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_EXTEND);

        let rate_per_sec = total_amount / (duration_sec as i128);

        // Transfer funds from subscriber to this contract vault
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&subscriber, &env.current_contract_address(), &total_amount);

        let stream = Stream {
            subscriber,
            vendor,
            operator,
            token,
            total_deposit: total_amount,
            duration_sec,
            rate_per_sec,
            start_time: env.ledger().timestamp(),
            settled_amount: 0,
            status: StreamStatus::Active,
        };

        let key = DataKey::Stream(stream_id);
        env.storage().persistent().set(&key, &stream);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        stream_id
    }

    /// Settle an accrued amount to the vendor. Only authorized operator key can invoke.
    pub fn settle_stream(env: Env, operator: Address, stream_id: u64, claim_amount: i128) {
        operator.require_auth();

        let key = DataKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Stream not found");

        if stream.operator != operator {
            panic!("Unauthorized operator");
        }
        if stream.status != StreamStatus::Active {
            panic!("Stream is not active");
        }
        if claim_amount <= 0 {
            panic!("claim_amount must be > 0");
        }

        let now = env.ledger().timestamp();
        let elapsed = now.saturating_sub(stream.start_time);

        // Remainder dust fix: if elapsed reaches or exceeds duration, grant full total_deposit
        let max_earned = if elapsed >= stream.duration_sec {
            stream.total_deposit
        } else {
            stream.total_deposit.min((elapsed as i128) * stream.rate_per_sec)
        };

        let max_claimable = max_earned.saturating_sub(stream.settled_amount);
        if claim_amount > max_claimable {
            panic!("claim_amount exceeds accrued ceiling");
        }

        stream.settled_amount += claim_amount;
        if stream.settled_amount >= stream.total_deposit {
            stream.status = StreamStatus::Settled;
        }

        env.storage().persistent().set(&key, &stream);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.vendor,
            &claim_amount,
        );
    }

    /// Emergency / cancellation clawback: subscriber reclaims unspent escrow funds.
    pub fn pull_refund(env: Env, subscriber: Address, stream_id: u64) {
        subscriber.require_auth();

        let key = DataKey::Stream(stream_id);
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&key)
            .expect("Stream not found");

        if stream.subscriber != subscriber {
            panic!("Unauthorized subscriber");
        }
        if stream.status != StreamStatus::Active {
            panic!("Stream is not active");
        }

        let refund_amount = stream.total_deposit.saturating_sub(stream.settled_amount);
        if refund_amount <= 0 {
            panic!("No unspent funds remaining");
        }

        stream.status = StreamStatus::Refunded;
        env.storage().persistent().set(&key, &stream);
        env.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND);

        let token_client = token::Client::new(&env, &stream.token);
        token_client.transfer(
            &env.current_contract_address(),
            &stream.subscriber,
            &refund_amount,
        );
    }

    /// Read stream state.
    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        let key = DataKey::Stream(stream_id);
        env.storage()
            .persistent()
            .get(&key)
            .expect("Stream not found")
    }
}

#[cfg(test)]
mod test;
