import {
	createPublicClient,
	http,
	parseAbi,
	type Abi,
	type Address,
} from "viem";
import { POChain } from "../middleware/chain";

const defaultEntrypointAbi = parseAbi([
	"function getNonce(address sender, uint192 key) view returns (uint256)",
	"function balanceOf(address account) view returns (uint256)",
	"function getUserOpHash((address sender,uint256 nonce,bytes initCode,bytes callData,bytes32 accountGasLimits,uint256 preVerificationGas,bytes32 gasFees,bytes paymasterAndData,bytes signature) userOp) view returns (bytes32)",
]);

type ReadContractRequest = {
	address: Address;
	abi: Abi;
	functionName: string;
	args: readonly unknown[];
};

type ReadContract = (request: ReadContractRequest) => Promise<unknown>;

export const createEntrypointClient = ({
	entryPointAddress,
	entryPointAbi = defaultEntrypointAbi,
	readContract,
	rpcUrl,
}: {
	entryPointAddress: Address;
	entryPointAbi?: Abi;
	readContract?: ReadContract;
	rpcUrl?: string;
}) => {
	const defaultReader: ReadContract =
		readContract ??
		(async (request) => {
			if (!rpcUrl) {
				throw new Error("rpcUrl is required when readContract is not injected");
			}

			const client = createPublicClient({
				chain: POChain,
				transport: http(rpcUrl),
			});

			return client.readContract({
				address: request.address,
				abi: request.abi,
				functionName: request.functionName,
				args: request.args as never,
			});
		});

	return {
		getAccountNonce(sender: Address) {
			return defaultReader({
				address: entryPointAddress,
				abi: entryPointAbi,
				functionName: "getNonce",
				args: [sender, 0n],
			}) as Promise<bigint>;
		},
		getDeposit(account: Address) {
			return defaultReader({
				address: entryPointAddress,
				abi: entryPointAbi,
				functionName: "balanceOf",
				args: [account],
			}) as Promise<bigint>;
		},
		getUserOpHash(userOp: {
			sender: Address;
			nonce: bigint;
			initCode: `0x${string}`;
			callData: `0x${string}`;
			accountGasLimits: `0x${string}`;
			preVerificationGas: bigint;
			gasFees: `0x${string}`;
			paymasterAndData: `0x${string}`;
			signature: `0x${string}`;
		}) {
			return defaultReader({
				address: entryPointAddress,
				abi: entryPointAbi,
				functionName: "getUserOpHash",
				args: [userOp],
			}) as Promise<`0x${string}`>;
		},
	};
};
