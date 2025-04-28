import { readContract } from "@wagmi/core"
import { getAddress, toFunctionSelector, toHex } from 'viem'
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import {  
    executeBatch, 
    createNewRule, 
    setForeignCall, 
    updatePolicy,
    addNewRuleToBatch, 
    createFunctionSignature,
    getRulesEnginePolicyContract,
    getRulesEngineComponentContract, 
    getForeignCall,
    getAllForeignCalls,
    setTracker,
    getTracker,
    getAllTrackers, 
    createFullPolicy,
    retrieveFullPolicy,
    createBlankPolicy,
    sleep,
    updateRule,
    deleteRule,
    deleteForeignCall,
    deleteTracker,
    getAllRules,
    deletePolicy

} from "../src/modules/ContractInteraction";


import { getConfig, account, DiamondAddress, connectConfig } from '../config'

// Hardcoded address of the diamond in diamondDeployedAnvilState.json

const config = getConfig()

const client: any = config.getClient({chainId: config.chains[0].id})

// Take snapshot
export const takeSnapshot = async () => {
    const snapshotId = await client.snapshot()
    return snapshotId
}
  
// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
    await client.revert({ id: snapshotId })
}


describe('Rules Engine Interactions', async () => {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    // Vanity address for now, lets try to eventually deploy a real token contract and use that here instead
    const policyApplicant: `0x${string}` = getAddress('0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef');
    let snapshotId: `0x${string}`;
    beforeAll(async () => {
        await connectConfig(config, 0)
        snapshotId = await takeSnapshot();
    })

    beforeEach(async () => {
        await revertToSnapshot(snapshotId);
    })

    test('Can create a batch of new rules', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var transactions: any[] = []
        var ruleStringA = `{
            "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"\
        }`
        var ruleStringB = `{
            "condition": "3 + value > 6",
            "positiveEffects": ["revert"],
            "negativeEffects": [],
            "functionSignature": "addValue(uint256 value)",
            "encodedValues": "uint256 value"
        }`

        addNewRuleToBatch(policyId, ruleStringA, getRulesEnginePolicyContract(rulesEngineContract, client), [], [], transactions);
        addNewRuleToBatch(policyId, ruleStringB, getRulesEnginePolicyContract(rulesEngineContract, client), [], [], transactions);
        const result = await executeBatch(getRulesEnginePolicyContract(rulesEngineContract, client), account, transactions);
    })
    test('Can create a new rule', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var ruleStringA = `{
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "functionSignature": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`
        var ruleId = await createNewRule(policyId, ruleStringA, 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall", type: 0}, {id: 2, name: "testCallTwo", type: 0}], 
            "src/testOutput/contractTestCreateNewRule.sol", "", [])
        expect(ruleId).toBeGreaterThan(0)
        var functionSignature = "addValue(uint256 value)"
        const fsId = await createFunctionSignature(policyId, functionSignature, getRulesEngineComponentContract(rulesEngineContract, client))
        var selector = toFunctionSelector(functionSignature)        
        await updatePolicy(getRulesEnginePolicyContract(rulesEngineContract, client), policyId, 
        [selector], [fsId], [[ruleId]])
        var rules = await getAllRules(policyId, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
    })
    test('Can update an existing rule', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var ruleStringA = `{
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "functionSignature": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`
        var ruleId = await createNewRule(policyId, ruleStringA, 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall", type: 0}, {id: 2, name: "testCallTwo", type: 0}], 
            "src/testOutput/contractTestCreateNewRule.sol", "", [])
        expect(ruleId).toBeGreaterThan(0)
        var functionSignature = "addValue(uint256 value)"
        const fsId = await createFunctionSignature(policyId, functionSignature, getRulesEngineComponentContract(rulesEngineContract, client))
        var selector = toFunctionSelector(functionSignature)        
        await updatePolicy(getRulesEnginePolicyContract(rulesEngineContract, client), policyId, 
        [selector], [fsId], [[ruleId]])
        var rules = await getAllRules(policyId, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        var ruleStringB = `{
        "condition": "3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2)",
        "positiveEffects": ["FC:testCallTwo(value)"],
        "negativeEffects": [],
        "functionSignature": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`
        var updatedRuleId = await updateRule(policyId, ruleId, ruleStringB, 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall", type: 0}, {id: 2, name: "testCallTwo", type: 0}], [])
        expect(updatedRuleId).toEqual(ruleId)
    })
    test('Can delete a rule', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var ruleStringA = `{
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "functionSignature": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`
        var ruleId = await createNewRule(policyId, ruleStringA, 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall", type: 0}, {id: 2, name: "testCallTwo", type: 0}], 
            "src/testOutput/contractTestCreateNewRule.sol", "", [])
        expect(ruleId).toBeGreaterThan(0)
        var functionSignature = "addValue(uint256 value)"
        const fsId = await createFunctionSignature(policyId, functionSignature, getRulesEngineComponentContract(rulesEngineContract, client))
        var selector = toFunctionSelector(functionSignature)        
        await updatePolicy(getRulesEnginePolicyContract(rulesEngineContract, client), policyId, 
        [selector], [fsId], [[ruleId]])
        
        var rules = await getAllRules(policyId, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        await deleteRule(policyId, ruleId, getRulesEnginePolicyContract(rulesEngineContract, client))
        var rules = await getAllRules(policyId, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        expect(rules![0][0].instructionSet.length).toEqual(0)
    })
    test('Can create a new foreign call', async() => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var fcSyntax =  
        `{
        "name": "Simple Foreign Call",
        "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
        "signature": "testSig(address,string,uint256)",
        "returnType": "uint256",
        "parameterTypes": "address, string, uint256",
        "encodedIndices": "0, 1, 2"
        }`
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var fcRetrieve = await getForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
    })
    test('Can delete a foreign call', async() => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var fcSyntax =  
            `{
                "name": "Simple Foreign Call",
                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "signature": "testSig(address)",
                "returnType": "uint256",
                "parameterTypes": "address",
                "encodedIndices": "0"
            }`
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var fcRetrieve = await getForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        var ret = await deleteForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(ret).toEqual(0)
        fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        expect(fcAllRetrieve![0].set).toEqual(false)
    })
    test('Can update an existing foreign call', async() => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var fcSyntax =  
        `{
            "name": "Simple Foreign Call",
            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            "signature": "testSig(address)",
            "returnType": "uint256",
            "parameterTypes": "address",
            "encodedIndices": "0"
        }`
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var fcRetrieve = await getForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        var updatedSyntax =  
        `{
            "name": "Simple Foreign Call",
            "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
            "signature": "testSig(address,string,uint256)",
            "returnType": "uint256",
            "parameterTypes": "address, string, uint256",
            "encodedIndices": "0, 1, 2"
        }`
        var updatedId = await setForeignCall(policyId, fcId, updatedSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(updatedId).toEqual(fcId)
    })
    test('Can create a new tracker', async() => {
        var trSyntax = `{
            "name": "Simple String Tracker",
            "type": "uint256",
            "defaultValue": "4"
        }`
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        while(true) {
            if(trAllRetrieve!.length < 1) {
                await sleep(1000)
                trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
            } else {
                break
            }
        }
        expect(trAllRetrieve?.length).toEqual(1)
        var trRetrieve = await getTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trRetrieve?.trackerValue).toEqual("0x0000000000000000000000000000000000000000000000000000000000000004")
    })
    test('Can delete a tracker', async() => {
        var trSyntax = `{
        "name": "Simple String Tracker",
        "type": "uint256",
        "defaultValue": "4"
        }`
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        while(true) {
            if(trAllRetrieve!.length < 1) {
                await sleep(1000)
                trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
            } else {
                break
            }
        }
        expect(trAllRetrieve?.length).toEqual(1)
        var trRetrieve = await getTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trRetrieve?.trackerValue).toEqual("0x0000000000000000000000000000000000000000000000000000000000000004")
        await deleteTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        var trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        while(true) {
            if(trAllRetrieve![0].set) {
                await sleep(1000)
                trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
            } else {
                break
            }
        }
        expect(trAllRetrieve![0].set).toEqual(false)

    })
    test('Can update an existing tracker', async() => {
        var trSyntax = `{
        "name": "Simple String Tracker",
        "type": "uint256",
        "defaultValue": "4"
        }`
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        while(true) {
            if(trAllRetrieve!.length < 1) {
                await sleep(1000)
                trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
            } else {
                break
            }
        }
        expect(trAllRetrieve?.length).toEqual(1)
        var trRetrieve = await getTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trRetrieve?.trackerValue).toEqual("0x0000000000000000000000000000000000000000000000000000000000000004")
        var updatedSyntax = `{
        "name": "Simple String Tracker",
        "type": "uint256",
        "defaultValue": "5"
        }`
        await setTracker(policyId, trId, updatedSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var updatedTRRetrieve = await getTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(updatedTRRetrieve?.trackerValue).toEqual("0x0000000000000000000000000000000000000000000000000000000000000005")
    })
    test('Can retrieve a full policy', async() => {
        var policyJSON = `
        {
        "Policy": "Test Policy", 
        "ForeignCalls": [
            {
                "name": "Simple Foreign Call",
                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "signature": "testSig(address)",
                "returnType": "uint256",
                "parameterTypes": "address",
                "encodedIndices": "0"
            }
        ], 
        "Trackers": [
        {
            "name": "Simple String Tracker",
            "type": "string",
            "defaultValue": "test" 
        }
        ],
        "RulesJSON": [
            {
                "condition": "value > 500",
                "positiveEffects": ["emit Success"],
                "negativeEffects": ["revert()"],
                "functionSignature": "transfer(address to, uint256 value)",
                "encodedValues": "address to, uint256 value"
            }
        ]
        }`
        var result = await createFullPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), 
        getRulesEngineComponentContract(rulesEngineContract, client), policyJSON,
            "src/testOutput/contractTestCreateFullPolicy.sol", "", 1)
        expect(result).toBeGreaterThanOrEqual(0)
        var resultFC = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))

        while(true) {
            if(resultFC!.length < 1) {
                await sleep(1000)
                resultFC = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))
            } else {
                break
            }
        }

        expect(resultFC?.length).toEqual(1)
        var resultTR = await getAllTrackers(result, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(resultTR?.length).toEqual(1)
        var retVal = await retrieveFullPolicy(result, [{hex: "0xa9059cbb", functionSignature: "transfer(address to, uint256 value)", encodedValues: "address to, uint256 value"}, 
            {hex: '0x71308757', functionSignature: "testSig(address)", encodedValues: ""}
        ], getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client))
        expect(retVal).toEqual('{"Trackers":["Tracker 1 --> string --> 0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000047465737400000000000000000000000000000000000000000000000000000000"],"ForeignCalls":["Foreign Call 1 --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address"],"RulesJSON":[{"condition":"value > 500","positiveEffects":["emit Success"],"negativeEffects":["revert()"],"functionSignature":"transfer(address to, uint256 value)","encodedValues":"address to, uint256 value"}]}')
    })
    test('Can delete a full policy', async() => {
        var policyJSON = `
        {
        "Policy": "Test Policy", 
        "ForeignCalls": [
            {
                "name": "Simple Foreign Call",
                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "signature": "testSig(address)",
                "returnType": "uint256",
                "parameterTypes": "address",
                "encodedIndices": "0"
            }
        ], 
        "Trackers": [
        {
            "name": "Simple String Tracker",
            "type": "string",
            "defaultValue": "test" 
        }
        ],
        "RulesJSON": [
            {
                "condition": "value > 500",
                "positiveEffects": ["emit Success"],
                "negativeEffects": ["revert()"],
                "functionSignature": "transfer(address to, uint256 value)",
                "encodedValues": "address to, uint256 value"
            }
        ]
        }`
        var result = await createFullPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), 
        getRulesEngineComponentContract(rulesEngineContract, client), policyJSON,
            "src/testOutput/contractTestCreateFullPolicy.sol", "", 1)
        expect(result).toBeGreaterThanOrEqual(0)
        await sleep(4000)
        
        await deletePolicy(result, getRulesEnginePolicyContract(rulesEngineContract, client))
        await sleep(4000)
        var rules = await getAllRules(result, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        expect(rules![0].length).toEqual(0)
        var trAllRetrieve = await getAllTrackers(result, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trAllRetrieve?.length).toEqual(1)
        expect(trAllRetrieve![0].set).toEqual(false)
        var fcAllRetrieve = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        expect(fcAllRetrieve![0].set).toEqual(false)
    }, {timeout: 15000})
})
