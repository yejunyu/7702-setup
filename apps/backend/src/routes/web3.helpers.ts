import { isAddress, type Address } from "viem";

type WalletMaterial = {
	eoaAddress: string | null;
	encryptedPrivateKey: string | null;
};

type GeneratedWallet = {
	address: string;
	encryptPrivateKey: string;
};

export const requireContractAddress = (
	value: string | undefined,
	envName: string,
): Address => {
	if (!value) {
		throw new Error(`FATAL: ${envName} is missing`);
	}

	if (!isAddress(value)) {
		throw new Error(`FATAL: ${envName} must be a valid EVM address`);
	}

	return value;
};

export const resolveWalletMaterial = (
	current: WalletMaterial,
	created?: GeneratedWallet,
) => {
	const eoaAddress = created?.address ?? current.eoaAddress;
	const encryptedPrivateKey =
		created?.encryptPrivateKey ?? current.encryptedPrivateKey;

	if (!eoaAddress || !encryptedPrivateKey) {
		throw new Error("Failed to initialize wallet");
	}

	return {
		eoaAddress,
		encryptedPrivateKey,
	};
};
