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
    buildForeignCallList
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

import RulesEngineRunLogicArtifact from "../abis/RulesEngineDataFacet.json";
import RulesDiamondArtifact from "../abis/RulesEngineDiamond.json";

const RulesEngineABI = RulesEngineRunLogicArtifact.abi

type RulesEngineContract = GetContractReturnType<typeof RulesEngineABI>;

type FCNameToID = {
    id: number
    name: string
}

type RuleStorageSet = {
    set: boolean, 
    rule: any
}

type hexToFunctionSignature = {
    hex: string,
    functionSignature: string
}

interface PolicyJSON {
    Policy: string;
    ForeignCalls: string[];
    Trackers: string[];
    Rules: string[];
}

const config = getConfig()

// const client = config.getClient({chain: config.chains[0]})

export const getRulesEngineContract = (address: Address, client): RulesEngineContract => getContract({
  address,
  abi: RulesEngineABI,
  client
});

export async function sleep(ms: number): Promise<void> {
    return new Promise(
        (resolve) => setTimeout(resolve, ms));
}

export const createBlankPolicy = async (
    contractAddressForPolicy: Address, 
    rulesEngineContract: RulesEngineContract): Promise<number> => {
        

    const addPolicy = await simulateContract(config, {
        address: rulesEngineContract.address,
        abi: rulesEngineContract.abi,
        functionName: "createPolicy",
        args: [[], []],
    })
    const returnHash = await writeContract(config, {
        ...addPolicy.request,
        account
    });
    if(addPolicy.result > 0) {
        while(true) {
            var applyPolicy
            try {
                applyPolicy = await simulateContract(config, {
                    address: rulesEngineContract.address,
                    abi: rulesEngineContract.abi,
                    functionName: "applyPolicy",
                    args: [contractAddressForPolicy.toLowerCase(), [Number(addPolicy.result)]],
                })
            } catch (error) {
                await sleep(1000);
            } 
            if(applyPolicy != null) {
                await writeContract(config, {
                ...applyPolicy.request,
                account
                }) 
            }
            break
        }
    
    }

    return addPolicy.result
}


export const retrieveRule = async(policyId: number, ruleId: number, rulesEngineContract: RulesEngineContract): Promise<RuleStruct | null> => {
    
    try {
        const retrieveRule = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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

export const retrieveFullPolicy = async(policyId: number, functionSignatureMappings: hexToFunctionSignature[], rulesEngineContract: RulesEngineContract): Promise<string> => {

    try {
        const retrievePolicy = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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
        var ruleStrings = []
        for(var innerArray of ruleIds2DArray) {
            var functionString = ""
            var fs = functionSignatures[iter]
            for(var mapping of functionSignatureMappings) {
                if(mapping.hex == fs) {
                     functionString = mapping.functionSignature
                }
            }
            for (var ruleId of innerArray) {
                var ruleS = await retrieveRule(policyId, ruleId, rulesEngineContract)
                var plhArray: string[] = []
                if(ruleS != null) {
                    ruleStrings.push(convertRuleStructToString(functionString, ruleS, plhArray))
                }
                
            }
            iter++
        }


        var foreignCalls: any[] | null = await getAllForeignCalls(policyId, rulesEngineContract)
        var callStrings: string[] = []
        convertForeignCallStructsToStrings(callStrings, foreignCalls, functionSignatureMappings)

        var trackers: any[] | null = await getAllTrackers(policyId, rulesEngineContract)
        var trackerStrings: string[] = []
        convertTrackerStructsToStrings(trackers, trackerStrings)

        var jsonObj = {
            Trackers: trackerStrings,
            ForeignCalls: callStrings,
            Rules: ruleStrings
        }
        return JSON.stringify(jsonObj)

    } catch (error) {
        console.error(error);
            return "";
    }    

}

export const createFullPolicy = async (rulesEngineContract: RulesEngineContract, policySyntax: string, 
    contractAddressForPolicy: Address, outputFileName: string, contractToModify: string): Promise<number> => {
    var fcIds: FCNameToID[] = []
    let trackers: TrackerDefinition[] = []
    let ruleIds = []
    let ruleToFunctionSignature = new Map<string, number[]>();
    let functionSignatures: string[] = []
    let functionSignatureIds: number[] = []
    let rulesDoubleMapping = []
    let functionSignatureSelectors = []

    // Policy Syntax Description 
    // -----------------------------------------------------------
    // {
    // "Policy": "Policy Name",
    // ForeignCalls:
    // ["Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address --> 3"],
    // 
    // Trackers:
    // ["Simple String Tracker --> string --> test --> 3"],
    //
    // Rules:
    // [""]
    // }
    // -----------------------------------------------------------
    let policyJSON: PolicyJSON = JSON.parse(policySyntax);
    const policyId = await createBlankPolicy(contractAddressForPolicy, rulesEngineContract)

    for(var foreignCall of policyJSON.ForeignCalls) {
        var fcStruct = parseForeignCallDefinition(foreignCall)
        const fcId = await createForeignCall(policyId, foreignCall, rulesEngineContract)
        var struc : FCNameToID = {id: fcId, name: fcStruct.name.split('(')[0]}
        fcIds.push(struc)
    }

    for(var tracker of policyJSON.Trackers) {
        var trackerStruct: TrackerDefinition = parseTrackerSyntax(tracker)
        const trId = await createTracker(policyId, tracker, rulesEngineContract)
        trackers.push(trackerStruct)
    }

    for(var rule of policyJSON.Rules) {

        var functionSignature = rule.split('-->')[2].trim()
        if(!functionSignatures.includes(functionSignature)) {
            functionSignatures.push(functionSignature)
            const fsId = await createFunctionSignature(policyId, functionSignature, rulesEngineContract)
            functionSignatureIds.push(fsId)
        }
        
        const ruleId = await createNewRule(policyId, rule, rulesEngineContract, fcIds, outputFileName, contractToModify)
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

    var result = await updatePolicy(rulesEngineContract, policyId, functionSignatureSelectors, functionSignatureIds, rulesDoubleMapping)

    return result
} 

export const updatePolicy = async (
    rulesEngineContract: RulesEngineContract, policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>  => {
        var updatePolicy
        while(true) {
            try {
                updatePolicy = await simulateContract(config, {
                address: rulesEngineContract.address,
                abi: rulesEngineContract.abi,
                functionName: "updatePolicy",
                args: [ policyId, signatures, ids, ruleIds ],
                });
            } catch (error) {
                console.error(error);
                await sleep(1000)       
            }
            break
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
    rulesEngineContract: RulesEngineContract,
    account: PrivateKeyAccount,
    calls: any[]
) => {
    try {

        const {request} = await simulateContract(config, {
            address: rulesEngineContract.address,
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

export const addNewRuleToBatch = async (policyId: number, ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[], calls: any[]) => {

        var effect = buildAnEffectStruct(ruleSyntax)

        var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effect)

        calls.push(
            encodeFunctionData({
                abi: rulesEngineContract.abi,
                functionName: "createRule",
                args: [ policyId, rule ],
            })
        )
}

export const createFunctionSignature = async (policyId: number, functionSignature: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
    try {

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

        const addRule = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "createFunctionSignature",
            args: [ policyId, toFunctionSelector(functionSignature), args ],
        });
        

        await writeContract(config, {
            ...addRule.request,
            account
        });

        return addRule.result;
    } catch (error) {
        console.error(error);
        return -1;
    }
}

export const createForeignCall = async(policyId: number, fcSyntax: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
    try {
        var foreignCall = parseForeignCallDefinition(fcSyntax)
        var fc = {
            set: true,
            foreignCallAddress: foreignCall.address,
            signature: toFunctionSelector(foreignCall.signature),
            foreignCallIndex: 0,
            returnType: foreignCall.returnType,
            parameterTypes: foreignCall.parameterTypes,
            typeSpecificIndices: foreignCall.encodedIndices

        }
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "createForeignCall",
            args: [ policyId, fc ],
        });
    

        await writeContract(config, {
            ...addFC.request,
            account
        });

        
        return addFC.result

    } catch (error) {
        console.error(error);
        return -1;
    }
}

export const createTracker = async(policyId: number, trSyntax: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
    try {
        var tracker: TrackerDefinition = parseTrackerSyntax(trSyntax)
        var transactionTracker = {set: true, pType: tracker.type, trackerValue: tracker.defaultValue }
        const addTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "createTracker",
            args: [ policyId,  transactionTracker ],
        });

        await writeContract(config, {
            ...addTR.request,
            account
        });

        let trackerResult = addTR.result 
        return trackerResult;
    } catch (error) {
        console.error(error);
        return -1;
    }
}


export const getForeignCall = async(policyId: number, foreignCallId: number, rulesEngineContract: RulesEngineContract): Promise<any | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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

export const getTracker = async(policyId: number, trackerId: number, rulesEngineContract: RulesEngineContract): Promise<any | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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


export const getAllForeignCalls = async(policyId: number, rulesEngineContract: RulesEngineContract): Promise<any[] | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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

export const getAllTrackers = async(policyId: number, rulesEngineContract: RulesEngineContract): Promise<TrackerDefinition[] | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
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

export const createNewRule = async (policyId: number, ruleSyntax: string, rulesEngineContract: RulesEngineContract, 
    foreignCallNameToID: FCNameToID[], outputFileName: string, contractToModify: string): Promise<number> => {
    try {
        var effects = buildAnEffectStruct(ruleSyntax)
        var rule = buildARuleStruct(policyId, ruleSyntax, foreignCallNameToID, effects)
        const addRule = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "createRule",
            args: [ policyId, rule ],
        });
        

        await writeContract(config, {
            ...addRule.request,
            account
        });

        generateModifier(ruleSyntax, outputFileName)

        var directoryStructure = outputFileName.split('/')
        directoryStructure.pop()
        var directoryString = ''
        for(var str of directoryStructure) {
            directoryString = directoryString + str + '/'
        }
        directoryString = directoryString + 'diff.diff'

        if(contractToModify && contractToModify.length > 0) {
            injectModifier(ruleSyntax.split('-->')[2].split('(')[0], ruleSyntax.split('-->')[3], contractToModify, directoryString)
        }

        return addRule.result;
    } catch (error) {
        console.error(error);
        return -1;
    }
}

export function buildAnEffectStruct(ruleSyntax: string) {
    var output = parseRuleSyntax(ruleSyntax, [])
    var pEffects = []
    var nEffects = []
    for(var pEffect of output.positiveEffects) {
        cleanInstructionSet(pEffect.instructionSet)

        const effect = {
            valid: true,
            dynamicParam: false,
            effectType: pEffect.type,
            pType: 0,
            param: toHex(0),
            text: toHex(toBytes(
                pEffect.text, 
                { size: 32 } 
              )),
            errorMessage: '',
            instructionSet: pEffect.instructionSet
        } as const
        pEffects.push(effect)
    }
    for(var nEffect of output.negativeEffects) {
        cleanInstructionSet(nEffect.instructionSet)

        const effect = {
            valid: true,
            dynamicParam: false,
            effectType: nEffect.type,
            pType: 0,
            param: toHex(0),
            text: toHex(toBytes(
                nEffect.text, 
                { size: 32 } 
              )),
            errorMessage: '',
            instructionSet: nEffect.instructionSet
        } as const
        nEffects.push(effect)
    }

    return {positiveEffects: pEffects, negativeEffects: nEffects }
}


export function buildARuleStruct(policyId: number, ruleSyntax: string, foreignCallNameToID: FCNameToID[], effect: any) {
    var output = parseRuleSyntax(ruleSyntax, [])
    var fcList = buildForeignCallList(ruleSyntax.split('-->')[0])
    var fcIDs = []
    for(var name of fcList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcIDs.push(mapping.id)
            }
        }
    }

    var fcEffectList = buildForeignCallList(ruleSyntax.split('-->')[1])
    var fcEffectIDs = []
    for(var name of fcEffectList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcEffectIDs.push(mapping.id)
            }
        }
    }

    var rawData = {
        instructionSetIndex: output.rawData.instructionSetIndex,
        argumentTypes: output.rawData.argumentTypes,
        dataValues: output.rawData.dataValues,
    }

    cleanInstructionSet(output.instructionSet)

    const rule =  {
        policyId: policyId,
        instructionSet: output.instructionSet,
        rawData: rawData,          
        placeHolders: output.placeHolders,
        effectPlaceHolders: output.effectPlaceHolders,
        posEffects: effect.positiveEffects,
        negEffects: effect.negativeEffects
    } as const


    return rule
}