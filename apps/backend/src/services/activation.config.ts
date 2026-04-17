import { isAddress, parseAbi, type Abi, type Address, type Hex } from "viem";

type ActivationEnv = Record<string, string | undefined>;

export type ActivationConfig = {
	rpcUrl: string;
	bundlerUrl: string;
	entryPointAddress: Address;
	paymasterAddress: Address;
	paymasterSignerKey: Hex;
	simple7702Address: Address;
	activationMarkerAddress: Address;
	chainId: number;
};

const requireEnv = (env: ActivationEnv, key: string) => {
	const value = env[key];
	if (!value) {
		throw new Error(`${key} is missing`);
	}
	return value;
};

const requireAddress = (env: ActivationEnv, key: string): Address => {
	const value = requireEnv(env, key);
	if (!isAddress(value)) {
		throw new Error(`${key} must be a valid EVM address`);
	}
	return value;
};

const requireHexKey = (env: ActivationEnv, key: string): Hex => {
	const value = requireEnv(env, key);
	if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
		throw new Error(`${key} must be a 32-byte hex private key`);
	}
	return value as Hex;
};

const readOptionalAddress = (
	env: ActivationEnv,
	...keys: string[]
): Address | undefined => {
	for (const key of keys) {
		const value = env[key];
		if (!value) {
			continue;
		}
		if (!isAddress(value)) {
			throw new Error(`${key} must be a valid EVM address`);
		}
		return value;
	}
	return undefined;
};

export const parseAbiJson = (abiJson: string): Abi => {
	try {
		return JSON.parse(abiJson) as Abi;
	} catch {
		throw new Error("Invalid ABI JSON");
	}
};

export const loadActivationConfig = (
	env: ActivationEnv = Bun.env,
): ActivationConfig => {
	const chainId = Number(env.CHAIN_ID ?? "714");
	if (!Number.isInteger(chainId) || chainId <= 0) {
		throw new Error("CHAIN_ID must be a positive integer");
	}

	return {
		rpcUrl: requireEnv(env, "RPC_URL"),
		bundlerUrl: requireEnv(env, "BUNDLER_URL"),
		entryPointAddress: requireAddress(env, "ENTRY_POINT_ADDRESS"),
		paymasterAddress: requireAddress(env, "PAYMASTER"),
		paymasterSignerKey: requireHexKey(env, "PAYMASTER_SIGNER_KEY"),
		simple7702Address: requireAddress(env, "SIMPLE7702"),
		activationMarkerAddress:
			readOptionalAddress(env, "ACTIVATION_MARKER", "ACTIVATIONMARKER") ??
			(() => {
				throw new Error("ACTIVATION_MARKER is missing");
			})(),
		chainId,
	};
};

export const activationMarkerAbi = parseAbi(["function ping()"]);
