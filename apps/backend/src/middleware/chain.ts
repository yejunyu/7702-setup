import { defineChain } from "viem";

export const POChain = defineChain({
	id: 714,
	name: "poc",
	testnet: true,
	nativeCurrency: {
		decimals: 18,
		name: "POChain",
		symbol: "POC",
	},

	rpcUrls: {
		default: { http: [Bun.env.RPC_URL || "http://127.0.0.1:8545"] },
		public: { http: [Bun.env.RPC_URL || "http://127.0.0.1:8545"] },
	},
});
