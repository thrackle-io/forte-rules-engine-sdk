import { readContract } from "@wagmi/core"
import { getAddress } from 'viem'
import RulesEngineRunLogicJson from "../src/abis/RulesEngineDataFacet.json";
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import { createBlankPolicy, executeBatch, createNewRule, addNewRuleToBatch, getRulesEngineContract } from "../src/modules/ContractInteraction";

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
        const callsAndResult = await createBlankPolicy(policyApplicant, getRulesEngineContract(rulesEngineContract, client));
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
})
