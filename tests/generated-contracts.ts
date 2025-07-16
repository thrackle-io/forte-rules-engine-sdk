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
import solc from "solc";
import * as fs from "fs";
import { PolicyJSON } from "../src/modules/validation";
import { generateTestContract } from "../src/codeGeneration/generate-contract-solidity";
import { policyModifierGeneration } from "../src/codeGeneration/code-modification-script";
import path from "path";

dotenv.config();
// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const RULES_ENGINE_ADDRESS: Address = getAddress(DiamondAddress);
var config: Config;
var RULES_ENGINE: RulesEngine;

type overrideStruct = {
  name: string;
  value: string;
};

type OverrideJSON = {
  overrides: overrideStruct[];
};

const importCallback = (importPath: string) => {
  try {
    // Adjust this logic to your project's structure and node_modules location
    const resolvedPath = path.resolve("./", importPath);
    console.log("resolvedPath", resolvedPath);
    const content = fs.readFileSync(resolvedPath, "utf8");
    return { contents: content };
  } catch (e: any) {
    return { error: `File not found: ${importPath} - ${e.message}` };
  }
};

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

  //Parse Policy JSON
  var policyJSONFile = process.argv[2];
  let policyData: string = fs.readFileSync(policyJSONFile, "utf8");
  if (!policyData) {
    console.error(`Policy JSON file ${policyJSONFile} does not exist.`);
  }
  console.log(policyData);
  //Generate Solidity contract
  generateTestContract(policyData, "TestGenContract.sol");

  //TODO: Generate other stuff (inject modifier script)
  policyModifierGeneration(process.argv[2], "TestGenModifiers.sol", [
    "TestGenContract.sol",
  ]);
  //Deploy contract on anvil
  const sourceCode = fs.readFileSync("TestGenContract.sol", "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "./TestGenContract.sol": {
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
  console.log(JSON.stringify(input));
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), importCallback)
  );
  console.log(output);
  const bytecode =
    output.contracts["TestGenContract.sol"]["ExampleUserContract"].evm.bytecode
      .object;
  const abi =
    output.contracts["TestGenContract.sol"]["ExampleUserContract"].abi;

  const result = await deployContract(config, {
    abi: abi,
    args: [],
    bytecode: bytecode,
  });

  var receipt = await waitForTransactionReceipt(config, {
    hash: result,
  });

  console.log("receipt.contractAddress", receipt.contractAddress);

  //   // create and apply the policy
  //   const addPolicy = await simulateContract(config, {
  //     address: receipt.contractAddress!,
  //     abi: abi,
  //     functionName: "setCallingContractAdmin",
  //     args: [getAddress(foundryAccountAddress)],
  //   });
  //   const returnHash = await writeContract(config, {
  //     ...addPolicy.request,
  //     account: config.getClient().account,
  //   });
  //   var RULES_ENGINE = new RulesEngine(RULES_ENGINE_ADDRESS, config, client);
  //   const policyCreationResult = await RULES_ENGINE.createPolicy(policyData);

  //   await RULES_ENGINE.appendPolicy(
  //     policyCreationResult.policyId,
  //     receipt.contractAddress!
  //   );

  //   // create random parameter inputs and run a rules enabled transaction
  //   var policyJSON: PolicyJSON = JSON.parse(policyData);
  //   var name = policyJSON.CallingFunctions[0].name;
  //   var params = policyJSON.CallingFunctions[0].encodedValues;

  //   // Override data (Add back in after testing existing functionality)
  //   //   var overrideFile = process.argv[3];
  //   //   let overrideData: string = fs.readFileSync(overrideFile, "utf8");
  //   //   if (!overrideData) {
  //   //     console.error(`Policy JSON file ${overrideFile} does not exist.`);
  //   //   }
  //   //   var overrideJSON: OverrideJSON = JSON.parse(overrideData);
  //   //   for (var over of overrideJSON.overrides) {
  //   //   }
  //   // Iterate through params and generate random values add to array below

  //   var randomlyGeneratedParams: any[] = [];

  //   for (let param of params.split(",")) {
  //     if (param.includes("address")) {
  //       randomlyGeneratedParams.push(
  //         getAddress("0x" + Math.random().toString(16).slice(2, 42))
  //       );
  //     } else if (param.includes("uint256")) {
  //       randomlyGeneratedParams.push(Math.floor(Math.random() * 1000000));
  //     } else if (param.includes("string")) {
  //       randomlyGeneratedParams.push(
  //         "testString" + Math.random().toString(36).substring(7)
  //       );
  //     } else if (param.includes("bool")) {
  //       randomlyGeneratedParams.push(Math.random() < 0.5);
  //     } else if (param.includes("bytes")) {
  //       randomlyGeneratedParams.push(
  //         "0x" + Math.random().toString(16).slice(2, 66)
  //       );
  //     }
  //     // Add more types as needed
  //     else {
  //       console.warn(`Unknown parameter type: ${param}`);
  //     }
  //   }

  //   const transaction = await simulateContract(config, {
  //     address: receipt.contractAddress!,
  //     abi: abi,
  //     functionName: name,
  //     args: randomlyGeneratedParams,
  //   });
  //   const myHash = await writeContract(config, {
  //     ...transaction.request,
  //     account: config.getClient().account,
  //   });
}

main();
