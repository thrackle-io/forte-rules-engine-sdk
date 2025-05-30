/// SPDX-License-Identifier: BUSL-1.1
import { Abi, Address, ByteArray, GetContractReturnType, Hex } from "viem";

import RulesEnginePolicyLogicArtifact from "../abis/RulesEnginePolicyFacet.json";
import RulesEngineComponentLogicArtifact from "../abis/RulesEngineComponentFacet.json";
import RulesEngineRuleLogicArtifact from "../abis/RulesEngineRuleFacet.json";

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
export const RulesEngineRulesABI = RulesEngineRuleLogicArtifact.abi;

export type RulesEnginePolicyContract = GetContractReturnType<
  typeof RulesEnginePolicyABI
>;
export type RulesEngineComponentContract = GetContractReturnType<
  typeof RulesEngineComponentABI
>;
export type RulesEngineRulesContract = GetContractReturnType<
  typeof RulesEngineRulesABI
>;

export type FCNameToID = {
  id: number;
  name: string;
  type: number;
};

export type RuleStorageSet = {
  set: boolean;
  rule: any;
};

export type hexToFunctionString = {
  hex: string;
  functionString: string;
  encodedValues: string;
  index: number;
};

export type CallingFunctionHashMapping = {
  callingFunction: string;
  signature: string;
  encodedValues: string;
};

export interface PolicyJSON {
  Policy: string;
  PolicyType: string;
  ForeignCalls: foreignCallJSON[];
  Trackers: trackerJSON[];
  Rules: ruleJSON[];
}

export interface foreignCallJSON {
  name: string;
  function: string;
  address: string;
  returnType: string;
  valuesToPass: string;
}

export interface trackerJSON {
  name: string;
  type: string;
  initialValue: string;
}

export interface ruleJSON {
  condition: string;
  positiveEffects: string[];
  negativeEffects: string[];
  callingFunction: string;
  encodedValues: string;
}

export type Tuple = {
  i: string;
  s: string;
};

export enum EffectType {
  REVERT = 0,
  EVENT = 1,
  EXPRESSION = 2,
}

export type EffectDefinition = {
  type: EffectType;
  text: string;
  instructionSet: any[];
  pType: number;
  parameterValue: any;
};

export type EffectStruct = {
  valid: boolean;
  dynamicParam: boolean;
  effectType: EffectType;
  text: Hex;
  pType: number;
  param: any;
  errorMessage: string;
  instructionSet: any[];
};

// TODO: Add more specific types for positiveEffects and negativeEffects
export type EffectStructs = {
  positiveEffects: any[];
  negativeEffects: any[];
};

export type RuleBase = {
  instructionSet: number[];
  rawData: RawData;
  placeHolders: any[];
  effectPlaceHolders: any[];
};

export type RuleDefinition = RuleBase & EffectStructs;

export type RuleStruct = RuleBase & {
  posEffects: any[];
  negEffects: any[];
};

export type ForeignCallOnChain = {
  set: boolean;
  foreignCallAddress: string;
  signature: string;
  returnType: number;
  foreignCallIndex: number;
  parameterTypes: number[];
  typeSpecificIndices: number[];
};

export type TrackerOnChain = {
  set: boolean;
  pType: number;
  trackerValue: string;
  trackerIndex: number;
};

export type ForeignCallDefinition = {
  name: string;
  address: Address;
  function: string;
  returnType: number;
  parameterTypes: number[];
  valuesToPass: number[];
};

export type PlaceholderStruct = {
  pType: number;
  typeSpecificIndex: number;
  trackerValue: boolean;
  foreignCall: boolean;
};

export type IndividualArugmentMapping = {
  functionCallArgumentType: number;
  callingFunctionArg: PlaceholderStruct;
};

export type ForeignCallArgumentMappings = {
  foreignCallIndex: number;
  mappings: IndividualArugmentMapping[];
};

export type FunctionArgument = {
  name: string;
  tIndex: number;
  rawType: string;
};

export type stringReplacement = {
  instructionSetIndex: number;
  originalData: string;
};

export type trackerIndexNameMapping = {
  id: number;
  name: string;
  type: number;
};

export type TrackerDefinition = {
  name: string;
  type: number;
  initialValue: any;
};

export type InstructionSet = {
  instructionSet: any[];
  placeHolders: PlaceholderStruct[];
};

export type RawData = {
  instructionSetIndex: number[];
  argumentTypes: number[];
  dataValues: ByteArray[];
};

export const matchArray: string[] = [
  "OR",
  "AND",
  "NOT",
  "==",
  ">=",
  ">",
  "<",
  "<=",
  "+",
  "-",
  "/",
  "*",
  "+=",
  "-=",
  "*=",
  "/=",
  "=",
  "!=",
];
export const truMatchArray: string[] = ["+=", "-=", "*=", "/=", "="];
export const operandArray: string[] = ["PLH", "N"];
export const supportedTrackerTypes: string[] = [
  "uint256",
  "string",
  "address",
  "bytes",
  "bool",
];
export enum pTypeEnum {
  ADDRESS = 0,
  STRING = 1,
  UINT256 = 2,
  BOOL = 3,
  VOID = 4,
  BYTES = 5,
}
export const PT = [
  { name: "address", enumeration: pTypeEnum.ADDRESS },
  { name: "string", enumeration: pTypeEnum.STRING },
  { name: "uint256", enumeration: pTypeEnum.UINT256 },
  { name: "bool", enumeration: pTypeEnum.BOOL },
  { name: "void", enumeration: pTypeEnum.VOID },
  { name: "bytes", enumeration: pTypeEnum.BYTES },
];

export type ErrorType = "INPUT" | "CONTRACT_READ" | "CONTRACT_WRITE" | "COMPILATION";

export type RulesError = {
    errorType: ErrorType;
    state: any;
    message: string;
}

export type Left<T> = {
    left: T;
    right?: never;
};

export type Right<U> = {
    right: U;
    left?: never;
};

export type Either<T, U> = NonNullable<Left<T> | Right<U>>;

export type UnwrapEither = <T, U>(e: Either<T, U>) => NonNullable<T | U>;

export type Maybe<T> = NonNullable<T> | null;
