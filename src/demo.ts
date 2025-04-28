import { createTestClient, http, walletActions, publicActions, testActions, Address, decodeFunctionResult, toFunctionSelector, getAddress, stringToHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { createFullPolicy, getAllForeignCalls, getRulesEnginePolicyContract, getRulesEngineComponentContract, sleep, getAllTrackers, retrieveFullPolicy, createBlankPolicy, applyPolicy } from "../src/modules/ContractInteraction";
import { getConfig, connectConfig } from '../config'
import * as fs from 'fs';
import * as path from 'path';

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
const DiamondAddress: `0x${string}` = `0x0165878A594ca255338adfa4d48449f69242Eb8F`

const config = getConfig()

const client = config.getClient({chainId: config.chains[0].id})

const account = privateKeyToAccount(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );

  async function main() {
    const rulesEngineContract: `0x${string}` = DiamondAddress;
    const policyApplicant: `0x${string}` = getAddress('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
    await connectConfig(config, 0)

    const absolutePath = path.resolve("src/demo.json")
    const policyJSON = await fs.promises.readFile(absolutePath, 'utf-8');
    var result = await createFullPolicy(getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client),
    policyJSON,
        "src/demoOutput/contractTestCreateFullPolicy.sol", "src/demoOutput/UserContract.sol", 1)
    var resultFC = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))

    while(true) {
        if(resultFC!.length < 1) {
            await sleep(1000)
            resultFC = await getAllForeignCalls(result, getRulesEngineComponentContract(rulesEngineContract, client))
        } else {
            break
        }
    }

    var resultTR = await getAllTrackers(result, getRulesEngineComponentContract(rulesEngineContract, client))
    var retVal = await retrieveFullPolicy(result, [{hex: "0xa9059cbb", functionSignature: "transfer(address to, uint256 value)", encodedValues: "address to, uint256 value"}, 
        {hex: '0x71308757', functionSignature: "testSig(address)", encodedValues: ""}
    ],getRulesEnginePolicyContract(rulesEngineContract, client), getRulesEngineComponentContract(rulesEngineContract, client))

    console.log("Foreign Call Count: ", resultFC?.length)
    console.log("Tracker Count: ", resultTR?.length)
    console.log("Reverse Interpreted Policy: ")
    console.log(retVal)

}

main()