/// SPDX-License-Identifier: BUSL-1.1
import {
  encodePacked,
  Address,
  toHex,
  encodeAbiParameters,
  parseAbiParameters,
  stringToBytes,
} from "viem";
import {
  callingFunctionJSON,
  Either,
  FCNameToID,
  ForeignCallDefinition,
  ForeignCallEncodedIndex,
  foreignCallJSON,
  matchArray,
  operandArray,
  PlaceholderStruct,
  PT,
  pTypeEnum,
  RuleComponent,
  RuleDefinition,
  ruleJSON,
  RulesError,
  supportedTrackerTypes,
  TrackerDefinition,
  trackerIndexNameMapping,
  trackerJSON,
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
} from "./parsing-utilities";
import {
  getAddress,
  isLeft,
  makeLeft,
  makeRight,
  unwrapEither,
} from "../modules/utils";

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
  syntax: ruleJSON,
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
  const [fcCondition, fcNames] = parseForeignCalls(
    condition,
    ruleComponents,
    foreignCallNameToID,
    indexMap,
    additionalForeignCalls
  );
  ruleComponents = [...ruleComponents, ...fcNames];
  const trackers = parseTrackers(fcCondition, ruleComponents, indexMap);
  ruleComponents = [...ruleComponents, ...trackers];
  var placeHolders = buildPlaceholderList(ruleComponents);
  for (var effectP in syntax.positiveEffects) {
    var effectNamesInternal: any[] = [];

    const [effectCondition, effectCalls] = parseForeignCalls(
      syntax.positiveEffects[effectP],
      effectNamesInternal,
      foreignCallNameToID,
      indexMap,
      additionalEffectForeignCalls
    );
    syntax.positiveEffects[effectP] = effectCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectCalls];
    const effectTrackers = parseTrackers(
      syntax.positiveEffects[effectP],
      effectNamesInternal,
      indexMap
    );

    effectNamesInternal = [...effectNamesInternal, ...effectTrackers];

    effectNamesMega.push(effectNamesInternal);
  }
  for (var effectN in syntax.negativeEffects) {
    var effectNamesInternal: any[] = [];

    const [effectCondition, effectCalls] = parseForeignCalls(
      syntax.negativeEffects[effectN],
      effectNamesInternal,
      foreignCallNameToID,
      indexMap,
      additionalEffectForeignCalls
    );
    syntax.negativeEffects[effectN] = effectCondition;
    effectNamesInternal = [...effectNamesInternal, ...effectCalls];
    const effectTrackers = parseTrackers(
      syntax.negativeEffects[effectN],
      effectNamesInternal,
      indexMap
    );

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

/**
 * Parses the tracker syntax and validates its type and default value.
 *
 * @param syntax - The JSON representation of the tracker syntax.
 * @returns Either an object containing the tracker's name, type, and encoded default value if successful or an error
 */
export function parseTrackerSyntax(
  syntax: trackerJSON
): Either<RulesError, TrackerDefinition> {
  let trackerType = syntax.type.trim();
  if (!supportedTrackerTypes.includes(trackerType)) {
    return makeLeft({
      errorType: "INPUT",
      state: { supportedTrackerTypes, trackerType },
      message: "Unsupported type",
    });
  }
  var trackerInitialValue: any;
  if (trackerType == "uint256") {
    if (!isNaN(Number(syntax.initialValue))) {
      trackerInitialValue = encodePacked(
        ["uint256"],
        [BigInt(syntax.initialValue)]
      );
    } else {
      return makeLeft({
        errorType: "INPUT",
        state: { defaultValue: syntax.initialValue },
        message: "Default Value doesn't match type",
      });
    }
  } else if (trackerType == "address") {
    const validatedAddress = getAddress(syntax.initialValue.trim());
    if (isLeft(validatedAddress)) {
      return validatedAddress;
    } else {
      var address = encodeAbiParameters(parseAbiParameters("address"), [
        unwrapEither(validatedAddress),
      ]);

      trackerInitialValue = address;
    }
  } else if (trackerType == "bytes") {
    var bytes = encodeAbiParameters(parseAbiParameters("bytes"), [
      toHex(stringToBytes(String(syntax.initialValue.trim()))),
    ]);

    trackerInitialValue = bytes;
  } else if (trackerType == "bool") {
    if (syntax.initialValue == "true") {
      trackerInitialValue = encodePacked(["uint256"], [1n]);
    } else {
      trackerInitialValue = encodePacked(["uint256"], [0n]);
    }
  } else {
    trackerInitialValue = encodeAbiParameters(parseAbiParameters("string"), [
      syntax.initialValue.trim(),
    ]);
  }
  var trackerTypeEnum = 0;
  for (var parameterType of PT) {
    if (parameterType.name == trackerType) {
      trackerTypeEnum = parameterType.enumeration;
    }
  }
  return makeRight({
    name: syntax.name.trim(),
    type: trackerTypeEnum,
    initialValue: trackerInitialValue,
  });
}

/**
 * Parses the foreign call definition and validates its structure.
 *
 * @param syntax - The JSON representation of the foreign call definition.
 * @returns Either an object containing the foreign call's name, address, function, return type, parameter types, and encoded indices if successful or an error.
 */
export function parseForeignCallDefinition(
  syntax: foreignCallJSON,
  foreignCallNameToID: FCNameToID[],
  indexMap: FCNameToID[],
  functionArguments: string[]
): Either<RulesError, ForeignCallDefinition> {
  const validatedAddress = getAddress(syntax.address.trim());
  if (isLeft(validatedAddress)) {
    return validatedAddress;
  } else {
    const address = unwrapEither(validatedAddress);
    var func = syntax.function.trim();
    var returnType = pTypeEnum.VOID; // default to void
    if (!PT.some((parameter) => parameter.name === syntax.returnType)) {
      return makeLeft({
        errorType: "INPUT",
        state: { PT, syntax },
        message: "Unsupported return type",
      });
    }
    for (var parameterType of PT) {
      if (parameterType.name == syntax.returnType) {
        returnType = parameterType.enumeration;
      }
    }
    var parameterTypes: number[] = [];
    var parameterSplit = syntax.function
      .trim()
      .split("(")[1]
      .split(")")[0]
      .split(",");
    for (var fcParameter of parameterSplit) {
      if (!PT.some((parameter) => parameter.name === fcParameter.trim())) {
        return makeLeft({
          errorType: "INPUT",
          state: { PT, syntax },
          message: "Unsupported argument type",
        });
      }
      for (var parameterType of PT) {
        if (fcParameter.trim() == parameterType.name) {
          parameterTypes.push(parameterType.enumeration);
        }
      }
    }

    var encodedIndices: ForeignCallEncodedIndex[] = [];
    var encodedIndecesSplit = syntax.valuesToPass.trim().split(",");
    for (var encodedIndex of encodedIndecesSplit) {
      if (encodedIndex.includes("FC:")) {
        for (var fcMap of foreignCallNameToID) {
          if ("FC:" + fcMap.name.trim() == encodedIndex.trim()) {
            var val: ForeignCallEncodedIndex = { eType: 1, index: fcMap.id };
            encodedIndices.push(val);
          }
        }
      } else if (encodedIndex.includes("TR:")) {
        for (var trMap of indexMap) {
          if ("TR:" + trMap.name.trim() == encodedIndex.trim()) {
            var val: ForeignCallEncodedIndex = { eType: 2, index: trMap.id };
            encodedIndices.push(val);
          }
        }
      } else {
        var iter = 0;
        for (var functionArg of functionArguments) {
          if (functionArg.trim() == encodedIndex.trim()) {
            var val: ForeignCallEncodedIndex = { eType: 0, index: iter };
            encodedIndices.push(val);
            break;
          } else {
            iter += 1;
          }
        }
      }
    }

    return makeRight({
      name: syntax.name.trim(),
      address: address,
      function: func,
      returnType: returnType,
      parameterTypes: parameterTypes,
      encodedIndices: encodedIndices,
    });
  }
}

export function parseCallingFunction(syntax: callingFunctionJSON): string[] {
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
