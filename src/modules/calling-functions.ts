/// SPDX-License-Identifier: BUSL-1.1
import { toFunctionSelector } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  Config,
  readContract,
} from "@wagmi/core";
import { sleep } from "./contract-interaction-utils";
import {
  determinePTEnumeration,
  parseFunctionArguments,
} from "../parsing/parser";
import {
  CallingFunctionHashMapping,
  PT,
  RulesEngineComponentContract,
} from "./types";

/**
 * @file CallingFunctions.ts
 * @description This module provides a comprehensive set of functions for interacting with the Calling Functions within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting calling functions.
 *
 * @module CallingFunctions
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
 * Creates a Calling Function in the rules engine component contract.
 *
 * This function parses the provided calling function, maps its arguments to their respective
 * types, and interacts with the smart contract to create the calling function. If the contract
 * interaction fails, it retries with a delay until successful.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy for which the calling function is being created.
 * @param callingFunction - The calling function string to be parsed and added to the contract.
 *                          of the rules engine component.
 * @param encodedValues - The encoded values string for the calling function.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const createCallingFunction = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  callingFunction: string,
  encodedValues: string
): Promise<number> => {
  var argsRaw = parseFunctionArguments(encodedValues);
  var args: number[] = argsRaw.map((val) =>
    determinePTEnumeration(val.rawType)
  );
  var addRule;
  while (true) {
    try {
      addRule = await simulateContract(config, {
        address: rulesEngineComponentContract.address,
        abi: rulesEngineComponentContract.abi,
        functionName: "createCallingFunction",
        args: [
          policyId,
          toFunctionSelector(callingFunction),
          args,
          callingFunction,
          encodedValues,
        ],
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
 * Delete a calling function from the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy for which the calling function is being deleted.
 * @param callingFunctionId - The calling function ID to be deleted.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const deleteCallingFunction = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  callingFunctionId: number
): Promise<number> => {
  var addRule;
  try {
    addRule = await simulateContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "deleteCallingFunction",
      args: [policyId, callingFunctionId],
    });
  } catch (err) {
    return -1;
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
 * retrieves the metadata for a calling function from the rules engine component contract.
 *
 * @param config - The configuration object containing network and wallet information.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy which the calling function belongs to.
 * @param callingFunctionId - The calling function ID.
 * @returns A promise that resolves to CallingFunctionHashMapping.
 *
 */
export const getCallingFunctionMetadata = async (
  config: Config,
  rulesEngineComponentContract: RulesEngineComponentContract,
  policyId: number,
  callingFunctionId: number
): Promise<CallingFunctionHashMapping> => {
  try {
    const getMeta = await readContract(config, {
      address: rulesEngineComponentContract.address,
      abi: rulesEngineComponentContract.abi,
      functionName: "getCallingFunctionMetadata",
      args: [policyId, callingFunctionId],
    });
    let callingFunctionResult = getMeta as CallingFunctionHashMapping;
    return callingFunctionResult;
  } catch (error) {
    console.error(error);
    return {
      callingFunction: "",
      signature: "",
      encodedValues: "",
    };
  }
};
