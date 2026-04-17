import { describe, expect, it } from "bun:test";
import { parseAbi, type Address, type Hex } from "viem";
import {
	loadActivationConfig,
	parseAbiJson,
} from "./activation.config";

const makeHexKey = (
	value: string,
): Hex => `0x${value.padEnd(64, "1").slice(0, 64)}` as Hex;

const makeAddress = (suffix: string): Address =>
	`0x${suffix.padStart(40, "0")}` as Address;

describe("loadActivationConfig", () => {
	it("throws when required env vars are missing", () => {
		expect(() => loadActivationConfig({})).toThrow("RPC_URL is missing");
	});

	it("normalizes required env vars and defaults chain id to 714", () => {
		const config = loadActivationConfig({
			RPC_URL: "http://127.0.0.1:8545",
			BUNDLER_URL: "http://127.0.0.1:14337",
			ENTRY_POINT_ADDRESS: makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
			PAYMASTER: makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d"),
			PAYMASTER_SIGNER_KEY: makeHexKey("9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3"),
			SIMPLE7702: makeAddress("a46cc63ebf4bd77888aa327837d20b23a63a56b5"),
			ACTIVATIONMARKER: makeAddress("7082f278ff101b775e3b98bd5bd6085a67944a2f"),
		});

		expect(config.chainId).toBe(714);
		expect(config.activationMarkerAddress).toBe(
			makeAddress("7082f278ff101b775e3b98bd5bd6085a67944a2f"),
		);
	});

	it("prefers ACTIVATION_MARKER when both env names are present", () => {
		const config = loadActivationConfig({
			RPC_URL: "http://127.0.0.1:8545",
			BUNDLER_URL: "http://127.0.0.1:14337",
			ENTRY_POINT_ADDRESS: makeAddress("433709009b8330fda32311df1c2afa402ed8d009"),
			PAYMASTER: makeAddress("20d482e63bdb1d0889596a86644ba8a84ecdb78d"),
			PAYMASTER_SIGNER_KEY: makeHexKey("9b28f36fbd67381120752d6172ecdcf10e06ab2d9a1367aac00cdcd6ac7855d3"),
			SIMPLE7702: makeAddress("a46cc63ebf4bd77888aa327837d20b23a63a56b5"),
			ACTIVATIONMARKER: makeAddress("7082f278ff101b775e3b98bd5bd6085a67944a2f"),
			ACTIVATION_MARKER: makeAddress("7082f278ff101b775e3b98bd5bd6085a67944a2e"),
			CHAIN_ID: "715",
		});

		expect(config.chainId).toBe(715);
		expect(config.activationMarkerAddress).toBe(
			makeAddress("7082f278ff101b775e3b98bd5bd6085a67944a2e"),
		);
	});
});

describe("parseAbiJson", () => {
	it("parses a valid abi json string", () => {
		const abi = parseAbiJson(
			JSON.stringify([
				{
					type: "function",
					name: "ping",
					stateMutability: "nonpayable",
					inputs: [],
					outputs: [],
				},
			]),
		);

		expect(abi).toEqual(
			parseAbi(["function ping()"]),
		);
	});

	it("throws on malformed abi json", () => {
		expect(() => parseAbiJson("{bad json")).toThrow("Invalid ABI JSON");
	});
});
