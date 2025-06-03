/// SPDX-License-Identifier: BUSL-1.1
import { Address, toFunctionSelector } from "viem";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
  Config,
  readContract,
} from "@wagmi/core";
import { RulesEngineAdminContract } from "./types";
import { sleep } from "./contract-interaction-utils";
import { account } from "../../config";

/**
 * @file admin.ts
 * @description This module provides a comprehensive set of functions for interacting with the admin functionality within the Rules Engine smart contracts.
 *              It includes functionality for granting, proposing, confirming, and retrieving admins.
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
 * Propose a new admin in the rules engine admin contract.
 *
 * This function proposes a new admin for a specific policy.
 *
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to set the admin for.
 * @param newAdminAddress - The address to propose as the new admin
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const proposeNewPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number,
  newAdminAddress: Address
) => {
  var proposeAdmin;
  while (true) {
    try {
      proposeAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "proposeNewPolicyAdmin",
        args: [newAdminAddress, policyId],
      });
      break;
    } catch (err) {
      await sleep(1000);
    }
  }
  if (proposeAdmin != null) {
    const returnHash = await writeContract(config, {
      ...proposeAdmin.request,
      account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }
};

/**
 * Confirm a new admin in the rules engine admin contract.
 *
 * This function confirms a new admin for a specific policy.
 *
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to set the admin for.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const confirmNewPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number
) => {
  var confirmAdmin;
  while (true) {
    try {
      confirmAdmin = await simulateContract(config, {
        address: rulesEngineAdminContract.address,
        abi: rulesEngineAdminContract.abi,
        functionName: "confirmNewPolicyAdmin",
        args: [policyId],
      });
      break;
    } catch (err) {
      console.log(err);
      await sleep(1000);
    }
  }
  console.log(confirmAdmin);
  if (confirmAdmin != null) {
    const returnHash = await writeContract(config, {
      ...confirmAdmin.request,
      account,
    });
    await waitForTransactionReceipt(config, {
      hash: returnHash,
    });
  }
};

/**
 * Determine if address is policy admin.
 *
 * This function determines whether or not an address is the admin for a specific policy.
 *
 * @param rulesEngineAdminContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy to check the admin for.
 * @param adminAddress - The address to check
 * @returns whether or not the address is the policy admin.
 *
 */
export const isPolicyAdmin = async (
  config: Config,
  rulesEngineAdminContract: RulesEngineAdminContract,
  policyId: number,
  adminAddress: Address
): Promise<boolean> => {
  try {
    let policyExists = await simulateContract(config, {
      address: rulesEngineAdminContract.address,
      abi: rulesEngineAdminContract.abi,
      functionName: "isPolicyAdmin",
      args: [policyId, adminAddress],
    });
    return policyExists.result as boolean;
  } catch (error) {
    return false;
  }
};
