import { describe, expect, it } from "bun:test";
import {
	encodePacked,
	recoverTypedDataAddress,
	type Address,
	type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
	buildPaymasterData,
	createPaymasterService,
	type PaymasterSignableUserOperation,
} from "./paymaster.service";

const makeAddress = (suffix: string): Address =>
	`0x${suffix.padStart(40, "0")}` as Address;

const signerPrivateKey =
	"0x9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3" as Hex;

const baseUserOp: PaymasterSignableUserOperation = {
	sender: makeAddress("1111111111111111111111111111111111111111"),
	nonce: 1n,
	initCode: "0x",
	callData: "0xb61d27f60000000000000000000000007082f278ff101b775e3b98bd5bd6085a67944a2f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045c36b18600000000000000000000000000000000000000000000000000000000",
	accountGasLimits:
		"0x00000000000000000000000000061a8000000000000000000000000000030d40",
	preVerificationGas: 0x5208n,
	gasFees:
		"0x0000000000000000000000003b9aca0000000000000000000000000077359400",
	paymasterVerificationGasLimit: 100000n,
	paymasterPostOpGasLimit: 300000n,
};

describe("buildPaymasterData", () => {
	it("packs validAfter + validUntil + signature in order", () => {
		const payload = buildPaymasterData({
			validAfter: 10n,
			validUntil: 20n,
			signature: "0x12345678",
		});

		expect(payload).toBe(
			encodePacked(
				["uint48", "uint48", "bytes"],
				[10, 20, "0x12345678"],
			),
		);
		expect(payload.slice(2, 14)).toBe("00000000000a");
		expect(payload.slice(14, 26)).toBe("000000000014");
	});
});

describe("createPaymasterService", () => {
	it("signs UserOperationRequest with the configured signer and domain", async () => {
		const service = createPaymasterService({
			chainId: 714,
			paymasterAddress: makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d"),
			paymasterSignerKey: signerPrivateKey,
		});

		const sponsored = await service.sponsorUserOperation(baseUserOp, {
			validAfter: 0n,
			validUntil: 3600n,
		});

		const recovered = await recoverTypedDataAddress({
			domain: {
				chainId: 714,
				name: "MyPaymasterECDSASigner",
				verifyingContract: makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d"),
				version: "1",
			},
			types: {
				UserOperationRequest: [
					{ name: "sender", type: "address" },
					{ name: "nonce", type: "uint256" },
					{ name: "initCode", type: "bytes" },
					{ name: "callData", type: "bytes" },
					{ name: "accountGasLimits", type: "bytes32" },
					{ name: "preVerificationGas", type: "uint256" },
					{ name: "gasFees", type: "bytes32" },
					{ name: "paymasterVerificationGasLimit", type: "uint256" },
					{ name: "paymasterPostOpGasLimit", type: "uint256" },
					{ name: "validAfter", type: "uint48" },
					{ name: "validUntil", type: "uint48" },
				],
			},
			primaryType: "UserOperationRequest",
				message: {
					...baseUserOp,
					validAfter: 0,
					validUntil: 3600,
				},
				signature: sponsored.signature,
		});

		expect(recovered).toBe(privateKeyToAccount(signerPrivateKey).address);
		expect(sponsored.paymaster).toBe(
			makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d"),
		);
		expect(sponsored.paymasterData).toBe(
			encodePacked(
				["uint48", "uint48", "bytes"],
				[0, 3600, sponsored.signature],
			),
		);
	});
});
