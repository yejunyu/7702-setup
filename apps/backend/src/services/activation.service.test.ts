import { describe, expect, it } from "bun:test";
import { type Address, type Hex } from "viem";
import { createActivationService } from "./activation.service";

const makeAddress = (suffix: string): Address =>
	`0x${suffix.padStart(40, "0")}` as Address;

const eoaAddress = makeAddress("1111111111111111111111111111111111111111");
const implementationAddress = makeAddress(
	"a46cc63ebf4bd77888aa327837d20b23a63a56b5",
);
const entryPointAddress = makeAddress(
	"433709009b8330fda32311df1c2afa402ed8d009",
);
const paymasterAddress = makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d");
const activationMarkerAddress = makeAddress(
	"7082f278ff101b775e3b98bd5bd6085a67944a2f",
);
const encryptedPrivateKey = "cipher:iv:tag";

describe("createActivationService", () => {
	it("initializes a wallet when the user does not have one and persists activation", async () => {
		const updates: Array<Record<string, unknown>> = [];
		let authorizationNonceSeen: bigint | undefined;
		let userOpNonceSeen: bigint | undefined;
		let userOpHashSeen: Hex | undefined;

		const service = createActivationService({
			config: {
				chainId: 714,
				entryPointAddress,
				simple7702Address: implementationAddress,
				activationMarkerAddress,
				paymasterAddress,
			},
			deps: {
				getUserById: async () => ({
					id: 7,
					eoaAddress: null,
					encryptedPrivateKey: null,
					accountAddress: null,
				}),
				updateUser: async (_userId, data) => {
					updates.push(data);
				},
				initUserWallet: async () => ({
					address: eoaAddress,
					encryptPrivateKey: encryptedPrivateKey,
				}),
				signAuthorization: async (_encrypted, params) => {
					authorizationNonceSeen = params.nonce;
					return {
						address: params.contractAddress,
						chainId: params.chainId,
						nonce: params.nonce,
						r: "0x1",
						s: "0x2",
						yParity: "0x0",
					};
				},
				signUserOpHash: async (_encrypted, hash) => {
					userOpHashSeen = hash;
					return "0xabcdef";
				},
				getTransactionCount: async () => 148n,
				getCode: async () =>
					"0xef0100a46cc63ebf4bd77888aa327837d20b23a63a56b5",
				getAccountNonce: async () => 0n,
				getUserOpHash: async (packed) => {
					userOpNonceSeen = packed.nonce;
					return "0x1234" as Hex;
				},
				estimateUserOperationGas: async (draft, ep) => {
					expect(draft.sender).toBe(eoaAddress);
					expect(draft.factory).toBe("0x7702");
					expect(ep).toBe(entryPointAddress);

					return {
						preVerificationGas: 21000n,
						verificationGasLimit: 400000n,
						callGasLimit: 200000n,
						paymasterVerificationGasLimit: 100000n,
						paymasterPostOpGasLimit: 300000n,
					};
				},
				sponsorUserOperation: async (userOp, overrides) => {
					expect(userOp.sender).toBe(eoaAddress);
					expect(overrides.validAfter).toBe(0n);
					return {
						paymaster: paymasterAddress,
						paymasterVerificationGasLimit: 100000n,
						paymasterPostOpGasLimit: 300000n,
						validAfter: 0n,
						validUntil: 3600n,
						signature: "0xfeed",
						paymasterData: "0x000000000000000000000000feed",
					};
				},
				sendUserOperation: async (userOp, ep) => {
					expect(userOp.signature).toBe("0xabcdef");
					expect(ep).toBe(entryPointAddress);
					return "0x1234";
				},
				pollUserOperationReceipt: async (userOpHash) => {
					expect(userOpHash).toBe("0x1234");
					return {
						success: true,
						receipt: {
							transactionHash:
								"0xfbe4cab3b426d690af18c808489bc7b25ff0b316780535ef918f4bece7b9fb55",
						},
					};
				},
			},
		});

		const result = await service.activateUser(7);

		expect(authorizationNonceSeen).toBe(148n);
		expect(userOpNonceSeen).toBe(0n);
		expect(userOpHashSeen).toBe("0x1234");
		expect(result.eoaAddress).toBe(eoaAddress);
		expect(result.accountAddress).toBe(eoaAddress);
		expect(result.userOpHash).toBe("0x1234");
		expect(result.receipt?.success).toBe(true);
		expect(updates).toEqual([
			{
				eoaAddress,
				encryptedPrivateKey,
			},
			{
				accountAddress: eoaAddress,
			},
		]);
	});
});
