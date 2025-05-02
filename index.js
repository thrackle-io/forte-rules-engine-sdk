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
} from './src/codeGeneration/generateSolidity.ts'

export {
    injectModifier
} from './src/codeGeneration/injectModifier.ts'

export {
    policyModifierGeneration
} from './src/codeGeneration/codeModificationScript.ts'