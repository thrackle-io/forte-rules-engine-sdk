/// SPDX-License-Identifier: BUSL-1.1
// index.ts

export {
    getRulesEnginePolicyContract, 
    getRulesEngineComponentContract,
} from './modules/ContractInteractionUtils';

export {
    createBlankPolicy,
    createFullPolicy,
    retrieveFullPolicy,
    deletePolicy
} from './modules/Policy'

export {
    createNewRule,
    updateRule,
    getAllRules,
    retrieveRule,
    deleteRule
} from './modules/Rules'

export {
    createForeignCall,
    updateForeignCall,
    getAllForeignCalls,
    getForeignCall,
    deleteForeignCall
} from './modules/ForeignCalls'

export {
    createTracker,
    updateTracker,
    getAllTrackers,
    getTracker,
    deleteTracker
} from './modules/Trackers'

export {
    createFunctionSignature
} from './modules/FunctionSignatures'

export const VERSION = '0.1.0';
