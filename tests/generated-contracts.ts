import {
  Config,
  createConfig,
  deployContract,
  mock,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";
import {
  Address,
  createClient,
  getAddress,
  http,
  PrivateKeyAccount,
  publicActions,
  walletActions,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import { RulesEngine } from "../src/modules/rules-engine";
import * as dotenv from "dotenv";
import { connectConfig, DiamondAddress } from "../config";
import * as solc from "solc";
import * as fs from "fs";
import { PolicyJSON } from "../src/modules/validation";

dotenv.config();
// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const RULES_ENGINE_ADDRESS: Address = getAddress(DiamondAddress);
var config: Config;
var RULES_ENGINE: RulesEngine;

/**
 * The following address and private key are defaults from anvil and are only meant to be used in a test environment.
 */
//-------------------------------------------------------------------------------------------------------------
const foundryPrivateKey: `0x${string}` =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const initialAccount: PrivateKeyAccount =
  privateKeyToAccount(foundryPrivateKey);
export const foundryAccountAddress: `0x${string}` =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

//-------------------------------------------------------------------------------------------------------------

/**
 * Creates a connection to the local anvil instance.
 * Separate configs will need to be created to communicate with different chains
 */
const createTestConfig = async () => {
  config = createConfig({
    chains: [foundry],
    client({ chain }) {
      return createClient({
        chain,
        transport: http("http://127.0.0.1:8545"),
        account: initialAccount,
      })
        .extend(walletActions)
        .extend(publicActions);
    },
    connectors: [
      mock({
        accounts: [foundryAccountAddress],
      }),
    ],
  });
};

async function main() {
  await createTestConfig();
  var client = config.getClient({ chainId: config.chains[0].id });
  RULES_ENGINE = new RulesEngine(RULES_ENGINE_ADDRESS, config, client);
  await connectConfig(config, 0);
  const sourceCode = fs.readFileSync(
    "tests/testOutput/UserContract.sol",
    "utf8"
  );
  const input = {
    language: "Solidity",
    sources: {
      "UserContract.sol": {
        content: sourceCode,
      },
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["*"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const bytecode =
    output.contracts["UserContract.sol"]["ExampleUserContract"].evm.bytecode
      .object;
  const abi = output.contracts["UserContract.sol"]["ExampleUserContract"].abi;

  const result = await deployContract(config, {
    abi: abi,
    args: [],
    bytecode: bytecode,
  });

  var receipt = await waitForTransactionReceipt(config, {
    hash: result,
  });

  console.log("receipt.contractAddress", receipt.contractAddress);

  const addPolicy = await simulateContract(config, {
    address: receipt.contractAddress!,
    abi: abi,
    functionName: "setCallingContractAdmin",
    args: [getAddress(foundryAccountAddress)],
  });
  const returnHash = await writeContract(config, {
    ...addPolicy.request,
    account: config.getClient().account,
  });

  var policyJSONFile = process.argv[2];
  let policyData: string = fs.readFileSync(policyJSONFile, "utf8");
  if (!policyData) {
    console.error(`Policy JSON file ${policyJSONFile} does not exist.`);
  }
  var RULES_ENGINE = new RulesEngine(RULES_ENGINE_ADDRESS, config, client);
  const policyCreationResult = await RULES_ENGINE.createPolicy(policyData);

  await RULES_ENGINE.appendPolicy(
    policyCreationResult.policyId,
    receipt.contractAddress!
  );
  var policyJSON: PolicyJSON = JSON.parse(policyData);
  var name = policyJSON.CallingFunctions[0].name;
  var params = policyJSON.CallingFunctions[0].encodedValues;

  // Iterate through params and generate random values add to array below

  var randomlyGeneratedParams: any[] = []; // TODO: Replace with Tayler's code

  const transaction = await simulateContract(config, {
    address: receipt.contractAddress!,
    abi: abi,
    functionName: name,
    args: randomlyGeneratedParams,
  });
  const myHash = await writeContract(config, {
    ...transaction.request,
    account: config.getClient().account,
  });
}

main();
