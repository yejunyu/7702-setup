import {
	encodePacked,
	type Address,
	type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type PaymasterSignableUserOperation = {
	sender: Address;
	nonce: bigint;
	initCode: Hex;
	callData: Hex;
	accountGasLimits: Hex;
	preVerificationGas: bigint;
	gasFees: Hex;
	paymasterVerificationGasLimit: bigint;
	paymasterPostOpGasLimit: bigint;
};

const userOperationRequestTypes = {
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
} as const;

export const buildPaymasterData = ({
	validAfter,
	validUntil,
	signature,
}: {
	validAfter: bigint;
	validUntil: bigint;
	signature: Hex;
}) =>
	encodePacked(
		["uint48", "uint48", "bytes"],
		[Number(validAfter), Number(validUntil), signature],
	);

export const createPaymasterService = ({
	chainId,
	paymasterAddress,
	paymasterSignerKey,
}: {
	chainId: number;
	paymasterAddress: Address;
	paymasterSignerKey: Hex;
}) => {
	const signer = privateKeyToAccount(paymasterSignerKey);

	return {
		async sponsorUserOperation(
			userOp: PaymasterSignableUserOperation,
			{
				validAfter = 0n,
				validUntil = 0n,
			}: { validAfter?: bigint; validUntil?: bigint } = {},
		) {
			const signature = await signer.signTypedData({
				domain: {
					chainId,
					name: "MyPaymasterECDSASigner",
					verifyingContract: paymasterAddress,
					version: "1",
				},
				types: userOperationRequestTypes,
				primaryType: "UserOperationRequest",
				message: {
					...userOp,
					validAfter: Number(validAfter),
					validUntil: Number(validUntil),
				},
			});

			return {
				paymaster: paymasterAddress,
				paymasterVerificationGasLimit: userOp.paymasterVerificationGasLimit,
				paymasterPostOpGasLimit: userOp.paymasterPostOpGasLimit,
				validAfter,
				validUntil,
				signature,
				paymasterData: buildPaymasterData({
					validAfter,
					validUntil,
					signature,
				}),
			};
		},
	};
};
