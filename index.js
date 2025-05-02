/// SPDX-License-Identifier: BUSL-1.1
// index.js

export {
    RulesEngine
} from './src/modules/RulesEngine'

export {
    getConfig,
    connectConfig
} from './config.ts'

export {
    generateModifier
} from './src/codeGeneration/generateSolidity.ts'

export {
    injectModifier
} from './src/codeGeneration/injectModifier.ts'

export {
    policyModifierGeneration
} from './src/codeGeneration/codeModificationScript.ts'