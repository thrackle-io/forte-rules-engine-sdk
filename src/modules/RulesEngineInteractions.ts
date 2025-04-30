/**
 * @file RulesEngineInteraction.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies, rules, foreign calls, 
 *              trackers and function signatures.
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
 * @license UNLICENSED
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

import { Address, getContract } from "viem"
import { PolicyJSON, RulesEngineComponentContract, RulesEnginePolicyABI, RulesEnginePolicyContract } from "./types"
import { getConfig } from "../../config"
import { createBlankPolicy, createFullPolicy, updatePolicy as updatePolicyInternal } from "./Policy"

const config = getConfig()

var rulesEnginePolicyContract: RulesEnginePolicyContract
var rulesEngineComponentContract: RulesEngineComponentContract

export const initializeRulesEngineConnection = async(address: Address, client: any) => {
    rulesEnginePolicyContract = getContract({
        address,
        abi: RulesEnginePolicyABI,
        client
    });
}

/**
 * Creates a policy in the Rules Engine.
 * 
 * @param policyJSON - Policy defined in a JSON string.
 * @returns The ID of the newly created policy.
 */
export const createPolicy = async (policyJSON: string): Promise<number> => {
    if(policyJSON.length > 0) {
        return createFullPolicy(rulesEnginePolicyContract, rulesEngineComponentContract, policyJSON)
    } else {
        return createBlankPolicy("open", rulesEnginePolicyContract)
    }
}

/**
 * Updates an existing policy in the Rules Engine.
 * 
 * @param policyId - The ID of the policy to update.
 * @param signatures - The function signatures associated with the policy.
 * @param ids - The IDs of the rules associated with the policy.
 * @param ruleIds - The mapping of rules to function signatures.
 * @returns The result of the policy update.
 */
export const updatePolicy = async (policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>  => {
    return updatePolicyInternal(rulesEnginePolicyContract, policyId, signatures, ids, ruleIds)
}