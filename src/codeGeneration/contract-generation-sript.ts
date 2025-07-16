/// SPDX-License-Identifier: BUSL-1.1
import * as fs from "fs";
import {
  getRulesErrorMessages,
  validatePolicyJSON,
} from "../modules/validation";
import { generateTestContract } from "./generate-contract-solidity";
import { isLeft, unwrapEither } from "../modules/utils";

/**
 * Processes a policy configuration file and generates a test contract which includes the first
 * CallingFunction defined in the policy JSON.
 * @param configPath Path to the policy JSON configuration file
 * @param outputFile The directory and name of the file to create for the modifiers
 */
export function testContractGeneration(
  configPath: string,
  outputFile: string
): void {
  // Read and parse the policy configuration
  const configData = fs.readFileSync(configPath, "utf-8");
  console.log(
    `Reading policy configuration from ${configPath} - ${configData} bytes`
  );
  const policyJson = validatePolicyJSON(configData);
  if (isLeft(policyJson)) {
    throw new Error(getRulesErrorMessages(policyJson.left));
  }
  const policyConfig = unwrapEither(policyJson);

  console.log(`Processing policy: ${policyConfig.Policy}`);

  generateTestContract(configData, outputFile);

  console.log("Test contract generation complete!");
}

/**
 * Command-line entry point
 */
const args = process.argv.slice(2);
console.log(`Arguments received: ${args.join(", ")}`);

if (args.length < 2) {
  console.error(
    "Usage: npx tsx contract-generation-script.ts <config-path> <outputFile-path>"
  );
  process.exit(1);
}

const configPath = args[0];
const outputFile = args[1];

testContractGeneration(configPath, outputFile);
