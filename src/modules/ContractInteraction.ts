import { 
    getContract, 
    Address,
    GetContractReturnType,
    toFunctionSelector,
    PublicClient,
    WalletClient,
    BaseError,
    ContractFunctionRevertedError,
    encodeFunctionData,
    PrivateKeyAccount,
    stringToHex
} from "viem";

import { parseSyntax, TrackerDefinition, buildForeignCallList, buildForeignCallListRaw, buildForeignCallArgumentMapping, parseFunctionArguments } from '../index';

import { privateKeyToAccount } from 'viem/accounts';

import RulesEngineRunLogicArtifact from "../abis/RulesEngineDataFacet.json";
import RulesDiamondArtifact from "../abis/RulesEngineDiamond.json";

const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // TODO: This is a foundry private key, replace with being read from .env/config
);

const RulesEngineABI = RulesEngineRunLogicArtifact.abi

type RulesEngineContract = GetContractReturnType<typeof RulesEngineABI>;

type FCNameToID = {
    id: number
    name: string
}

export const getRulesEngineContract = (address: Address, client: WalletClient & PublicClient): RulesEngineContract => getContract({
  address,
  abi: RulesEngineABI,
  client
});

export const createBlankPolicy = async (
    client: WalletClient & PublicClient, 
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

    const addPolicy = await client.simulateContract({
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
    client: WalletClient & PublicClient, 
    rulesEngineContract: RulesEngineContract, policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>  => {
        try {
            const updatePolicy = await client.simulateContract({
                address: rulesEngineContract.address,
                abi: rulesEngineContract.abi,
                functionName: "updatePolicy",
                args: [ policyId, signatures, ids, ruleIds ],
            });
            
    
            await client.writeContract({
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
    client: WalletClient & PublicClient,
    rulesEngineContract: RulesEngineContract,
    account: PrivateKeyAccount,
    calls: any[]
) => {
    try {
        const {request} = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: RulesDiamondArtifact.abi,
            functionName: "batch",
            args: [calls, true],
            account
        });
        
        const tx = await client.writeContract({
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

export const addNewRuleToBatch = async (client: WalletClient & PublicClient, ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[], calls: any[]) => {

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

export const createFunctionSignature = async (client: WalletClient & PublicClient, functionSignature: string, rulesEngineContract: RulesEngineContract): Promise<number> => {
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

        const addRule = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updateFunctionSignature",
            args: [ 0, toFunctionSelector(functionSignature), args ],
        });
        

        await client.writeContract({
            ...addRule.request,
            account
        });

        return addRule.result;
    } catch (error) {
        console.error(error);
        return -1;
    }
}

export const createNewRule = async (client: WalletClient & PublicClient, ruleSyntax: string, rulesEngineContract: RulesEngineContract, foreignCallNameToID: FCNameToID[], policyTrackers: TrackerDefinition[]): Promise<number> => {
    try {
        var effect = buildAnEffectStruct(ruleSyntax)
        var rule = buildARuleStruct(ruleSyntax, foreignCallNameToID, policyTrackers, effect)
        const addRule = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updateRule",
            args: [ 0, rule ],
        });
        

        await client.writeContract({
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

function cleanInstructionSet(instructionSet: any[]) {
    var iter = 0
    for(var val of instructionSet) {
        if(val == 'N') {
            instructionSet[iter] = 0
        } else if(val == '+') {
            instructionSet[iter] = 1
        } else if(val == '>') {
            instructionSet[iter] = 6
        } else if(val == '==') {
            instructionSet[iter] = 7
        } else if(val == 'AND') {
            instructionSet[iter] = 8
        } else if(val == 'PLH') {
            instructionSet[iter] = 11
        }

        iter++
    }
}