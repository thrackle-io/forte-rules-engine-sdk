/// SPDX-License-Identifier: BUSL-1.1

export { RulesEngine } from './modules/rules-engine.js'

export { getConfig, connectConfig, setupConfig } from '../config.js'

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
} from './modules/types.js'

export {
  safeParseJson,
  getRulesErrorMessages,
  validateRuleJSON,
  validateForeignCallJSON,
  validateTrackerJSON,
  validateMappedTrackerJSON,
  validateCallingFunctionJSON,
  validatePolicyJSON,
  ruleValidator,
  foreignCallValidator,
  trackerValidator,
  mappedTrackerValidator,
  callingFunctionValidator,
  policyJSONValidator,
  splitFunctionInput,
  validateFCFunctionInput,
} from './modules/validation.js'

export type {
  RuleJSON,
  ForeignCallJSON,
  TrackerJSON,
  MappedTrackerJSON,
  CallingFunctionJSON,
  PolicyJSON,
} from './modules/validation.js'

export { isLeft, isRight, unwrapEither } from './modules/utils.js'
