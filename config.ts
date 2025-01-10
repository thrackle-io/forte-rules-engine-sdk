import { createConfig, Config } from '@wagmi/core'
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
        { chain,
          transport: http('http://localhost:8545'),
          mode: 'anvil'
        }
      ).extend(walletActions).extend(publicActions)
    }, 
})

export const setupConfig = (config: Config) => {
    _config = config
}

export const getConfig = (): Config => {
    return _config
}

