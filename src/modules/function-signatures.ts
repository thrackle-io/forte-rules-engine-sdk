/// SPDX-License-Identifier: BUSL-1.1
import { toFunctionSelector } from "viem"
import {
    simulateContract,
    waitForTransactionReceipt,
    writeContract, 
    Config
} from "@wagmi/core";
import { account } from "../../config"
import { sleep } from "./contract-interaction-utils"
import { parseFunctionArguments } from "./parsing/parser"
import { RulesEngineComponentContract } from "./types"

/**
 * @file FunctionSignatures.ts
 * @description This module provides a comprehensive set of functions for interacting with the Function Signatures within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting function signatures.
 * 
 * @module FunctionSignatures
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
 * Creates a function signature in the rules engine component contract.
 *
 * This function parses the provided function signature, maps its arguments to their respective
 * types, and interacts with the smart contract to create the function signature. If the contract
 * interaction fails, it retries with a delay until successful.
 *
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy for which the function signature is being created.
 * @param functionSignature - The function signature string to be parsed and added to the contract.
 *                                        of the rules engine component.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const createFunctionSignature = async (
    config: Config,
    rulesEngineComponentContract: RulesEngineComponentContract,
    policyId: number, functionSignature: string
    ): Promise<number> => {
        var argsRaw = parseFunctionArguments(functionSignature)
        var args = []
        for(var arg of argsRaw) {
            if(arg.rawType == "uint256") {
                args.push(2)
            } else if(arg.rawType == "string") {
                args.push(1)
            } else if(arg.rawType == "address") {
                args.push(0)
            }
        }

        var addRule
    while(true) {
        try {
            addRule = await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "createFunctionSignature",
                args: [ policyId, toFunctionSelector(functionSignature), args ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addRule != null) {
        const returnHash = await writeContract(config, {
            ...addRule.request,
            account
        });
        await waitForTransactionReceipt(config, {
            hash: returnHash,
        })

        return addRule.result;
    }
    return -1 
    }   

/**
 * Delete a function signature from the rules engine component contract.
 *
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 * @param policyId - The ID of the policy for which the function signature is being created.
 * @param functionSignatureId - The function signature ID to be deleted.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const deleteFunctionSignature = async (
    config: Config,
    rulesEngineComponentContract: RulesEngineComponentContract,
    policyId: number, functionSignatureId: number
    ): Promise<number> => {
    var addRule
    try {
        addRule = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deleteFunctionSignature",
            args: [ policyId, functionSignatureId ],
        });
    } catch (err) {
        return -1
    }

    if(addRule != null) {
        const returnHash = await writeContract(config, {
            ...addRule.request,
            account
        });
        await waitForTransactionReceipt(config, {
            hash: returnHash,
        })

        return addRule.result;
    }
    return -1 
}
