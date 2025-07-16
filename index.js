/// SPDX-License-Identifier: BUSL-1.1
// index.js

import { validate } from "typedoc/dist/lib/utils/validation.js";

export { RulesEngine } from "./src/modules/rules-engine.ts";

export { getConfig, connectConfig, setupConfig } from "./config.ts";

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
  supportedTrackerTypes,
  pTypeEnum,
  PT,
  Left,
  Right,
  Either
} from "./src/modules/types.ts";

export { generateModifier } from "./src/codeGeneration/generate-solidity.ts";

export { injectModifier } from "./src/codeGeneration/inject-modifier.ts";

export { policyModifierGeneration } from "./src/codeGeneration/code-modification-script.ts";

export {
  ruleJSON,
  validateRuleJSON,
  ForeignCallJSON,
  validateForeignCallJSON,
  TrackerJSON,
  validateTrackerJSON,
  MappedTrackerJSON,
  validateMappedTrackerJSON,
  CallingFunctionJSON,
  validateCallingFunctionJSON,
  PolicyJSON,
  validatePolicyJSON,
} from "./src/modules/validation.ts";

export {
  isLeft,
  isRight,
  unwrapEither
} from "./src/modules/utils.ts";
