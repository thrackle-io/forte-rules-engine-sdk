/// SPDX-License-Identifier: BUSL-1.1
// index.ts

export { createNewRule, 
    getRulesEnginePolicyContract, 
    getRulesEngineComponentContract,
    setForeignCall, 
    getForeignCall, 
    getAllForeignCalls,
    createFullPolicy,
    sleep,
    getAllTrackers,
    retrieveFullPolicy 
} from './modules/ContractInteraction';

export const VERSION = '0.1.0';
