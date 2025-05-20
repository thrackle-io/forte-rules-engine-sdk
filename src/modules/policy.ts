/// SPDX-License-Identifier: BUSL-1.1

import { toFunctionSelector, Address } from "viem";

import {
    Config,
    simulateContract,
    waitForTransactionReceipt,
    writeContract
} from "@wagmi/core";

import { account } from "../../config";
import { parseForeignCallDefinition, parseTrackerSyntax } from "../parsing/parser";
import { 
    RulesEnginePolicyContract, 
    RulesEngineComponentContract, 
    FCNameToID, TrackerDefinition, 
    PolicyJSON, 
    hexToFunctionSignature, 
    ForeignCallOnChain,
    TrackerOnChain
} from "./types";
import { createForeignCall,getAllForeignCalls, getForeignCallMetadata} from "./foreign-calls"
import {createRule } from "./rules"
import { getAllTrackers, getTrackerMetadata } from "./trackers";
import { sleep } from "./contract-interaction-utils";
import { createFunctionSignature, getFunctionSignatureMetadata } from "./function-signatures";
import { getRule } from "./rules";
import { createTracker } from "./trackers";
import { convertRuleStructToString, convertForeignCallStructsToStrings, convertTrackerStructsToStrings } from "../parsing/reverse-parsing-logic";

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
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @returns The ID of the newly created policy.
 */
export const createPolicy = async (config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract,  rulesEngineComponentContract: RulesEngineComponentContract,
    policySyntax?: string): Promise<{policyId: number, functionSignatureMappings: hexToFunctionSignature[]}> => {
    var fcIds: FCNameToID[] = []
    var trackerIds: FCNameToID[] = []
    let trackers: TrackerDefinition[] = []
    let ruleIds = []
    let ruleToFunctionSignature = new Map<string, number[]>();
    let functionSignatures: string[] = []
    let functionSignatureIds: number[] = []
    let rulesDoubleMapping = []
    let functionSignatureSelectors = []
    let functionSignatureMappings: hexToFunctionSignature[] = []

    const addPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "createPolicy",
        args: [[], [], 1],
    })
    const returnHash = await writeContract(config, {
        ...addPolicy.request,
        account
    });
    const transactionReceipt = await waitForTransactionReceipt(config, {
        hash: returnHash,
    })

    let policyId:number = addPolicy.result

    if (policySyntax !== undefined){
        let policyJSON: PolicyJSON = JSON.parse(policySyntax);
        if (policyJSON.ForeignCalls != null) {
            for(var foreignCall of policyJSON.ForeignCalls) {
                var fcStruct = parseForeignCallDefinition(foreignCall)
                const fcId = await createForeignCall(config, rulesEngineComponentContract, policyId, JSON.stringify(foreignCall))
                var struc : FCNameToID = {id: fcId, name: fcStruct.name.split('(')[0], type: 0}
                fcIds.push(struc)
            }
        }
        if (policyJSON.Trackers != null) {
            for(var tracker of policyJSON.Trackers) {
                var trackerStruct: TrackerDefinition = parseTrackerSyntax(tracker)
                const trId = await createTracker(config, rulesEngineComponentContract, policyId, JSON.stringify(tracker) )
                var struc : FCNameToID = {id: trId, name: trackerStruct.name, type: trackerStruct.type}
                trackerIds.push(struc)
                trackers.push(trackerStruct)
            }
        }
        for(var rule of policyJSON.RulesJSON) {
            var functionSignature = rule.functionSignature.trim()
            if(!functionSignatures.includes(functionSignature)) {
                functionSignatures.push(functionSignature)
                const fsId = await createFunctionSignature(config, rulesEngineComponentContract, policyId, functionSignature, rule.encodedValues)
                functionSignatureIds.push(fsId)
                functionSignatureMappings.push({hex: toFunctionSelector(functionSignature), functionSignature: functionSignature, encodedValues: rule.encodedValues, index: -1})
            }
            
            const ruleId = await createRule(config, rulesEnginePolicyContract, policyId, JSON.stringify(rule), fcIds, trackerIds)
            if (ruleId == -1) {
                return {policyId: -1, functionSignatureMappings: []}
            }
            ruleIds.push(ruleId)
            if(ruleToFunctionSignature.has(functionSignature)) {
                ruleToFunctionSignature.get(functionSignature)?.push(ruleId)
            } else {
                ruleToFunctionSignature.set(functionSignature, [ruleId])
            }
        }
        
        for(var fs of functionSignatures) {
            if(ruleToFunctionSignature.has(fs)) {
                rulesDoubleMapping.push(ruleToFunctionSignature.get(fs))
            } else {
                rulesDoubleMapping.push([])
            }
            functionSignatureSelectors.push(toFunctionSelector(fs))
        }
        policyId = await updatePolicy(config, rulesEnginePolicyContract, policyId, functionSignatureSelectors, functionSignatureIds, rulesDoubleMapping)
    }
    return {policyId, functionSignatureMappings: functionSignatureMappings}
} 

/**
 * Updates an existing policy in the Rules Engine.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to update.
 * @param signatures - The function signatures associated with the policy.
 * @param ids - The IDs of the rules associated with the policy.
 * @param ruleIds - The mapping of rules to function signatures.
 * @returns The result of the policy update.
 */
export const updatePolicy = async (config: Config,
    rulesEnginePolicyContract: RulesEnginePolicyContract, policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>  => {
        var updatePolicy
        while(true) {
            try {
                updatePolicy = await simulateContract(config, {
                address: rulesEnginePolicyContract.address,
                abi: rulesEnginePolicyContract.abi,
                functionName: "updatePolicy",
                args: [ policyId, signatures, ids, ruleIds, 1 ],
                });
                break
            } catch (error) {
                // TODO: Look into replacing this loop/sleep with setTimeout
                await sleep(1000)      
            }
            
        }
        if(updatePolicy != null) {
            const returnHash = await writeContract(config, {
                ...updatePolicy.request,
                account
            });
            await waitForTransactionReceipt(config, {
                hash: returnHash,
            })
    
            return updatePolicy.result;
        } 

        return -1
    }

/**
 * Sets the policies appled to a specific contract address.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const setPolicies = async(config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract, 
    policyIds: [number], contractAddressForPolicy: Address) => {

    var applyPolicy
    while(true) {
        try {
            applyPolicy = await simulateContract(config, {
                address: rulesEnginePolicyContract.address,
                abi: rulesEnginePolicyContract.abi,
                functionName: "applyPolicy",
                args: [contractAddressForPolicy, policyIds],
            })
            break
        } catch (error) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000);
        } 
    }

    if(applyPolicy != null) {
        const returnHash = await writeContract(config, {
        ...applyPolicy.request,
        account
        }) 
        await waitForTransactionReceipt(config, {
            hash: returnHash,
        })
    }
}

/**
 * Appends a policy to the list of policies applied to a specific contract address.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to apply.
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 */
export const appendPolicy = async(config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract, 
    policyId: number, contractAddressForPolicy: Address) => {
    
    const retrievePolicies = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "getAppliedPolicyIds",
        args: [ contractAddressForPolicy],
    });

    let policyResult = retrievePolicies.result as [number]
    policyResult.push(policyId)

    setPolicies(config, rulesEnginePolicyContract, policyResult, contractAddressForPolicy)
}

/**
 * Deletes a policy from the Rules Engine.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param policyId - The ID of the policy to delete.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const deletePolicy = async(config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract, policyId: number): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "deletePolicy",
            args: [ policyId ],
        })
    } catch (err) {
        return -1
    }

    if(addFC != null) {
        const returnHash = await writeContract(config, {
            ...addFC.request,
            account
        });
        await waitForTransactionReceipt(config, {
            hash: returnHash,
        })
    }
    
    return 0
}

/**
 * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policyId - The ID of the policy to retrieve.
 * @param functionSignatureMappings - A mapping of function signatures to their hex representations.
 * @returns A JSON string representing the full policy.
 */
export const getPolicy = async(config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract, rulesEngineComponentContract: RulesEngineComponentContract, 
    policyId: number): Promise<string> => {

        var functionSignatureMappings: hexToFunctionSignature[] = []
        try {
        const retrievePolicy = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "getPolicy",
            args: [ policyId],
        });

        let policyResult = retrievePolicy.result
        let functionSignatures: any = policyResult[0]
        let ruleIds2DArray: any = policyResult[2]

        var iter = 1
        for(var fsId in functionSignatures) {
            var mapp = await getFunctionSignatureMetadata(config, rulesEngineComponentContract, policyId, iter)
            var newMapping: hexToFunctionSignature = {
                hex: mapp.signature,
                functionSignature: mapp.functionSignature,
                encodedValues: mapp.encodedValues,
                index: -1
            }
            functionSignatureMappings.push(newMapping)
            iter++
        }

        var foreignCalls: ForeignCallOnChain[] = await getAllForeignCalls(config, rulesEngineComponentContract, policyId)
        var foreignCallNames: string[] = []
        for(var fc of foreignCalls) {
            var name = await getForeignCallMetadata(config, rulesEngineComponentContract, policyId, fc.foreignCallIndex)
            foreignCallNames.push(name)
            var newMapping: hexToFunctionSignature = {
                hex: fc.signature,
                functionSignature: name,
                encodedValues: "",
                index: -1
            }
            functionSignatureMappings.push(newMapping)
        }

        var callStrings: string[] = []
        convertForeignCallStructsToStrings(callStrings, foreignCalls, functionSignatureMappings, foreignCallNames)

        var trackers: TrackerOnChain[] = await getAllTrackers(config, rulesEngineComponentContract, policyId)
        var trackerNames: string[] = []
        for(var tracker of trackers) {
            var name = await getTrackerMetadata(config, rulesEngineComponentContract, policyId, tracker.trackerIndex)
            trackerNames.push(name)
            var newMapping: hexToFunctionSignature = {
                hex: "",
                functionSignature: name,
                encodedValues: "",
                index: tracker.trackerIndex
            }
            functionSignatureMappings.push(newMapping)
        }

        var trackerStrings: string[] = []
        convertTrackerStructsToStrings(trackers, trackerStrings, trackerNames)

        var iter = 0
        var ruleJSONObjs = []
        for(var innerArray of ruleIds2DArray) {
            var functionString = ""
            var encodedValues: string = ""
            var fs = functionSignatures[iter]
            for(var mapping of functionSignatureMappings) {
                if(mapping.hex == fs) {
                    functionString = mapping.functionSignature
                    encodedValues = mapping.encodedValues
                    break
                }
            }
            for (var ruleId of innerArray) {
                var ruleS = await getRule(config, rulesEnginePolicyContract, policyId, ruleId)
                var plhArray: string[] = []
                if(ruleS != null) {
                    ruleJSONObjs.push(convertRuleStructToString(functionString, encodedValues, ruleS, plhArray, foreignCalls, trackers, functionSignatureMappings))
                }
                
            }
            iter++
        }

        var jsonObj = {
            Trackers: trackerStrings,
            ForeignCalls: callStrings,
            RulesJSON: ruleJSONObjs
        }
        return JSON.stringify(jsonObj)

    } catch (error) {
        console.error(error);
            return "";
    }    

}

export async function policyExists(config: Config, rulesEnginePolicyContract: RulesEnginePolicyContract, rulesEngineComponentContract: RulesEngineComponentContract, policyId: number): Promise<boolean> {
    try {
        let policyExists = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "getPolicy",
            args: [policyId],
        });
        if (policyExists.result[0] != null && policyExists.result[2] != null) {
            return true
        }
        return false
    } catch (error) {
        return false
    }
}