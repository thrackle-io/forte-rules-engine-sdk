// index.ts
export { 
    parseRuleSyntax, 
    parseTrackerSyntax, 
    parseForeignCallDefinition, 
    EffectType, 
    TrackerDefinition, 
    stringReplacement,
    RawData,
    PT,
    RuleStruct,
    buildForeignCallArgumentMapping, 
    buildForeignCallList, 
    buildForeignCallListRaw, 
    parseFunctionArguments,
    reverseParseRule,
    cleanInstructionSet,
    convertRuleStructToString,
    convertForeignCallStructsToStrings,
    convertTrackerStructsToStrings
} from './modules/Parser';

export { getConfig, connectConfig, account, DiamondAddress } from '../config'

export { createNewRule, 
    getRulesEngineContract, 
    createForeignCall, 
    getForeignCall, 
    getAllForeignCalls 
} from './modules/ContractInteraction';

export const VERSION = '0.1.0';