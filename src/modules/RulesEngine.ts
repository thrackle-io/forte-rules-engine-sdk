/**
 * @file RulesEngineInteraction.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies, rules, foreign calls, 
 *              trackers and function signatures.
 * 
 * @module RulesEngine
 * 
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 * 
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license BUSL-1.1
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

import {IRulesEngine} from "../IRulesEngine"
import { Address, getContract } from "viem"
import { FCNameToID, hexToFunctionSignature, RulesEngineComponentABI, RulesEngineComponentContract, RulesEnginePolicyABI, RulesEnginePolicyContract, RuleStruct } from "./types"
import { getConfig } from "../../config"
import {createPolicy as createPolicyInternal,
     updatePolicy as updatePolicyInternal, 
    applyPolicy as applyPolicyInternal,
    deletePolicy as deletePolicyInternal,
    getPolicy as getPolicyInternal
 } from "./Policy"

import {
    createRule as createRuleInternal,
    updateRule as updateRuleInternal,
    deleteRule as deleteRuleInternal,
    getRule as getRuleInternal,
    getAllRules as getAllRulesInternal
} from "./Rules"

import {
    createForeignCall as createForeignCallInternal,
    updateForeignCall as updateForeignCallInternal,
    deleteForeignCall as deleteForeignCallInternal,
    getForeignCall as getForeignCallInternal,
    getAllForeignCalls as getAllForeignCallsInternal
} from "./ForeignCalls"

import {
    createTracker as createTrackerInternal,
    updateTracker as updateTrackerInternal,
    deleteTracker as deleteTrackerInternal,
    getTracker as getTrackerInternal,
    getAllTrackers as getAllTrackersInternal
} from "./Trackers"
    
import {
    createFunctionSignature as createFunctionSignatureInternal
} from "./FunctionSignatures"

const config = getConfig()

export class RulesEngine {
    private rulesEnginePolicyContract: RulesEnginePolicyContract
    private rulesEngineComponentContract: RulesEngineComponentContract

    /**
     * @constructor
     * @param {Address} rulesEngineAddress - The address of the deployed Rules Engine smart contract.
     * @param {any} client - The client instance for interacting with the blockchain.
     */
    constructor(rulesEngineAddress: Address, client: any) {
        this.rulesEnginePolicyContract = getContract({
                address: rulesEngineAddress,
                abi: RulesEnginePolicyABI,
                client
            });
        this.rulesEngineComponentContract = getContract({
                address: rulesEngineAddress,
                abi: RulesEngineComponentABI,
                client
              });
    }
    public getRulesEnginePolicyContract(): RulesEnginePolicyContract {
        return this.rulesEnginePolicyContract
    }
    public getRulesEngineComponentContract(): RulesEngineComponentContract {    
        return this.rulesEngineComponentContract
    }
   
    createPolicy(policyJSON: string): Promise<number> 
    {
        return createPolicyInternal(this.rulesEnginePolicyContract, this.rulesEngineComponentContract, policyJSON)
    }
    updatePolicy(policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number> 
    {
        return updatePolicyInternal(this.rulesEnginePolicyContract, policyId, signatures, ids, ruleIds)
    }
    applyPolicy(policyId: number, contractAddressForPolicy: Address): Promise<number> 
    {
        return applyPolicyInternal(this.rulesEnginePolicyContract, policyId, contractAddressForPolicy)
    }
    deletePolicy(policyId: number): Promise<number>
    {
        return deletePolicyInternal(this.rulesEnginePolicyContract, policyId)
    }
    getPolicy(policyId: number, functionSignatureMappings: hexToFunctionSignature[]): Promise<string>
    {
        return getPolicyInternal(this.rulesEnginePolicyContract, this.rulesEngineComponentContract, policyId, functionSignatureMappings)
    }
    createNewRule(policyId: number, ruleS: string, foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[]): Promise<number>
    {
        return createRuleInternal(this.rulesEnginePolicyContract, policyId, ruleS, foreignCallNameToID, trackerNameToID)
    }
    updateRule(policyId: number, ruleId: number, ruleS: string, foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[]): Promise<number>  
    {
        return updateRuleInternal(this.rulesEnginePolicyContract, policyId, ruleId, ruleS, foreignCallNameToID, trackerNameToID)
    }
    deleteRule(policyId: number, ruleId: number): Promise<number>
    {
        return deleteRuleInternal(this.rulesEngineComponentContract, policyId, ruleId, )
    }
    getRule(policyId: number, ruleId: number): Promise<RuleStruct | null>
    {
        return getRuleInternal(this.rulesEnginePolicyContract, policyId, ruleId)
    }
    getAllRules(policyId: number): Promise<any[] | null>
    {
        return getAllRulesInternal(this.rulesEnginePolicyContract, policyId)
    }
    createForeignCall(policyId: number, fcSyntax: string): Promise<number> 
    {
        return createForeignCallInternal(this.rulesEngineComponentContract, policyId, fcSyntax)
    }
    updateForeignCall(policyId: number, foreignCallId: number, fcSyntax: string): Promise<number> 
    {
        return updateForeignCallInternal(this.rulesEngineComponentContract, policyId, foreignCallId, fcSyntax)
    }
    deleteForeignCall(policyId: number, foreignCallId: number): Promise<number>
    {
        return deleteForeignCallInternal(this.rulesEngineComponentContract, policyId, foreignCallId)
    }
    getForeignCall(policyId: number, foreignCallId: number): Promise<any | null>
    {
        return getForeignCallInternal(this.rulesEngineComponentContract, policyId, foreignCallId)
    }
    getAllForeignCalls(policyId: number): Promise<any[] | null> 
    {
        return getAllForeignCallsInternal(this.rulesEngineComponentContract, policyId)
    }
    createTracker(policyId: number, trSyntax: string): Promise<number>  
    {
        return createTrackerInternal(this.rulesEngineComponentContract, policyId, trSyntax)
    }
    updateTracker(policyId: number, trackerId: number, trSyntax: string): Promise<number>   
    {
        return updateTrackerInternal(this.rulesEngineComponentContract, policyId, trackerId, trSyntax)
    }
    deleteTracker(policyId: number, trackerId: number): Promise<number> 
    {
        return deleteTrackerInternal(this.rulesEngineComponentContract, policyId, trackerId)
    }
    getTracker(policyId: number, trackerId: number): Promise<any | null>        
    {
        return getTrackerInternal(this.rulesEngineComponentContract, policyId, trackerId)
    }
    getAllTrackers(policyId: number): Promise<any[] | null>
    {
        return getAllTrackersInternal(this.rulesEngineComponentContract, policyId)
    }
    createFunctionSignature(policyId: number, functionSignature: string): Promise<number>
    {
        return createFunctionSignatureInternal(this.rulesEngineComponentContract, policyId, functionSignature)
    }       
}
