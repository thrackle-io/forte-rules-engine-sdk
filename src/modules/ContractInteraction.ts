import { 
    getContract, 
    Address,
    GetContractReturnType,
    PublicClient,
    WalletClient,
} from "viem";

import { privateKeyToAccount } from 'viem/accounts';

import RulesEngineRunLogicArtifact from "../artifacts/src/RulesEngineRunLogic.sol/RulesEngineRunLogic.json";

const account = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", // TODO: This is a foundry private key, replace with being read from .env/config
);

const RulesEngineABI = RulesEngineRunLogicArtifact.abi

type RulesEngineContract = GetContractReturnType<typeof RulesEngineABI>;


export const getRulesEngineContract = (address: Address, client: WalletClient & PublicClient): RulesEngineContract => getContract({
  address,
  abi: RulesEngineABI,
  client
});

export const createBlankPolicy = async (client: WalletClient & PublicClient, contractAddressForPolicy: Address, rulesEngineContract: RulesEngineContract): Promise<number> => {
    try {
        const addPolicy = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "updatePolicy",
            args: [0, [], [], [[]]],
        });
        
        await client.writeContract({
            ...addPolicy.request,
            account
        });

        const applyPolicy = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: rulesEngineContract.abi,
            functionName: "applyPolicy",
            args: [contractAddressForPolicy, [addPolicy.result]],
        });

        await client.writeContract({
            ...applyPolicy.request,
            account
        })

        return addPolicy.result;
    } catch (error) {
        console.error(error);
        return -1;
    }
}