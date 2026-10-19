# LAURA × Stonk Intern Work — ACTIVE QA INTEGRATION STATUS

**Audit/repair: 2026-10-19.** This section takes precedence over the older initial draft instructions below; do not claim the new escrow is end-to-end certified until real receipts exist.

- Existing LAURA feature-branch PR #2, head before this repair `5c14edc9f0fdef67248dfe2ae4be8852c3dcf537`, was already deployed to Render `srv-db6pp2om7kps73asabr0` on 2026-10-15. Do **not** rebuild the independent evidence service.
- Existing `src/lib/intern-work/execute.ts` was pinned to the superseded escrow `0x656E46dc55E383b1f927617301A3E1580a576B2D`. That pin would refuse a new single-Intern QA job.
- **Verified replacement deployed on Robinhood Testnet chain 46630:** `0x754cb296Fa60DAcA5f4DCb2E9DF750267114DD33`. Source of truth: [Stonk escrow deployment workflow #39183713778](https://github.com/skinny1-code/stonk-intern-work/actions/runs/39183713778), deploy tx `0xb1a207d7da0f6babe3ffde76314daa1716bcb343ae8b68ca9a966c84aacfd719`, artifact `single-intern-escrow-testnet-proof` / `12157386803`.
- Repair in existing branch commit `431a65b5bd63837a94d2d527111e5eca7b6b717d`: only known chain-46630 escrows are permitted; deploy can select `LAURA_INTERN_ESCROW_ADDRESS=0x754cb296Fa60DAcA5f4DCb2E9DF750267114DD33` **server side**. Invalid/custom addresses fail closed. Existing owner NFT, Intern #3536, payout TBA, board allowlist, RPC, read-only policy, LLM evidence boundaries, no-key-custody policy remain unchanged.
- Correct new test must use `LAURA_WORK_BOARD_URL=https://stonk-intern-work-pr45-qa.onrender.com` and an authenticated original board record from the new escrow. The previous LAURA default is preserved for legacy isolated testing; do not silently select an arbitrary chain or board.
- On 2026-10-19, the QA gateway reported retries with HTTP **429** and then **502** for this LAURA Render service. The last directly inspected LAURA application log showed a running host and an authenticated handler rejecting an invalid job ID, **not** a successful new-job execution. Network and model reliability must be retested after deployment; do not mark this gate passing merely because the host's build is green.
- Release sequence: run branch CI -> deploy/restart existing LAURA Render host on reviewed commit -> set `LAURA_INTERN_ESCROW_ADDRESS` via Render Environment -> confirm authenticated read-only real-model execution for a *fresh* funded, assigned job -> return immutable evidence -> independent Stonk verifier approval and final receipt. Never place signer private keys on LAURA.
- For every LAURA/Intern change, record its precise SHA, CI runs, Render deployment ID, signer-free evidence proof, upstream failures, and rollback in this existing file. No false success claims, no hardcoded credentials, and no new parallel executor.

---

# LAURA × Stonk Intern Work — bounded wallet verification

Status: **feature branch / draft PR. Not deployed or enabled.** Does not certify paid work.

## Scope

- Backend route: `POST /api/intern-work/execute`
- Actor: LAURA's existing Anthropic/OpenAI inference provider (no new model or API integration)
- Job: Robinhood testnet escrow #3, wallet-verification service, Intern NFT #3536.
- LAURA operates on behalf of the assigned NFT; the NFT remains an ownership/qualification and payout identity, not an AI computing device.
- This endpoint performs **no** signing, transferring, result submission, verification approval, or payout. It is separate from public read-only `/api/mcp`.

## Secure deployment prerequisites

On the existing LAURA deployment (Railway/host), configure server-side values:

```
LAURA_INTERN_WORK_ENABLED=true
LAURA_INTERN_WORK_TOKEN=<random unique 32+ character secret>
# One existing functioning inference provider is required:
SWARM_LLM_PROVIDER=openai
OPENAI_API_KEY=<existing provider key>
```

The existing `ANTHROPIC_API_KEY` provider is also supported instead of OpenAI, when configured with a valid model and adequate credits. **No mock/failed model result passes**. Do not put either key into GitHub source, browser, public MCP, logs, or the staging dashboard. Give the **same private** `LAURA_INTERN_WORK_TOKEN` to Stonk Intern Work's GitHub Actions secret, not a public environment variable. Keep `ROBINHOOD_TESTNET_DEPLOYER_KEY` **only** on the Stonk Intern Work signing side, never on LAURA.

Review and merge the LAURA draft PR, deploy exact reviewed source, verify service health, then enable the feature flag. Enabling the flag without the token fails closed.

## Endpoint request and response

Authenticated HTTP POST with `Authorization: Bearer <LAURA_INTERN_WORK_TOKEN>` and JSON body:

```json
{"boardJobId":"agentjob:2e76eb74103f0f0e7e85063e5285c863329606f29904544bfdd605131e4cbeca","internId":"3536"}
```

The response includes `report`, identical serialized `reportJson`, `resultHash` (Keccak-256 over reportJson UTF-8 bytes), and `evidenceSha256`. It contains no signatures or tokens.

LAURA reads the actual public staging board, confirms `ASSIGNED`, verifies the escrow's client/service/requirements hashes and status, checks that NFT #3536 is still owned by its authorized holder and its payout TBA matches, and reads the wallet balance, nonce, and code at one block. Wallet target selection uses exactly one explicit address from the job description; for **Test2**, which has no explicit wallet address, it reports on the authenticated hiring wallet and labels that fallback. No cross-chain or arbitrary URL/RPC selection is accepted.

LAURA's LLM summarizes only observed evidence. The report **does not** claim identity verification, full wallet security, comprehensive transaction tracing, or conclusive absence of malicious activity. A separate verifier must assess job requirements and facts.

## Submission and verification boundary

The Stonk integration `scripts/laura-submit-testnet-job3.mjs` rechecks the response hashes **and** re-queries block-pinned wallet state before any transaction. Default behavior is evidence-only (`LAURA_SUBMIT_ONCHAIN=false`). If explicitly enabled with a separate authorized testnet signer, it can call escrow `submitResult(3,resultHash)`; this moves the chain to `VERIFICATION` but **never** calls `verifyResult`, `finalize`, or any payout method. Verification and keeper remain separate roles.

The chain job deadline is binding; work that is incomplete by the deadline is not silently marked complete. If Test2 expires, use an appropriately funded **new test job**, not a backdated report or artificial state transition.

## Tests

- LAURA workflow: `LAURA Intern Work Evidence` — Next.js typecheck + offline real/model-mock/identity/terms failure tests.
- Stonk workflow: `LAURA Assigned Intern Job 3 Execution` — fail-closed evidence proof tests and worker syntax check.
- No real inference call or on-chain submission is claimed until authenticated deployment and a documented receipt succeed.
