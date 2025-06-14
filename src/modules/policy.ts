/// SPDX-License-Identifier: BUSL-1.1

import { toFunctionSelector, Address, getAddress } from "viem";

import {
  Config,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core";

import {
  parseForeignCallDefinition,
  parseTrackerSyntax,
} from "../parsing/parser";
import {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  FCNameToID,
  TrackerDefinition,
  PolicyJSON,
  ForeignCallOnChain,
  TrackerOnChain,
  hexToFunctionString,
  RulesEngineRulesContract,
} from "./types";
import {
  createForeignCall,
  getAllForeignCalls,
  getForeignCallMetadata,
} from "./foreign-calls";
import { createRule } from "./rules";
import { getAllTrackers, getTrackerMetadata } from "./trackers";
import { sleep } from "./contract-interaction-utils";
import {
  createCallingFunction,
  getCallingFunctionMetadata,
} from "./calling-functions";
import { getRule } from "./rules";
import { createTracker } from "./trackers";
import {
  convertRuleStructToString,
  convertForeignCallStructsToStrings,
  convertTrackerStructsToStrings,
} from "../parsing/reverse-parsing-logic";
import { isRight, unwrapEither } from "./utils";

/**
 * @file policy.ts
 * @description This module provides a comprehensive set of functions for interacting with the Policies within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies.
 *
 * @module policy
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
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
 * Creates a policy in the Rules Engine, including rules, trackers, and foreign calls.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @returns The ID of the newly created policy.
 */
export const createPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policySyntax?: string
): Promise<{ policyId: number }> => {
  var fcIds: FCNameToID[] = [];
  var trackerIds: FCNameToID[] = [];
  let trackers: TrackerDefinition[] = [];
  let ruleIds = [];
  let ruleToCallingFunction = new Map<string, number[]>();
  let callingFunctions: string[] = [];
  let callingFunctionIds: number[] = [];
  let rulesDoubleMapping = [];
  let callingFunctionSelectors = [];
  let callingFunctionMappings: hexToFunctionString[] = [];

  const addPolicy = await simulateContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "createPolicy",
    args: [[], [], 1],
  });
  const returnHash = await writeContract(config, {
    ...addPolicy.request,
  });
  const transactionReceipt = await waitForTransactionReceipt(config, {
    hash: returnHash,
  });

  let policyId: number = addPolicy.result;

  if (policySyntax !== undefined) {
    let policyJSON: PolicyJSON = JSON.parse(policySyntax);
    if (policyJSON.ForeignCalls != null) {
      for (var foreignCall of policyJSON.ForeignCalls) {
        const parsedFC = parseForeignCallDefinition(foreignCall);
        if (isRight(parsedFC)) {
          const fcStruct = unwrapEither(parsedFC);
          const fcId = await createForeignCall(
            config,
            rulesEngineComponentContract,
            policyId,
            JSON.stringify(foreignCall)
          );
          var struc: FCNameToID = {
            id: fcId,
            name: fcStruct.name.split("(")[0],
            type: 0,
          };
          fcIds.push(struc);
        } else {
          throw new Error(unwrapEither(parsedFC).message);
        }
      }
    }

    if (policyJSON.Trackers != null) {
      for (var tracker of policyJSON.Trackers) {
        const parsedTracker = parseTrackerSyntax(tracker);
        if (isRight(parsedTracker)) {
          const trackerStruct = unwrapEither(parsedTracker);
          const trId = await createTracker(
            config,
            rulesEngineComponentContract,
            policyId,
            JSON.stringify(tracker)
          );
          var struc: FCNameToID = {
            id: trId,
            name: trackerStruct.name,
            type: trackerStruct.type,
          };
          trackerIds.push(struc);
          trackers.push(trackerStruct);
        } else {
          throw new Error(unwrapEither(parsedTracker).message);
        }
      }
    }

    for (var rule of policyJSON.Rules) {
      var callingFunction = rule.callingFunction.trim();
      if (!callingFunctions.includes(callingFunction)) {
        callingFunctions.push(callingFunction);
        const fsId = await createCallingFunction(
          config,
          rulesEngineComponentContract,
          policyId,
          callingFunction,
          rule.encodedValues
        );
        callingFunctionIds.push(fsId);
        callingFunctionMappings.push({
          hex: toFunctionSelector(callingFunction),
          functionString: callingFunction,
          encodedValues: rule.encodedValues,
          index: -1,
        });
      }

      const ruleId = await createRule(
        config,
        rulesEngineRulesContract,
        policyId,
        JSON.stringify(rule),
        fcIds,
        trackerIds
      );
      if (ruleId == -1) {
        return { policyId: -1 };
      }
      ruleIds.push(ruleId);
      if (ruleToCallingFunction.has(callingFunction)) {
        ruleToCallingFunction.get(callingFunction)?.push(ruleId);
      } else {
        ruleToCallingFunction.set(callingFunction, [ruleId]);
      }
    }

    for (var cf of callingFunctions) {
      if (ruleToCallingFunction.has(cf)) {
        rulesDoubleMapping.push(ruleToCallingFunction.get(cf));
      } else {
        rulesDoubleMapping.push([]);
      }
      callingFunctionSelectors.push(toFunctionSelector(cf));
    }
    policyId = await updatePolicy(
      config,
      rulesEnginePolicyContract,
      policyId,
      callingFunctionSelectors,
      callingFunctionIds,
      rulesDoubleMapping
    );
  }
  return { policyId };
};

/**
 * Updates an existing policy in the Rules Engine.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to update.
 * @param callingFunctions - The calling functions associated with the policy.
 * @param ids - The IDs of the rules associated with the policy.
 * @param ruleIds - The mapping of rules to calling functions.
 * @returns The result of the policy update.
 */
export const updatePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  signatures: any[],
  ids: number[],
  ruleIds: any[]
): Promise<number> => {
  var updatePolicy;
  while (true) {
    try {
      updatePolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "updatePolicy",
        args: [policyId, signatures, ids, ruleIds, 1],
      });
      break;
    } catch (error) {
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }
  if (updatePolicy != null) {
    const returnHash = await writeContract(config, {
      ...updatePolicy.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });

    return updatePolicy.result;
  }

  return -1;
};

/**
 * Sets the policies appled to a specific contract address.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const setPolicies = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyIds: [number],
  contractAddressForPolicy: Address
): Promise<void> => {
  var applyPolicy;
  while (true) {
    try {
      applyPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "applyPolicy",
        args: [contractAddressForPolicy, policyIds],
      });
      break;
    } catch (error) {
      console.log(error);
      // TODO: Look into replacing this loop/sleep with setTimeout
      await sleep(1000);
    }
  }

  if (applyPolicy != null) {
    const returnHash = await writeContract(config, {
      ...applyPolicy.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }
};

/**
 * Appends a policy to the list of policies applied to a specific contract address.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to apply.
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const appendPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number,
  contractAddressForPolicy: Address
): Promise<void> => {
  const retrievePolicies = await simulateContract(config, {
    address: rulesEnginePolicyContract.address,
    abi: rulesEnginePolicyContract.abi,
    functionName: "getAppliedPolicyIds",
    args: [contractAddressForPolicy],
  });

  let policyResult = retrievePolicies.result as [number];
  policyResult.push(policyId);

  setPolicies(
    config,
    rulesEnginePolicyContract,
    policyResult,
    contractAddressForPolicy
  );
};

/**
 * Deletes a policy from the Rules Engine.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to delete.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const deletePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "deletePolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineRulesContract - The contract instance for interacting with the Rules Engine Rules.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policyId - The ID of the policy to retrieve.
 * @returns A JSON string representing the full policy.
 */
export const getPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineRulesContract: RulesEngineRulesContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number
): Promise<string> => {
  var callingFunctionMappings: hexToFunctionString[] = [];
  try {
    const retrievePolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getPolicy",
      args: [policyId],
    });

    let policyResult = retrievePolicy.result;
    let callingFunctions: any = policyResult[0];
    let ruleIds2DArray: any = policyResult[2];

    var iter = 1;
    for (var cfId in callingFunctions) {
      var mapp = await getCallingFunctionMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        iter
      );
      var newMapping: hexToFunctionString = {
        hex: mapp.signature,
        functionString: mapp.callingFunction,
        encodedValues: mapp.encodedValues,
        index: -1,
      };
      callingFunctionMappings.push(newMapping);
      iter++;
    }

    var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(
      config,
      rulesEngineComponentContract,
      policyId
    );
    var foreignCallNames: string[] = [];
    for (var fc of foreignCalls) {
      var name = await getForeignCallMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        fc.foreignCallIndex
      );
      foreignCallNames.push(name);
      var newMapping: hexToFunctionString = {
        hex: fc.signature,
        functionString: name,
        encodedValues: "",
        index: -1,
      };
      callingFunctionMappings.push(newMapping);
    }

    var callStrings: string[] = [];
    convertForeignCallStructsToStrings(
      callStrings,
      foreignCalls,
      callingFunctionMappings,
      foreignCallNames
    );

    var trackers: TrackerOnChain[] = await getAllTrackers(
      config,
      rulesEngineComponentContract,
      policyId
    );
    var trackerNames: string[] = [];
    for (var tracker of trackers) {
      var name = await getTrackerMetadata(
        config,
        rulesEngineComponentContract,
        policyId,
        tracker.trackerIndex
      );
      trackerNames.push(name);
      var newMapping: hexToFunctionString = {
        hex: "",
        functionString: name,
        encodedValues: "",
        index: tracker.trackerIndex,
      };
      callingFunctionMappings.push(newMapping);
    }

    const trackerStrings = convertTrackerStructsToStrings(trackers, trackerNames);

    var iter = 0;
    var ruleJSONObjs = [];
    for (var innerArray of ruleIds2DArray) {
      var functionString = "";
      var encodedValues: string = "";
      var fs = callingFunctions[iter];
      for (var mapping of callingFunctionMappings) {
        if (mapping.hex == fs) {
          functionString = mapping.functionString;
          encodedValues = mapping.encodedValues;
          break;
        }
      }
      for (var ruleId of innerArray) {
        var ruleS = await getRule(
          config,
          rulesEngineRulesContract,
          policyId,
          ruleId
        );
        var plhArray: string[] = [];
        if (ruleS != null) {
          ruleJSONObjs.push(
            convertRuleStructToString(
              functionString,
              encodedValues,
              ruleS,
              plhArray,
              foreignCalls,
              trackers,
              callingFunctionMappings
            )
          );
        }
      }
      iter++;
    }

    var jsonObj = {
      Trackers: trackerStrings,
      ForeignCalls: callStrings,
      Rules: ruleJSONObjs,
    };
    return JSON.stringify(jsonObj);
  } catch (error) {
    console.error(error);
    return "";
  }
};
/**
 * Checks if a policy exists in the Rules Engine.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policyId - The ID of the policy to check.
 * @returns True if the policy exists, false otherwise.
 */
export async function policyExists(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number
): Promise<boolean> {
  try {
    let policyExists = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getPolicy",
      args: [policyId],
    });
    if (policyExists.result[0] != null && policyExists.result[2] != null) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Retrieves the IDs of all of the policies that have been applied to a contract address.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param address - The address to check.
 * @returns array of all of the policy ids applied to the contract
 */
export async function getAppliedPolicyIds(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  address: string
): Promise<number[]> {
  try {
    let appliedPolicies = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "getAppliedPolicyIds",
      args: [getAddress(address)],
    });
    return appliedPolicies.result;
  } catch (error) {
    return [];
  }
}

/**
 * Retrieves whether a policy is open or closed.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @returns array of all of the policy ids applied to the contract
 */
export async function isClosedPolicy(
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<boolean> {
  try {
    let isClosed = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "isClosedPolicy",
      args: [policyId],
    });
    return isClosed.result;
  } catch (error) {
    return false;
  }
}

/**
 * Closes a policy on the Rules Engine.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to close.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const closePolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "closePolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Opens a policy on the Rules Engine.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to open.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const openPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "openPolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves whether an address is a possible subscriber to the closed policy.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to check.
 * @param subscriber - The address to check
 * @returns array of all of the policy ids applied to the contract
 */
export async function isClosedPolicySubscriber(
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address
): Promise<boolean> {
  try {
    let isClosed = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "isClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
    return isClosed.result;
  } catch (error) {
    return false;
  }
}

/**
 * Adds a subscriber to the closed policy.
 *
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to add to.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const addClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "addClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Removes a subscriber from the closed policy.
 *
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Components.
 * @param policyId - The ID of the policy to remove from.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const removeClosedPolicySubscriber = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  subscriber: Address
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "removeClosedPolicySubscriber",
      args: [policyId, subscriber],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Cements a policy on the Rules Engine.
 *
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to cement.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const cementPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<number> => {
  var addFC;
  try {
    addFC = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "cementPolicy",
      args: [policyId],
    });
  } catch (err) {
    return -1;
  }

  if (addFC != null) {
    const returnHash = await writeContract(config, {
      ...addFC.request,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }

  return 0;
};

/**
 * Retrieves whether a policy is cemented.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to check.
 * @returns whether or not the policy is cemented
 */
export const isCementedPolicy = async (
  config: Config,
  rulesEnginePolicyContract: RulesEnginePolicyContract,
  policyId: number
): Promise<boolean> => {
  try {
    const retrievePolicy = await simulateContract(config, {
      address: rulesEnginePolicyContract.address,
      abi: rulesEnginePolicyContract.abi,
      functionName: "isCementedPolicy",
      args: [policyId],
    });

    return retrievePolicy.result;
  } catch (err) {
    return false;
  }
};
