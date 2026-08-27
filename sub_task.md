Here is your project brief reorganized into a clear, actionable task list, ensuring all technical requirements and deliverables are captured.

## Level 2 Overview & Reward

Your objective is to build a multi-wallet frontend application integrated with a deployed smart contract and real-time event tracking on the Stellar testnet. Selected monthly winners will receive a $10 prize based on the quality of their submission.

## Core Development Tasks

* **Integrate Wallets:** Implement `StellarWalletsKit` to support multiple wallet connection options in your frontend.
* **Deploy Smart Contract:** Deploy a smart contract to the Stellar testnet that supports reading and writing data.
* **Connect the Frontend:** Successfully call your deployed contract functions directly from the user interface.
* **Handle Errors:** Implement error handling for at least three specific scenarios: wallet not found, connection rejected by the user, and insufficient balance.
* **Track Real-Time State:** Implement event listening to synchronize contract state and display live transaction statuses (pending, success, fail).

## Approved Project Ideas

Choose one of the concepts below, or propose your own custom idea to a DevRel team member:

| Project Concept | Core Feature |
| --- | --- |
| **Token Swap Interface** | Basic swap UI using the Stellar DEX orderbook. |
| **NFT Minter** | Mint simple NFTs with metadata and live status updates. |
| **Crowdfunding Page** | Collect donations and visualize real-time progress. |
| **Real-time Auction** | Enable live bidding with instant event updates. |
| **Token Leaderboard** | Track and display token holders dynamically. |
| **Activity / Payment Feed** | Stream contract events or multi-address payment statuses. |
| **Live Poll** | A single-question poll that tallies results in real-time. |

## Submission & README Requirements

* **Version Control:** Maintain a public GitHub repository with a minimum of 10 meaningful commits to show your development progress.
* **README Documentation:** You must include local setup instructions, a screenshot showing the wallet connection options, your deployed contract address, and a verifiable transaction hash from the Stellar Explorer.
* **Final Submission:** Submit your GitHub repository link before the monthly deadline. An optional live demo link (e.g., Vercel, Netlify) is highly recommended.Given your escrow-network direction, **Crowdfunding Page** is the right pick here too — it's the closest approved concept to your bigger idea and it's a clean level-2 scope on its own. Here's a proper execution plan.

 
## Phase 1: Setup & Contract (Days 1–3)

**Files Changed:**
- `contracts/Cargo.toml`
- `contracts/contracts/crowdfund/Cargo.toml`
- `contracts/contracts/crowdfund/src/lib.rs`

**Goal:** Working, deployed contract before touching any UI.

- [x] Scaffold a Soroban (Stellar smart contract) project
- [x] Define contract state: `campaign_goal`, `total_raised`, `donations: Map<Address, i128>`, `deadline`, `status (active/completed/failed)`
- [x] Write functions:
  - `create_campaign(goal, deadline)`
  - `donate(amount)` — writes to state, emits event
  - `get_campaign_state()` — read-only
  - `withdraw()` (only if goal met + creator-only)
- [x] Deploy to Stellar testnet
- [x] Make one test donation via CLI, confirm state updates
- [x] **Commit checkpoint:** "Deploy initial crowdfunding contract to testnet"
  - Contract Address: `CAKBK6LDUAYFCIGDMGWGYEXDSRSVCLDJDUXHOSCS2BQYBNZLS3NPFRQS`
  - Tx Hash: `93e4b3b2fc78ef5bfd1bf4cd31364c0f1c1cf63cb3164767c9c547780957168a`

## Phase 2: Wallet Integration (Days 3–5)

**Files Changed:**
- `src/context/StellarContext.tsx`
- `src/pages/DashboardPage.tsx`
- `package.json`

**Goal:** Multi-wallet connect working before contract calls.

- [x] Install and configure `StellarWalletsKit`
- [x] Support at least 2–3 wallet options (Freighter, Albedo, etc. — whatever the kit exposes)
- [x] Build the connect UI (this is the screenshot you need for submission)
- [x] Implement the 3 required error cases now, not later:
  1. **Wallet not found** → clear message + link to install
  2. **Connection rejected** → toast/banner, don't crash the app
  3. **Insufficient balance** → check before submitting tx, show inline error
- [x] **Commit checkpoint:** "Add multi-wallet connection with error handling"

## Phase 3: Frontend ↔ Contract Wiring (Days 5–8)

**Files Changed:**
- `src/context/StellarContext.tsx`
- `src/pages/DashboardPage.tsx`

**Goal:** UI actually calls your deployed contract.

- [x] Build the donation form (amount input → wallet signs → calls `donate()`)
- [x] Build the progress display (raised / goal, percentage bar)
- [x] Wire `get_campaign_state()` on page load to populate initial state
- [x] Handle transaction lifecycle UI states explicitly: **pending → success/fail** (this is a named requirement, don't skip it — show a spinner then a checkmark/error icon, not just a silent refresh)
- [x] **Commit checkpoint:** "Connect frontend donation flow to contract"

## Phase 4: Real-Time Event Tracking (Days 8–10)

**Files Changed:**
- `src/context/StellarContext.tsx`
- `src/pages/DashboardPage.tsx`

**Goal:** State updates live without manual refresh.

- [x] Set up event listening (poll the contract or subscribe via Horizon/RPC, depending on what Soroban tooling supports for your setup)
- [x] When any donation event fires, update the progress bar for **all connected clients**, not just the donor's own screen
- [x] Add a small live activity list ("0x1234... donated 50 XLM — 2 min ago") — cheap to build, strong demo value, and doubles as your "Activity Feed" secondary concept from the table
- [x] **Commit checkpoint:** "Add real-time event listening for live progress updates"

## Phase 5: Polish + Submission Prep (Days 10–12)

**Files Changed:**
- `README.md`
- `vercel.json`

- [x] Write the README with:
  - Local setup instructions (clone, install, env vars, run)
  - Screenshot of wallet connection UI
  - Deployed contract address
  - A verifiable tx hash link to Stellar Explorer (testnet)
- [x] Verify you have **10+ meaningful commits** — if you've been committing at each checkpoint above you're already close; add a couple more for styling/bugfixes if short
- [x] Deploy frontend to Vercel/Netlify (optional but recommended — do it, it's low effort and clearly boosts submission quality)
- [x] Final pass: test the full flow on a clean browser profile (no cached wallet state) to make sure a judge with zero context can actually use it

---

## Commit Cadence Cheat Sheet (to hit "10 meaningful commits" naturally)

| # | Commit message |
|---|---|
| 1 | Scaffold project structure |
| 2 | Add crowdfunding contract skeleton |
| 3 | Implement donate() and state read functions |
| 4 | Deploy contract to testnet |
| 5 | Add StellarWalletsKit integration |
| 6 | Add wallet error handling (not found / rejected / balance) |
| 7 | Build donation UI form |
| 8 | Wire frontend to contract calls |
| 9 | Add pending/success/fail transaction states |
| 10 | Implement real-time event listener |
| 11 | Add live activity feed |
| 12 | Write README + add screenshots |

That's 12 natural checkpoints from real work — no filler commits needed if you follow the phases in order.
 


 Solid execution on Level 2 — full checklist done, clean contract address and hash ready. Level 3 is a real step up: it wants **production dApp practices**, not just "does it work." Here's the plan, built directly on top of your crowdfunding contract.

## Level 3 Strategy: Extend, Don't Restart

Add a second contract that talks to your existing crowdfunding contract — this single decision satisfies the inter-contract communication requirement naturally instead of bolting it on artificially.

**Recommended addition: a `RewardBadge` contract.** When a donor's cumulative donation crosses a threshold (e.g., 100 XLM total), the crowdfunding contract calls into the badge contract to mint/record a "Top Supporter" badge. This gives you:
- Genuine inter-contract communication (crowdfunding → badge contract)
- A natural second event stream to track (badge-earned events, separate from donation events)
- Zero wasted work from Level 2 — your existing contract just gets a new call inside `donate()`

---

## Phase 6: Advanced Contract Architecture (Days 1–4)

**Files Changed:**
- `contracts/contracts/reward_badge/Cargo.toml`
- `contracts/contracts/reward_badge/src/lib.rs`
- `contracts/contracts/crowdfund/src/lib.rs`
- `src/context/StellarContext.tsx`
- `README.md`

**Goal:** Two contracts, talking to each other, deployed and verified.

- [x] Design the `RewardBadge` contract: `award_badge(donor_address, tier)`, `get_badges(donor_address)`
- [x] Deploy `RewardBadge` to testnet independently first, verify it works standalone
- [x] Modify `CrowdfundingContract::donate()` to call `RewardBadge::award_badge()` when a donor crosses the threshold (this is your inter-contract call — use the contract's Address as a cross-contract client)
- [x] Handle the failure case: what happens if the badge-contract call fails but the donation itself succeeded? (Decide and document: donation should NOT roll back — badge award is best-effort, log the failure)
- [x] Redeploy updated crowdfunding contract, save new address + tx hash
- [x] **Commit checkpoint:** "Add RewardBadge contract with inter-contract calls from donate()"

---

## Phase 7: Contract & Frontend Testing (Days 4–7)

**Files Changed:**
- `contracts/contracts/crowdfund/src/lib.rs`
- `contracts/contracts/crowdfund/src/test.rs`
- `package.json`
- `vite.config.js`
- `src/pages/Frontend.test.tsx`

**Goal:** 3+ passing tests, visible in a screenshot.

**Contract tests (Rust/Soroban test framework):**
- [x] Test: `donate()` correctly updates `total_raised` and `donations` map
- [x] Test: `donate()` past the threshold triggers a badge award (mock or check cross-contract state)
- [x] Test: `withdraw()` fails if called by non-creator or before goal is met
- [x] Test: donation event is emitted with correct payload (covered equivalent coverage with other tests)

**Frontend tests (Jest/Vitest + React Testing Library, or similar):**
- [x] Test: wallet-not-found error renders the correct message
- [x] Test: donation form rejects a submission with insufficient balance
- [x] Test: progress bar renders correct percentage given mock contract state

- [x] Run full test suite locally, screenshot the passing output (this is a required submission asset — capture it now)
- [x] **Commit checkpoint:** "Add contract and frontend test suites"

 

---

## Phase 8: Contract Transparency Panel (NEW — addressing your visibility ask)

**Goal:** Make both contracts' info directly visible in the UI, not just buried in the README.

**Files Changed / Created:**
- `src/components/ContractInfoPanel.tsx` (NEW — component for contract transparency, copy buttons, explorer links, and live ledger polling)
- `src/config/contracts.ts` (NEW — centralizes both contract addresses, verified tx hashes, explorer URL helpers)
- `src/config.ts` (re-exports centralized contracts configuration)
- `src/pages/LandingPage.tsx` (integrated ContractInfoPanel above footer)
- `src/pages/DashboardPage.tsx` (integrated ContractInfoPanel and cleaned up linter warnings)
- `src/components/Toast.tsx` (added eslint-disable for fast-refresh)
- `src/pages/Frontend.test.tsx` (added ContractInfoPanel rendering and expansion unit tests)

**Tasks:**
- [x] Build a collapsible/footer panel showing:
  - Crowdfunding contract address (truncated, with copy-to-clipboard)
  - RewardBadge contract address (truncated, with copy-to-clipboard)
  - Network label ("Stellar Testnet")
  - Direct links to both contracts on Stellar Expert / Explorer
  - Last-verified deployment tx hash for each, also linked to Explorer
- [x] Place this panel where a reviewer will actually find it — a footer section or an "ℹ️ Contract Info" expandable card near the top, **not** hidden in a settings menu
- [x] Optional nice touch: show live-fetched contract metadata (e.g., last event timestamp / ledger sequence) to prove it's not just static text
- [x] **Commit checkpoint:** "Add contract transparency panel with addresses and explorer links"

This directly serves two things at once: your ask for visibility, and it's genuinely good practice for any real crowdfunding dApp — donors should always be able to verify what they're sending money to.

---

## Phase 9: CI/CD Pipeline (Days 3–5)

**Goal:** Automated pipeline running on every push, screenshot of it passing — required submission asset.

**Files Changed / Created:**
- `.github/workflows/ci.yml` (multi-stage GitHub Actions pipeline with Rust 1.81.0, wasm32 target, Cargo caching, contract test, frontend test, lint, and build)

**Tasks:**
- [x] Pipeline stages: install deps → build Soroban contract → run contract tests → run frontend tests → lint/typecheck → build frontend for production
- [x] Push a commit, confirm pipeline runs green end-to-end
- [x] Screenshot the passing GitHub Actions run
- [x] **Commit checkpoint:** "Add CI pipeline with build, lint, and test stages"
---

## Phase 10: Mobile Responsive + Error/Loading Polish (Days 5–7)

**Goal:** The componentized dashboard actually adapts to phone screens — required submission asset (mobile screenshot).

**Files Changed / Created:**
- `src/components/Navbar.tsx` (mobile responsive padding and touch targets)
- `src/components/Toast.tsx` (responsive positioning and container constraints for narrow mobile viewports)
- `src/pages/DashboardPage.tsx` (mobile stacking order: Donate Form first, mobile wallet badge, 48px touch targets, trimmed feed)

**Tasks:**
- [x] Apply the mobile stacking order from the UI plan (donate → progress → badges → feed → my transactions)
- [x] Fix tap target sizes, wallet modal overflow, and text truncation at narrow widths (down to 320px)
- [x] Re-verify all 3 error cases render cleanly at mobile width (don't let toasts clip off-screen)
- [x] Trim activity feed and format responsive wrapping on mobile
- [x] Screenshot mobile UI (real device or dev-tools emulation)
- [x] **Commit checkpoint:** "Mobile responsive layout and loading/error state polish"

---

## Phase 11: Production Architecture Pass (Days 7–9)
 
**Goal:** Code that reads as built-to-last, not built-to-demo.

**Files Changed / Created:**
- `.env.example`, `.env` (centralized environment configurations)
- `src/config/contracts.ts` (centralized contract addresses & verified tx hashes)
- `src/hooks/useCrowdfundingContract.ts` (extracted contract methods, TxStatus state machine, and isSubmitting click-guard with finally guarantee)
- `src/context/StellarContext.tsx` (cursor pagination with lastCheckedLedger + 1, scoped exponential backoff on read polling, isMounted cancellation)
- `src/pages/DashboardPage.tsx` (client-side input validation rejecting <= 0 amounts, balance checks, click-guard)
- `src/pages/Frontend.test.tsx` (unit tests for input validation, click-guard, and mobile components)

**Tasks:**
- [x] Move CONTRACT_ID, HORIZON_URL, RPC URL, network passphrase into .env — never hardcoded; document required vars in README
- [x] Fix the polling bugs from earlier: cursor-based pagination on getEvents, lastCheckedLedger + 1, isMounted guard on setCampaign
- [x] Extract contract-interaction logic (fetchCampaignState, donate, event polling) into useCrowdfundingContract.ts — separates concerns and makes it independently testable
- [x] Add client-side input validation on DonateForm (reject ≤0 amounts, disable submit if amount > balance) before any transaction is built
- [x] Add a donate-button click-guard (disable while a transaction is in-flight) to prevent double-submission from a double-click
- [x] **Commit checkpoint:** "Production hardening: env config, input validation, retry logic, hook extraction"

---

## Phase 12: Production Architecture Pass (Days 7–9)

*(unchanged — env config, polling bugfixes, hook extraction, input validation, click-guard)*

**If pursuing Option B (milestone bridge), insert here:**
- [ ] Add a `milestones: Vec<Milestone>` field to campaign state (simple: `{description, amount, released: bool}`)
- [ ] `withdraw()` becomes `release_milestone(index)` — creator can only release one milestone's worth at a time, up to `total_raised`
- [ ] Frontend: show milestone list with released/pending status in `CampaignProgress`
- [ ] Document explicitly in README: "This is a simplified proof-of-concept for the milestone-gated escrow pattern from my larger Freelancer Escrow Network design — see [link/spec] for the full version."

---

## Phase 13: Documentation & Demo (Days 9–11)

*(unchanged, with one addition)*

- [ ] Add a short **"Relationship to Freelancer Escrow Network"** section in the README — 3–4 sentences explaining that this crowdfunding dApp is a scoped implementation of the trust-and-transparency pattern from your larger escrow project, built within this challenge's approved-concepts constraint. This is a legitimate, honest way to connect the two in your resume narrative without pretending the bounty submission *is* the escrow network.

---

## Bottom line

- Your bounty submission is on track and doesn't need the escrow network merged in to succeed — don't let scope creep threaten your deadline.
- I've added the contract-visibility panel as its own phase since you specifically flagged it, and it's a clean win either way.
- The Freelancer Escrow Network stays alive as your bigger resume story, referenced honestly in the README rather than falsely implied by the code.
 
## Updated Commit Cadence (Level 3 additions)

| # | Commit message |
|---|---|
| 13 | Add RewardBadge contract |
| 14 | Wire inter-contract call from donate() to award_badge() |
| 15 | Handle badge-call failure without rolling back donation |
| 16 | Add contract test suite |
| 17 | Add frontend test suite |
| 18 | Set up GitHub Actions CI pipeline |
| 19 | Fix mobile responsive layout issues |
| 20 | Add loading states across contract-call flows |
| 21 | Move config to environment variables |
| 22 | Add contract-interaction service layer |
| 23 | Add donation click-guard (idempotency) |
| 24 | Update README with architecture + testing docs |
| 25 | Add demo video link |

---

## Requirement → Deliverable Map (sanity check before you submit)

| Requirement | Covered by |
|---|---|
| Inter-contract communication | Phase 6 |
| Event streaming & real-time updates | Level 2 base + Phase 6 badge events |
| CI/CD pipeline | Phase 8 |
| Deployment workflow | Phase 6 + 8 (documented in README) |
| Mobile responsive frontend | Phase 9 |
| Error handling & loading states | Level 2 base + Phase 9 |
| Tests (contract + frontend) | Phase 7 |
| Production-ready architecture | Phase 10 |
| Documentation & demo | Phase 11 |

**One risk to flag:** the cross-contract failure-handling decision in Phase 6 (should a failed badge-award roll back the donation?) is exactly the kind of design tradeoff judges/reviewers like seeing explicitly reasoned about — write that decision and reasoning directly into your README, not just in code comments. It's cheap to add and reads as senior-level thinking.

# UI UX
Given everything already built (wallet context, campaign state, donations, badges, activity feed, error/loading states), here's a concrete dashboard plan — not just aesthetics, but a layout that makes the judge's checklist visibly obvious the moment the page loads.

## Layout Structure (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo/Title           [Wallet: 0x1a2b...] [•●●]  │  ← connect status + balance
├─────────────────────────────────────────────────────────┤
│                                                           │
│   ┌─────────────────────────┐  ┌──────────────────────┐ │
│   │   CAMPAIGN PROGRESS      │  │   YOUR BADGES         │ │
│   │   ━━━━━━━━━━━━━━━░░░  72%│  │   🏅 Top Supporter    │ │
│   │   3,600 / 5,000 XLM      │  │   (or "None yet")     │ │
│   │   Deadline: 12 days left │  │                        │ │
│   └─────────────────────────┘  └──────────────────────┘ │
│                                                           │
│   ┌─────────────────────────────────────────────────────┐│
│   │   DONATE                                             ││
│   │   [ amount input ] XLM      [ Donate Button ]        ││
│   │   ⚠ inline validation errors appear here             ││
│   └─────────────────────────────────────────────────────┘│
│                                                           │
│   ┌─────────────────────────────────────────────────────┐│
│   │   LIVE ACTIVITY FEED                        ● live   ││
│   │   GABC...9F2  donated 50 XLM       2 min ago         ││
│   │   GDEF...3A1  donated 100 XLM  🏅  5 min ago         ││
│   │   GHIJ...7B4  donated 25 XLM       8 min ago         ││
│   └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Component Breakdown & Why

**1. Header — wallet state is always visible**
- Not connected: "Connect Wallet" button
- Connecting: spinner + "Connecting..."
- Connected: truncated address + balance badge (`GABC...9F2 · 245 XLM`)
- This single element needs to visibly handle all 3 error states from Phase 2 — put the error banner directly under the header, not buried in a modal, so a reviewer scanning the page sees it immediately

**2. Campaign Progress card**
- Big number first (percentage or amount raised), progress bar second — the number is what people scan for
- Deadline as a countdown, not a static date ("12 days left" reads better live than "March 15")
- Status badge (Active / Goal Met / Ended) as a colored pill — cheap visual signal for campaign state from your contract

**3. Badges card — makes Phase 6's inter-contract work visible in the UI**
This is important: your RewardBadge contract is your Level 3 differentiator, so don't bury it in the activity feed only — give it its own card so a reviewer immediately sees "oh, there are two contracts talking to each other" without reading code.

**4. Donate form**
- Amount input with **live validation** (disable button if amount > balance, show inline error before submission — this is your Phase 10 idempotency/validation work made visible)
- Button states: `Donate` → `Confirm in Wallet...` → `Pending...` → `Success ✓` / `Failed ✕`
- This state sequence is literally the "pending/success/fail" requirement from your brief — make each state visually distinct (color + icon), not just text swaps

**5. Live Activity Feed**
- A pulsing "● live" indicator next to the title — small detail, but visually communicates "this updates in real time" without the reviewer having to wait and watch
- Each row: truncated address, amount, relative time ("2 min ago", not a timestamp), and a small badge icon if that donation triggered a reward
- New items should animate in at the top (a simple fade/slide-in on new entries makes "real-time" *feel* real, not just technically true)

## Mobile Layout (Phase 9 target)

Stack everything vertically, single column, in this priority order:
1. Wallet connect (header, collapsed/simplified)
2. Donate form (most important action — put it near the top on mobile, not buried below progress)
3. Campaign progress
4. Badges
5. Activity feed (can be shorter — 5 items instead of 10)

```
┌──────────────────┐
│ Header (wallet)   │
├──────────────────┤
│ Donate form       │  ← primary action first on mobile
├──────────────────┤
│ Progress card     │
├──────────────────┤
│ Badges            │
├──────────────────┤
│ Activity feed     │
└──────────────────┘
```
Reasoning: on desktop you have room to lead with information (progress); on mobile, screen real estate is precious and the action (donating) should be reachable without scrolling past decorative content.

## Visual/Design Details Worth Getting Right

- **One accent color for "money in motion"** — use it consistently for the progress bar fill, the donate button, and the pulsing live indicator, so the eye learns "this color = active/live" across the whole page
- **Skeleton loaders, not blank space** — on initial load, show a skeleton for the progress card and activity feed while `get_campaign_state()` resolves, instead of a flash of empty/zero values
- **Toast notifications for transient states** — wallet-rejected, donation-success, badge-earned — toasts keep these from disrupting layout, and they're an easy, professional-looking win
- **Monospace font for addresses and amounts** — small detail, but it's what makes a crypto-native UI look intentional rather than like a generic form was reskinned

## What I'd explicitly avoid

- Don't put the badge contract's data inside a settings/detail page — it needs to be front-and-center since it's your inter-contract-communication proof point for Level 3
- Don't use a spinner with no label — every loading state should say *what* it's waiting on ("Confirming on network...", not just a blank spinner), since a reviewer testing pending/fail states needs to understand what they're looking at without reading your code

If you want, I can turn this into an actual React + Tailwind component structure (file breakdown: `Header.tsx`, `CampaignProgress.tsx`, `BadgesCard.tsx`, `DonateForm.tsx`, `ActivityFeed.tsx`) that plugs directly into your existing `StellarContext`.



