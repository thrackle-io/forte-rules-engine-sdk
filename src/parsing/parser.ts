
/// SPDX-License-Identifier: BUSL-1.1
import { encodePacked, Address, getAddress, toHex, encodeAbiParameters, parseAbiParameters, stringToBytes } from 'viem';
import {
    FCNameToID,
    ForeignCallDefinition,
    foreignCallJSON,
    matchArray,
    operandArray,
    PlaceholderStruct,
    PT,
    pTypeEnum,
    ruleJSON,
    RuleDefinition,
    supportedTrackerTypes,
    TrackerDefinition,
    trackerIndexNameMapping,
    trackerJSON
} from '../modules/types';
import { convertHumanReadableToInstructionSet } from './internal-parsing-logic';
import {
    removeExtraParenthesis,
    parseFunctionArguments,
    parseTrackers,
    buildRawData,
    parseForeignCalls,
    buildPlaceholderList,
    parseEffect
} from './parsing-utilities';

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
 * Parses the rule syntax and converts it into an abstract syntax tree (AST) and instruction set.
 * 
 * @param syntax - The JSON representation of the rule syntax.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 * @returns An object containing the instruction set, raw data, positive effects, negative effects, placeholders, and effect placeholders.
 */
export function parseRuleSyntax(syntax: ruleJSON, indexMap: trackerIndexNameMapping[], foreignCallNameToID: FCNameToID[]): RuleDefinition {

    var condition = syntax.condition

    condition = removeExtraParenthesis(condition)

    var functionSignature = syntax.encodedValues

    var names = parseFunctionArguments(functionSignature, condition)
    var effectNames: any[] = []
    condition = parseForeignCalls(condition, names, foreignCallNameToID)
    parseTrackers(condition, names, indexMap)
    const placeHolders = buildPlaceholderList(names)

    for (var effectP in syntax.positiveEffects) {
        syntax.positiveEffects[effectP] = parseForeignCalls(syntax.positiveEffects[effectP], effectNames, foreignCallNameToID)
        parseTrackers(syntax.positiveEffects[effectP], effectNames, indexMap)
    }
    for (var effectN in syntax.negativeEffects) {
        syntax.negativeEffects[effectN] = parseForeignCalls(syntax.negativeEffects[effectN], effectNames, foreignCallNameToID)
        parseTrackers(syntax.negativeEffects[effectN], effectNames, indexMap)
    }

    const effectPlaceHolders = buildPlaceholderList(effectNames)

    var positiveEffectsFinal = []
    var negativeEffectsFinal = []
    if (syntax.positiveEffects != null) {
        for (var effectP of syntax.positiveEffects) {
            let effect = parseEffect(effectP, effectNames, effectPlaceHolders, indexMap)
            positiveEffectsFinal.push(effect)

        }
    }

    if (syntax.negativeEffects != null) {
        for (var effectN of syntax.negativeEffects) {
            let effect = parseEffect(effectN, effectNames, effectPlaceHolders, indexMap)
            negativeEffectsFinal.push(effect)
        }
    }

    var retVal = convertHumanReadableToInstructionSet(condition, names, indexMap, placeHolders)
    var excludeArray = []
    for (var name of names) {
        excludeArray.push(name.name)
    }

    excludeArray.push(...matchArray)
    excludeArray.push(...operandArray)
    const rawData = buildRawData(retVal.instructionSet, excludeArray)
    return {
        instructionSet: retVal.instructionSet,
        rawData,
        positiveEffects: positiveEffectsFinal,
        negativeEffects: negativeEffectsFinal,
        placeHolders,
        effectPlaceHolders: effectPlaceHolders
    }
}

/**
 * Parses the tracker syntax and validates its type and default value.
 * 
 * @param syntax - The JSON representation of the tracker syntax.
 * @returns An object containing the tracker's name, type, and encoded default value.
 * @throws An error if the tracker type or default value is invalid.
 */
export function parseTrackerSyntax(syntax: trackerJSON): TrackerDefinition {
    let trackerType = syntax.type.trim()
    if (!supportedTrackerTypes.includes(trackerType)) {
        throw new Error("Unsupported type")
    }
    var trackerDefaultValue: any
    if (trackerType == "uint256") {
        if (!isNaN(Number(syntax.defaultValue))) {

            trackerDefaultValue = encodePacked(['uint256'], [BigInt(syntax.defaultValue)])
        } else {
            throw new Error("Default Value doesn't match type")
        }
    } else if (trackerType == "address") {
        var address = encodeAbiParameters(
            parseAbiParameters('address'),
            [getAddress(syntax.defaultValue.trim())]
        )

        trackerDefaultValue = address
    } else if (trackerType == "bytes") {
        var bytes = encodeAbiParameters(
            parseAbiParameters('bytes'),
            [toHex(stringToBytes(String(syntax.defaultValue.trim())))]
        )

        trackerDefaultValue = bytes
    } else if(trackerType == "bool") {
        if(syntax.defaultValue == "true") {
            trackerDefaultValue = encodePacked(['uint256'], [1n])
        } else {
            trackerDefaultValue = encodePacked(['uint256'], [0n])
        }
    } else {
        trackerDefaultValue = encodeAbiParameters(
            parseAbiParameters('string'),
            [syntax.defaultValue.trim()])
    }
    var trackerTypeEnum = 0
    for (var parameterType of PT) {
        if (parameterType.name == trackerType) {
            trackerTypeEnum = parameterType.enumeration
        }
    }
    return { name: syntax.name.trim(), type: trackerTypeEnum, defaultValue: trackerDefaultValue }
}

/**
 * Parses the foreign call definition and validates its structure.
 * 
 * @param syntax - The JSON representation of the foreign call definition.
 * @returns An object containing the foreign call's name, address, signature, return type, parameter types, and encoded indices.
 * @throws An error if the return type or parameter types are unsupported.
 */
export function parseForeignCallDefinition(syntax: foreignCallJSON): ForeignCallDefinition {
    var address: Address = getAddress(syntax.address.trim())
    var signature = syntax.signature.trim()
    var returnType = pTypeEnum.VOID // default to void
    if (!PT.some(parameter => parameter.name === syntax.returnType)) {
        throw new Error("Unsupported return type")
    }
    for (var parameterType of PT) {
        if (parameterType.name == syntax.returnType) {
            returnType = parameterType.enumeration
        }
    }
    var parameterTypes: number[] = []
    var parameterSplit = syntax.parameterTypes.trim().split(',')
    for (var fcParameter of parameterSplit) {
        if (!PT.some(parameter => parameter.name === fcParameter.trim())) {
            throw new Error("Unsupported argument type")
        }

        for (var parameterType of PT) {
            if (fcParameter.trim() == parameterType.name) {
                parameterTypes.push(parameterType.enumeration)
            }
        }
    }

    var encodedIndices: number[] = []
    var encodedIndecesSplit = syntax.encodedIndices.trim().split(',')
    for (var encodedIndex of encodedIndecesSplit) {
        if (!isNaN(Number(encodedIndex))) {
            encodedIndices.push(Number(encodedIndex))
        }
    }

    return {
        name: syntax.name.trim(), address: address, signature: signature,
        returnType: returnType, parameterTypes: parameterTypes, encodedIndices: encodedIndices
    }
}

/**
 * Builds a list of foreign call names from a rule condition string.
 * 
 * @param condition - The rule condition string.
 * @returns An array of foreign call names.
 */
export function buildForeignCallList(condition: string): string[] {
    // Use a regular expression to find all FC expressions
    const fcRegex = /FC:[a-zA-Z]+\([^)]+\)/g
    const matches = condition.matchAll(fcRegex);
    let processedCondition = condition
    var names: string[] = []
    // Convert matches iterator to array to process all at once
    for (const match of matches) {
        const fullFcExpr = match[0];
        var nameAndArgs = fullFcExpr.split(':')[1]
        var name = nameAndArgs.split('(')[0]
        names.push(name)
    }
    return names
}

/**
 * Builds a list of tracker names from a rule condition string.
 * 
 * @param condition - The rule condition string.
 * @returns An array of tracker names.
 */
export function buildTrackerList(condition: string): string[] {
    const trRegex = /TR:[a-zA-Z]+/g
    const truRegex = /TRU:[a-zA-Z]+/g
    var matches = condition.match(trRegex)

    var names: string[] = []
    if (matches != null) {
        for (const match of matches) {
            const fullTRExpr = match;
            var name = fullTRExpr.replace("TR:", "")
            names.push(name)
        }
    }
    matches = condition.match(truRegex)
    if (matches != null) {
        for (const match of matches) {
            const fullTRExpr = match;
            var name = fullTRExpr.replace("TRU:", "")
            names.push(name)
        }
    }

    return names
}

/**
 * Cleans the instruction set by replacing string representations of operators with their numeric equivalents.
 * 
 * @param instructionSet - The instruction set to clean.
 */
export function cleanInstructionSet(instructionSet: any[]): void {
    var iter = 0
    for (var val of instructionSet) {
        if (val == 'N') {
            instructionSet[iter] = 0
        } else if (val == '+') {
            instructionSet[iter] = 1
        } else if (val == '-') {
            instructionSet[iter] = 2
        } else if (val == '*') {
            instructionSet[iter] = 3
        } else if (val == '/') {
            instructionSet[iter] = 4
        } else if (val == '<') {
            instructionSet[iter] = 5
        } else if (val == '>') {
            instructionSet[iter] = 6
        } else if (val == '==') {
            instructionSet[iter] = 7
        } else if (val == 'AND') {
            instructionSet[iter] = 8
        } else if (val == 'OR') {
            instructionSet[iter] = 9
        } else if (val == 'NOT') {
            instructionSet[iter] = 10
        } else if (val == 'PLH') {
            instructionSet[iter] = 11
        } else if (val == 'TRU') {
            instructionSet[iter] = 12
        } else if (val == "=") {
            instructionSet[iter] = 13
        } else if (val == ">=") {
            instructionSet[iter] = 14;
        } else if (val == "<=") {
            instructionSet[iter] = 15;
        } else if (val == "!=") {
            instructionSet[iter] = 16;
        }

        iter++
    }
}

export { parseFunctionArguments };

