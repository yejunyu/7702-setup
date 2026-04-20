import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { WalletHelper } from "../utils/crypto";

export const WalletService = {
	initUserWallet: async (userId: number) => {
		// 1. 生成钱包
		const { address, privateKey } = WalletHelper.createEOA();
		// 2. 加密私钥
		const encryptPrivateKey = WalletHelper.encryptPrivateKey(privateKey);

		return {
			address,
			encryptPrivateKey,
		};
	},

	sign7702Auth: async (
		encryptKey: string,
		contractAddress: `0x${string}`,
		chainId: number,
		nonce: number,
	) => {
		// 1. 解密
		const privateKey = WalletHelper.decryptPrivateKey(
			encryptKey,
		) as `0x${string}`;
		const eoa = privateKeyToAccount(privateKey);

		// 2. 构建7702认证对象
		const authorization = await eoa.signAuthorization({
			contractAddress,
			chainId,
			nonce,
		});
		return authorization;
	},
};
