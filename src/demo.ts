import { createTestClient, http, walletActions, publicActions, testActions, Address, decodeFunctionResult, toFunctionSelector, getAddress, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import RulesEngineRunLogicJson from "../src/abis/RulesEngineDataFacet.json";
import { createBlankPolicy, executeBatch, createNewRule, addNewRuleToBatch, updatePolicy, getRulesEngineContract, createFunctionSignature } from "../src/modules/ContractInteraction";
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

  async function main() {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    const policyApplicant: `0x${string}` = getAddress('0x0165878A594ca255338adfa4d48449f69242Eb8F');
    const callsAndResult = await createBlankPolicy(client, policyApplicant, getRulesEngineContract(rulesEngineContract, client));
    const result = await executeBatch(client, getRulesEngineContract(rulesEngineContract, client), account, callsAndResult.calls);
    const policyId = await client.readContract({
        address: rulesEngineContract,
        abi: rulesEngineAbi,
        functionName: "getAppliedPolicyIds",
        args: [policyApplicant]
    })
    console.log("policy Id: ", policyId)
    var functionId = await createFunctionSignature(client, "transfer(address,uint256) returns (bool)", getRulesEngineContract(rulesEngineContract, client))
    console.log("function ID: ", functionId)
    var ruleId = await createNewRule(client, "value > 500 --> revert --> transfer(address to, uint256 value)", getRulesEngineContract(rulesEngineContract, client), [], [])
    var ruleIds = [[ruleId]]
    var functionIds = [functionId]
    var functionSignatures = ["transfer(address,uint256) returns (bool)"]
    var policyIdUpdate = await updatePolicy(client, getRulesEngineContract(rulesEngineContract, client), policyId as number, functionSignatures, functionIds, ruleIds)
    console.log(policyIdUpdate)
}

main()