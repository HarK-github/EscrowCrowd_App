# Codebase Simplification Plan (Ponytail Audit)

Based on the whole-repo over-engineering and complexity audit, below are the prioritized simplifications ranked by size of reduction.

---

## Ranked Audit Findings

1. **`delete:`** Unused streaming escrow balance hook and test (0 UI callers, speculative 60fps RAF subscriber).  
   - **Replacement:** Nothing (delete files).  
   - **Target:** `src/hooks/useStreamBalance.ts`, `src/hooks/useStreamBalance.test.ts` (~201 lines)

2. **`native:`** BullMQ and IORedis queue infrastructure when sequential execution is already handled in-process.  
   - **Replacement:** Native sequential Promise queue chain.  
   - **Target:** `backend/queue.js`, `backend/package.json` (~70 lines, -2 deps)

3. **`shrink:`** Triplicated transaction build, simulate, sign, and poll logic across hooks (`execTx`, `executeTransaction`, `sendAndConfirm`).  
   - **Replacement:** Single shared `submitTransaction` helper.  
   - **Target:** `src/hooks/useCrowdfundingContract.ts`, `src/hooks/useFactoryContract.ts` (~65 lines)

4. **`native:`** `ContractInfoPanel` wrapper component managing open/close state for a disclosure panel.  
   - **Replacement:** Native `<details><summary>` element or inline state.  
   - **Target:** `src/components/ContractInfoPanel.tsx` (~41 lines)

5. **`native:`** `postcss` and `autoprefixer` devDependencies redundant with Tailwind v4.  
   - **Replacement:** Native `@tailwindcss/vite` handling.  
   - **Target:** `package.json` (-2 deps)

6. **`delete:`** `clsx` and `tailwind-merge` dependencies with zero imports across the entire repository.  
   - **Replacement:** Standard template literals.  
   - **Target:** `package.json` (-2 deps)

7. **`yagni:`** Split configuration files where `src/config.ts` merely re-exports `src/config/contracts.ts`.  
   - **Replacement:** Consolidate into a single config file.  
   - **Target:** `src/config.ts`, `src/config/contracts.ts` (~15 lines)

8. **`yagni:`** Single-use `Testimonial` component containing one hardcoded blockquote.  
   - **Replacement:** Inline directly into `LandingPage.tsx`.  
   - **Target:** `src/components/Testimonial.tsx` (~16 lines)

9. **`delete:`** Ad-hoc prototype reflection script left in project root.  
   - **Replacement:** Nothing (delete file).  
   - **Target:** `test_kit.js` (~8 lines)

10. **`delete:`** Orphaned test scratch file unreferenced in test suite.  
    - **Replacement:** Nothing (delete file).  
    - **Target:** `contracts/contracts/crowdfund/test_find_events.rs` (~4 lines)

11. **`delete:`** Unreferenced starter assets (`hero.png`, `react.svg`, `vite.svg`).  
    - **Replacement:** Nothing (delete files).  
    - **Target:** `src/assets/` (~3 files)

---

## Net Reduction Potential

- **Lines:** ~424 lines
- **Dependencies:** -6 dependencies (`clsx`, `tailwind-merge`, `postcss`, `autoprefixer`, `bullmq`, `ioredis`)


---

## Line-by-Line Code Review: Simplifying Advanced JS (For Project Viva & Explanations)

Focus: Replace obscure / advanced JavaScript patterns with straightforward, readable code that is easy to explain during a presentation or viva, without breaking functionality.

1. **`src/hooks/useCrowdfundingContract.ts:L483-485` (`stdlib`)**
   - **Current:** Regex chunking and hex parsing: `CROWDFUND_WASM_HASH.match(/.{1,2}/g)!.map(b => parseInt(b, 16))`.
   - **Simplified Replacement:** Standard 2-character slice loop or `Buffer.from(hash, 'hex')`. Much easier to explain to reviewers than regular expression byte chunking.

2. **`src/hooks/useCrowdfundingContract.ts:L432-434` (`shrink`)**
   - **Current:** Lambda wrapper closures: `fetchCampaignState: (id: string) => fetchCampaignStateData(id)`.
   - **Simplified Replacement:** Direct function reference: `fetchCampaignState: fetchCampaignStateData`. Avoids unnecessary arrow function layers.

3. **`src/hooks/useCrowdfundingContract.ts:L184-239` (`shrink`)**
   - **Current:** Triplicated transaction build/simulate/sign/poll pipelines (`executeTransaction`, `execTx` in same file, `sendAndConfirm` in `useFactoryContract.ts`).
   - **Simplified Replacement:** Extract a single shared 15-line `submitTx(operation, signer)` helper. Makes transaction flow clear and unified across all contract calls.

4. **`src/components/ContractInfoPanel.tsx:L9-40` (`native`)**
   - **Current:** Custom React state hook (`useState(false)`), custom click handlers, and conditional rendering for toggling the contract details drawer.
   - **Simplified Replacement:** Native HTML `<details><summary>` element. Zero JavaScript, native browser accessibility, and trivially simple to explain.

5. **`backend/queue.js:L13-65` (`native`)**
   - **Current:** Complex `InMemoryQueue` class managing `this.chain = this.chain.then(...)` promise chaining and exponential backoff retry algorithms, coupled with a BullMQ/IORedis dual branch.
   - **Simplified Replacement:** A straightforward sequential `async/await` loop over a standard JavaScript array (`jobs`). Clear step-by-step logic without advanced queueing algebra.

6. **`backend/rateLimit.js:L17-22` (`shrink`)**
   - **Current:** Sliding-window rate limiter filtering an array of timestamps on every incoming request inside a `Map`.
   - **Simplified Replacement:** A standard fixed-window counter resetting via `setInterval(..., 60000)` or timestamp epochs. Removes complex sliding window math.

7. **`src/config.ts:L1-15` (`yagni`)**
   - **Current:** Redundant configuration wrapper file that merely re-exports `config/contracts.ts` and aliases constants.
   - **Simplified Replacement:** Delete `src/config.ts` and import directly from `src/config/contracts.ts` (or keep one unified config file).

8. **`src/components/Testimonial.tsx:L5-16` (`yagni`)**
   - **Current:** Dedicated component file for one static quote string.
   - **Simplified Replacement:** Inline directly into `src/pages/LandingPage.tsx`.

9. **`test_kit.js:L1-8` (`delete`)**
   - **Current:** Ad-hoc prototype traversal script (`Object.getPrototypeOf` loop).
   - **Simplified Replacement:** Delete; throwaway debugging script not part of the application.

10. **`contracts/contracts/crowdfund/test_find_events.rs:L1-4` (`delete`)**
    - **Current:** Orphaned 4-line test function unreferenced by the test suite.
    - **Simplified Replacement:** Delete file.

**Review Savings:** -215 lines possible without breaking any functionality.
