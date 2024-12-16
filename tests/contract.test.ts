
import { createTestClient, http, walletActions, publicActions, testActions, Address, decodeFunctionResult, getAddress } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import RulesEngineRunLogicJson from "../src/abis/RulesEngineDataFacet.json";
import { expect, test, describe, beforeAll, beforeEach } from 'vitest'
import { createBlankPolicy, executeBatch, createNewRule, addNewRuleToBatch, getRulesEngineContract } from "../src/modules/ContractInteraction";
// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const DiamondAddress: `0x${string}` = `0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9`

const rulesEngineAbi = RulesEngineRunLogicJson.abi
const client = createTestClient({
    chain: foundry,
    mode: 'anvil',
    transport: http('http://localhost:8545')
}).extend(walletActions).extend(publicActions)

const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );


// Take snapshot
export const takeSnapshot = async () => {
    const snapshotId = await client.snapshot()
    return snapshotId
}
  
// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
    await client.revert({ id: snapshotId })
}

describe('Rules Engine Interactions', () => {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    // Vanity address for now, lets try to eventually deploy a real token contract and use that here instead
    const policyApplicant: `0x${string}` = getAddress('0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef');
    let snapshotId: `0x${string}`;

    beforeAll(async () => {
        snapshotId = await takeSnapshot();
    })

    beforeEach(async () => {
        await revertToSnapshot(snapshotId);
    })

    test('Can create a blank policy', async () => {
        const callsAndResult = await createBlankPolicy(client, policyApplicant, getRulesEngineContract(rulesEngineContract, client));
        expect(callsAndResult.result).toBeGreaterThan(0)
        const result = await executeBatch(client, getRulesEngineContract(rulesEngineContract, client), account, callsAndResult.calls);
        const policyId = await client.readContract({
            address: rulesEngineContract,
            abi: rulesEngineAbi,
            functionName: "getAppliedPolicyIds",
            args: [policyApplicant]
        })

        expect(Number(policyId)).toBeGreaterThan(0)
    })
    test('Can create a batch of new rules', async () => {
        var transactions: any[] = []
        addNewRuleToBatch(client, "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract, client), [], [], transactions);
        addNewRuleToBatch(client, "3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2) --> FC:testCallTwo(value) --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], [], transactions);
        const result = await executeBatch(client, getRulesEngineContract(rulesEngineContract, client), account, await transactions);
    })
    test('Can create a new rule', async () => {
        var ruleId = await createNewRule(client, "3 + 4 > 5 AND (FC:testCall(value) == 1 AND 2 == 2) --> FC:testCallTwo(value) --> addValue(uint256 value)", getRulesEngineContract(rulesEngineContract, client), [{ id: 1, name: "testCall"}, {id: 2, name: "testCallTwo"}], [])
        expect(ruleId).toBeGreaterThan(0)
    })
})
