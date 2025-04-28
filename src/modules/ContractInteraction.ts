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

export const getRulesEnginePolicyContract = (address: Address, client): RulesEnginePolicyContract => getContract({
    address,
    abi: RulesEnginePolicyABI,
    client
  });

  export const getRulesEngineComponentContract = (address: Address, client): RulesEngineComponentContract => getContract({
    address,
    abi: RulesEngineComponentABI,
    client
  });

export async function sleep(ms: number): Promise<void> {
    return new Promise(
        (resolve) => setTimeout(resolve, ms));
}

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

export const addNewRuleToBatch = async (policyId: number, ruleS: string, rulesEnginePolicyContract: RulesEnginePolicyContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[], calls: any[]) => {
    let ruleSyntax: ruleJSON = JSON.parse(ruleS);
    var effect = buildAnEffectStruct(ruleSyntax)

    var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effect)

    calls.push(
        encodeFunctionData({
            abi: rulesEnginePolicyContract.abi,
            functionName: "createRule",
            args: [ policyId, rule ],
        })
    )
}

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

export const updateRule = async (policyId: number, ruleId: number, ruleS: string, rulesEnginePolicyContract: RulesEnginePolicyContract, 
    foreignCallNameToID: FCNameToID[]): Promise<number> => {
    let ruleSyntax: ruleJSON = JSON.parse(ruleS);
    var effects = buildAnEffectStruct(ruleSyntax)
    var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effects)
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
