/// SPDX-License-Identifier: BUSL-1.1
import {
  encodePacked,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  stringToBytes,
  getAddress,
} from "viem";
import {
  Either,
  FCNameToID,
  ForeignCallDefinition,
  ForeignCallEncodedIndex,
  MappedTrackerDefinition,
  matchArray,
  operandArray,
  PT,
  pTypeEnum,
  RuleComponent,
  RuleDefinition,
  RulesError,
  TrackerDefinition,
  trackerIndexNameMapping,
} from "../modules/types";
import { convertHumanReadableToInstructionSet } from "./internal-parsing-logic";
import {
  removeExtraParenthesis,
  parseFunctionArguments,
  parseTrackers,
  buildRawData,
  parseForeignCalls,
  buildPlaceholderList,
  parseEffect,
  cleanseForeignCallLists,
  parseGlobalVariables,
} from "./parsing-utilities";

import {
  CallingFunctionJSON,
  ForeignCallJSON,
  MappedTrackerJSON,
  PType,
  RuleJSON,
  splitFunctionInput,
  supportedTrackerTypes,
  TrackerJSON,
} from "../modules/validation";
import { isLeft, makeLeft, makeRight, unwrapEither } from "../modules/utils";

/**
 * @file parser.ts
 * @description This module provides a external facing parsing functions for the Rules Engine SDK.
 *              It includes functions for parsing rule syntax, trackers, foreign calls, and converting
 *              human-readable conditions into instruction sets.
 *              Additionally, it supports reverse parsing of instruction sets back into human-readable syntax.
 *
 * @module parser
 *
 * @exports
 * - Functions for parsing rule syntax, trackers, foreign calls, and converting between formats.
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

/**
 * Parses the rule syntax and converts it into a raw instruction set.
 *
 * @param syntax - The JSON representation of the rule syntax.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 * @param foreignCallNameToID - A mapping of foreign call names to their IDs.
 * @returns An object containing the instruction set, raw data, positive effects, negative effects,
 *          placeholders, and effect placeholders.
 */

export function parseRuleSyntax(
  syntax: RuleJSON,
  indexMap: trackerIndexNameMapping[],
  foreignCallNameToID: FCNameToID[],
  encodedValues: string,
  additionalForeignCalls: string[],
  additionalEffectForeignCalls: string[]
): RuleDefinition {
  var condition = syntax.condition;
  condition = removeExtraParenthesis(condition);
  let ruleComponents: RuleComponent[] = [
    ...parseFunctionArguments(encodedValues, condition),
  ];
  var effectNames: any[] = [];
  var effectNamesMega: any[] = [];
  let [fcCondition, fcNames] = parseForeignCalls(
    condition,
    ruleComponents,
    foreignCallNameToID,
    indexMap,
    additionalForeignCalls
  );
  ruleComponents = [...ruleComponents, ...fcNames];
  const [trCondition, trackers] = parseTrackers(
    fcCondition,
    ruleComponents,
    indexMap
  );
  fcCondition = trCondition;
  ruleComponents = [...ruleComponents, ...trackers];
  const gvComponents = parseGlobalVariables(trCondition);
  ruleComponents = [...ruleComponents, ...gvComponents];
  var placeHolders = buildPlaceholderList(ruleComponents);
  for (var effectP in syntax.positiveEffects) {
    var effectNamesInternal: any[] = [];

    let [effectCondition, effectCalls] = parseForeignCalls(
      syntax.positiveEffects[effectP],
      effectNamesInternal,
      foreignCallNameToID,
      indexMap,
      additionalEffectForeignCalls
    );
    syntax.positiveEffects[effectP] = effectCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectCalls];
    const [effectTrCondition, effectTrackers] = parseTrackers(
      syntax.positiveEffects[effectP],
      effectNamesInternal,
      indexMap
    );
    effectCondition = effectTrCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectTrackers];

    effectNamesMega.push(effectNamesInternal);
  }
  for (var effectN in syntax.negativeEffects) {
    var effectNamesInternal: any[] = [];

    let [effectCondition, effectCalls] = parseForeignCalls(
      syntax.negativeEffects[effectN],
      effectNamesInternal,
      foreignCallNameToID,
      indexMap,
      additionalEffectForeignCalls
    );
    syntax.negativeEffects[effectN] = effectCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectCalls];
    const [effectTrackerCondition, effectTrackers] = parseTrackers(
      syntax.negativeEffects[effectN],
      effectNamesInternal,
      indexMap
    );
    effectCondition = effectTrackerCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectTrackers];

    effectNamesMega.push(effectNamesInternal);
  }
  effectNames = cleanseForeignCallLists(effectNamesMega);
  var effectPlaceHolders = buildPlaceholderList(effectNames);
  effectPlaceHolders = [...new Set(effectPlaceHolders)];
  var positiveEffectsFinal = [];
  var negativeEffectsFinal = [];
  if (syntax.positiveEffects != null) {
    for (var effectP of syntax.positiveEffects) {
      let effect = parseEffect(
        effectP,
        effectNames,
        effectPlaceHolders,
        indexMap
      );
      positiveEffectsFinal.push(effect);
    }
  }

  if (syntax.negativeEffects != null) {
    for (var effectN of syntax.negativeEffects) {
      let effect = parseEffect(
        effectN,
        effectNames,
        effectPlaceHolders,
        indexMap
      );
      negativeEffectsFinal.push(effect);
    }
  }
  var retVal = convertHumanReadableToInstructionSet(
    fcCondition,
    ruleComponents,
    indexMap,
    placeHolders
  );
  var excludeArray = [];
  for (var name of ruleComponents) {
    excludeArray.push(name.name);
  }

  excludeArray.push(...matchArray);
  excludeArray.push(...operandArray);
  var raw = buildRawData(retVal, excludeArray);

  return {
    instructionSet: raw,
    positiveEffects: positiveEffectsFinal,
    negativeEffects: negativeEffectsFinal,
    placeHolders: placeHolders,
    effectPlaceHolders: effectPlaceHolders,
  };
}

export function parseMappedTrackerSyntax(
  syntax: MappedTrackerJSON
): MappedTrackerDefinition {
  console.log("SYN", syntax);
  let keyType = syntax.keyType;
  let valueType = syntax.valueType;
  console.log("HERE");
  var keys = syntax.initialKeys.map((val) => val.value);
  var values = syntax.initialValues.map((val) => val.value);
  console.log("HEREE", keys);
  var trackerInitialKeys: any[] = encodeTrackerData(
    syntax.initialKeys,
    keyType
  );
  var trackerInitialValues: any[] = encodeTrackerData(
    syntax.initialValues,
    valueType
  );
  console.log("KEY", trackerInitialKeys);
  const keyTypeEnum = (PT.find((_pt) => _pt.name == keyType) ?? PT[4])
    .enumeration;
  const valueTypeEnum = (PT.find((_pt) => _pt.name == valueType) ?? PT[4])
    .enumeration;

  return {
    name: syntax.name,
    keyType: keyTypeEnum,
    valueType: valueTypeEnum,
    initialKeys: trackerInitialKeys,
    initialValues: trackerInitialValues,
  };
}

function encodeTrackerData(valueSet: any[], keyType: string): any[] {
  const values: any[] = [];
  valueSet.map((val) => {
    // for (var val of valueSet) {
    if (keyType == "uint256") {
      console.log("VAL", val);
      console.log("SET", valueSet);
      values.push(encodePacked(["uint256"], [BigInt(val)]));
    } else if (keyType == "address") {
      const validatedAddress = getAddress(val as string);
      var address = encodeAbiParameters(parseAbiParameters("address"), [
        validatedAddress,
      ]);

      values.push(address);
    } else if (keyType == "bytes") {
      var bytes = encodeAbiParameters(parseAbiParameters("bytes"), [
        toHex(stringToBytes(String(val))),
      ]);

      values.push(bytes);
    } else if (keyType == "bool") {
      if (val == "true") {
        values.push(encodePacked(["uint256"], [1n]));
      } else {
        values.push(encodePacked(["uint256"], [0n]));
      }
    } else {
      values.push(
        encodeAbiParameters(parseAbiParameters("string"), [val as string])
      );
    }
  });

  return values;
}

/**
 * Parses the tracker syntax and validates its type and default value.
 *
 * @param syntax - The JSON representation of the tracker syntax.
 * @returns Either an object containing the tracker's name, type, and encoded default value if successful or an error
 */
export function parseTrackerSyntax(syntax: TrackerJSON): TrackerDefinition {
  let trackerType = syntax.type;

  var trackerInitialValue: any;
  if (trackerType == "uint256") {
    trackerInitialValue = encodePacked(
      ["uint256"],
      [BigInt(syntax.initialValue)]
    );
  } else if (trackerType == "address") {
    const validatedAddress = getAddress(syntax.initialValue);
    trackerInitialValue = encodeAbiParameters(parseAbiParameters("address"), [
      validatedAddress,
    ]);
  } else if (trackerType == "bytes") {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters("bytes"), [
      toHex(stringToBytes(String(syntax.initialValue))),
    ]);
  } else if (trackerType == "bool") {
    if (syntax.initialValue == "true") {
      trackerInitialValue = encodePacked(["uint256"], [1n]);
    } else {
      trackerInitialValue = encodePacked(["uint256"], [0n]);
    }
  } else {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters("string"), [
      syntax.initialValue,
    ]);
  }
  var trackerTypeEnum = 0;
  for (var parameterType of PT) {
    if (parameterType.name == trackerType) {
      trackerTypeEnum = parameterType.enumeration;
    }
  }
  return {
    name: syntax.name,
    type: trackerTypeEnum,
    initialValue: trackerInitialValue,
  };
}

/**
 * Parses the foreign call definition and validates its structure.
 *
 * @param syntax - The JSON representation of the foreign call definition.
 * @returns Either an object containing the foreign call's name, address, function, return type, parameter types, and encoded indices if successful or an error.
 */
export function parseForeignCallDefinition(
  syntax: ForeignCallJSON,
  foreignCallNameToID: FCNameToID[],
  indexMap: FCNameToID[],
  functionArguments: string[]
): ForeignCallDefinition {
  var encodedIndices: ForeignCallEncodedIndex[] = syntax.valuesToPass
    .split(",")
    .map((encodedIndex: string) => {
      if (encodedIndex.includes("FC:")) {
        for (var fcMap of foreignCallNameToID) {
          if ("FC:" + fcMap.name.trim() == encodedIndex.trim()) {
            return { eType: 1, index: fcMap.id };
          }
        }
      } else if (encodedIndex.includes("TR:")) {
        for (var trMap of indexMap) {
          if ("TR:" + trMap.name.trim() == encodedIndex.trim()) {
            return { eType: 2, index: trMap.id };
          }
        }
      } else {
        var iter = 0;
        for (var functionArg of functionArguments) {
          if (functionArg.trim() == encodedIndex.trim()) {
            return { eType: 0, index: iter };
          } else {
            iter += 1;
          }
        }
      }
    }) as ForeignCallEncodedIndex[];

  const returnType: number = PType.indexOf(syntax.returnType);

  var parameterTypes: number[] = [];
  for (var arg of splitFunctionInput(syntax.function)) {
    for (var pt of PT) {
      if (pt.name == arg) {
        parameterTypes.push(pt.enumeration);
        break;
      }
    }
  }

  console.log("parame", parameterTypes);
  var valuesToPass: number[] = syntax.valuesToPass
    .split(",")
    .filter((input: string) => !isNaN(Number(input)))
    .map((input: string) => Number(input));

  return {
    ...syntax,
    returnType,
    parameterTypes,
    encodedIndices,
  };
}

export function parseCallingFunction(syntax: CallingFunctionJSON): string[] {
  var initialSplit = syntax.encodedValues.split(", ");
  var variableNames: string[] = [];
  for (var ind of initialSplit) {
    var variable = ind.trim().split(" ")[1];
    variableNames.push(variable);
  }

  return variableNames;
}

/**
 * Builds a list of foreign call names from a rule condition string.
 *
 * @param condition - The rule condition string.
 * @returns An array of foreign call names.
 */
export function buildForeignCallList(condition: string): string[] {
  // Use a regular expression to find all FC expressions
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g;
  const matches = condition.matchAll(fcRegex);
  var names: string[] = [];
  // Convert matches iterator to array to process all at once
  for (const match of matches) {
    const fullFcExpr = match[0];
    var name = fullFcExpr.split(":")[1];
    names.push(name);
  }
  return names;
}

/**
 * Builds a list of tracker names from a rule condition string.
 *
 * @param condition - The rule condition string.
 * @returns An array of tracker names.
 */
export function buildTrackerList(condition: string): string[] {
  const trRegex = /TR:[a-zA-Z]+/g;
  const truRegex = /TRU:[a-zA-Z]+/g;
  var matches = condition.match(trRegex);

  var names: string[] = [];
  if (matches != null) {
    for (const match of matches) {
      const fullTRExpr = match;
      var name = fullTRExpr.replace("TR:", "");
      names.push(name);
    }
  }
  matches = condition.match(truRegex);
  if (matches != null) {
    for (const match of matches) {
      const fullTRExpr = match;
      var name = fullTRExpr.replace("TRU:", "");
      names.push(name);
    }
  }

  return names;
}

/**
 * Cleans the instruction set by replacing string representations of operators with their numeric equivalents.
 *
 * @param instructionSet - The instruction set to clean.
 */
export function cleanInstructionSet(instructionSet: any[]): any[] {
  return instructionSet.map((instruction) => {
    if (instruction == "N") {
      return 0;
    } else if (instruction == "+") {
      return 1;
    } else if (instruction == "-") {
      return 2;
    } else if (instruction == "*") {
      return 3;
    } else if (instruction == "/") {
      return 4;
    } else if (instruction == "<") {
      return 5;
    } else if (instruction == ">") {
      return 6;
    } else if (instruction == "==") {
      return 7;
    } else if (instruction == "AND") {
      return 8;
    } else if (instruction == "OR") {
      return 9;
    } else if (instruction == "NOT") {
      return 10;
    } else if (instruction == "PLH") {
      return 11;
    } else if (instruction == "TRU") {
      return 12;
    } else if (instruction == "=") {
      return 13;
    } else if (instruction == ">=") {
      return 14;
    } else if (instruction == "<=") {
      return 15;
    } else if (instruction == "!=") {
      return 16;
    }
    return instruction;
  });
}

export { parseFunctionArguments };
