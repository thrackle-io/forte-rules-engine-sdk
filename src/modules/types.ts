
/// SPDX-License-Identifier: BUSL-1.1
import { 
    Address,
    ByteArray,
    GetContractReturnType
} from "viem";

import RulesEnginePolicyLogicArtifact from "../abis/RulesEnginePolicyFacet.json";
import RulesEngineComponentLogicArtifact from "../abis/RulesEngineComponentFacet.json";

/**
 * @file types.ts
 * @description This module provides the comprehensive set types that are used throughout the SDK
 * 
 * @module types
 * 
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * 
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license BUSL-1.1
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

export const RulesEnginePolicyABI = RulesEnginePolicyLogicArtifact.abi;
export const RulesEngineComponentABI = RulesEngineComponentLogicArtifact.abi;

export type RulesEnginePolicyContract = GetContractReturnType<typeof RulesEnginePolicyABI>;
export type RulesEngineComponentContract = GetContractReturnType<typeof RulesEngineComponentABI>;

export type FCNameToID = {
    id: number
    name: string
    type: number
}

export type RuleStorageSet = {
    set: boolean, 
    rule: any
}

export type hexToFunctionSignature = {
    hex: string,
    functionSignature: string,
    encodedValues: string
}

export interface PolicyJSON {
    Policy: string;
    PolicyType: string;
    ForeignCalls: foreignCallJSON[];
    Trackers: trackerJSON[];
    RulesJSON: ruleJSON[];
}

export interface foreignCallJSON {
    name: string,
    signature: string,
    address: string,
    returnType: string,
    parameterTypes: string,
    encodedIndices: string
}

export interface trackerJSON {
    name: string,
    type: string,
    defaultValue: string
}

export interface ruleJSON {
    condition: string,
    positiveEffects: string[],
    negativeEffects: string[],
    functionSignature: string,
    encodedValues: string
}

export type Tuple = {
    i: string;
    s: string;
}

export enum EffectType {
    REVERT = 0,
    EVENT = 1,
    EXPRESSION = 2
    
}

export type RuleStruct = {
    instructionSet: number[],
    rawData: RawData,          
    placeHolders: any[],
    effectPlaceHolders: any[],
    fcArgumentMappingsConditions: any[],
    fcArgumentMappingsEffects: any[],
    posEffects: any[],
    negEffects: any[]
}

export type ForeignCallDefinition = {

    name: string;
    address: Address;
    signature: string;
    returnType: number;
    parameterTypes: number[];
    encodedIndices: number[];
}

export type PlaceholderStruct = {
    pType: number;
    typeSpecificIndex: number;
    trackerValue: boolean;
    foreignCall: boolean;
}

export type IndividualArugmentMapping = {
    functionCallArgumentType: number;
    functionSignatureArg: PlaceholderStruct;
}

export type ForeignCallArgumentMappings = {
    foreignCallIndex: number;
    mappings: IndividualArugmentMapping[];
}

export type FunctionArgument = {
    name: string
    tIndex: number
    rawType: string
}

export type stringReplacement = {
    instructionSetIndex: number
    originalData: string
}

export type trackerIndexNameMapping = {
    id: number
    name: string
    type: number
}

export type TrackerDefinition = {
    name: string
    type: number
    defaultValue: any
}

export type RawData = {
    instructionSetIndex: number[]
    argumentTypes: number[]
    dataValues: ByteArray[]
}


export const matchArray: string[] = ['OR', 'AND', '==', '>=', '>', '<', '<=', '+', '-', '/', '*', '+=', '-=', '*=', '/=', '=']
export const truMatchArray: string[] = ['+=', '-=', '*=', '/=', '=']
export const operandArray: string[] = ['PLH', 'N']
export const supportedTrackerTypes: string[] = ['uint256', 'string', 'address', 'bytes']
export enum pTypeEnum {
    ADDRESS = 0,
    STRING = 1,
    UINT256 = 2,
    BOOL = 3,
    VOID = 4,
    BYTES = 5
}
export const PT = [ {name: 'address', enumeration: pTypeEnum.ADDRESS}, {name: 'string', enumeration: pTypeEnum.STRING}, 
    {name: 'uint256', enumeration: pTypeEnum.UINT256}, {name: 'bool', enumeration: pTypeEnum.BOOL}, 
    {name: 'void', enumeration: pTypeEnum.VOID}, {name: 'bytes', enumeration: pTypeEnum.BYTES} ]
