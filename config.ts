import { createConfig, Config, connect } from '@wagmi/core'
import { mock } from '@wagmi/connectors'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from '@wagmi/core/chains'
import { http, walletActions, publicActions, createTestClient, PrivateKeyAccount } from 'viem'

/**  
 * The following address and private key are defaults from anvil and are only meant to be used in a test environment.
 */
//-------------------------------------------------------------------------------------------------------------
const foundryPrivateKey: `0x${string}` = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
export const account: PrivateKeyAccount = privateKeyToAccount(foundryPrivateKey)
const foundryAccountAddress: `0x${string}` = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
export const DiamondAddress: `0x${string}` = `0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6`
//-------------------------------------------------------------------------------------------------------------

export type Init = {
  connect?: boolean
  connectorIndex?: number
  config: Config
}

export const initializeRulesSdk = async ({ connect, connectorIndex, config }: Init) => {
  setupConfig(config)
  if (connect && connectorIndex !== undefined) {
    await connectConfig(config, connectorIndex)
  }
}
var _config: Config

/** 
 * Test config only for use in internal SDK repo testing. 
 * For actual SDK use a config should be passed in with the setupConfig function.
 */
export const createTestConfig = async(): Promise<Config> => {
  _config = createConfig({
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
                foundryAccountAddress
              ]
          })
      ]
  })
  return _config
}


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

