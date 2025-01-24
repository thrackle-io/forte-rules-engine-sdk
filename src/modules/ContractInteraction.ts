import { 
    getContract, 
    Address,
    GetContractReturnType,
    toFunctionSelector,
    BaseError,
    ContractFunctionRevertedError,
    encodeFunctionData,
    PrivateKeyAccount,
    ByteArray
} from "viem";

import {
    simulateContract,
    writeContract, 
    readContract
} from "@wagmi/core";

import { 
    parseSyntax, 
    TrackerDefinition, 
    buildForeignCallList, 
    buildForeignCallListRaw, 
    buildForeignCallArgumentMapping, 
    parseFunctionArguments, 
    cleanInstructionSet,
    getConfig,
    account,
    parseForeignCallDefinition,
    parseTrackerSyntax,
    parsePolicy
} from '../index';

import RulesEngineRunLogicArtifact from "../abis/RulesEngineDataFacet.json";
import RulesDiamondArtifact from "../abis/RulesEngineDiamond.json";

const RulesEngineABI = RulesEngineRunLogicArtifact.abi

type RulesEngineContract = GetContractReturnType<typeof RulesEngineABI>;

type FCNameToID = {
    id: number
    name: string
}

type ForeignCallCreationReturn = {

    foreignCallAddress: string;
    foreignCallIndex: number;
    signature: string;
    returnType: number;
    parameterTypes: number[];
}

type ForeignCallSet = {
    set: boolean,
    foreignCalls: ForeignCallCreationReturn[]
}

type TrackerValuesSet = {
    set: boolean;
    trackers: TrackerTransactionType[];
}

type TrackerTransactionType = {
    pType: number,
    trackerValue: string
}

const config = getConfig()

const client = config.getClient({chain: config.chains[0]})

export const getRulesEngineContract = (address: Address): RulesEngineContract => getContract({
  address,
  abi: RulesEngineABI,
  client
});

export const createBlankPolicyBatch = async (
    contractAddressForPolicy: Address, 
    rulesEngineContract: RulesEngineContract): Promise<{calls: any[], result: any}> => {

    let calls: any[] = []


    calls.push(
        encodeFunctionData({
            abi: rulesEngineContract.abi,
            functionName: "updatePolicy",
            args: [0, [], [], [[]]],
        })
    )

    const addPolicy = await simulateContract(config, {
        address: rulesEngineContract.address,
        abi: rulesEngineContract.abi,
        functionName: "updatePolicy",
        args: [0, [], [], [[]]],
    })

    calls.push(
        encodeFunctionData({
            abi: rulesEngineContract.abi,
            functionName: "applyPolicy",
            args: [contractAddressForPolicy, [addPolicy.result]],
        })
    )

    return {calls, result: addPolicy.result}
}

export const createBlankPolicy = async (
    contractAddressForPolicy: Address, 
    rulesEngineContract: RulesEngineContract): Promise<number> => {


    const addPolicy = await simulateContract(config, {
        address: rulesEngineContract.address,
        abi: rulesEngineContract.abi,
        functionName: "updatePolicy",
        args: [0, [], [], [[]]],
    })

    await writeContract(config, {
        ...addPolicy.request,
        account
    });
    if(addPolicy.result > 0) {
        const applyPolicy = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "applyPolicy",
            args: [contractAddressForPolicy, [addPolicy.result]],
        })

        await writeContract(config, {
            ...applyPolicy.request,
            account
        })
    
    }

    return addPolicy.result
}

export const createFullPolicy = async (rulesEngineContract: RulesEngineContract, policySyntax: string, contractAddressForPolicy: Address): Promise<number> => {
    const policyId = await createBlankPolicy(contractAddressForPolicy, rulesEngineContract)

    const policyJSON = parsePolicy(policySyntax)
    var fcIds = []
    var trs = []
    var ruleIds = []
    let ruleToFunctionSignature = new Map<string, number[]>();
    let functionSignatures: string[] = []
    let functionSignatureIds: number[] = []
    let rulesDoubleMapping = []

    for(var foreignCall of policyJSON.ForeignCalls) {
        var fcStruct = parseForeignCallDefinition(foreignCall)
        const fcId = await createForeignCall(foreignCall, rulesEngineContract, policyId)
        var struc : FCNameToID = {id: fcId, name: fcStruct.name.split('(')[0]}
        fcIds.push(struc)
    }

    for(var tracker of policyJSON.Trackers) {
        var trackerStruct: TrackerDefinition = parseTrackerSyntax(tracker)
        const trId = await createTracker(tracker, rulesEngineContract, policyId)
        trs.push(trackerStruct)
    }

    for(var rule of policyJSON.Rules) {

        var functionSignature = rule.split('-->')[2].trim()
        if(!functionSignatures.includes(functionSignature)) {
            functionSignatures.push(functionSignature)
            const fsId = await createFunctionSignature(functionSignature, rulesEngineContract)
            functionSignatureIds.push(fsId)
        }
        
        const ruleId = await createNewRule(rule, rulesEngineContract, fcIds, trs)
        ruleIds.push(ruleId)
        if(ruleToFunctionSignature.has(functionSignature)) {
            ruleToFunctionSignature.get(functionSignature)?.push(ruleId)
        } else {
            ruleToFunctionSignature.set(functionSignature, [ruleId])
        }
    }
    var functionSignaturesFinal = []
    for(var fs of functionSignatures) {
        if(ruleToFunctionSignature.has(fs)) {
            rulesDoubleMapping.push(ruleToFunctionSignature.get(fs))
        } else {
            rulesDoubleMapping.push([])
        }
        functionSignaturesFinal.push(toFunctionSelector(fs))
    }

    var result = await updatePolicy(rulesEngineContract, policyId, functionSignaturesFinal, functionSignatureIds, rulesDoubleMapping)

    return result
} 

export const updatePolicy = async (
    rulesEngineContract: RulesEngineContract, policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>  => {
        try {

            const updatePolicy = await simulateContract(config, {
                address: rulesEngineContract.address,
                abi: rulesEngineContract.abi,
                functionName: "updatePolicy",
                args: [ policyId, signatures, ids, ruleIds ],
            });
            
    
            await writeContract(config, {
                ...updatePolicy.request,
                account
            });
    
            return updatePolicy.result;
        } catch (error) {
            console.error(error);
            return -1;
        }

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

export const addNewRuleToBatch = async (ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[], calls: any[]) => {

        var effect = buildAnEffectStruct(ruleSyntax)

        var rule = buildARuleStruct(ruleSyntax, foreignCallNameToID, policyTrackers, effect)

        calls.push(
            encodeFunctionData({
                abi: rulesEngineContract.abi,
                functionName: "updateRule",
                args: [ 0, rule ],
            })
        )
}

export const createFunctionSignature = async (functionSignature: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
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
            functionName: "updateFunctionSignature",
            args: [ 0, toFunctionSelector(functionSignature), args ],
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

export const createForeignCall = async(fcSyntax: string, rulesEngineContract: RulesEngineContract, policyId: number): Promise<number> => {
    try {
        var foreignCall = parseForeignCallDefinition(fcSyntax)

        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updateForeignCall",
            args: [ policyId, foreignCall.address, foreignCall.signature, foreignCall.returnType, foreignCall.parameterTypes ],
        });
    

        await writeContract(config, {
            ...addFC.request,
            account
        });

        let foreignCallResult = addFC.result as ForeignCallCreationReturn
        return foreignCallResult.foreignCallIndex;
    } catch (error) {
        console.error(error);
        return -1;
    }
}

export const createTracker = async(trSyntax: string, rulesEngineContract: RulesEngineContract, policyId: number): Promise<number> => {
    try {
        var tracker: TrackerDefinition = parseTrackerSyntax(trSyntax)
        var transactionTracker = {pType: tracker.type, trackerValue: tracker.defaultValue } as TrackerTransactionType
        const addTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "addTracker",
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


export const getForeignCall = async(policyId: number, foreignCallId: number, rulesEngineContract: RulesEngineContract): Promise<ForeignCallCreationReturn | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "getForeignCall",
            args: [ policyId, foreignCallId ],
        });
        await writeContract(config, {
            ...addFC.request,
            account
        });

        let foreignCallResult = addFC.result as ForeignCallCreationReturn
        return foreignCallResult;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export const getTracker = async(policyId: number, trackerId: number, rulesEngineContract: RulesEngineContract): Promise<TrackerTransactionType | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "getTracker",
            args: [ policyId, trackerId ],
        });
    

        await writeContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result as TrackerTransactionType
        return trackerResult;
    } catch (error) {
    console.error(error);
        return null;
    }
}


export const getAllForeignCalls = async(policyId: number, rulesEngineContract: RulesEngineContract): Promise<ForeignCallSet | null> => {
    try {
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "getForeignCall",
            args: [ policyId ],
        });
    
        await writeContract(config, {
            ...addFC.request,
            account
        });

        let foreignCallResult = addFC.result as ForeignCallSet
        return foreignCallResult;
    } catch (error) {
        console.error(error);
        return null;
    }

}



export const getAllTrackers = async(policyId: number, rulesEngineContract: RulesEngineContract): Promise<TrackerValuesSet | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "getTracker",
            args: [ policyId],
        });
    

        await writeContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result as TrackerValuesSet
        return trackerResult;
    } catch (error) {
    console.error(error);
        return null;
    }
}

export const createNewRule = async (ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[]): Promise<number> => {
    try {

        var effects = buildAnEffectStruct(ruleSyntax)
        var rule = buildARuleStruct(ruleSyntax, foreignCallNameToID, policyTrackers, effects)
        const addRule = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updateRule",
            args: [ 0, rule ],
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

export function buildAnEffectStruct(ruleSyntax: string) {
    var output = parseSyntax(ruleSyntax)
    var pEffects = []
    var nEffects = []
    for(var pEffect of output.positiveEffects) {
        cleanInstructionSet(pEffect.instructionSet)

        const effect = {
            valid: true,
            effectType: pEffect.type,
            text: pEffect.text,
            instructionSet: pEffect.instructionSet
        } as const
        pEffects.push(effect)
    }
    for(var nEffect of output.negativeEffects) {
        cleanInstructionSet(nEffect.instructionSet)

        const effect = {
            valid: true,
            effectType: nEffect.type,
            text: nEffect.text,
            instructionSet: nEffect.instructionSet
        } as const
        nEffects.push(effect)
    }

    return {positiveEffects: pEffects, negativeEffects: nEffects }
}

export function buildARuleStruct(ruleSyntax: string, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[], effect: any) {
    var output = parseSyntax(ruleSyntax)
    var fcList = buildForeignCallList(ruleSyntax.split('-->')[0])
    var fcNames = buildForeignCallListRaw(ruleSyntax.split('-->')[0])
    var fcIDs = []
    for(var name of fcList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcIDs.push(mapping.id)
            }
        }
    }

    var fcEffectList = buildForeignCallList(ruleSyntax.split('-->')[1])
    var fcEffectNames = buildForeignCallListRaw(ruleSyntax.split('-->')[1])
    var fcEffectIDs = []
    for(var name of fcEffectList) {
        for(var mapping of foreignCallNameToID) {
            if(mapping.name == name) {
                fcEffectIDs.push(mapping.id)
            }
        }
    }

    var names = parseFunctionArguments(ruleSyntax.split('-->')[2])
    var fcmapping = buildForeignCallArgumentMapping(fcIDs, fcNames, names, policyTrackers)
    var fcEffectMapping = buildForeignCallArgumentMapping(fcEffectIDs, fcEffectNames, names, [])
    var rawData = {
        instructionSetIndex: output.rawData.instructionSetIndex,
        argumentTypes: output.rawData.argumentTypes,
        dataValues: output.rawData.dataValues,
    }

    cleanInstructionSet(output.instructionSet)

    const rule =  {
        instructionSet: output.instructionSet,
        rawData: rawData,          
        placeHolders: output.placeHolders,
        effectPlaceHolders: output.effectPlaceHolders,
        fcArgumentMappingsConditions: fcmapping,
        fcArgumentMappingsEffects: fcEffectMapping,
        posEffects: effect.positiveEffects,
        negEffects: effect.negativeEffects
    } as const
    return rule
}