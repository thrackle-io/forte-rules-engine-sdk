import { 
    getContract, 
    Address,
    GetContractReturnType,
    PublicClient,
    WalletClient,
    BaseError,
    ContractFunctionRevertedError,
    encodeFunctionData,
    PrivateKeyAccount
} from "viem";

import { privateKeyToAccount } from 'viem/accounts';

import RulesEngineRunLogicArtifact from "../abis/RulesStorage.json";
import RulesDiamondArtifact from "../abis/RulesDiamond.json";

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

export const createBlankPolicy = async (
    client: WalletClient & PublicClient, 
    contractAddressForPolicy: Address, 
    rulesEngineContract: RulesEngineContract): Promise<{calls: any[], result: any}> => {

    let calls: any[] = []

    calls.push(
        encodeFunctionData({
            abi: rulesEngineContract.abi,
            functionName: "updatePolicy",
            args: [0, [], [], [[]]],
        })
    )

    const addPolicy = await client.simulateContract({
        address: rulesEngineContract.address,
        abi: rulesEngineContract.abi,
        functionName: "updatePolicy",
        args: [0, [], [], [[]]],
    })

    calls.push(
        encodeFunctionData({
            abi: rulesEngineContract.abi,
            functionName: "applyPolicy",
            args: [contractAddressForPolicy, [addPolicy.result]],
        })
    )

    return {calls, result: addPolicy.result}
}

export const executePolicyBatch = async (
    client: WalletClient & PublicClient,
    rulesEngineContract: RulesEngineContract,
    account: PrivateKeyAccount,
    calls: any[]
) => {
    try {
        const {request} = await client.simulateContract({
            address: rulesEngineContract.address,
            abi: RulesDiamondArtifact.abi,
            functionName: "batch",
            args: [calls, true],
            account
        });
        
        const tx = await client.writeContract({
            ...request
        });

        return tx;
    } catch (err) {
        if (err instanceof BaseError) {
            const revertError = err.walk(err => err instanceof ContractFunctionRevertedError)
            return revertError ?? err
        }
        return err as Error
    }

}