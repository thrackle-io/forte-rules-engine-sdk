import { 
    getContract, 
    Address,
    GetContractReturnType,
    toFunctionSelector,
    BaseError,
    ContractFunctionRevertedError,
    encodeFunctionData,
    PrivateKeyAccount,
    hexToString,
    toBytes,
    toHex,
    encodePacked,
    encodeAbiParameters,
    parseAbiParameters,
    stringToBytes,
    getAddress,

} from "viem";

import {
    RuleStruct,
    convertRuleStructToString,
    convertForeignCallStructsToStrings,
    convertTrackerStructsToStrings,
    TrackerDefinition,
    parseForeignCallDefinition,
    parseTrackerSyntax,
    parseFunctionArguments,
    parseRuleSyntax,
    cleanInstructionSet,
    buildForeignCallList,
    buildTrackerList
} from "./Parser"

import {
    generateModifier
} from '../codeGeneration/generateSolidity'

import {
    injectModifier
} from '../codeGeneration/injectModifier'

import {
    simulateContract,
    writeContract, 
    readContract,
    call
} from "@wagmi/core";

import { getConfig, account } from '../../config'

import RulesDiamondArtifact from "../abis/RulesEngineDiamond.json";
import RulesEnginePolicyLogicArtifact from "../abis/RulesEnginePolicyFacet.json";
import RulesEngineComponentLogicArtifact from "../abis/RulesEngineComponentFacet.json";
/**
 * @file ContractInteraction.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies, rules, trackers, and foreign calls.
 *              Additionally, it supports generating Solidity modifiers, injecting them into contracts, and simulating contract interactions.
 * 
 * @module ContractInteraction
 * 
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `generateSolidity`: Handles the generation of Solidity modifiers.
 * - `injectModifier`: Handles the injection of modifiers into Solidity contracts.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 * 
 * @types
 * - `RulesEnginePolicyContract`: Represents the contract instance for interacting with the Rules Engine Policy.
 * - `RulesEngineComponentContract`: Represents the contract instance for interacting with the Rules Engine Component.
 * - `FCNameToID`: Maps foreign call names to their corresponding IDs.
 * - `RuleStorageSet`: Represents the structure of a rule stored in the Rules Engine.
 * - `hexToFunctionSignature`: Maps hex-encoded function signatures to their human-readable equivalents.
 * - `PolicyJSON`: Represents the structure of a policy in JSON format.
 * - `foreignCallJSON`, `trackerJSON`, `ruleJSON`: Represent the structure of foreign calls, trackers, and rules in JSON format.
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license UNLICENSED
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */
const RulesEnginePolicyABI = RulesEnginePolicyLogicArtifact.abi;
const RulesEngineComponentABI = RulesEngineComponentLogicArtifact.abi;

type RulesEnginePolicyContract = GetContractReturnType<typeof RulesEnginePolicyABI>;
type RulesEngineComponentContract = GetContractReturnType<typeof RulesEngineComponentABI>;

type FCNameToID = {
    id: number
    name: string
    type: number
}

type RuleStorageSet = {
    set: boolean, 
    rule: any
}

type hexToFunctionSignature = {
    hex: string,
    functionSignature: string,
    encodedValues: string
}

interface PolicyJSON {
    Policy: string;
    ForeignCalls: foreignCallJSON[];
    Trackers: trackerJSON[];
    RulesJSON: ruleJSON[];
}

export interface foreignCallJSON {
    name: string,
    signature: string,
    address: string,
    returnType: string,
    parameterTypes: string,
    encodedIndices: string
}

export interface trackerJSON {
    name: string,
    type: string,
    defaultValue: string
}

export interface ruleJSON {
    condition: string,
    positiveEffects: string[],
    negativeEffects: string[],
    functionSignature: string,
    encodedValues: string
}

const config = getConfig()

//TODO: Make the client usages type specific
export const getRulesEnginePolicyContract = (address: Address, client: any): RulesEnginePolicyContract => getContract({
    address,
    abi: RulesEnginePolicyABI,
    client
  });

  export const getRulesEngineComponentContract = (address: Address, client: any): RulesEngineComponentContract => getContract({
    address,
    abi: RulesEngineComponentABI,
    client
  });

/**
 * Pauses the execution of an asynchronous function for a specified duration.
 *
 * @param ms - The number of milliseconds to sleep before resolving the promise.
 * @returns A promise that resolves after the specified duration.
 */
export async function sleep(ms: number): Promise<void> {
    return new Promise(
        (resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a blank policy in the Rules Engine.
 * 
 * @param policyType - The type of the policy to be created.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns The ID of the newly created policy.
 */
export const createBlankPolicy = async (policyType: number, 
    rulesEnginePolicyContract: RulesEnginePolicyContract): Promise<number> => {
        
    const addPolicy = await simulateContract(config, {
        address: rulesEnginePolicyContract.address,
        abi: rulesEnginePolicyContract.abi,
        functionName: "createPolicy",
        args: [[], [], policyType],
    })
    const returnHash = await writeContract(config, {
        ...addPolicy.request,
        account
    });

    return addPolicy.result
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
 * Retrieves a specific rule from the Rules Engine.
 * 
 * @param policyId - The ID of the policy containing the rule.
 * @param ruleId - The ID of the rule to retrieve.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @returns The retrieved rule as a `RuleStruct`, or `null` if retrieval fails.
 */
export const retrieveRule = async(policyId: number, ruleId: number, rulesEnginePolicyContract: RulesEnginePolicyContract): Promise<RuleStruct | null> => {
    
    try {
        const retrieveRule = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "getRule",
            args: [ policyId, ruleId],
        });

        await writeContract(config, {
            ...retrieveRule.request,
            account
        });

        let ruleResult = retrieveRule.result as RuleStorageSet
        let ruleS = ruleResult.rule as RuleStruct


        for(var posEffect of ruleS.posEffects) {
            posEffect.text = hexToString(posEffect.text).replace(/\u0000/g, "")
        }

        for(var negEffect of ruleS.negEffects) {
            negEffect.text = hexToString(negEffect.text).replace(/\u0000/g, "")
        }

        return ruleS

    } catch (error) {
        console.error(error);
            return null;
    } 
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
    policySyntax: string, outputFileName: string, contractToModify: string, 
    policyType: number): Promise<number> => {
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
    const policyId = await createBlankPolicy(policyType, rulesEnginePolicyContract)
    
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
        
        const ruleId = await createNewRule(policyId, JSON.stringify(rule), rulesEnginePolicyContract, fcIds, outputFileName, contractToModify, trackerIds)
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

    return policyId
    // return result
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
 * Executes a batch of calls in the Rules Engine.
 * 
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param account - The account executing the batch.
 * @param calls - The list of calls to execute.
 * @returns The transaction result or an error if execution fails.
 */
export const executeBatch = async (
    rulesEnginePolicyContract: RulesEnginePolicyContract,
    account: PrivateKeyAccount,
    calls: any[]
) => {
    try {

        const {request} = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: RulesDiamondArtifact.abi,
            functionName: "batch",
            args: [calls, true],
            account
        });
        
        const tx = await writeContract(config, {
            ...request
        });

        return tx;
    } catch (err) {
        if (err instanceof BaseError) {
            const revertError = err.walk(err => err instanceof ContractFunctionRevertedError)
            return revertError ?? err
        }
        return err as Error
    }

}

/**
 * Adds a new rule to a batch of calls for the Rules Engine Policy Contract.
 *
 * @param policyId - The ID of the policy to which the rule will be added.
 * @param ruleS - A JSON string representing the rule to be added.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param foreignCallNameToID - A mapping of foreign call names to their corresponding IDs.
 * @param trackerNameToID - A mapping of tracker names to their corresponding IDs.
 * @param calls - An array to which the encoded function call for creating the rule will be appended.
 *
 * @returns A promise that resolves when the rule has been successfully added to the batch.
 */
export const addNewRuleToBatch = async (policyId: number, ruleS: string, rulesEnginePolicyContract: RulesEnginePolicyContract, foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[], calls: any[]) => {
    let ruleSyntax: ruleJSON = JSON.parse(ruleS);
    var effect = buildAnEffectStruct(ruleSyntax, trackerNameToID)

    var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effect, trackerNameToID)

    calls.push(
        encodeFunctionData({
            abi: rulesEnginePolicyContract.abi,
            functionName: "createRule",
            args: [ policyId, rule ],
        })
    )
}

/**
 * Creates a function signature in the rules engine component contract.
 *
 * This function parses the provided function signature, maps its arguments to their respective
 * types, and interacts with the smart contract to create the function signature. If the contract
 * interaction fails, it retries with a delay until successful.
 *
 * @param policyId - The ID of the policy for which the function signature is being created.
 * @param functionSignature - The function signature string to be parsed and added to the contract.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI
 *                                        of the rules engine component.
 * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
 *
 * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
 */
export const createFunctionSignature = async (policyId: number, functionSignature: string, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {
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
        await writeContract(config, {
            ...addRule.request,
            account
        });

        return addRule.result;
    }
    return -1 
}

/**
 * Deletes a foreign call associated with a specific policy in the rules engine component contract.
 *
 * @param policyId - The ID of the policy to which the foreign call belongs.
 * @param foreignCallId - The ID of the foreign call to be deleted.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interacting with the rules engine component.
 * @returns A promise that resolves to a number:
 *          - `0` if the operation is successful.
 *          - `-1` if an error occurs during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteForeignCall = async(policyId: number, foreignCallId: number,  
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {

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
 * Sets or updates a foreign call in the rules engine component contract.
 *
 * @param policyId - The ID of the policy to associate with the foreign call.
 * @param foreignCallId - The ID of the foreign call to update. Use `0` to create a new foreign call.
 * @param fcSyntax - A JSON string representing the foreign call definition.
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
 *
 * @remarks
 * - If `foreignCallId` is `0`, a new foreign call is created. Otherwise, the specified foreign call is updated.
 * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
 * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
 * - The `writeContract` function is used to execute the contract interaction on the blockchain.
 * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
 *
 * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
 */
export const setForeignCall = async(policyId: number, foreignCallId: number, fcSyntax: string, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {
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
            addFC = foreignCallId == 0 ? await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "createForeignCall",
                args: [ policyId, fc ],
            }) : await simulateContract(config, {
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
        if(foreignCallId == 0) {
            return addFC.result
        } else {
            let foreignCallResult = addFC.result as any
            return foreignCallResult.foreignCallIndex
        }
    } 
    return -1
}

/**
 * Deletes a tracker associated with a specific policy in the rules engine component contract.
 *
 * @param policyId - The ID of the policy to which the tracker belongs.
 * @param trackerId - The ID of the tracker to be deleted.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @returns A promise that resolves to a number:
 *          - `0` if the tracker was successfully deleted.
 *          - `-1` if an error occurred during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteTracker = async(policyId: number, trackerId: number,  
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deleteTracker",
            args: [ policyId, trackerId ],
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
 * Asynchronously sets or updates a tracker in the rules engine component contract.
 *
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to update. If 0, a new tracker will be created.
 * @param trSyntax - A JSON string representing the tracker syntax.
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @returns A promise that resolves to the tracker ID. If a new tracker is created, the new tracker ID is returned.
 *          If an update is performed, the existing tracker ID is returned. Returns -1 if the operation fails.
 *
 * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
 *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
 */
export const setTracker = async(policyId: number, trackerId: number, trSyntax: string, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {
    var json : trackerJSON = JSON.parse(trSyntax)
    var tracker: TrackerDefinition = parseTrackerSyntax(json)
    var transactionTracker = {set: true, pType: tracker.type, trackerValue: tracker.defaultValue }
    var addTR
    while(true) {
        try {
            addTR = trackerId == 0 ? await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "createTracker",
                args: [ policyId,  transactionTracker ],
            }) : await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "updateTracker",
                args: [ policyId,  trackerId, transactionTracker ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addTR != null) {
        await writeContract(config, {
            ...addTR.request,
            account
        });

        let trackerResult = addTR.result 
        return trackerId == 0 ? trackerResult : trackerId;
    }
    return -1;
}

/**
 * Retrieves the result of a foreign call from the rules engine component contract.
 *
 * @param policyId - The ID of the policy associated with the foreign call.
 * @param foreignCallId - The ID of the foreign call to retrieve.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getForeignCall = async(policyId: number, foreignCallId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any | null> => {
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
 * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
 *
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to retrieve.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getTracker = async(policyId: number, trackerId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getTracker",
            args: [ policyId, trackerId ],
        });
    

        await readContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result
        return trackerResult;
    } catch (error) {
    console.error(error);
        return null;
    }
}

/**
 * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
 * @param rulesEngineComponentContract - An object representing the Rules Engine Component Contract, 
 * containing its address and ABI.
 * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllForeignCalls = async(policyId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any[] | null> => {
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

/**
 * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
 * @param rulesEngineComponentContract - An object representing the Rules Engine Component Contract, 
 * including its address and ABI.
 * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllTrackers = async(policyId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any[] | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getAllTrackers",
            args: [ policyId],
        });
    

        await readContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result
        return trackerResult;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Updates an existing rule in the Rules Engine Policy Contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleId - The ID of the rule to be updated.
 * @param ruleS - A JSON string representing the rule's structure and logic.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
 * @param foreignCallNameToID - A mapping of foreign call names to their corresponding IDs.
 * @param trackerNameToID - A mapping of tracker names to their corresponding IDs.
 * @returns A promise that resolves to the result of the rule update operation. Returns the result ID if successful, or -1 if the operation fails.
 *
 * @throws Will retry indefinitely if the contract simulation fails, with a 1-second delay between retries.
 */
export const updateRule = async (policyId: number, ruleId: number, ruleS: string, rulesEnginePolicyContract: RulesEnginePolicyContract, 
    foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[]): Promise<number> => {
    let ruleSyntax: ruleJSON = JSON.parse(ruleS);
    var effects = buildAnEffectStruct(ruleSyntax, trackerNameToID)
    var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effects, trackerNameToID)
    var addRule
    while(true) {
        try {
            addRule = await simulateContract(config, {
                address: rulesEnginePolicyContract.address,
                abi: rulesEnginePolicyContract.abi,
                functionName: "updateRule",
                args: [ policyId, ruleId, rule ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addRule != null) {
        await writeContract(config, {
            ...addRule.request,
            account
        });

        return addRule.result;
    } 
    return -1
}

/**
 * Asynchronously creates a new rule in the rules engine policy contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleS - A JSON string representing the rule to be created.
 * @param rulesEnginePolicyContract - The contract instance for interacting with the rules engine policy.
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
export const createNewRule = async (policyId: number, ruleS: string, rulesEnginePolicyContract: RulesEnginePolicyContract, 
    foreignCallNameToID: FCNameToID[], outputFileName: string, contractToModify: string, trackerNameToID: FCNameToID[]): Promise<number> => {

    let ruleSyntax: ruleJSON = JSON.parse(ruleS);
    let effectSyntax: ruleJSON = JSON.parse(ruleS)
    var effects = buildAnEffectStruct(effectSyntax, trackerNameToID)
    var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effects, trackerNameToID)

    var addRule
    while(true) {
        try {
            addRule = await simulateContract(config, {
                address: rulesEnginePolicyContract.address,
                abi: rulesEnginePolicyContract.abi,
                functionName: "createRule",
                args: [ policyId, rule ],
            });
            break
        } catch (err) {
            console.log(err)
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addRule != null) {
        await writeContract(config, {
            ...addRule.request,
            account
        });

        generateModifier(ruleS, outputFileName)

        var directoryStructure = outputFileName.split('/')
        directoryStructure.pop()
        var directoryString = ''
        for(var str of directoryStructure) {
            directoryString = directoryString + str + '/'
        }
        directoryString = directoryString + 'diff.diff'

        if(contractToModify && contractToModify.length > 0) {
            injectModifier(ruleSyntax.functionSignature.split('(')[0], ruleSyntax.encodedValues, contractToModify, directoryString)
        }
        return addRule.result;
    } 
    return -1
}

/**
 * Retrieves all rules associated with a specific policy ID from the Rules Engine Policy Contract.
 *
 * @param policyId - The unique identifier of the policy for which rules are to be retrieved.
 * @param rulesEnginePolicyContract - An object representing the Rules Engine Policy Contract, 
 * including its address and ABI (Application Binary Interface).
 * @returns A promise that resolves to an array of rules if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllRules = async(policyId: number, rulesEnginePolicyContract: RulesEnginePolicyContract): Promise<any[] | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEnginePolicyContract.address,
            abi: rulesEnginePolicyContract.abi,
            functionName: "getAllRules",
            args: [ policyId],
        });
    

        await readContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result
        return trackerResult;
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Deletes a rule from the rules engine component contract.
 *
 * @param policyId - The ID of the policy to which the rule belongs.
 * @param ruleId - The ID of the rule to be deleted.
 * @param rulesEngineComponentContract - The contract instance containing the rules engine component.
 * @returns A promise that resolves to a number:
 *          - `0` if the rule was successfully deleted.
 *          - `-1` if an error occurred during the deletion process.
 *
 * @throws This function does not throw errors directly but returns `-1` in case of an exception.
 */
export const deleteRule = async(policyId: number, ruleId: number,  
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deleteRule",
            args: [ policyId, ruleId ],
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
 * Builds a structured representation of positive and negative effects based on the provided rule syntax and tracker mappings.
 *
 * @param ruleSyntax - The JSON representation of the rule syntax to parse.
 * @param trackerNameToID - An array mapping tracker names to their corresponding IDs.
 * @returns An object containing arrays of positive and negative effects, each represented as structured objects.
 *
 * The returned object has the following structure:
 * - `positiveEffects`: An array of objects representing the positive effects.
 * - `negativeEffects`: An array of objects representing the negative effects.
 *
 * Each effect object includes:
 * - `valid`: A boolean indicating whether the effect is valid.
 * - `dynamicParam`: A boolean indicating whether the parameter is dynamic.
 * - `effectType`: The type of the effect.
 * - `pType`: The parameter type (e.g., address, string, bytes, uint).
 * - `param`: The encoded parameter value.
 * - `text`: A hexadecimal representation of the effect's text.
 * - `errorMessage`: The error message associated with the effect.
 * - `instructionSet`: The cleaned instruction set for the effect.
 */
function buildAnEffectStruct(ruleSyntax: ruleJSON, trackerNameToID: FCNameToID[]) {
    var output = parseRuleSyntax(ruleSyntax, trackerNameToID)
    var pEffects = []
    var nEffects = []

    for(var pEffect of output.positiveEffects) {
        cleanInstructionSet(pEffect.instructionSet)
        var param: any

        if(pEffect.pType == 0) {
            // address
            param = encodeAbiParameters(
                parseAbiParameters('address'),
                [getAddress(String(pEffect.parameterValue))])
        } else if(pEffect.pType == 1) {
            // string
            param = encodeAbiParameters(
                parseAbiParameters('string'),
                [String(pEffect.parameterValue)])
        } else if(pEffect.pType == 5) {
            // bytes
            param = encodeAbiParameters(
                parseAbiParameters('bytes'),
                [toHex(stringToBytes(String(pEffect.parameterValue)))])
        } else {
            // uint
            param = encodeAbiParameters(
                parseAbiParameters('uint256'),
                [BigInt(pEffect.parameterValue)])
        }

        const effect = {
            valid: true,
            dynamicParam: false,
            effectType: pEffect.type,
            pType: pEffect.pType,
            param: param,
            text: toHex(stringToBytes(
                pEffect.text, 
                { size: 32 } 
              )),
            errorMessage: pEffect.text,
            instructionSet: pEffect.instructionSet
        } as const
        pEffects.push(effect)
    }
    for(var nEffect of output.negativeEffects) {

        var param: any

        if(nEffect.pType == 0) {
            // address
            param = encodeAbiParameters(
                parseAbiParameters('address'),
                [getAddress(String(nEffect.parameterValue))])
        } else if(nEffect.pType == 1) {
            // string
            param = encodeAbiParameters(
                parseAbiParameters('string'),
                [String(nEffect.parameterValue)])
        } else if(nEffect.pType == 5) {
            // bytes
            param = encodeAbiParameters(
                parseAbiParameters('bytes'),
                [toHex(stringToBytes(String(nEffect.parameterValue)))])
        } else {
            // uint
            param = encodeAbiParameters(
                parseAbiParameters('uint256'),
                [BigInt(nEffect.parameterValue)])
        }

        cleanInstructionSet(nEffect.instructionSet)
        const effect = {
            valid: true,
            dynamicParam: false,
            effectType: nEffect.type,
            pType: nEffect.pType,
            param: param,
            text: toHex(stringToBytes(
                nEffect.text, 
                { size: 32 } 
              )),
            errorMessage: nEffect.text,
            instructionSet: nEffect.instructionSet
        } as const
        nEffects.push(effect)
    }

    return {positiveEffects: pEffects, negativeEffects: nEffects }
}

/**
 * Constructs a rule structure based on the provided policy ID, rule syntax, foreign call mappings, 
 * effect data, and tracker mappings. This function processes the rule syntax to generate a structured 
 * representation of the rule, including placeholders, effects, and associated metadata.
 *
 * @param policyId - The unique identifier for the policy associated with the rule.
 * @param ruleSyntax - The JSON representation of the rule syntax, including conditions and effects.
 * @param foreignCallNameToID - An array of mappings between foreign call names and their corresponding IDs.
 * @param effect - An object containing the positive and negative effects of the rule.
 * @param trackerNameToID - An array of mappings between tracker names and their corresponding IDs.
 * 
 * @returns A structured representation of the rule, including its instruction set, placeholders, 
 *          effect placeholders, and associated effects.
 */
function buildARuleStruct(policyId: number, ruleSyntax: ruleJSON, foreignCallNameToID: FCNameToID[], effect: any, trackerNameToID: FCNameToID[]) {
    var fcList = buildForeignCallList(ruleSyntax.condition)
    for(var eff of ruleSyntax.positiveEffects) {
        fcList.push(...buildForeignCallList(eff))
    }
    for(var eff of ruleSyntax.negativeEffects) {
        fcList.push(...buildForeignCallList(eff))
    }
    var output = parseRuleSyntax(ruleSyntax, trackerNameToID)
    var trList = buildTrackerList(ruleSyntax.condition)
    for(var eff of ruleSyntax.positiveEffects) {
        trList.push(...buildTrackerList(eff))
    }
    for(var eff of ruleSyntax.negativeEffects) {
        trList.push(...buildTrackerList(eff))
    }
    var fcIDs = []
    var trIDs = []
    for(var name of fcList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcIDs.push(mapping.id)
            }
        }
    }
    for(var name of trList) {
        for(var mapping of trackerNameToID) {
            if(mapping.name == name) {
                trIDs.push(mapping.id)
            }
        }
    }
    var iter = 0
    var tIter = 0
    for(var index in output.placeHolders) {
        if(output.placeHolders[index].foreignCall) {
            output.placeHolders[index].typeSpecificIndex = foreignCallNameToID[iter].id
            iter++
        }
        if(output.placeHolders[index].trackerValue) {
            output.placeHolders[index].typeSpecificIndex = trackerNameToID[tIter].id
            tIter++
        }
    }

    iter = 0
    tIter = 0

    for(var index in output.effectPlaceHolders) {
        if(output.effectPlaceHolders[index].foreignCall) {
            output.effectPlaceHolders[index].typeSpecificIndex = foreignCallNameToID[iter].id
            iter++
        }
        if(output.effectPlaceHolders[index].trackerValue) {
            output.effectPlaceHolders[index].typeSpecificIndex = trackerNameToID[tIter].id
            tIter++
        }
    }

    var fcEffectList: string[] = []
    for(var eff of ruleSyntax.positiveEffects) {
        fcEffectList.concat(buildForeignCallList(eff))
    }
    for(var eff of ruleSyntax.negativeEffects) {
        fcEffectList.concat(buildForeignCallList(eff))
    }

    var fcEffectIDs = []
    for(var name of fcEffectList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcEffectIDs.push(mapping.id)
            }
        }
    }

    var rawData = {
        instructionSetIndex: [],
        argumentTypes: [],
        dataValues: [],
    }
    cleanInstructionSet(output.instructionSet)
    const rule =  {
        instructionSet: output.instructionSet,
        rawData: rawData,          
        placeHolders: output.placeHolders,
        effectPlaceHolders: output.effectPlaceHolders,
        posEffects: effect.positiveEffects,
        negEffects: effect.negativeEffects
    } as const
    console.log(rule)
    return rule
}
