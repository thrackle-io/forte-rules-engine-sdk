import { createConfig, Config, connect } from '@wagmi/core'
import { mock } from '@wagmi/connectors'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from '@wagmi/core/chains'
import { http, walletActions, publicActions, createTestClient, PrivateKeyAccount } from 'viem'

const foundryPrivateKey: `0x${string}` = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export const account: PrivateKeyAccount = privateKeyToAccount(foundryPrivateKey)

export const DiamondAddress: `0x${string}` = `0x5FC8d32690cc91D4c39d9d3abcBD16989F875707`

let _config: Config = createConfig({
    chains: [foundry],
    client({ chain }) { 
      return createTestClient(
        { 
          chain,
          transport: http('http://127.0.0.1:8545'),
          mode: 'anvil',
          account
        }
      ).extend(walletActions).extend(publicActions)
    }, 
    connectors: [
        mock({
            accounts: [
                '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
            ]
        })
    ]
})


export const setupConfig = (config: Config) => {
    _config = config
}

export const getConfig = (): Config => {
    return _config
}

export const connectConfig = async (config: Config, connectorIndex: number) => {
    try {
        const result = await connect(config, {
          connector: config.connectors[connectorIndex],
        })
        console.log(result)
    } catch (error) {
        console.error(error)
    }
}

