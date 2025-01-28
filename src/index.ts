// index.ts
export { 
    parseSyntax, 
    parseTrackerSyntax, 
    parseForeignCallDefinition, 
    EffectType, 
    TrackerDefinition, 
    stringReplacement,
    RawData,
    PT,
    buildForeignCallArgumentMapping, 
    buildForeignCallList, 
    buildForeignCallListRaw, 
    parseFunctionArguments,
    reverseParseRule,
    cleanInstructionSet
} from './modules/Parser';

export { getConfig, connectConfig, account, DiamondAddress } from '../config'

export { createNewRule, 
    getRulesEngineContract, 
    createForeignCall, 
    getForeignCall, 
    getAllForeignCalls 
} from './modules/ContractInteraction';

export const VERSION = '0.1.0';