/// SPDX-License-Identifier: BUSL-1.1
import { createTestClient, http, walletActions, publicActions, testActions, Address, decodeFunctionResult, toFunctionSelector, getAddress, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { getConfig, connectConfig } from '../config'
import * as fs from 'fs';
import * as path from 'path';
import { createPolicy, getAllForeignCalls, getAllTrackers, getPolicy } from '..';
import { getRulesEnginePolicyContract, getRulesEngineComponentContract, sleep } from './modules/ContractInteractionUtils';
/**
 * @file demo.ts
 * @description This script demonstrates the integration and usage of the Rules Engine SDK by creating, applying, 
 *              and retrieving policies, trackers, and foreign calls. It serves as an example of how to interact 
 *              with the Rules Engine smart contracts and showcases the SDK's capabilities.
 * 
 * @module Demo
 * 
 * @dependencies
 * - `viem`: Provides utilities for interacting with Ethereum contracts, including encoding/decoding data and managing accounts.
 * - `ContractInteraction`: Contains functions for creating, retrieving, and managing policies, trackers, and foreign calls.
 * - `config`: Provides configuration utilities for connecting to the blockchain.
 * - `fs` and `path`: Used for reading and resolving file paths for policy JSON files and output files.
 * 
 * @constants
 * - `DiamondAddress`: The hardcoded address of the Rules Engine smart contract (diamond contract).
 * - `config`: The configuration object for connecting to the blockchain.
 * - `client`: The blockchain client instance for interacting with the Rules Engine contracts.
 * - `account`: The account object derived from a private key for signing transactions.
 * 
 * @functions
 * - `main()`: The main function that demonstrates the following:
 *   1. Connecting to the blockchain using the provided configuration.
 *   2. Reading a policy JSON file and creating a full policy in the Rules Engine.
 *   3. Retrieving foreign calls and trackers associated with the policy.
 *   4. Reverse interpreting the policy to display its human-readable form.
 *   5. Logging the results to the console.
 * 
 * @usage
 * - Run this script to test the Rules Engine SDK and observe its functionality in creating and managing policies.
 * - Ensure that the `src/demo.json` file contains a valid policy JSON and the output paths are writable.
 * 
 * @example
 * ```bash
 * node demo.js
 * ```
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license UNLICENSED
 * 
 * @note This file is intended for demonstration and testing purposes only. It is not suitable for production use.
 */
// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const DiamondAddress: `0x${string}` = `0x0165878A594ca255338adfa4d48449f69242Eb8F`

const config = getConfig()

const client = config.getClient({chainId: config.chains[0].id})

const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );

/**
 * The `main` function serves as the entry point for executing a series of operations
 * related to policy creation, foreign call retrieval, and policy interpretation
 * within a rules engine framework. It performs the following tasks:
 * 
 * 1. Connects to a configuration using the provided `config` object.
 * 2. Reads a policy JSON file from the specified path.
 * 3. Creates a full policy using the rules engine's policy and component contracts.
 * 4. Continuously checks for foreign calls until they are available.
 * 5. Retrieves trackers associated with the created policy.
 * 6. Reversely interprets the policy to extract specific function signatures and encoded values.
 * 7. Logs the foreign call count, tracker count, and the reverse-interpreted policy.
 * 
 * @async
 * @function
 * @throws Will throw an error if any of the asynchronous operations fail.
 * 
 * @remarks
 * - The function assumes the existence of helper functions such as `connectConfig`, 
 *   `createPolicy`, `getAllForeignCalls`, `getAllTrackers`, and `getPolicy`.
 * - It also relies on utility functions like `getRulesEnginePolicyContract` and 
 *   `getRulesEngineComponentContract` for interacting with the rules engine contracts.
 * - The function includes a polling mechanism to wait for foreign calls to be available.
 * 
 * @example
 * // Ensure the required configuration and dependencies are set up before calling `main`.
 * await main();
 */
  async function main() {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    const policyApplicant: `0x${string}` = getAddress('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
    await connectConfig(config, 0)

    const absolutePath = path.resolve("src/demo.json")
    const policyJSON = await fs.promises.readFile(absolutePath, 'utf-8');
    var result = await createPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client),
    policyJSON)
    var resultFC = await getAllForeignCalls(getRulesEngineComponentContract(rulesEngineContract, client), result)

    while(true) {
        if(resultFC!.length < 1) {
            await sleep(1000)
            resultFC = await getAllForeignCalls(getRulesEngineComponentContract(rulesEngineContract, client), result)
        } else {
            break
        }
    }

    var resultTR = await getAllTrackers( getRulesEngineComponentContract(rulesEngineContract, client), result)
    var retVal = await getPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client),result, [{hex: "0xa9059cbb", functionSignature: "transfer(address to, uint256 value)", encodedValues: "address to, uint256 value"}, 
        {hex: '0x71308757', functionSignature: "testSig(address)", encodedValues: ""}
    ])

    console.log("Foreign Call Count: ", resultFC?.length)
    console.log("Tracker Count: ", resultTR?.length)
    console.log("Reverse Interpreted Policy: ")
    console.log(retVal)

}

main()
