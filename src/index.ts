// index.ts
export { 
    parseSyntax, 
    parseTrackerSyntax, 
    parseForeignCallDefinition, 
    EffectType, 
    TrackerDefinition, 
    stringReplacement,
    buildForeignCallArgumentMapping, 
    buildForeignCallList, 
    buildForeignCallListRaw, 
    parseFunctionArguments,
    reverseParseRule,
    cleanInstructionSet
} from './modules/Parser';

export { getConfig, connectConfig, account, DiamondAddress } from '../config'

export { createNewRule, getRulesEngineContract } from './modules/ContractInteraction';

export const VERSION = '0.1.0';