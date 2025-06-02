/// SPDX-License-Identifier: BUSL-1.1
import { hexToString } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  readContract,
  Config,
} from "@wagmi/core";

import { account } from "../../config";
import {
  buildAnEffectStruct,
  buildARuleStruct,
  sleep,
} from "./contract-interaction-utils";
import {
  FCNameToID,
  ruleJSON,
  RuleStruct,
  RuleStorageSet,
  Maybe,
  RulesEngineRulesContract,
} from "./types";

/**
 * @file Rules.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting rules.
 *
 * @module ContractInteraction
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 *
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

/**
 * Asynchronously creates a new rule in the rules engine policy contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleS - A JSON string representing the rule to be created.
 * @param rulesEngineRulesContract - The contract instance for interacting with the rules engine policy.
 * @param foreignCallNameToID - An array mapping foreign call names to their corresponding IDs.
 * @param outputFileName - The name of the output file where the rule modifier will be generated.
 * @param contractToModify - The contract to be modified with the generated rule modifier.
 * @param trackerNameToID - An array mapping tracker names to their corresponding IDs.
 * @returns A promise that resolves to the result of the rule creation operation. Returns the rule ID if successful, or -1 if the operation fails.
 *
 * @throws Will log errors to the console if the contract simulation fails and retry the operation after a delay.
 *
 * @remarks
 * - The function parses the rule JSON string to build the rule and effect structures.
 * - It uses a retry mechanism with a delay to handle potential failures during contract simulation.
 * - If the rule creation is successful, it writes the contract, generates a rule modifier, and optionally injects the modifier into the specified contract.
 */
export const createRule = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number,
  ruleS: string,
  foreignCallNameToID: FCNameToID[],
  trackerNameToID: FCNameToID[]
): Promise<number> => {
  let ruleSyntax: ruleJSON = JSON.parse(ruleS);
  let effectSyntax: ruleJSON = JSON.parse(ruleS);
  if (
    !(
      (effectSyntax.positiveEffects != null &&
        effectSyntax.positiveEffects.length > 0) ||
      (effectSyntax.negativeEffects != null &&
        effectSyntax.negativeEffects.length > 0)
    )
  ) {
    return -1;
  }
  var effects = buildAnEffectStruct(
    effectSyntax,
    trackerNameToID,
    foreignCallNameToID
  );
  var rule = buildARuleStruct(
    policyId,
    ruleSyntax,
    foreignCallNameToID,
    effects,
    trackerNameToID
  );

  var addRule;
  while (true) {
    try {
      addRule = await simulateContract(config, {
        address: rulesEngineRulesContract.address,
        abi: rulesEngineRulesContract.abi,
        functionName: "createRule",
        args: [policyId, rule],
      });
      break;
    } catch (err) {
      console.log(err);
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (addRule != null) {
    const returnHash = await writeContract(config, {
      ...addRule.request,
      account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });

    return addRule.result;
  }
  return -1;
};

/**
 * Updates an existing rule in the Rules Engine Policy Contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleId - The ID of the rule to be updated.
 * @param ruleS - A JSON string representing the rule's structure and logic.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Policy.
 * @param foreignCallNameToID - A mapping of foreign call names to their corresponding IDs.
 * @param trackerNameToID - A mapping of tracker names to their corresponding IDs.
 * @returns A promise that resolves to the result of the rule update operation. Returns the result ID if successful, or -1 if the operation fails.
 *
 * @throws Will retry indefinitely if the contract simulation fails, with a 1-second delay between retries.
 */
export const updateRule = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number,
  ruleId: number,
  ruleS: string,
  foreignCallNameToID: FCNameToID[],
  trackerNameToID: FCNameToID[]
): Promise<number> => {
  let ruleSyntax: ruleJSON = JSON.parse(ruleS);
  var effects = buildAnEffectStruct(
    ruleSyntax,
    trackerNameToID,
    foreignCallNameToID
  );
  var rule = buildARuleStruct(
    policyId,
    ruleSyntax,
    foreignCallNameToID,
    effects,
    trackerNameToID
  );
  var addRule;
  while (true) {
    try {
      addRule = await simulateContract(config, {
        address: rulesEngineRulesContract.address,
        abi: rulesEngineRulesContract.abi,
        functionName: "updateRule",
        args: [policyId, ruleId, rule],
      });
      break;
    } catch (err) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (addRule != null) {
    const returnHash = await writeContract(config, {
      ...addRule.request,
      account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });

    return addRule.result;
  }
  return -1;
};

/**
 * Deletes a rule from the rules engine component contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleId - The ID of the rule to be deleted.
 * @param rulesEngineRulesContract - The contract instance containing the rules engine component.
 * @returns A promise that resolves to a number:
 *          - `0` if the rule was successfully deleted.
 *          - `-1` if an error occurred during the deletion process.
 *
 * @throws This function does not throw errors directly but returns `-1` in case of an exception.
 */
export const deleteRule = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number,
  ruleId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineRulesContract.address,
      abi: rulesEngineRulesContract.abi,
      functionName: "deleteRule",
      args: [policyId, ruleId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
      account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves a specific rule from the Rules Engine.
 *
 * @param policyId - The ID of the policy containing the rule.
 * @param ruleId - The ID of the rule to retrieve.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns The retrieved rule as a `RuleStruct`, or `null` if retrieval fails.
 */
export const getRule = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number,
  ruleId: number
): Promise<Maybe<RuleStruct>> => {
  try {
    const result = await readContract(config, {
      address: rulesEngineRulesContract.address,
      abi: rulesEngineRulesContract.abi,
      functionName: "getRule",
      args: [policyId, ruleId],
    });

    let ruleResult = result as RuleStorageSet;
    let ruleS = ruleResult.rule as RuleStruct;

    for (var posEffect of ruleS.posEffects) {
      posEffect.text = hexToString(posEffect.text).replace(/\u0000/g, "");
    }

    for (var negEffect of ruleS.negEffects) {
      negEffect.text = hexToString(negEffect.text).replace(/\u0000/g, "");
    }

    return ruleS;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * Retrieves all rules associated with a specific policy ID from the Rules Engine Policy Contract.
 *
 * @param policyId - The unique identifier of the policy for which rules are to be retrieved.
 * @param rulesEngineRulesContract - An object representing the Rules Engine Rules Contract,
 * including its address and ABI (Application Binary Interface).
 * @returns A promise that resolves to an array of rules if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllRules = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number
): Promise<Maybe<any[]>> => {
  try {
    const result = await readContract(config, {
      address: rulesEngineRulesContract.address,
      abi: rulesEngineRulesContract.abi,
      functionName: "getAllRules",
      args: [policyId],
    });

    return result as RuleStorageSet[];
  } catch (error) {
    console.error(error);
    return null;
  }
};
