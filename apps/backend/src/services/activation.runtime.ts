import { createPublicClient, http } from "viem";
import { db } from "../db";
import { POChain } from "../middleware/chain";
import { createActivationService } from "./activation.service";
import { loadActivationConfig } from "./activation.config";
import { createBundlerClient, pollUserOperationReceipt } from "./bundler.client";
import { createEntrypointClient } from "./entrypoint.client";
import { createPaymasterService } from "./paymaster.service";
import { WalletService } from "./wallet.service";

const config = loadActivationConfig();

const publicClient = createPublicClient({
	chain: POChain,
	transport: http(config.rpcUrl),
});

const bundlerClient = createBundlerClient({
	bundlerUrl: config.bundlerUrl,
});

const entrypointClient = createEntrypointClient({
	entryPointAddress: config.entryPointAddress,
	rpcUrl: config.rpcUrl,
});

const paymasterService = createPaymasterService({
	chainId: config.chainId,
	paymasterAddress: config.paymasterAddress,
	paymasterSignerKey: config.paymasterSignerKey,
});

export const activationService = createActivationService({
	config: {
		chainId: config.chainId,
		entryPointAddress: config.entryPointAddress,
		simple7702Address: config.simple7702Address,
		activationMarkerAddress: config.activationMarkerAddress,
		paymasterAddress: config.paymasterAddress,
	},
	deps: {
		async getUserById(userId) {
			return db.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					eoaAddress: true,
					encryptedPrivateKey: true,
					accountAddress: true,
				},
			});
		},
		async updateUser(userId, data) {
			await db.user.update({
				where: { id: userId },
				data,
			});
		},
		initUserWallet: WalletService.initUserWallet,
		async signAuthorization(encryptedPrivateKey, params) {
			const authorization = await WalletService.sign7702Auth(
				encryptedPrivateKey,
				params.contractAddress,
				params.chainId,
				params.nonce,
			);
			return {
				...authorization,
				nonce: BigInt(authorization.nonce),
				yParity: authorization.yParity === 1 ? "0x1" : "0x0",
			};
		},
		signUserOpHash: WalletService.signRawHash,
		async getTransactionCount(address) {
			return BigInt(
				await publicClient.getTransactionCount({
					address,
					blockTag: "latest",
				}),
			);
		},
		async getCode(address) {
			return (await publicClient.getCode({ address })) ?? "0x";
		},
		getAccountNonce: entrypointClient.getAccountNonce,
		getUserOpHash: entrypointClient.getUserOpHash,
		estimateUserOperationGas: bundlerClient.estimateUserOperationGas,
		sponsorUserOperation: paymasterService.sponsorUserOperation,
		sendUserOperation: bundlerClient.sendUserOperation,
		pollUserOperationReceipt(userOpHash) {
			return pollUserOperationReceipt(bundlerClient, userOpHash, {
				maxAttempts: 20,
				intervalMs: 1_000,
			});
		},
	},
});
