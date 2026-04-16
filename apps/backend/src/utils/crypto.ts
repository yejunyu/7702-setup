// src/utils/crypto.ts
import crypto from "crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

// 检查环境变量
if (
	!Bun.env.WALLET_ENCRYPTION_KEY ||
	Bun.env.WALLET_ENCRYPTION_KEY.length !== 64
) {
	throw new Error(
		"FATAL: WALLET_ENCRYPTION_KEY is missing or invalid (must be 64 hex chars)",
	);
}

const ENCRYPTION_KEY = Buffer.from(Bun.env.WALLET_ENCRYPTION_KEY, "hex");
const ALGORITHM = "aes-256-gcm";

export const WalletHelper = {
	/**
	 * 生成一个新的 EOA 钱包
	 * 返回: { address, privateKey }
	 */
	createEOA: () => {
		const privateKey = generatePrivateKey();
		const account = privateKeyToAccount(privateKey);
		return {
			address: account.address,
			privateKey: privateKey,
		};
	},

	/**
	 * 加密私钥 (AES-256-GCM)
	 * 返回: base64 格式的 密文:iv:authTag
	 */
	encryptPrivateKey: (privateKey: string): string => {
		const iv = crypto.randomBytes(12); // GCM 标准的 12 字节 IV
		const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

		let encrypted = cipher.update(privateKey, "utf8", "base64");
		encrypted += cipher.final("base64");
		const authTag = cipher.getAuthTag().toString("base64");

		// 将 IV、密文和验证标签拼装在一起存入数据库
		return `${encrypted}:${iv.toString("base64")}:${authTag}`;
	},

	/**
	 * 解密私钥
	 */
	decryptPrivateKey: (encryptedData: string): string => {
		const parts = encryptedData.split(":");
		if (parts.length !== 3)
			throw new Error("Invalid encrypted private key format");

		const [encrypted, ivBase64, authTagBase64] = parts;
		const iv = Buffer.from(ivBase64, "base64");
		const authTag = Buffer.from(authTagBase64, "base64");

		const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encrypted, "base64", "utf8");
		decrypted += decipher.final("utf8");
		return decrypted;
	},
};
