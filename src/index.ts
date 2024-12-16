// index.ts
export { 
    parseSyntax, 
    parseTrackerSyntax, 
    parseForeignCallDefinition, 
    EffectType, 
    TrackerDefinition, 
    buildForeignCallArgumentMapping, 
    buildForeignCallList, 
    buildForeignCallListRaw, 
    parseFunctionArguments 
} from './modules/Parser';

export { createNewRule, getRulesEngineContract } from './modules/ContractInteraction';

export const VERSION = '0.1.0';


