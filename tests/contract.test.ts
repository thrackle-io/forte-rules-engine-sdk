import { createTestClient, http, walletActions, publicActions, testActions, Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import RulesEngineRunLogicJson from "../src/artifacts/src/RulesEngineRunLogic.sol/RulesEngineRunLogic.json";

import { expect, test, describe, beforeAll, beforeEach } from 'vitest'

import { createBlankPolicy, getRulesEngineContract } from "../src/modules/ContractInteraction";



const rulesEngineAbi = RulesEngineRunLogicJson.abi
const rulesEngineBytecode = RulesEngineRunLogicJson.bytecode as `0x${string}`

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

export const deployRulesEngine = async () => {
    const rulesEngine = await client.deployContract({
        abi: rulesEngineAbi,
        bytecode: rulesEngineBytecode,
        account: account
    })
    return rulesEngine;
}

describe('Rules Engine Interactions', () => {
    let rulesEngineContract: `0x${string}`;
    let snapshotId: `0x${string}`;

    beforeAll(async () => {
        rulesEngineContract = await deployRulesEngine();
        snapshotId = await takeSnapshot();
    })

    beforeEach(async () => {
        await revertToSnapshot(snapshotId);
    })

    test('Can create a blank policy', async () => {
        const policyId = await createBlankPolicy(client, rulesEngineContract, getRulesEngineContract(rulesEngineContract, client));
        expect(policyId).toBeGreaterThan(0);
    })
})