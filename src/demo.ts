import { createTestClient, http, walletActions, publicActions, testActions, Address, decodeFunctionResult, toFunctionSelector, getAddress, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import RulesEngineRunLogicJson from "../src/abis/RulesEngineDataFacet.json";
import { createFullPolicy, getAllForeignCalls, getRulesEngineContract, sleep, getAllTrackers, retrieveFullPolicy } from "../src/modules/ContractInteraction";
import { getConfig, connectConfig } from '../config'
import * as fs from 'fs';
import * as path from 'path';

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const DiamondAddress: `0x${string}` = `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`

const rulesEngineAbi = RulesEngineRunLogicJson.abi
// const client = createTestClient({
//     chain: foundry,
//     mode: 'anvil',
//     transport: http('http://localhost:8545')
// }).extend(walletActions).extend(publicActions)

const config = getConfig()

const client = config.getClient({chainID: config.chains[0].id})

const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );

  async function main() {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    const policyApplicant: `0x${string}` = getAddress('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
    await connectConfig(config, 0)

    const absolutePath = path.resolve("src/demo.json")
    const policyJSON = await fs.promises.readFile(absolutePath, 'utf-8');
    var result = await createFullPolicy(getRulesEngineContract(rulesEngineContract, client), policyJSON, policyApplicant,
        "src/demoOutput/contractTestCreateFullPolicy.sol", "src/demoOutput/UserContract.sol")
    var resultFC = await getAllForeignCalls(result, getRulesEngineContract(rulesEngineContract, client))

    while(true) {
        if(resultFC!.length < 1) {
            await sleep(1000)
            resultFC = await getAllForeignCalls(result, getRulesEngineContract(rulesEngineContract, client))
        } else {
            break
        }
    }

    var resultTR = await getAllTrackers(result, getRulesEngineContract(rulesEngineContract, client))
    var retVal = await retrieveFullPolicy(result, [{hex: "0xa9059cbb", functionSignature: "transfer(address to, uint256 value)"}, 
        {hex: '0x71308757', functionSignature: "testSig(address)"}
    ],getRulesEngineContract(rulesEngineContract, client))

    console.log("Foreign Call Count: ", resultFC?.length)
    console.log("Tracker Count: ", resultTR?.length)
    console.log("Reverse Interpreted Policy: ")
    console.log(retVal)

}

main()