import { type Address } from "viem";

type JsonRpcSuccess<T> = {
	jsonrpc: "2.0";
	id: number;
	result: T;
};

type JsonRpcFailure = {
	jsonrpc: "2.0";
	id: number;
	error: {
		code: number;
		message: string;
	};
};

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure;

export type UserOperationDraft = {
	sender: Address;
	nonce: string;
	factory: "0x7702" | string;
	factoryData: string;
	callData: string;
	signature: string;
	preVerificationGas?: string;
	verificationGasLimit?: string;
	callGasLimit?: string;
	paymaster?: Address;
	paymasterVerificationGasLimit?: string;
	paymasterPostOpGasLimit?: string;
	paymasterData?: string;
};

export type UserOperationGasEstimate = {
	preVerificationGas: bigint;
	verificationGasLimit: bigint;
	callGasLimit: bigint;
	paymasterVerificationGasLimit?: bigint;
	paymasterPostOpGasLimit?: bigint;
};

export type UserOperationReceipt = {
	success: boolean;
	receipt?: {
		transactionHash?: string;
	};
};

const hexToBigInt = (value: string | undefined) =>
	value ? BigInt(value) : undefined;

const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

const createRpcCaller = (bundlerUrl: string) => {
	return async <T>(method: string, params: unknown[]): Promise<T> => {
		const response = await fetch(bundlerUrl, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method,
				params,
			}),
		});
		const payload = (await response.json()) as JsonRpcResponse<T>;
		if ("error" in payload) {
			throw new Error(`${method} failed: ${payload.error.message}`);
		}
		return payload.result;
	};
};

export const createBundlerClient = ({
	bundlerUrl,
}: {
	bundlerUrl: string;
}) => {
	const call = createRpcCaller(bundlerUrl);

	return {
		estimateUserOperationGas(
			userOp: UserOperationDraft,
			entryPointAddress: Address,
		): Promise<UserOperationGasEstimate> {
			return call<{
				preVerificationGas: string;
				verificationGasLimit: string;
				callGasLimit: string;
				paymasterVerificationGasLimit?: string;
				paymasterPostOpGasLimit?: string;
			}>("eth_estimateUserOperationGas", [userOp, entryPointAddress]).then(
				(result) => ({
					preVerificationGas: BigInt(result.preVerificationGas),
					verificationGasLimit: BigInt(result.verificationGasLimit),
					callGasLimit: BigInt(result.callGasLimit),
					paymasterVerificationGasLimit: hexToBigInt(
						result.paymasterVerificationGasLimit,
					),
					paymasterPostOpGasLimit: hexToBigInt(result.paymasterPostOpGasLimit),
				}),
			);
		},
		sendUserOperation(userOp: UserOperationDraft, entryPointAddress: Address) {
			return call<string>("eth_sendUserOperation", [userOp, entryPointAddress]);
		},
		getUserOperationReceipt(userOpHash: string) {
			return call<UserOperationReceipt | null>("eth_getUserOperationReceipt", [
				userOpHash,
			]);
		},
		getUserOperationStatus(userOpHash: string) {
			return call<unknown>("skandha_userOperationStatus", [userOpHash]);
		},
	};
};

export const pollUserOperationReceipt = async (
	bundlerClient: ReturnType<typeof createBundlerClient>,
	userOpHash: string,
	{
		maxAttempts = 10,
		intervalMs = 1_000,
	}: { maxAttempts?: number; intervalMs?: number } = {},
) => {
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const receipt = await bundlerClient.getUserOperationReceipt(userOpHash);
		if (receipt) {
			return receipt;
		}
		if (attempt < maxAttempts - 1) {
			await sleep(intervalMs);
		}
	}

	throw new Error("Timed out waiting for user operation receipt");
};
