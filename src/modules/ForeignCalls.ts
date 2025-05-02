
/// SPDX-License-Identifier: BUSL-1.1
import { toFunctionSelector } from "viem"
import {
    simulateContract,
    writeContract, 
    readContract
} from "@wagmi/core";
import { account, getConfig } from "../../config"
import { sleep } from "./ContractInteractionUtils"
import { parseForeignCallDefinition } from "./Parser"
import { RulesEngineComponentContract } from "./types"

/**
 * @file ForeignCalls.ts
 * @description This module provides a comprehensive set of functions for interacting with the Foreign Calls within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting foreign calls.
 * 
 * @module ForeignCalls
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

const config = getConfig()

/**
 * Creates a foreign call in the rules engine component contract.
 *
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy to associate with the foreign call.
 * @param fcSyntax - A JSON string representing the foreign call definition.
 * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
 *
 * @remarks
 * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
 * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
 * - The `writeContract` function is used to execute the contract interaction on the blockchain.
 * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
 *
 * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
 */
export const createForeignCall = async(rulesEngineComponentContract: RulesEngineComponentContract, policyId: number, fcSyntax: string, 
    ): Promise<number> => {
    var json = JSON.parse(fcSyntax)
    var foreignCall = parseForeignCallDefinition(json)
    var fc = {
        set: true,
        foreignCallAddress: foreignCall.address,
        signature: toFunctionSelector(foreignCall.signature),
        foreignCallIndex: 0,
        returnType: foreignCall.returnType,
        parameterTypes: foreignCall.parameterTypes,
        typeSpecificIndices: foreignCall.encodedIndices

    }
    var addFC
    while(true) {
        try {
            addFC = await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "createForeignCall",
                args: [ policyId, fc ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addFC != null) {
        await writeContract(config, {
            ...addFC.request,
            account
        });
        return addFC.result
        
    } 
    return -1
}
/**
 * Updates a foreign call in the rules engine component contract.
 *
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @param policyId - The ID of the policy to associate with the foreign call.
 * @param foreignCallId - The ID of the foreign call to update.
 * @param fcSyntax - A JSON string representing the foreign call definition.
 * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
 *
 * @remarks
 * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
 * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
 * - The `writeContract` function is used to execute the contract interaction on the blockchain.
 * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
 *
 * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
 */
export const updateForeignCall = async(rulesEngineComponentContract: RulesEngineComponentContract, 
    policyId: number, foreignCallId: number, fcSyntax: string, 
    ): Promise<number> => {
    var json = JSON.parse(fcSyntax)
    var foreignCall = parseForeignCallDefinition(json)
    var fc = {
        set: true,
        foreignCallAddress: foreignCall.address,
        signature: toFunctionSelector(foreignCall.signature),
        foreignCallIndex: 0,
        returnType: foreignCall.returnType,
        parameterTypes: foreignCall.parameterTypes,
        typeSpecificIndices: foreignCall.encodedIndices

    }
    var addFC
    while(true) {
        try {
            addFC = await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "updateForeignCall",
                args: [ policyId, foreignCallId, fc ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addFC != null) {
        await writeContract(config, {
            ...addFC.request,
            account
        });
           let foreignCallResult = addFC.result as any
           return foreignCallResult.foreignCallIndex
    } 
    return -1
}

/**
 * Deletes a foreign call associated with a specific policy in the rules engine component contract.
 *
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interacting with the rules engine component.
 * @param policyId - The ID of the policy to which the foreign call belongs.
 * @param foreignCallId - The ID of the foreign call to be deleted.
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteForeignCall = async(rulesEngineComponentContract: RulesEngineComponentContract, 
    policyId: number, foreignCallId: number,  
    ): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deleteForeignCall",
            args: [ policyId, foreignCallId ],
        })
    } catch (err) {
        return -1
    }

    if(addFC != null) {
        await writeContract(config, {
            ...addFC.request,
            account
        });
    }
    
    return 0
}

/**
 * Retrieves the result of a foreign call from the rules engine component contract.
 *
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @param policyId - The ID of the policy associated with the foreign call.
 * @param foreignCallId - The ID of the foreign call to retrieve.
 * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getForeignCall = async(rulesEngineComponentContract: RulesEngineComponentContract,
    policyId: number, foreignCallId: number): Promise<any | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getForeignCall",
            args: [ policyId, foreignCallId ],
        });
        await readContract(config, {
            ...addFC.request,
            account
        });

        let foreignCallResult = addFC.result 
        return foreignCallResult;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param rulesEngineComponentContract - An object representing the Rules Engine Component Contract, 
 * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
 * containing its address and ABI.
 * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllForeignCalls = async(rulesEngineComponentContract: RulesEngineComponentContract, 
    policyId: number): Promise<any[] | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getAllForeignCalls",
            args: [ policyId ],
        });
    
        await readContract(config, {
            ...addFC.request,
            account
        });

        return addFC.result;
    } catch (error) {
        console.error(error);
        return null;
    }

}
