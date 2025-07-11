/// SPDX-License-Identifier: BUSL-1.1
// index.js

export { RulesEngine } from './src/modules/rules-engine.ts'

export { getConfig, connectConfig, setupConfig } from './config.ts'

export {
  RulesEnginePolicyContract,
  RulesEngineComponentContract,
  FCNameToID,
  RuleStorageSet,
  hexToFunctionString,
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
  pTypeEnum,
  PT,
  Left,
  Right,
  Either,
} from './src/modules/types.ts'

// Export validation functions and interfaces
export {
  // Validation functions
  safeParseJson,
  getRulesErrorMessages,
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validateMappedTrackerJSON,
  validateCallingFunctionJSON,
  validatePolicyJSON,

  // Zod validators (for runtime validation)
  ruleValidator,
  foreignCallValidator,
  trackerValidator,
  mappedTrackerValidator,
  callingFunctionValidator,
  policyJSONValidator,

  // TypeScript interfaces
  RuleJSON,
  ForeignCallJSON,
  TrackerJSON,
  MappedTrackerJSON,
  CallingFunctionJSON,
  PolicyJSON,

  // Utility functions
  splitFunctionInput,
  validateFCFunctionInput,
} from './src/modules/validation.ts'

export { generateModifier } from './src/codeGeneration/generate-solidity.ts'

export { injectModifier } from './src/codeGeneration/inject-modifier.ts'

export { policyModifierGeneration } from './src/codeGeneration/code-modification-script.ts'
