import { readContract } from "@wagmi/core"
import { getAddress, toHex } from 'viem'
import RulesEngineRunLogicJson from "../src/abis/RulesEngineDataFacet.json";
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import { createBlankPolicyBatch, 
    executeBatch, 
    createNewRule, 
    createForeignCall, 
    addNewRuleToBatch, 
    getRulesEngineContract, 
    getForeignCall,
    getAllForeignCalls,
    createTracker,
    getTracker,
    getAllTrackers, 
    createFullPolicy
} from "../src/modules/ContractInteraction";


import { getConfig, account, DiamondAddress, connectConfig } from '../config'

// Hardcoded address of the diamond in diamondDeployedAnvilState.json

const rulesEngineAbi = RulesEngineRunLogicJson.abi

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

    test('Can create a blank policy', async () => {
        const callsAndResult = await createBlankPolicyBatch(policyApplicant, getRulesEngineContract(rulesEngineContract, client));
        expect(callsAndResult.result).toBeGreaterThan(0)
        const result = await executeBatch( getRulesEngineContract(rulesEngineContract, client), account, callsAndResult.calls);
        const policyId = await readContract(config, {
            address: rulesEngineContract,
            abi: rulesEngineAbi,
            functionName: "getAppliedPolicyIds",
            args: [policyApplicant]
        })


        expect(Number(policyId)).toBeGreaterThan(0)
    })
    test('Can create a batch of new rules', async () => {
        var transactions: any[] = []
        addNewRuleToBatch("3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract), [], [], transactions);
        addNewRuleToBatch("3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2) --> FC:testCallTwo(value) --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], [], transactions);
        const result = await executeBatch(getRulesEngineContract(rulesEngineContract), account, await transactions);
    })
    test('Can create a new rule', async () => {
        var ruleId = await createNewRule("3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2) --> FC:testCallTwo(value) --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], [])
        expect(ruleId).toBeGreaterThan(0)
    })

    test('Can create a new foreign call', async() => {
        var fcSyntax = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256"
        var fcId = await createForeignCall(fcSyntax, getRulesEngineContract(rulesEngineContract), 3)
        fcId = await createForeignCall(fcSyntax, getRulesEngineContract(rulesEngineContract), 3)
        expect(fcId).toBeGreaterThan(0)
        var fcRetrieve = await getForeignCall(3, fcId, getRulesEngineContract(rulesEngineContract))
        expect(fcRetrieve?.foreignCallIndex).toEqual(fcId)
        var fcIdTwo = await createForeignCall(fcSyntax, getRulesEngineContract(rulesEngineContract), 3)
        expect(fcIdTwo).toBeGreaterThan(0)
        var fcAllRetrieve = await getAllForeignCalls(3, getRulesEngineContract(rulesEngineContract))
        expect(fcAllRetrieve?.foreignCalls.length).toBeGreaterThanOrEqual(3)
    })
    test('Can create a new tracker', async() => {
        var trSyntax = "Simple String Tracker --> uint256 --> 4";
        var trId = await createTracker(trSyntax, getRulesEngineContract(rulesEngineContract), 3)
        trId = await createTracker(trSyntax, getRulesEngineContract(rulesEngineContract), 3)
        expect(trId).toBeGreaterThan(0)
        var trRetrieve = await getTracker(3, trId, getRulesEngineContract(rulesEngineContract))
        expect(trRetrieve?.trackerValue).toEqual("0x40")
        var trAllRetrieve = await getAllTrackers(3, getRulesEngineContract(rulesEngineContract))
        expect(trAllRetrieve?.trackers.length).toBeGreaterThanOrEqual(2)
    })
    test('Can create a full policy', async() => {
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
        var policyJSON = '\
        {\
        "Policy": "Test Policy", \
        "ForeignCalls": ["Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address) --> uint256 --> address"], \
        "Trackers": ["Simple String Tracker --> string --> test"], \
        "Rules": ["value > 500 --> revert() --> transfer(address to, uint256 value)"]\
        }'
        console.log(policyJSON)
        console.log(JSON.parse(policyJSON))
        var result = await createFullPolicy(getRulesEngineContract(rulesEngineContract, client), policyJSON, policyApplicant)
        expect(result).toBeGreaterThanOrEqual(0)
        var resultFC = await getAllForeignCalls(result, getRulesEngineContract(rulesEngineContract, client))
        expect(resultFC?.foreignCalls.length).toEqual(1)
        var resultTR = await getAllTrackers(result, getRulesEngineContract(rulesEngineContract, client))
        expect(resultTR?.trackers.length).toEqual(1)
    })
})
