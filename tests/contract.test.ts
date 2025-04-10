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

const client = config.getClient({chainID: config.chains[0].id})

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
        addNewRuleToBatch(policyId, "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value) --> uint256 value", getRulesEnginePolicyContract(rulesEngineContract, client), [], [], transactions);
        addNewRuleToBatch(policyId, "3 + value > 6 --> revert --> addValue(uint256 value) --> uint256 value", getRulesEnginePolicyContract(rulesEngineContract, client), [], [], transactions);
        const result = await executeBatch(getRulesEnginePolicyContract(rulesEngineContract, client), account, transactions);
    })
    test('Can create a new rule', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var ruleId = await createNewRule(policyId, "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value) --> uint256 value", 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], 
            "src/testOutput/contractTestCreateNewRule.sol", "")
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
        var ruleId = await createNewRule(policyId, "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value) --> uint256 value", 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], 
            "src/testOutput/contractTestCreateNewRule.sol", "")
        expect(ruleId).toBeGreaterThan(0)
        var functionSignature = "addValue(uint256 value)"
        const fsId = await createFunctionSignature(policyId, functionSignature, getRulesEngineComponentContract(rulesEngineContract, client))
        var selector = toFunctionSelector(functionSignature)        
        await updatePolicy(getRulesEnginePolicyContract(rulesEngineContract, client), policyId, 
        [selector], [fsId], [[ruleId]])
        var rules = await getAllRules(policyId, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        var updatedRuleId = await updateRule(policyId, ruleId, "3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2) --> FC:testCallTwo(value) --> addValue(uint256 value) --> uint256 value", 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}])
        expect(updatedRuleId).toEqual(ruleId)
    })
    test('Can delete a rule', async () => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var ruleId = await createNewRule(policyId, "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value) --> uint256 value", 
            getRulesEnginePolicyContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], 
            "src/testOutput/contractTestCreateNewRule.sol", "")
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
        var fcSyntax = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 0, 1, 2"
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcId).toEqual(1n)
        var fcRetrieve = await getForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
    })
    test('Can delete a foreign call', async() => {
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        var fcSyntax = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 0, 1, 2"
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcId).toEqual(1n)
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
        var fcSyntax = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 0, 1, 2"
        var fcId = await setForeignCall(policyId, 0, fcSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcId).toEqual(1n)
        var fcRetrieve = await getForeignCall(policyId, fcId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcAllRetrieve = await getAllForeignCalls(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        var updatedSyntax = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 0, 1, 2"
        var updatedId = await setForeignCall(policyId, fcId, updatedSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(updatedId).toEqual(fcId)
    })
    test('Can create a new tracker', async() => {
        var trSyntax = "Simple String Tracker --> uint256 --> 4";
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trId).toEqual(1n)
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
        expect(trRetrieve?.trackerValue).toEqual("0x40")
    })
    test('Can delete a tracker', async() => {
        var trSyntax = "Simple String Tracker --> uint256 --> 4";
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trId).toEqual(1n)
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
        expect(trRetrieve?.trackerValue).toEqual("0x40")
        await deleteTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        var trAllRetrieve = await getAllTrackers(policyId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trAllRetrieve![0].set).toEqual(false)

    })
    test('Can update an existing tracker', async() => {
        var trSyntax = "Simple String Tracker --> uint256 --> 4";
        var policyId = await createBlankPolicy(1, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(policyId).toBeGreaterThan(0)
        var trId = await setTracker(policyId, 0, trSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trId).toEqual(1n)
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
        expect(trRetrieve?.trackerValue).toEqual("0x40")
        var updatedSyntax = "Simple String Tracker --> uint256 --> 5";
        await setTracker(policyId, trId, updatedSyntax, getRulesEngineComponentContract(rulesEngineContract, client))
        var updatedTRRetrieve = await getTracker(policyId, trId, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(updatedTRRetrieve?.trackerValue).toEqual("0x50")
    })
    test('Can retrieve a full policy', async() => {
        var policyJSON = '\
        {\
        "Policy": "Test Policy", \
        "ForeignCalls": ["Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address --> 0"], \
        "Trackers": ["Simple String Tracker --> string --> test"], \
        "Rules": ["value > 500 --> pos: emit Success <-> neg: revert() --> transfer(address to, uint256 value) --> address to, uint256 value"]\
        }'
        var result = await createFullPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), 
        getRulesEngineComponentContract(rulesEngineContract, client), policyJSON, policyApplicant,
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
        var retVal = await retrieveFullPolicy(result, [{hex: "0xa9059cbb", functionSignature: "transfer(address to, uint256 value)"}, 
            {hex: '0x71308757', functionSignature: "testSig(address)"}
        ], getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client))
        expect(retVal).toEqual('{"Trackers":["Tracker 1 --> string --> 0x74657374"],"ForeignCalls":["Foreign Call 1 --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address"],"Rules":["value > 500 --> pos: emit Success <-> neg: revert() --> transfer(address to, uint256 value)"]}')
    })
    test('Can delete a full policy', async() => {
        var policyJSON = '\
        {\
        "Policy": "Test Policy", \
        "ForeignCalls": ["Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address --> 0"], \
        "Trackers": ["Simple String Tracker --> string --> test"], \
        "Rules": ["value > 500 --> pos: emit Success <-> neg: revert() --> transfer(address to, uint256 value) --> address to, uint256 value"]\
        }'
        var result = await createFullPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), 
        getRulesEngineComponentContract(rulesEngineContract, client), policyJSON, policyApplicant,
            "src/testOutput/contractTestCreateFullPolicy.sol", "", 1)
        expect(result).toBeGreaterThanOrEqual(0)
        
        await deletePolicy(result, getRulesEnginePolicyContract(rulesEngineContract, client))
        var rules = await getAllRules(result, getRulesEnginePolicyContract(rulesEngineContract, client))
        expect(rules?.length).toEqual(1)
        expect(rules![0].length).toEqual(0)
        var trAllRetrieve = await getAllTrackers(result, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(trAllRetrieve![0].set).toEqual(false)
        var fcAllRetrieve = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))
        expect(fcAllRetrieve?.length).toEqual(1)
        expect(fcAllRetrieve![0].set).toEqual(false)
    })
})
