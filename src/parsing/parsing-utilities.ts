/// SPDX-License-Identifier: BUSL-1.1
import {
  ByteArray,
  encodeAbiParameters,
  isAddress,
  keccak256,
  parseAbiParameters,
  toBytes,
} from "viem";
import {
  trackerIndexNameMapping,
  FCNameToID,
  EffectType,
  PlaceholderStruct,
  operandArray,
  RawData,
  EffectDefinition,
  FunctionArgument,
  ForeignCall,
  Tracker,
} from "../modules/types";
import { convertHumanReadableToInstructionSet } from "./internal-parsing-logic";
import { getRandom } from "../modules/utils";

/**
 * @file parsing-utilities.ts
 * @description This module provies utility functions that the rest of the parsing logic depends on.
 *
 * @module parser
 *
 * @exports
 * - Utilities for the main parsing logic
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

/**
 * Parses the function signature string and builds an array of argument placeholders.
 *
 * @param encodedValues - The encoded values string.
 * @param condition - Optional parameter for the condition statement of a rule
 * @returns An array of argument placeholders.
 */
export function parseFunctionArguments(
  encodedValues: string,
  condition?: string
): FunctionArgument[] {
  var params = encodedValues.split(", ");
  var names = [];
  var typeIndex = 0;

  for (var param of params) {
    var typeName = param.split(" ");
    if (
      typeName[0].trim() == "uint256" &&
      (condition == null || condition.includes(typeName[1]))
    ) {
      names.push({
        name: typeName[1],
        tIndex: typeIndex,
        rawType: typeName[0].trim(),
      });
    } else if (
      typeName[0].trim() == "string" &&
      (condition == null || condition.includes(typeName[1]))
    ) {
      names.push({
        name: typeName[1],
        tIndex: typeIndex,
        rawType: typeName[0].trim(),
      });
    } else if (
      typeName[0].trim() == "address" &&
      (condition == null || condition.includes(typeName[1]))
    ) {
      names.push({
        name: typeName[1],
        tIndex: typeIndex,
        rawType: typeName[0].trim(),
      });
    } else if (
      typeName[0].trim() == "bytes" &&
      (condition == null || condition.includes(typeName[1]))
    ) {
      names.push({
        name: typeName[1],
        tIndex: typeIndex,
        rawType: typeName[0].trim(),
      });
    } else if (
      typeName[0].trim() == "bool" &&
      (condition == null || condition.includes(typeName[1]))
    ) {
      names.push({
        name: typeName[1],
        tIndex: typeIndex,
        rawType: typeName[0].trim(),
      });
    }
    typeIndex++;
  }

  return names;
}

/**
 * Parses tracker references in a rule condition string and adds them to the argument list.
 *
 * @param condition - The rule condition string.
 * @param nextIndex - The next available index for placeholders.
 * @param names - An array of argument placeholders.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 * 
 * @returns an array of created Tracker objects.
 */
export function parseTrackers(
  condition: string,
  names: any[],
  indexMap: trackerIndexNameMapping[]
): Tracker[] {
  const trRegex = /TR:[a-zA-Z]+/g;
  const truRegex = /TRU:[a-zA-Z]+/g;
  var matches = condition.match(trRegex);
  const trackers: Tracker[] = [];

  if (matches != null) {
    var uniq = [...new Set(matches)];
    for (var match of uniq!) {
      var type = "address";
      var index = 0;
      for (var ind of indexMap) {
        if ("TR:" + ind.name == match) {
          index = ind.id;
          if (ind.type == 0) {
            type = "address";
          } else if (ind.type == 1) {
            type = "string";
          } else if (ind.type == 3) {
            type = "bool";
          } else if (ind.type == 5) {
            type = "bytes";
          } else {
            type = "uint256";
          }
        }
      }
      trackers.push({
        name: match,
        tIndex: index,
        rawType: "tracker",
        rawTypeTwo: type,
      });
    }
  }

  var matchesUpdate = condition.match(truRegex);

  if (matchesUpdate != null) {
    var uniq = [...new Set(matchesUpdate)];
    for (var match of uniq!) {
      var index = 0;
      match = match.replace("TRU:", "TR:");
      for (var ind of indexMap) {
        if ("TR:" + ind.name == match) {
          index = ind.id;
        }
      }
      var found = false;
      for (var name of [...names, ...trackers]) {
        if (name.name == match) {
          found = true;
          break;
        }
      }
      if (!found) {
        trackers.push({ name: match, tIndex: index, rawType: "tracker" });
      }
    }
  }

  return trackers
}

/**
 * Parses a condition string to identify and process foreign call (FC) expressions.
 * Replaces each FC expression with a unique placeholder and updates the `names` array
 * with metadata about the processed expressions.
 *
 * @param condition - The input condition string containing potential FC expressions.
 * @param nextIndex - The starting index for tracking FC expressions in the `names` array.
 * @param names - An array to store metadata about the processed FC expressions, including
 *                their placeholders, indices, and types.
 * @returns The updated condition string with FC expressions replaced by placeholders
 *          and an array of created ForeignCall
 *
 * @remarks
 * - FC expressions are identified using the regular expression `/FC:[a-zA-Z]+[^\s]+/g`.
 * - If an FC expression is already present in the `names` array, its existing placeholder
 *   is reused.
 * - Each new FC expression is assigned a unique placeholder in the format `FC:<getRandom()>`.
  */
export function parseForeignCalls(
  condition: string,
  names: any[],
  foreignCallNameToID: FCNameToID[]
): [string, ForeignCall[]] {
  // Use a regular expression to find all FC expressions
  const fcRegex = /FC:[a-zA-Z]+[^\s]+/g;
  const matches = condition.matchAll(fcRegex);
  let processedCondition = condition;
  const foreignCalls: ForeignCall[] = [];

  // Convert matches iterator to array to process all at once
  for (const match of matches) {
    const fullFcExpr = match[0];
    if (names.indexOf(match) !== -1) {
      let ph = names[names.indexOf(match)].fcPlaceholder;
      processedCondition = processedCondition.replace(fullFcExpr, ph);
      continue;
    }
    // Create a unique placeholder for this FC expression
    var placeholder = `FC:${getRandom()}`;
    for (var existing of names) {
      if (existing.name == fullFcExpr) {
        placeholder = existing.fcPlaceholder;
      }
    }

    processedCondition = processedCondition.replace(fullFcExpr, placeholder);
    var alreadyFound = false;
    for (var existing of names) {
      if (existing.name == fullFcExpr) {
        alreadyFound = true;
        break;
      }
    }
    if (!alreadyFound) {
      var index = 0;
      for (var fcMap of foreignCallNameToID) {
        if ("FC:" + fcMap.name.trim() == fullFcExpr.trim()) {
          index = fcMap.id;
        }
      }
      foreignCalls.push({
        name: match[0],
        tIndex: index,
        rawType: "foreign call",
        fcPlaceholder: placeholder,
      });
    }
  }

  return [processedCondition, foreignCalls];
}

/**
 * Build the placeholder struct array from the names array
 *
 * @param names - array in the SDK internal format for placeholders
 * @returns Placeholder array in the chain specific format
 */
export function buildPlaceholderList(names: any[]): PlaceholderStruct[] {
  var placeHolders: PlaceholderStruct[] = [];
  for (var name of names) {
    var placeHolderEnum = 0;
    var tracker = false;
    if (name.rawType == "address") {
      placeHolderEnum = 0;
    } else if (name.rawType == "string") {
      placeHolderEnum = 1;
    } else if (name.rawType == "uint256") {
      placeHolderEnum = 2;
    } else if (name.rawType == "bool") {
      placeHolderEnum = 3;
    } else if (name.rawType == "bytes") {
      placeHolderEnum = 5;
    } else if (name.rawType == "tracker") {
      if ((name as any).rawTypeTwo == "address") {
        placeHolderEnum = 0;
      } else if ((name as any).rawTypeTwo == "string") {
        placeHolderEnum = 1;
      } else if ((name as any).rawTypeTwo == "bool") {
        placeHolderEnum = 3;
      } else if ((name as any).rawTypeTwo == "bytes") {
        placeHolderEnum = 5;
      } else {
        placeHolderEnum = 2;
      }
      tracker = true;
    }

    var placeHolder: PlaceholderStruct = {
      pType: placeHolderEnum,
      typeSpecificIndex: name.tIndex,
      trackerValue: tracker,
      foreignCall: name.rawType == "foreign call",
    };
    placeHolders.push(placeHolder);
  }
  return placeHolders;
}

/**
 * Parses an effect string and extracts its type, text, instruction set, parameter type,
 * and parameter value. The function supports three types of effects: "emit", "revert",
 * and general expressions.
 *
 * @param effect - The effect string to parse.
 * @param names - An array of names used for interpreting expressions.
 * @param placeholders - An array to store placeholder structures extracted during parsing.
 * @param indexMap - A mapping of tracker index names used for interpreting expressions.
 *
 * @returns An object containing:
 * - `type`: The type of the effect (e.g., `EffectType.REVERT`, `EffectType.EVENT`, or `EffectType.EXPRESSION`).
 * - `text`: The extracted text of the effect.
 * - `instructionSet`: An array of instructions for expression effects.
 * - `pType`: The parameter type (0 for address, 1 for string, 2 for numeric).
 * - `parameterValue`: The extracted parameter value (address, string, or numeric).
 */
export function parseEffect(
  effect: string,
  names: any[],
  placeholders: PlaceholderStruct[],
  indexMap: trackerIndexNameMapping[]
): EffectDefinition {
  var effectType = EffectType.REVERT;
  var effectText = "";
  var effectInstructionSet: any[] = [];
  const revertTextPattern = /(revert)\("([^"]*)"\)/;
  var pType = 2;
  var parameterValue: any = 0;
  if (effect.includes("emit")) {
    effectType = EffectType.EVENT;
    var placeHolder = effect.replace("emit ", "").trim();
    var spli = placeHolder.split(", ");
    if (spli.length > 1) {
      effectText = spli[0];
      if (isAddress(spli[1].trim())) {
        pType = 0;
        parameterValue = spli[1].trim();
      } else if (!isNaN(Number(spli[1].trim()))) {
        pType = 2;
        parameterValue = BigInt(spli[1].trim());
      } else {
        pType = 1;
        parameterValue = spli[1].trim();
      }
    } else {
      effectText = spli[0];
    }
  } else if (effect.includes("revert")) {
    effectType = EffectType.REVERT;
    const match = effect.match(revertTextPattern);
    effectText = match ? match[2] : "";
  } else {
    effectType = EffectType.EXPRESSION;
    var instructionSet = convertHumanReadableToInstructionSet(
      effect,
      names,
      indexMap,
      placeholders
    );
    effectInstructionSet = instructionSet;
  }

  return {
    type: effectType,
    text: effectText,
    instructionSet: effectInstructionSet,
    pType,
    parameterValue,
  };
}

/**
 * Processes an instruction set to build raw data entries, excluding specified strings,
 * and converts certain elements into hashed or numeric representations.
 *
 * @param instructionSet - An array of instructions to process. Elements can be strings or numbers.
 * @param excludeArray - An array of strings to exclude from processing.
 * @param rawDataArray - An array to store raw data entries. Each entry includes the raw data,
 *                       its index in the instruction set, and its data type.
 * @returns An object containing:
 *          - `instructionSetIndex`: An array of indices in the instruction set corresponding to processed elements.
 *          - `argumentTypes`: An array of argument types (e.g., 1 for strings).
 *          - `dataValues`: An array of byte arrays representing the processed data values.
 */
export function buildRawData(
  instructionSet: any[],
  excludeArray: string[]
): number[] {
  return instructionSet.map((instruction) => {

    // Only capture values that aren't naturally numbers
    if (!isNaN(Number(instruction))) {
      return BigInt(instruction);
    } else if (!excludeArray.includes(instruction.trim())) {
      instruction = instruction.trim();
      if (instruction == "true") {
        return 1n;
      } else if (instruction == "false") {
        return 0n;
      } else if (!operandArray.includes(instruction)) {
        // Convert the string or bytes to a keccak256 hash then to a uint256
        return BigInt(
          keccak256(
            encodeAbiParameters(
              parseAbiParameters(instruction.startsWith("0x") ? "bytes" : "string"),
              [instruction]
            )
          )
        );
      } else {
        return instruction;
      }
    } else {
      return instruction;
    }
  });
}

/**
 * Cleans a given string by removing line breaks, reducing multiple spaces to a single space,
 * and trimming leading and trailing whitespace.
 *
 * @param str - The input string to be cleaned.
 * @returns The cleaned string with normalized whitespace.
 */
export function cleanString(str: string): string {
  return str
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cleans up a given string by removing unnecessary parentheses and replacing specific patterns
 * with placeholders for later restoration. The function processes two types of patterns:
 * 1. Substrings starting with "FC:".
 * 2. Parentheses containing logical operators ("AND" or "OR").
 *
 * The function performs the following steps:
 * - Identifies and replaces "FC:" patterns with temporary placeholders.
 * - Iteratively removes or replaces parentheses based on their content.
 * - Restores the replaced placeholders back into the string.
 *
 * @param strToClean - The input string to be cleaned of extra parentheses.
 * @returns The cleaned string with unnecessary parentheses removed and original patterns restored.
 */
export function removeExtraParenthesis(strToClean: string): string {
  var holders: string[] = [];
  var fcHolder: string[] = [];
  var iter = 0;

  while (strToClean.includes("FC:")) {
    var initialIndex = strToClean.lastIndexOf("FC:");
    var closingIndex = strToClean.indexOf(" ", initialIndex);
    var sub = strToClean.substring(initialIndex, closingIndex + 1);
    fcHolder.push(sub);
    var replacement = "fcRep:" + iter;
    iter += 1;
    strToClean = strToClean.replace(sub, replacement);
  }

  iter = 0;
  while (strToClean.includes("(")) {
    var initialIndex = strToClean.lastIndexOf("(");
    var closingIndex = strToClean.indexOf(")", initialIndex);
    var sub = strToClean.substring(initialIndex, closingIndex + 1);
    var removed = false;

    if (sub.includes("AND") || sub.includes("OR") || sub.includes("NOT")) {
      holders.push(sub);
      var replacement = "rep:" + iter;
      iter += 1;
      strToClean = strToClean.replace(sub, replacement);
    } else {
      removed = true;
      strToClean =
        strToClean.substring(0, initialIndex) +
        "" +
        strToClean.substring(initialIndex + 1);
      strToClean =
        strToClean.substring(0, closingIndex - 1) +
        "" +
        strToClean.substring(closingIndex);
    }
  }

  var replaceCount = 0;
  while (replaceCount < holders.length) {
    iter = 0;
    for (var hold of holders) {
      var str = "rep:" + iter;
      if (strToClean.includes(str)) {
        strToClean = strToClean.replace(str, holders[iter]);
        replaceCount += 1;
      }
      iter += 1;
    }
  }
  iter = 0;
  for (var hold of fcHolder) {
    var str = "fcRep:" + iter;
    strToClean = strToClean.replace(str, fcHolder[iter]);
    iter += 1;
  }
  return strToClean;
}
