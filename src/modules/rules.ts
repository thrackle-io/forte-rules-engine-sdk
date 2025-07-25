/// SPDX-License-Identifier: BUSL-1.1
import { hexToString } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  readContract,
  Config,
} from "@wagmi/core";

import {
  buildAnEffectStruct,
  buildARuleStruct,
  sleep,
} from "./contract-interaction-utils";
import {
  FCNameToID,
  RuleStruct,
  RuleStorageSet,
  Maybe,
  RulesEngineRulesContract,
  RulesEngineComponentContract,
  RulesEnginePolicyContract,
  RulesEngineForeignCallContract,
  RuleMetadataStruct,
} from "./types";
import { getCallingFunctionMetadata } from "./calling-functions";
import { buildForeignCallList } from "../parsing/parser";
import { getForeignCall, getForeignCallMetadata } from "./foreign-calls";
import { getTrackerMetadata } from "./trackers";
import { isLeft, unwrapEither } from "./utils";
import { validateRuleJSON } from "./validation";

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
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  ruleS: string,
  foreignCallNameToID: FCNameToID[],
  trackerNameToID: FCNameToID[]
): Promise<number> => {
  const validatedRuleSyntax = validateRuleJSON(ruleS);
  const validatedEffectSyntax = validateRuleJSON(ruleS);
  if (isLeft(validatedRuleSyntax)) {
    return -1;
  }
  if (isLeft(validatedEffectSyntax)) {
    return -1;
  }
  const ruleSyntax = unwrapEither(validatedRuleSyntax);
  const effectSyntax = unwrapEither(validatedEffectSyntax);
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

  const retrievePolicy = await simulateContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getPolicy",
    args: [policyId],
  });

  let policyResult = retrievePolicy.result;

  let callingFunctionIds: number[] = policyResult[1];
  const callingFunctionsMetadataCalls = callingFunctionIds.map((cfId) =>
    getCallingFunctionMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      cfId
    )
  );
  const callingFunctionMetadata = await Promise.all(
    callingFunctionsMetadataCalls
  );

  var iter = 1;
  var encodedValues: string = "";
  for (var mapp of callingFunctionMetadata) {
    if (mapp.callingFunction.trim() == ruleSyntax.callingFunction.trim()) {
      encodedValues = mapp.encodedValues;
      break;
    }
    iter += 1;
  }

  var fcList = await buildForeignCallList(ruleSyntax.condition);
  var fullFCList = [];
  for (var fc of fcList) {
    for (var id of foreignCallNameToID) {
      if (id.name.trim() == fc.trim()) {
        var fcChain = await getForeignCall(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        var fcChainMeta = await getForeignCallMetadata(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        for (var ind of fcChain!.encodedIndices) {
          if (ind.eType == 1) {
            var fcChainInternal = await getForeignCallMetadata(
              config,
              rulesEngineForeignCallContract,
              policyId,
              ind.index
            );
            fullFCList.push("FC:" + fcChainInternal);
          } else if (ind.eType == 2) {
            var trackerInternal = await getTrackerMetadata(
              config,
              rulesEngineComponentContract,
              policyId,
              ind.index
            );
            fullFCList.push("TR:" + trackerInternal);
          }
        }
        fullFCList.push("FC:" + fcChainMeta);
      }
    }
  }

  var fcListEff = [];
  var fullFCListEff = [];
  if (ruleSyntax.positiveEffects != null) {
    for (var eff of ruleSyntax.positiveEffects) {
      fcListEff.push(...buildForeignCallList(eff));
    }
  }
  if (ruleSyntax.negativeEffects != null) {
    for (var eff of ruleSyntax.negativeEffects) {
      fcListEff.push(...buildForeignCallList(eff));
    }
  }

  for (var fc of fcListEff) {
    for (var id of foreignCallNameToID) {
      if (id.name.trim() == fc.trim()) {
        var fcChain = await getForeignCall(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        var fcChainMeta = await getForeignCallMetadata(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        for (var ind of fcChain!.encodedIndices) {
          if (ind.eType == 1) {
            var fcChainInternal = await getForeignCallMetadata(
              config,
              rulesEngineForeignCallContract,
              policyId,
              ind.index
            );
            fullFCListEff.push("FC:" + fcChainInternal);
          } else if (ind.eType == 2) {
            var trackerInternal = await getTrackerMetadata(
              config,
              rulesEngineComponentContract,
              policyId,
              ind.index
            );
            fullFCListEff.push("TR:" + trackerInternal);
          }
        }
        fullFCListEff.push("FC:" + fcChainMeta);
      }
    }
  }

  var effects = buildAnEffectStruct(
    effectSyntax,
    trackerNameToID,
    foreignCallNameToID,
    encodedValues,
    fullFCList,
    fullFCListEff
  );
  var rule = buildARuleStruct(
    ruleSyntax,
    foreignCallNameToID,
    effects,
    trackerNameToID,
    encodedValues,
    fullFCList,
    fullFCListEff
  );
  var addRule;
  while (true) {
    try {
      addRule = await simulateContract(config, {
        address: rulesEngineRulesContract.address,
        abi: rulesEngineRulesContract.abi,
        functionName: "createRule",
        args: [policyId, rule, ruleSyntax.Name, ruleSyntax.Description],
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
      account: config.getClient().account,
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
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  rulesEngineForeignCallContract: RulesEngineForeignCallContract,
  policyId: number,
  ruleId: number,
  ruleS: string,
  foreignCallNameToID: FCNameToID[],
  trackerNameToID: FCNameToID[]
): Promise<number> => {
  const validatedRuleSyntax = validateRuleJSON(ruleS);
  if (isLeft(validatedRuleSyntax)) {
    return -1;
  }

  const ruleSyntax = unwrapEither(validatedRuleSyntax);

  const retrievePolicy = await simulateContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getPolicy",
    args: [policyId],
  });

  let policyResult = retrievePolicy.result;
  let callingFunctionIds: number[] = policyResult[1];
  const callingFunctionsMetadataCalls = callingFunctionIds.map((cfId) =>
    getCallingFunctionMetadata(
      config,
      rulesEngineComponentContract,
      policyId,
      cfId
    )
  );
  const callingFunctionMetadata = await Promise.all(
    callingFunctionsMetadataCalls
  );

  var iter = 1;
  var encodedValues: string = "";
  for (var mapp of callingFunctionMetadata) {
    if (mapp.callingFunction.trim() == ruleSyntax.callingFunction.trim()) {
      encodedValues = mapp.encodedValues;
      break;
    }
    iter += 1;
  }

  var fcList = await buildForeignCallList(ruleSyntax.condition);
  var fullFCList = [];
  for (var fc of fcList) {
    for (var id of foreignCallNameToID) {
      if (id.name.trim() == fc.trim()) {
        var fcChain = await getForeignCall(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        var fcChainMeta = await getForeignCallMetadata(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        for (var ind of fcChain!.encodedIndices) {
          if (ind.eType == 1) {
            var fcChainInternal = await getForeignCallMetadata(
              config,
              rulesEngineForeignCallContract,
              policyId,
              ind.index
            );
            fullFCList.push("FC:" + fcChainInternal);
          } else if (ind.eType == 2) {
            var trackerInternal = await getTrackerMetadata(
              config,
              rulesEngineComponentContract,
              policyId,
              ind.index
            );
            fullFCList.push("TR:" + trackerInternal);
          }
        }
        fullFCList.push("FC:" + fcChainMeta);
      }
    }
  }
  const fcListEff = [
    ...ruleSyntax.positiveEffects,
    ...ruleSyntax.negativeEffects,
  ]
    .map(buildForeignCallList)
    .flat();
  var fullFCListEff = [];

  for (var fc of fcListEff) {
    for (var id of foreignCallNameToID) {
      if (id.name.trim() == fc.trim()) {
        var fcChain = await getForeignCall(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        var fcChainMeta = await getForeignCallMetadata(
          config,
          rulesEngineForeignCallContract,
          policyId,
          id.id
        );
        for (var ind of fcChain!.encodedIndices) {
          if (ind.eType == 1) {
            var fcChainInternal = await getForeignCallMetadata(
              config,
              rulesEngineForeignCallContract,
              policyId,
              ind.index
            );
            fullFCListEff.push("FC:" + fcChainInternal);
          } else if (ind.eType == 2) {
            var trackerInternal = await getTrackerMetadata(
              config,
              rulesEngineComponentContract,
              policyId,
              ind.index
            );
            fullFCListEff.push("TR:" + trackerInternal);
          }
        }
        fullFCListEff.push("FC:" + fcChainMeta);
      }
    }
  }

  var effects = buildAnEffectStruct(
    ruleSyntax,
    trackerNameToID,
    foreignCallNameToID,
    encodedValues,
    fullFCList,
    fullFCListEff
  );
  var rule = buildARuleStruct(
    ruleSyntax,
    foreignCallNameToID,
    effects,
    trackerNameToID,
    encodedValues,
    fullFCList,
    fullFCListEff
  );
  var addRule;
  while (true) {
    try {
      addRule = await simulateContract(config, {
        address: rulesEngineRulesContract.address,
        abi: rulesEngineRulesContract.abi,
        functionName: "updateRule",
        args: [policyId, ruleId, rule, ruleSyntax.Name, ruleSyntax.Description],
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
      account: config.getClient().account,
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
      account: config.getClient().account,
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
 * Retrieves the metadata for a rule from the Rules Engine Rules Contract based on the provided policy ID and rule ID.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineRulesContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the rule.
 * @param ruleId - The ID of the rule to retrieve.
 * @returns A promise that resolves to the rule metadata result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getRuleMetadata = async (
  config: Config,
  rulesEngineRulesContract: RulesEngineRulesContract,
  policyId: number,
  ruleId: number
): Promise<Maybe<RuleMetadataStruct>> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEngineRulesContract.address,
      abi: rulesEngineRulesContract.abi,
      functionName: "getRuleMetadata",
      args: [policyId, ruleId],
    });

    let ruleResult = getMeta as RuleMetadataStruct;
    return ruleResult;
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
