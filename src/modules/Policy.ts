import { toFunctionSelector, Address } from "viem";

import {
    simulateContract,
    writeContract
} from "@wagmi/core";

import { account, getConfig } from "../../config";
import { parseForeignCallDefinition, parseTrackerSyntax, convertRuleStructToString, convertForeignCallStructsToStrings, convertTrackerStructsToStrings } from "./Parser";
import { RulesEnginePolicyContract, RulesEngineComponentContract, FCNameToID, TrackerDefinition, PolicyJSON, hexToFunctionSignature } from "./types";
import { setForeignCall, createNewRule, getAllForeignCalls, getAllTrackers } from "..";
import { sleep } from "./ContractInteractionUtils";
import { createFunctionSignature } from "./FunctionSignatures";
import { retrieveRule } from "./Rules";
import { setTracker } from "./Trackers";

/**
 * @file Policy.ts
 * @description This module provides a comprehensive set of functions for interacting with the Policies within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies.
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

const config = getConfig()

/**
 * Creates a blank policy in the Rules Engine.
 * 
 * @param policyType - The type of the policy to be created.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns The ID of the newly created policy.
 */
export const createBlankPolicy = async (policyType: string, 
    rulesEnginePolicyContract: RulesEnginePolicyContract): Promise<number> => {
        
    const addPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "createPolicy",
        args: [[], [], policyType == "open" ? 1 : 0],
    })
    const returnHash = await writeContract(config, {
        ...addPolicy.request,
        account
    });

    return addPolicy.result
}

/**
 * Creates a full policy in the Rules Engine, including rules, trackers, and foreign calls.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @param policySyntax - The JSON string representing the policy syntax.
 * @param outputFileName - The name of the output file for generated Solidity code.
 * @param contractToModify - The contract to which the policy will be applied.
 * @param policyType - The type of the policy to be created.
 * @returns The ID of the newly created policy.
 */
export const createFullPolicy = async (rulesEnginePolicyContract: RulesEnginePolicyContract,  rulesEngineComponentContract: RulesEngineComponentContract,
    policySyntax: string): Promise<number> => {
    var fcIds: FCNameToID[] = []
    var trackerIds: FCNameToID[] = []
    let trackers: TrackerDefinition[] = []
    let ruleIds = []
    let ruleToFunctionSignature = new Map<string, number[]>();
    let functionSignatures: string[] = []
    let functionSignatureIds: number[] = []
    let rulesDoubleMapping = []
    let functionSignatureSelectors = []
    let policyJSON: PolicyJSON = JSON.parse(policySyntax);
    const policyId = await createBlankPolicy(policyJSON.PolicyType, rulesEnginePolicyContract)
    
    for(var foreignCall of policyJSON.ForeignCalls) {
        var fcStruct = parseForeignCallDefinition(foreignCall)
        const fcId = await setForeignCall(policyId, 0, JSON.stringify(foreignCall), rulesEngineComponentContract)
        var struc : FCNameToID = {id: fcId, name: fcStruct.name.split('(')[0], type: 0}
        fcIds.push(struc)
    }


    for(var tracker of policyJSON.Trackers) {
        var trackerStruct: TrackerDefinition = parseTrackerSyntax(tracker)
        const trId = await setTracker(policyId, 0, JSON.stringify(tracker), rulesEngineComponentContract)
        var struc : FCNameToID = {id: trId, name: trackerStruct.name, type: trackerStruct.type}
        trackerIds.push(struc)
        trackers.push(trackerStruct)
    }

    for(var rule of policyJSON.RulesJSON) {
        var functionSignature = rule.functionSignature.trim()
        if(!functionSignatures.includes(functionSignature)) {
            functionSignatures.push(functionSignature)
            const fsId = await createFunctionSignature(policyId, functionSignature, rulesEngineComponentContract)
            functionSignatureIds.push(fsId)
        }
        
        const ruleId = await createNewRule(policyId, JSON.stringify(rule), rulesEnginePolicyContract, fcIds, trackerIds)
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
    var result = await updatePolicy(rulesEnginePolicyContract, policyId, functionSignatureSelectors, functionSignatureIds, rulesDoubleMapping)

    return result
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
export const updatePolicy = async (
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
            await writeContract(config, {
                ...updatePolicy.request,
                account
            });
    
            return updatePolicy.result;
        } 

        return -1
    }

/**
 * Applies a policy to a specific contract address.
 * 
 * @param policyId - The ID of the policy to apply.
 * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns The result of the policy application.
 */
export const applyPolicy = async(policyId: number, contractAddressForPolicy: Address,
    rulesEnginePolicyContract: RulesEnginePolicyContract): Promise<number> => {

    var applyPolicy
    while(true) {
        try {
            applyPolicy = await simulateContract(config, {
                address: rulesEnginePolicyContract.address,
                abi: rulesEnginePolicyContract.abi,
                functionName: "applyPolicy",
                args: [contractAddressForPolicy, [policyId]],
            })
            break
        } catch (error) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000);
        } 
    }

    if(applyPolicy != null) {
        await writeContract(config, {
        ...applyPolicy.request,
        account
        }) 
    }
    return applyPolicy.result
}

/**
 * Deletes a policy from the Rules Engine.
 * 
 * @param policyId - The ID of the policy to delete.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @returns `0` if successful, `-1` if an error occurs.
 */
export const deletePolicy = async(policyId: number,  
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deletePolicy",
            args: [ policyId ],
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
 * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
 * 
 * @param policyId - The ID of the policy to retrieve.
 * @param functionSignatureMappings - A mapping of function signatures to their hex representations.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param rulesEngineComponentContract - The contract instance for interacting with the Rules Engine Component.
 * @returns A JSON string representing the full policy.
 */
export const retrieveFullPolicy = async(policyId: number, functionSignatureMappings: hexToFunctionSignature[], 
    rulesEnginePolicyContract: RulesEnginePolicyContract, rulesEngineComponentContract: RulesEngineComponentContract): Promise<string> => {
    try {
        const retrievePolicy = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "getPolicy",
            args: [ policyId],
        });

        await writeContract(config, {
            ...retrievePolicy.request,
            account
        });

        let policyResult = retrievePolicy.result
        let functionSignatures: any = policyResult[0]
        let functionIds = policyResult[1]
        let ruleIds2DArray: any = policyResult[2]

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
                var ruleS = await retrieveRule(policyId, ruleId, rulesEnginePolicyContract)
                var plhArray: string[] = []
                if(ruleS != null) {
                    ruleJSONObjs.push(convertRuleStructToString(functionString, encodedValues, ruleS, plhArray))
                }
                
            }
            iter++
        }


        var foreignCalls: any[] | null = await getAllForeignCalls(policyId, rulesEngineComponentContract)
        var callStrings: string[] = []
        convertForeignCallStructsToStrings(callStrings, foreignCalls, functionSignatureMappings)

        var trackers: any[] | null = await getAllTrackers(policyId, rulesEngineComponentContract)
        var trackerStrings: string[] = []
        convertTrackerStructsToStrings(trackers, trackerStrings)

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