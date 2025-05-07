/// SPDX-License-Identifier: BUSL-1.1
// index.js

export {
    RulesEngine
} from './src/modules/rules-engine'

export {
    getConfig,
    connectConfig,
    setupConfig
} from './config.ts'

export {
    RulesEnginePolicyContract,
    RulesEngineComponentContract,
    FCNameToID,
    RuleStorageSet,
    hexToFunctionSignature,
    PolicyJSON,
    foreignCallJSON,
    ruleJSON,
    EffectType,
    RuleStruct,
    ForeignCallDefinition,
    PlaceholderStruct,
    IndividualArugmentMapping,
    ForeignCallArgumentMappings,
    FunctionArgument,
    stringReplacement,
    trackerIndexNameMapping,
    TrackerDefinition,
    RawData,
    matchArray,
    truMatchArray,
    operandArray,
    supportedTrackerTypes,
    pTypeEnum,
    PT
} from './src/modules/types.ts'

export {
    generateModifier
} from './src/codeGeneration/generate-solidity.ts'

export {
    injectModifier
} from './src/codeGeneration/inject-modifier.ts'

export {
    policyModifierGeneration
} from './src/codeGeneration/code-modification-script.ts'