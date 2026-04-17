# Backend 7702 Activation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real `/web3/activate` backend flow that creates or loads a user EOA, signs EIP-7702 authorization, sponsors the operation with the configured paymaster, submits the final UserOperation to the bundler, and persists successful activation state.

**Architecture:** Keep the HTTP route thin and move the activation pipeline into dedicated services. The pipeline must preserve the correct ordering: load wallet, fetch both nonces, build authorization and draft userOp, estimate gas, sign paymaster payload from the final estimated userOp, compute and sign the raw `userOpHash`, submit to the bundler, then verify/persist the result.

**Tech Stack:** Bun, Elysia, Prisma, viem, JSON-RPC, local ABI files in `src/abi`

---

### Task 1: Environment and Config Guardrails

**Files:**
- Create: `src/services/activation.config.ts`
- Modify: `env.example`
- Test: `src/services/activation.config.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- missing required env vars throw clear startup errors
- valid env vars return normalized addresses/URLs/chain id
- ABI file loading fails loudly if the ABI JSON is malformed

**Step 2: Run test to verify it fails**

Run: `rtk bun test src/services/activation.config.test.ts`
Expected: FAIL because config loader does not exist yet.

**Step 3: Write minimal implementation**

Implement a config module that validates and exports:
- `RPC_URL`
- `BUNDLER_URL`
- `ENTRY_POINT_ADDRESS`
- `PAYMASTER`
- `PAYMASTER_SIGNER_KEY`
- `SIMPLE7702`
- `ACTIVATION_MARKER`
- optional `CHAIN_ID` with default `714`

**Step 4: Run test to verify it passes**

Run: `rtk bun test src/services/activation.config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add env.example src/services/activation.config.ts src/services/activation.config.test.ts docs/plans/2026-04-17-backend-7702-activation.md
git commit -m "feat: add activation config validation"
```

### Task 2: Bundler and EntryPoint RPC Helpers

**Files:**
- Create: `src/services/bundler.client.ts`
- Create: `src/services/entrypoint.client.ts`
- Test: `src/services/bundler.client.test.ts`

**Step 1: Write the failing test**

Add tests for:
- `getAccountNonce(sender)` uses `EntryPoint.getNonce(sender, 0)`
- `estimateUserOperationGas` sends the correct JSON-RPC payload
- `sendUserOperation` sends the final userOp and returns the `userOpHash`
- receipt polling stops on success and errors on timeout

**Step 2: Run test to verify it fails**

Run: `rtk bun test src/services/bundler.client.test.ts`
Expected: FAIL because helper clients do not exist yet.

**Step 3: Write minimal implementation**

Implement thin RPC clients around:
- `eth_estimateUserOperationGas`
- `eth_sendUserOperation`
- `eth_getUserOperationReceipt`
- optional `skandha_userOperationStatus`
- `EntryPoint.getNonce`
- `EntryPoint.balanceOf`

**Step 4: Run test to verify it passes**

Run: `rtk bun test src/services/bundler.client.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/bundler.client.ts src/services/entrypoint.client.ts src/services/bundler.client.test.ts
git commit -m "feat: add bundler and entrypoint rpc clients"
```

### Task 3: Paymaster Sponsorship Helpers

**Files:**
- Create: `src/services/paymaster.service.ts`
- Test: `src/services/paymaster.service.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- the EIP-712 domain matches `MyPaymasterECDSASigner` / `1`
- signing uses the configured paymaster signer private key
- `paymasterData` packs validity window and signature in the expected order

**Step 2: Run test to verify it fails**

Run: `rtk bun test src/services/paymaster.service.test.ts`
Expected: FAIL because the paymaster service does not exist yet.

**Step 3: Write minimal implementation**

Implement helpers that:
- accept the final estimated userOp
- sign the paymaster sponsorship payload
- return `paymaster`, gas limits, and encoded `paymasterData`

**Step 4: Run test to verify it passes**

Run: `rtk bun test src/services/paymaster.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/paymaster.service.ts src/services/paymaster.service.test.ts
git commit -m "feat: add paymaster sponsorship service"
```

### Task 4: Activation Pipeline Service

**Files:**
- Create: `src/services/activation.service.ts`
- Modify: `src/services/wallet.service.ts`
- Test: `src/services/activation.service.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- missing wallet triggers wallet creation and persistence
- authorization nonce and userOp nonce are fetched independently
- draft userOp uses `sender = eoaAddress` and `factory = 0x7702`
- final signature signs the raw `userOpHash`
- successful activation updates `accountAddress`

**Step 2: Run test to verify it fails**

Run: `rtk bun test src/services/activation.service.test.ts`
Expected: FAIL because the activation service does not exist yet.

**Step 3: Write minimal implementation**

Implement the orchestrator:
- load or initialize wallet
- sign `eip7702Auth`
- build `execute(ActivationMarker.ping())`
- build draft userOp
- estimate gas
- attach paymaster data
- compute final userOpHash
- sign raw digest
- submit to bundler
- poll receipt and verify code/persist state

**Step 4: Run test to verify it passes**

Run: `rtk bun test src/services/activation.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/activation.service.ts src/services/wallet.service.ts src/services/activation.service.test.ts
git commit -m "feat: add 7702 activation pipeline"
```

### Task 5: Route Wiring and App Integration

**Files:**
- Modify: `src/routes/web3.route.ts`
- Modify: `src/index.ts`
- Test: `src/routes/web3.route.test.ts`

**Step 1: Write the failing test**

Add tests that verify:
- `/web3/activate` is mounted
- authenticated requests call the activation service
- success responses include activation metadata
- failures map to stable error codes/messages

**Step 2: Run test to verify it fails**

Run: `rtk bun test src/routes/web3.route.test.ts`
Expected: FAIL because the route is not mounted and does not use the activation service yet.

**Step 3: Write minimal implementation**

Update the route to delegate to `activation.service.ts` and mount `web3Router` in `src/index.ts`.

**Step 4: Run test to verify it passes**

Run: `rtk bun test src/routes/web3.route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/web3.route.ts src/index.ts src/routes/web3.route.test.ts
git commit -m "feat: wire backend 7702 activation route"
```

### Task 6: Full Verification

**Files:**
- Verify: `src/services/*.ts`
- Verify: `src/routes/*.ts`
- Verify: `env.example`

**Step 1: Run focused tests**

Run: `rtk bun test src/services/activation.config.test.ts src/services/bundler.client.test.ts src/services/paymaster.service.test.ts src/services/activation.service.test.ts src/routes/web3.route.test.ts`
Expected: PASS

**Step 2: Run type-check**

Run: `rtk bunx tsc --noEmit`
Expected: PASS

**Step 3: Smoke-run app**

Run: `rtk bun run src/index.ts`
Expected: app starts cleanly if the local port is free and required env vars are set

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement backend paymaster-sponsored 7702 activation"
```
