import { 
    getContract, 
    Address,
    GetContractReturnType,
    toFunctionSelector,
    BaseError,
    ContractFunctionRevertedError,
    encodeFunctionData,
    PrivateKeyAccount
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
    parseForeignCallDefinition
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

const config = getConfig()

const client = config.getClient({chain: config.chains[0]})

export const getRulesEngineContract = (address: Address): RulesEngineContract => getContract({
  address,
  abi: RulesEngineABI,
  client
});

export const createBlankPolicy = async (
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

export const createForeignCall = async(fcSyntax: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
    try {
        var foreignCall = parseForeignCallDefinition(fcSyntax)
        const addFC = await simulateContract(config, {
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updateForeignCall",
            args: [ foreignCall.policyId, foreignCall.address, foreignCall.signature, foreignCall.returnType, foreignCall.parameterTypes ],
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


export const createNewRule = async (ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[]): Promise<number> => {
    try {

        var effect = buildAnEffectStruct(ruleSyntax)
        var rule = buildARuleStruct(ruleSyntax, foreignCallNameToID, policyTrackers, effect)
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

    cleanInstructionSet(output.effect.instructionSet)

    const effect = {
        valid: true,
        effectType: output.effect.type,
        text: output.effect.text,
        instructionSet: output.effect.instructionSet
    } as const

    return effect
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
        effectPlaceHolders: output.effect.placeholders,
        fcArgumentMappingsConditions: fcmapping,
        fcArgumentMappingsEffects: fcEffectMapping,
        posEffects: [effect],
        negEffects: []
    } as const
    return rule
}