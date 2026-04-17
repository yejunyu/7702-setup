import { afterEach, describe, expect, it } from "bun:test";
import { hexToBigInt, parseAbi, type Address, type Hex } from "viem";
import {
	createBundlerClient,
	pollUserOperationReceipt,
} from "./bundler.client";
import { createEntrypointClient } from "./entrypoint.client";

const makeAddress = (suffix: string): Address =>
	`0x${suffix.padStart(40, "0")}` as Address;

const entryPointAbi = parseAbi([
	"function getNonce(address sender, uint192 key) view returns (uint256)",
]);

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("createEntrypointClient", () => {
	it("reads the account nonce from EntryPoint.getNonce(sender, 0)", async () => {
		let capturedArgs: readonly unknown[] | undefined;
		const client = createEntrypointClient({
			readContract: async (request) => {
				capturedArgs = request.args;
				return 7n;
			},
			entryPointAddress: makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
			entryPointAbi,
		});

		const nonce = await client.getAccountNonce(
			makeAddress("1111111111111111111111111111111111111111"),
		);

		expect(nonce).toBe(7n);
		expect(capturedArgs).toEqual([
			makeAddress("1111111111111111111111111111111111111111"),
			0n,
		]);
	});
});

describe("createBundlerClient", () => {
	it("sends eth_estimateUserOperationGas with the userOp and entry point", async () => {
		let capturedBody = "";
		globalThis.fetch = (async (_input, init) => {
			capturedBody = String(init?.body);
			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					result: {
						preVerificationGas: "0x100",
						verificationGasLimit: "0x200",
						callGasLimit: "0x300",
						paymasterVerificationGasLimit: "0x400",
						paymasterPostOpGasLimit: "0x500",
					},
				}),
			);
		}) as typeof fetch;

		const bundler = createBundlerClient({
			bundlerUrl: "http://127.0.0.1:14337",
		});

		const result = await bundler.estimateUserOperationGas(
			{
				sender: makeAddress("1111111111111111111111111111111111111111"),
				nonce: "0x0",
				factory: "0x7702",
				factoryData: "0x",
				callData: "0x1234",
				signature: "0x",
			},
			makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
		);

		expect(result.callGasLimit).toBe(0x300n);
		expect(JSON.parse(capturedBody)).toMatchObject({
			method: "eth_estimateUserOperationGas",
			params: [
				{
					sender: makeAddress("1111111111111111111111111111111111111111"),
					callData: "0x1234",
				},
				makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
			],
		});
	});

	it("sends eth_sendUserOperation and returns the userOpHash", async () => {
		globalThis.fetch = ((async () =>
			new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					result:
						"0x87b8c8a95d67b556d4de9d3f33cf4dc26d2e952ad5aa84ce61fad6b9019b524c",
				}),
			)) as unknown) as typeof fetch;

		const bundler = createBundlerClient({
			bundlerUrl: "http://127.0.0.1:14337",
		});

		const userOpHash = await bundler.sendUserOperation(
			{
				sender: makeAddress("1111111111111111111111111111111111111111"),
				nonce: "0x0",
				factory: "0x7702",
				factoryData: "0x",
				callData: "0x1234",
				signature: "0xabcd",
			},
			makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
		);

		expect(userOpHash).toBe(
			"0x87b8c8a95d67b556d4de9d3f33cf4dc26d2e952ad5aa84ce61fad6b9019b524c",
		);
	});

	it("polls until a successful receipt is returned", async () => {
		let calls = 0;
		globalThis.fetch = ((async () => {
			calls += 1;
			return new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					result:
						calls < 2
							? null
							: {
									success: true,
									receipt: {
										transactionHash:
											"0xfbe4cab3b426d690af18c808489bc7b25ff0b316780535ef918f4bece7b9fb55",
									},
								},
				}),
			);
		}) as unknown) as typeof fetch;

		const bundler = createBundlerClient({
			bundlerUrl: "http://127.0.0.1:14337",
		});

		const receipt = await pollUserOperationReceipt(
			bundler,
			"0x87b8c8a95d67b556d4de9d3f33cf4dc26d2e952ad5aa84ce61fad6b9019b524c",
			{ maxAttempts: 3, intervalMs: 0 },
		);

		expect(receipt.success).toBe(true);
		expect(calls).toBe(2);
	});

	it("throws when receipt polling times out", async () => {
		globalThis.fetch = ((async () =>
			new Response(
				JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					result: null,
				}),
			)) as unknown) as typeof fetch;

		const bundler = createBundlerClient({
			bundlerUrl: "http://127.0.0.1:14337",
		});

		expect(
			pollUserOperationReceipt(
				bundler,
				"0x87b8c8a95d67b556d4de9d3f33cf4dc26d2e952ad5aa84ce61fad6b9019b524c",
				{ maxAttempts: 2, intervalMs: 0 },
			),
		).rejects.toThrow("Timed out waiting for user operation receipt");
	});
});
