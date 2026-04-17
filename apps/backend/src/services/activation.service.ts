import {
	concatHex,
	encodeFunctionData,
	pad,
	parseAbi,
	toHex,
	type Address,
	type Hex,
} from "viem";
import { resolveWalletMaterial } from "../routes/web3.helpers";

const simple7702Abi = parseAbi([
	"function execute(address target, uint256 value, bytes data)",
]);

const activationMarkerAbi = parseAbi(["function ping()"]);

type UserRecord = {
	id: number;
	eoaAddress: string | null;
	encryptedPrivateKey: string | null;
	accountAddress: string | null;
};

type AuthorizationPayload = {
	address: Address;
	chainId: number;
	nonce: bigint;
	r: Hex | string;
	s: Hex | string;
	yParity: "0x0" | "0x1";
};

type EstimatedGas = {
	preVerificationGas: bigint;
	verificationGasLimit: bigint;
	callGasLimit: bigint;
	paymasterVerificationGasLimit?: bigint;
	paymasterPostOpGasLimit?: bigint;
};

type UserOperationDraft = {
	sender: Address;
	nonce: string;
	factory: "0x7702";
	factoryData: "0x";
	callData: Hex;
	signature: Hex;
	preVerificationGas?: string;
	verificationGasLimit?: string;
	callGasLimit?: string;
	maxFeePerGas?: string;
	maxPriorityFeePerGas?: string;
	paymaster?: Address;
	paymasterVerificationGasLimit?: string;
	paymasterPostOpGasLimit?: string;
	paymasterData?: Hex;
	eip7702Auth?: AuthorizationPayload;
};

type PackedUserOperation = {
	sender: Address;
	nonce: bigint;
	initCode: Hex;
	callData: Hex;
	accountGasLimits: Hex;
	preVerificationGas: bigint;
	gasFees: Hex;
	paymasterAndData: Hex;
	signature: Hex;
};

type SponsoredUserOperation = {
	paymaster: Address;
	paymasterVerificationGasLimit: bigint;
	paymasterPostOpGasLimit: bigint;
	validAfter: bigint;
	validUntil: bigint;
	signature: Hex;
	paymasterData: Hex;
};

type ActivationDeps = {
	getUserById(userId: number): Promise<UserRecord | null>;
	updateUser(userId: number, data: Record<string, unknown>): Promise<void>;
	initUserWallet(userId: number): Promise<{
		address: string;
		encryptPrivateKey: string;
	}>;
	signAuthorization(
		encryptedPrivateKey: string,
		params: {
			contractAddress: Address;
			chainId: number;
			nonce: bigint;
		},
	): Promise<AuthorizationPayload>;
	signUserOpHash(encryptedPrivateKey: string, userOpHash: Hex): Promise<Hex>;
	getTransactionCount(sender: Address): Promise<bigint>;
	getCode(address: Address): Promise<Hex>;
	getAccountNonce(sender: Address): Promise<bigint>;
	getUserOpHash(userOp: PackedUserOperation): Promise<Hex>;
	estimateUserOperationGas(
		userOp: UserOperationDraft,
		entryPointAddress: Address,
	): Promise<EstimatedGas>;
	sponsorUserOperation(
		userOp: {
			sender: Address;
			nonce: bigint;
			initCode: Hex;
			callData: Hex;
			accountGasLimits: Hex;
			preVerificationGas: bigint;
			gasFees: Hex;
			paymasterVerificationGasLimit: bigint;
			paymasterPostOpGasLimit: bigint;
		},
		overrides: { validAfter?: bigint; validUntil?: bigint },
	): Promise<SponsoredUserOperation>;
	sendUserOperation(
		userOp: UserOperationDraft,
		entryPointAddress: Address,
	): Promise<string>;
	pollUserOperationReceipt(userOpHash: string): Promise<{
		success: boolean;
		receipt?: {
			transactionHash?: string;
		};
	}>;
};

type ActivationConfig = {
	chainId: number;
	entryPointAddress: Address;
	simple7702Address: Address;
	activationMarkerAddress: Address;
	paymasterAddress: Address;
};

const packTwoUint128 = (high: bigint, low: bigint): Hex =>
	concatHex([pad(toHex(high), { size: 16 }), pad(toHex(low), { size: 16 })]);

const buildPaymasterAndData = (sponsored: SponsoredUserOperation): Hex =>
	concatHex([
		sponsored.paymaster,
		pad(toHex(sponsored.paymasterVerificationGasLimit), { size: 16 }),
		pad(toHex(sponsored.paymasterPostOpGasLimit), { size: 16 }),
		sponsored.paymasterData,
	]);

const buildActivationCallData = (activationMarkerAddress: Address): Hex => {
	const pingCallData = encodeFunctionData({
		abi: activationMarkerAbi,
		functionName: "ping",
	});

	return encodeFunctionData({
		abi: simple7702Abi,
		functionName: "execute",
		args: [activationMarkerAddress, 0n, pingCallData],
	});
};

export const createActivationService = ({
	config,
	deps,
}: {
	config: ActivationConfig;
	deps: ActivationDeps;
}) => {
	return {
		async activateUser(userId: number) {
			const user = await deps.getUserById(userId);
			if (!user) {
				throw new Error("User not found");
			}

			let createdWallet:
				| Awaited<ReturnType<ActivationDeps["initUserWallet"]>>
				| undefined;
			if (!user.eoaAddress || !user.encryptedPrivateKey) {
				createdWallet = await deps.initUserWallet(userId);
				await deps.updateUser(userId, {
					eoaAddress: createdWallet.address,
					encryptedPrivateKey: createdWallet.encryptPrivateKey,
				});
			}

			const wallet = resolveWalletMaterial(
				{
					eoaAddress: user.eoaAddress,
					encryptedPrivateKey: user.encryptedPrivateKey,
				},
				createdWallet,
			);

			const sender = wallet.eoaAddress as Address;
			const authorizationNonce = await deps.getTransactionCount(sender);
			const userOpNonce = await deps.getAccountNonce(sender);

			const authorization = await deps.signAuthorization(
				wallet.encryptedPrivateKey,
				{
					contractAddress: config.simple7702Address,
					chainId: config.chainId,
					nonce: authorizationNonce,
				},
			);

			const callData = buildActivationCallData(config.activationMarkerAddress);
			const draftUserOp: UserOperationDraft = {
				sender,
				nonce: toHex(userOpNonce),
				factory: "0x7702",
				factoryData: "0x",
				callData,
				signature: "0x",
				eip7702Auth: authorization,
			};

			const estimatedGas = await deps.estimateUserOperationGas(
				draftUserOp,
				config.entryPointAddress,
			);

			const maxPriorityFeePerGas = 1_000_000_000n;
			const maxFeePerGas = 2_000_000_000n;
			const packedForHashBase = {
				sender,
				nonce: userOpNonce,
				initCode: "0x7702" as Hex,
				callData,
				accountGasLimits: packTwoUint128(
					estimatedGas.verificationGasLimit,
					estimatedGas.callGasLimit,
				),
				preVerificationGas: estimatedGas.preVerificationGas,
				gasFees: packTwoUint128(maxPriorityFeePerGas, maxFeePerGas),
			};

			const sponsored = await deps.sponsorUserOperation(
				{
					...packedForHashBase,
					paymasterVerificationGasLimit:
						estimatedGas.paymasterVerificationGasLimit ?? 100000n,
					paymasterPostOpGasLimit:
						estimatedGas.paymasterPostOpGasLimit ?? 300000n,
				},
				{ validAfter: 0n, validUntil: 3600n },
			);

			const packedUserOp: PackedUserOperation = {
				...packedForHashBase,
				paymasterAndData: buildPaymasterAndData(sponsored),
				signature: "0x",
			};

			const userOpHash = await deps.getUserOpHash(packedUserOp);
			const signature = await deps.signUserOpHash(
				wallet.encryptedPrivateKey,
				userOpHash,
			);

			const finalUserOp: UserOperationDraft = {
				...draftUserOp,
				preVerificationGas: toHex(estimatedGas.preVerificationGas),
				verificationGasLimit: toHex(estimatedGas.verificationGasLimit),
				callGasLimit: toHex(estimatedGas.callGasLimit),
				maxPriorityFeePerGas: toHex(maxPriorityFeePerGas),
				maxFeePerGas: toHex(maxFeePerGas),
				paymaster: sponsored.paymaster,
				paymasterVerificationGasLimit: toHex(
					sponsored.paymasterVerificationGasLimit,
				),
				paymasterPostOpGasLimit: toHex(sponsored.paymasterPostOpGasLimit),
				paymasterData: sponsored.paymasterData,
				signature,
			};

			const submittedUserOpHash = await deps.sendUserOperation(
				finalUserOp,
				config.entryPointAddress,
			);
			const receipt = await deps.pollUserOperationReceipt(submittedUserOpHash);
			const code = await deps.getCode(sender);

			if (!receipt.success) {
				throw new Error("Activation transaction failed");
			}
			if (
				!code
					.toLowerCase()
					.startsWith(`0xef0100${config.simple7702Address.slice(2).toLowerCase()}`)
			) {
				throw new Error("7702 code was not installed on sender");
			}

			await deps.updateUser(userId, {
				accountAddress: sender,
			});

			return {
				eoaAddress: sender,
				accountAddress: sender,
				authorization,
				userOp: finalUserOp,
				userOpHash: submittedUserOpHash,
				receipt,
			};
		},
	};
};
