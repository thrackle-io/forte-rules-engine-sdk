
/// SPDX-License-Identifier: BUSL-1.1
import { keccak256, encodePacked, Address, getAddress, toBytes, ByteArray, toHex, isAddress, encodeAbiParameters, parseAbiParameters, stringToBytes } from 'viem';
import { EffectType, FCNameToID, ForeignCallArgumentMappings, ForeignCallDefinition, foreignCallJSON, FunctionArgument, IndividualArugmentMapping, matchArray, operandArray, PlaceholderStruct, PT, pTypeEnum, RawData, ruleJSON, RuleStruct, stringReplacement, supportedTrackerTypes, TrackerDefinition, trackerIndexNameMapping, trackerJSON, truMatchArray, Tuple } from './types';

/**
 * @file parser.ts
 * @description This module provides a comprehensive set of parsing utilities for the Rules Engine SDK.
 *              It includes functions for parsing rule syntax, trackers, foreign calls, and converting
 *              human-readable conditions into abstract syntax trees (ASTs) and instruction sets.
 *              Additionally, it supports reverse parsing of instruction sets back into human-readable syntax.
 * 
 * @module parser
 * 
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `ContractInteraction`: Contains types and structures for rules, trackers, and foreign calls.
 * 
 * @types
 * - `EffectType`: Enum representing the types of effects (e.g., REVERT, EVENT, EXPRESSION).
 * - `RuleStruct`: Represents the structure of a rule in the Rules Engine.
 * - `ForeignCallDefinition`: Represents the structure of a foreign call definition.
 * - `PlaceholderStruct`: Represents placeholders used in instruction sets.
 * - `trackerIndexNameMapping`: Maps tracker IDs to their names and types.
 * - `RawData`: Represents raw data extracted from instruction sets.
 * 
 * @exports
 * - Functions for parsing rule syntax, trackers, foreign calls, and converting between formats.
 * - Helper functions for cleaning and interpreting instruction sets.
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license BUSL-1.1
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

// --------------------------------------------------------------------------------------------------
// External Parsing Functions:
// --------------------------------------------------------------------------------------------------

/**
 * Parses the rule syntax and converts it into an abstract syntax tree (AST) and instruction set.
 * 
 * @param syntax - The JSON representation of the rule syntax.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 * @returns An object containing the instruction set, raw data, positive effects, negative effects, placeholders, and effect placeholders.
 */
export function parseRuleSyntax(syntax: ruleJSON, indexMap: trackerIndexNameMapping[], foreignCallNameToID: FCNameToID[]) {

    var condition = syntax.condition

    condition = removeExtraParenthesis(condition)

    var functionSignature = syntax.encodedValues
    var names = parseFunctionArguments(functionSignature)
    var effectNames: any[] = []
    condition = parseForeignCalls(condition, names, foreignCallNameToID)
    parseTrackers(condition,  names, indexMap)
    
    for(var effectP in syntax.positiveEffects) {
        syntax.positiveEffects[effectP] = parseForeignCalls(syntax.positiveEffects[effectP], effectNames, foreignCallNameToID)
        parseTrackers(syntax.positiveEffects[effectP],  effectNames, indexMap)
    }
    for(var effectN in syntax.negativeEffects) {
        syntax.negativeEffects[effectN] = parseForeignCalls(syntax.negativeEffects[effectN], effectNames, foreignCallNameToID)
        parseTrackers(syntax.negativeEffects[effectN],  effectNames, indexMap)
    }

    var effectPlaceHolders: PlaceholderStruct[] = []
    var positiveEffectsFinal = []
    var negativeEffectsFinal = []
    if (syntax.positiveEffects != null) {
        for(var effectP of syntax.positiveEffects) {
            let effect = parseEffect(effectP, effectNames, effectPlaceHolders, indexMap)
            positiveEffectsFinal.push(effect)

        }
    }
    if (syntax.negativeEffects != null) {
        for(var effectN of syntax.negativeEffects) {
            let effect = parseEffect(effectN, effectNames, effectPlaceHolders, indexMap)
            negativeEffectsFinal.push(effect)
        }
    }
    var placeHolders: PlaceholderStruct[] = []
    var retVal = interpretToInstructionSet(condition, names, indexMap, placeHolders)
    var excludeArray = []
    for(var name of names) {
        excludeArray.push(name.name)
    }

    excludeArray.push(...matchArray)
    excludeArray.push(...operandArray)
    var rawData: any[] = []
    var raw = buildRawData(retVal.instructionSet, excludeArray, rawData)
    return {instructionSet: retVal.instructionSet, rawData: raw, positiveEffects: positiveEffectsFinal, negativeEffects: negativeEffectsFinal,
         placeHolders: placeHolders, effectPlaceHolders: effectPlaceHolders}
}

/**
 * Parses the tracker syntax and validates its type and default value.
 * 
 * @param syntax - The JSON representation of the tracker syntax.
 * @returns An object containing the tracker's name, type, and encoded default value.
 * @throws An error if the tracker type or default value is invalid.
 */
export function parseTrackerSyntax(syntax: trackerJSON) {
    let trackerType = syntax.type.trim()
    if(!supportedTrackerTypes.includes(trackerType)) {
        throw new Error("Unsupported type")
    }
    var trackerDefaultValue: any
    if(trackerType == "uint256") {
        if(!isNaN(Number(syntax.defaultValue))) {

            trackerDefaultValue = encodePacked(['uint256'], [BigInt(syntax.defaultValue)])
        } else {
            throw new Error("Default Value doesn't match type")
        }
    } else if(trackerType == "address") {
        var address = encodeAbiParameters(
            parseAbiParameters('address'),
            [getAddress(syntax.defaultValue.trim())]
          )

        trackerDefaultValue = address
    } else if(trackerType == "bytes") {
        var bytes = encodeAbiParameters(
            parseAbiParameters('bytes'),
            [toHex(stringToBytes(String(syntax.defaultValue.trim())))]
          )

        trackerDefaultValue = bytes
    } else {
        trackerDefaultValue = encodeAbiParameters(
                            parseAbiParameters('string'),
                            [syntax.defaultValue.trim()])
    }
    var trackerTypeEnum = 0
    for(var parameterType of PT) {
        if(parameterType.name == trackerType) {
            trackerTypeEnum = parameterType.enumeration
        }
    }
    return {name: syntax.name.trim(), type: trackerTypeEnum, defaultValue: trackerDefaultValue}
}

/**
 * Parses the foreign call definition and validates its structure.
 * 
 * @param syntax - The JSON representation of the foreign call definition.
 * @returns An object containing the foreign call's name, address, signature, return type, parameter types, and encoded indices.
 * @throws An error if the return type or parameter types are unsupported.
 */
export function parseForeignCallDefinition(syntax: foreignCallJSON) {
    var address: Address = getAddress(syntax.address.trim())
    var signature = syntax.signature.trim()
    var returnType = pTypeEnum.VOID // default to void
    if(!PT.some(parameter => parameter.name === syntax.returnType)) {
        throw new Error("Unsupported return type")
    }
    for(var parameterType of PT) {
        if(parameterType.name ==syntax.returnType) {
            returnType = parameterType.enumeration
        }
    }
    var parameterTypes: number[] = []
    var parameterSplit = syntax.parameterTypes.trim().split(',')
    for(var fcParameter of parameterSplit) {
        if(!PT.some(parameter => parameter.name === fcParameter.trim())) {
            throw new Error("Unsupported argument type")
        }
        
        for(var parameterType of PT) {
            if(fcParameter.trim() == parameterType.name) {
                parameterTypes.push(parameterType.enumeration)
            }
        }
    }

    var encodedIndices: number[] = []
    var encodedIndecesSplit = syntax.encodedIndices.trim().split(',')
    for(var encodedIndex of encodedIndecesSplit) {
        if(!isNaN(Number(encodedIndex))) {
            encodedIndices.push(Number(encodedIndex))
        }
    }



    return {name: syntax.name.trim(), address: address, signature: signature, 
        returnType: returnType, parameterTypes: parameterTypes, encodedIndices: encodedIndices} as ForeignCallDefinition
}

/**
 * Converts an instruction set back into a human-readable rule condition string.
 * 
 * @param instructionSet - The instruction set to reverse parse.
 * @param placeHolderArray - An array of placeholders used in the instruction set.
 * @param stringReplacements - An array of string replacements for specific instructions.
 * @returns A human-readable rule condition string.
 */
export function reverseParseRule(instructionSet: number[], placeHolderArray: string[], stringReplacements: stringReplacement[]) {
    var currentAction = -1
    var currentActionIndex = 0
    var currentMemAddress = 0
    var memAddressesMap = []
    var currentInstructionValues: any[] = []
    var retVal = ""
    var instructionNumber = 0
    for (var instruction of instructionSet) {
        if(currentAction == -1) {
            currentAction = Number(instruction);
            switch(currentAction) {
                case 0: 
                    currentActionIndex = 1;
                    break;
                case 1:
                    currentActionIndex = 2;
                    break;
                case 2:
                    currentActionIndex = 2;
                    break;
                case 3:
                    currentActionIndex = 2;
                    break;
                case 4:
                    currentActionIndex = 2;
                    break;
                case 5:
                    currentActionIndex = 2;
                    break;
                case 6:
                    currentActionIndex = 2;
                    break;
                case 7:
                    currentActionIndex = 2;
                    break;
                case 8:
                    currentActionIndex = 2;
                    break;
                case 9: 
                    currentActionIndex = 2;
                    break;
                case 10: 
                    currentActionIndex = 1;
                    break;
                case 11:
                    currentActionIndex = 1;
                    break;
                default:
                    currentActionIndex = 0;
                    break;
            }
        } else {
            switch(currentAction) {
                case 0:
                    var found = false
                    for(var raw of stringReplacements) {
                        if(raw.instructionSetIndex == instructionNumber) {
                            memAddressesMap.push({memAddr: currentMemAddress, value: raw.originalData})
                            found = true
                            break;
                        }
                    }
                    if(!found) {
                        memAddressesMap.push({memAddr: currentMemAddress, value: instruction})
                    }
                    currentMemAddress += 1
                    break;
                case 1: 
                        retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                            memAddressesMap, currentActionIndex, currentInstructionValues, " + ")
                        if(currentActionIndex == 1) {
                            currentMemAddress += 1
                            currentInstructionValues = []
                        }
                    break;
                case 2:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " - ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 3:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " * ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 4:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " / ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 5:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " < ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 6:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " > ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 7:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " == ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 8:
                    retVal = logicalOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " AND ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 9:
                    retVal = logicalOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " OR ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 10:
                    for(var memValue of memAddressesMap) {
                        if(memValue.memAddr == instruction) {
                            currentInstructionValues.push(memValue.value)
                        }
                    }
                    if(currentActionIndex == 1) {
                        var currentString = "NOT " + currentInstructionValues[0]
                        memAddressesMap.push({memAddr: currentMemAddress, value: currentString})
                        retVal = currentString
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 11:
                    memAddressesMap.push({memAddr: currentMemAddress, value: placeHolderArray[instruction]})
                    currentMemAddress += 1
                    break;
                case 12:
                    break
                case 13:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " = ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                    break
                case 14:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " >= ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                case 15:
                    retVal = arithmeticOperatorReverseInterpretation(instruction, currentMemAddress, 
                        memAddressesMap, currentActionIndex, currentInstructionValues, " <= ")
                    if(currentActionIndex == 1) {
                        currentMemAddress += 1
                        currentInstructionValues = []
                    }
                    break;
                default:
                    console.log("unknown instruction");
                    break;

            }
            currentActionIndex -= 1;
            if(currentActionIndex == 0) {
                currentAction = -1;
            }
        } 
        instructionNumber += 1
    }
    if(retVal.at(0) == '(') {
        retVal = retVal.substring(2, retVal.length - 2)
    }
    return retVal
}

// --------------------------------------------------------------------------------------------------
// External Helper Functions
// --------------------------------------------------------------------------------------------------

/**
 * Builds a list of foreign call names from a rule condition string.
 * 
 * @param condition - The rule condition string.
 * @returns An array of foreign call names.
 */
export function buildForeignCallList(condition: string) {
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
export function buildTrackerList(condition: string) {
    const trRegex = /TR:[a-zA-Z]+/g
    const truRegex = /TRU:[a-zA-Z]+/g
    var matches = condition.match(trRegex)

    var names: string[] = []
    if(matches != null) {
        for (const match of matches) {
            const fullTRExpr = match;
            var name = fullTRExpr.replace("TR:", "")
            names.push(name)
        }
    }
    matches = condition.match(truRegex)
    if(matches != null) {
        for (const match of matches) {
            const fullTRExpr = match;
            var name = fullTRExpr.replace("TRU:", "")
            names.push(name)
        }
    }

    return names
}

/**
 * Builds a list of raw foreign call expressions from a rule condition string.
 * 
 * @param condition - The rule condition string.
 * @returns An array of raw foreign call expressions.
 */
export function buildForeignCallListRaw(condition: string) {
    const fcRegex = /FC:[a-zA-Z]+\([^)]+\)/g
    const matches = condition.matchAll(fcRegex);
    let processedCondition = condition
    var names: string[] = []
    // Convert matches iterator to array to process all at once
    for (const match of matches) {
        const fullFcExpr = match[0];
        names.push(fullFcExpr)
    }
    return names
}

/**
 * Builds a mapping of foreign call arguments to their corresponding placeholders.
 * 
 * @param fCallIDs - An array of foreign call IDs.
 * @param fCalls - An array of foreign call expressions.
 * @param argumentNames - An array of function arguments.
 * @param trackers - An array of tracker definitions.
 * @returns An array of foreign call argument mappings.
 */
export function buildForeignCallArgumentMapping(fCallIDs: number[], fCalls: string[], argumentNames: FunctionArgument[], trackers: TrackerDefinition[]) {
    var retVal: ForeignCallArgumentMappings[] = []
    var iter = 0
    for(var foreignCall of fCalls) {
        var cleaned = cleanString(foreignCall)
        var initialSplit = cleaned.split('(')
        var parameters = cleanString(initialSplit[1].replace(')', ''))
        var parameterSplit = parameters.split(',')
        var callName = initialSplit[0]
        var mappings: IndividualArugmentMapping[] = []

        for(var parameter of parameterSplit) {
            var found = false
            parameter = parameter.trim()

            var argumentIterator = 0
            for (var arugment of argumentNames) {
                if(buildIndividualMapping(parameter, argumentIterator, arugment, mappings, false)) {
                    found = true
                    break
                }
                argumentIterator+=1
            }
            if(!found) {
                for(var tracker of trackers) {
                    if(buildIndividualMapping(parameter, argumentIterator, tracker, mappings, true)) {
                        break
                    }
                    argumentIterator+=1
                }
            }
        }
        if(mappings.length > 0) {
            var foreignCallMappings : ForeignCallArgumentMappings = {
                foreignCallIndex: fCallIDs[iter],
                mappings: mappings
            }
            retVal.push(foreignCallMappings)
        }
        iter++
    }
    return retVal
}

/**
 * Cleans the instruction set by replacing string representations of operators with their numeric equivalents.
 * 
 * @param instructionSet - The instruction set to clean.
 */
export function cleanInstructionSet(instructionSet: any[]) {
    var iter = 0
    for(var val of instructionSet) {
        if(val == 'N') {
            instructionSet[iter] = 0
        } else if(val == '+') {
            instructionSet[iter] = 1
        } else if(val == '-') {
            instructionSet[iter] = 2
        } else if(val == '*') {
            instructionSet[iter] = 3
        } else if(val == '/') {
            instructionSet[iter] = 4
        } else if(val == '<') {
            instructionSet[iter] = 5
        } else if(val == '>') {
            instructionSet[iter] = 6
        } else if(val == '==') {
            instructionSet[iter] = 7
        } else if(val == 'AND') {
            instructionSet[iter] = 8
        } else if(val == 'OR') {
            instructionSet[iter] = 9
        } else if(val == 'NOT') {
            instructionSet[iter] = 10
        } else if(val == 'PLH') {
            instructionSet[iter] = 11
        } else if(val == 'TRU') {
            instructionSet[iter] = 12
        } else if(val == "=") {
            instructionSet[iter] = 13
        } else if(val == ">=") {
            instructionSet[iter] = 14;
        } else if(val == "<=") {
            instructionSet[iter] = 15;
        }

        iter++
    }
}

/**
 * Converts a `RuleStruct` object into a JSON-like string representation.
 *
 * @param functionString - The function signature as a string.
 * @param encodedValues - A string containing encoded values for the rule.
 * @param ruleS - The `RuleStruct` object containing rule details such as placeholders, positive effects, and negative effects.
 * @param plhArray - An array to store the names of placeholders extracted from the rule.
 * @returns An object of type `ruleJSON` containing the condition, positive effects, negative effects, function signature, and encoded values.
 *
 * The function processes the `RuleStruct` object to:
 * - Extract placeholder names and append them to `plhArray`.
 * - Parse and format positive and negative effects into strings.
 * - Reverse parse the rule's instruction set to generate a condition string.
 * - Populate the `ruleJSON` object with the processed data.
 */
export function convertRuleStructToString(functionString: string, encodedValues: string, ruleS: RuleStruct, plhArray: string[]) {
    
    var rJSON: ruleJSON = {
        condition: "",
        positiveEffects: [],
        negativeEffects: [],
        functionSignature: "",
        encodedValues: ""
    }

    var names = parseFunctionArguments(encodedValues)

    for(var plh of ruleS!.placeHolders) {
        plhArray.push(names[plh.typeSpecificIndex].name)
    }

    var posIter = 0
    for(var pos of ruleS.posEffects) {
        var effectString = ""
        if(pos.effectType == 0) {
            effectString += "revert(" + pos.text + ")"
        } else if(pos.effectType == 1) {
            effectString += "emit " + pos.text 
        }
        posIter += 1

        rJSON.positiveEffects.push(effectString)
    }

    if(ruleS.negEffects.length > 0) {
        var negIter = 0
        for(var neg of ruleS.negEffects) {
            var effectString = ""
            if(neg.effectType == 0) {
                effectString += "revert(" + neg.text + ")"
            } else if(neg.effectType == 1) {
                effectString += "emit " + neg.text 
            }
            negIter+= 1
            rJSON.negativeEffects.push(effectString)
        }
    }

    rJSON.condition = reverseParseRule(ruleS!.instructionSet, plhArray, [])
    rJSON.functionSignature = functionString
    rJSON.encodedValues = encodedValues
    return rJSON
    
}

/**
 * Converts an array of foreign call structures into formatted string representations
 * and appends them to the provided `callStrings` array.
 *
 * @param callStrings - An array to which the formatted foreign call strings will be appended.
 * @param foreignCalls - An array of foreign call objects or `null`. Each object should contain
 *                       details such as `signature`, `returnType`, `parameterTypes`, and `foreignCallAddress`.
 * @param functionSignatureMappings - An array of mappings that associate a `hex` signature with
 *                                    a human-readable `functionSignature`.
 *
 * The function processes each foreign call by:
 * - Matching its `signature` with the corresponding `functionSignature` from the mappings.
 * - Resolving its `returnType` and `parameterTypes` to human-readable names using a predefined
 *   parameter type enumeration (`PT`).
 * - Formatting the foreign call details into a string and appending it to the `callStrings` array.
 *
 * The output string format is:
 * `Foreign Call <index> --> <foreignCallAddress> --> <functionSignature> --> <returnType> --> <parameterTypes>`
 *
 * Example:
 * ```
 * Foreign Call 1 --> 0x1234567890abcdef --> myFunction(uint256) --> uint256 --> uint256, string
 * ```
 */
export function convertForeignCallStructsToStrings(callStrings: string[], foreignCalls: any[] | null, functionSignatureMappings: any[]) {
    var fcIter = 1
    if(foreignCalls != null) {
        for(var call of foreignCalls) {
            var signatureString = ""
            for(var mapping of functionSignatureMappings) {
                if(mapping.hex == call.signature) {
                    signatureString = mapping.functionSignature
                }
            }
            var returnTypeString = ""
            var parameterStrings = []

            for(var parameterType of PT) {
                if(call.returnType == parameterType.enumeration) {
                    returnTypeString = parameterType.name
                }
            }

            for(var param of call.parameterTypes) {
                for(var parameterType of PT) {
                    if(param == parameterType.enumeration) {
                        parameterStrings.push(parameterType.name)
                    }
                }
            }

            var outputString = ""
            outputString += "Foreign Call " + String(fcIter) + " --> "
            outputString += call.foreignCallAddress
            outputString += " --> "
            outputString += signatureString
            outputString += " --> "
            outputString += returnTypeString
            outputString += " --> "
            var innerIter = 0
            for(var str of parameterStrings) {
                if(innerIter > 0) {
                    outputString += ", "
                }
                outputString += str
                innerIter++
            }

            callStrings.push(outputString)
            fcIter += 1
        }
    }
}

/**
 * Converts tracker structures into human-readable strings.
 * 
 * @param trackers - An array of tracker structures.
 * @param trackerStrings - An array to store the resulting strings.
 */
export function convertTrackerStructsToStrings(trackers: any[] | null, trackerStrings: string[]) {
    var trackerIter = 1
    if(trackers != null) {
        for(var tracker of trackers) {

            var trackerType = ""
            for(var parameterType of PT) {
                if(tracker.pType == parameterType.enumeration) {
                    trackerType = parameterType.name
                }
            }

            var outputString = ""
            outputString += "Tracker " + String(trackerIter) + " --> "
            outputString += trackerType
            outputString += " --> "
            outputString += tracker.trackerValue
            trackerStrings.push(outputString)
            trackerIter += 1
        }
    }
}

/**
 * Parses the function signature string and builds an array of argument placeholders.
 * 
 * @param functionSignature - The function signature string.
 * @returns An array of argument placeholders.
 */
export function parseFunctionArguments(functionSignature: string) {
    var params = functionSignature.split(", ");
    var names = []
    var typeIndex = 0
    var addressIndex = 0
    var uint256Index = 0
    var stringIndex = 0
    var bytesIndex = 0

    for(var param of params) {
        var typeName = param.split(" ");
        if(typeName[0].trim() == "uint256") {
            names.push({name: typeName[1], tIndex: typeIndex, rawType: typeName[0].trim()})
            uint256Index++
        } else if(typeName[0].trim() == "string") {
            names.push({name: typeName[1], tIndex: typeIndex, rawType: typeName[0].trim()})
            stringIndex++
        } else if(typeName[0].trim() == "address") {
            names.push({name: typeName[1], tIndex: typeIndex, rawType: typeName[0].trim()})
            addressIndex++
        } else if(typeName[0].trim() == "bytes") {
            names.push({name: typeName[1], tIndex: typeIndex, rawType: typeName[0].trim()})
            bytesIndex++
        }
        typeIndex++
    }

    return names
}

/**
 * Parses tracker references in a rule condition string and adds them to the argument list.
 * 
 * @param condition - The rule condition string.
 * @param nextIndex - The next available index for placeholders.
 * @param names - An array of argument placeholders.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 */
export function parseTrackers(condition: string, names: any[], indexMap: trackerIndexNameMapping[]) {
    const trRegex = /TR:[a-zA-Z]+/g
    const truRegex = /TRU:[a-zA-Z]+/g
    var matches = condition.match(trRegex)

    if(matches != null) {
        var uniq = [...new Set(matches)];
        for(var match of uniq!) {
            var type = "address"
            var index = 0
            for(var ind of indexMap){
                if(("TR:"+ind.name) == match) {
                    index = ind.id
                    if(ind.type == 0) {
                        type = "address"
                    } else if(ind.type == 1) {
                        type = "string"
                    } else if(ind.type == 5) {
                        type = "bytes"
                    } else {
                        type = "uint256"
                    }
                }
            }
            names.push({name: match, tIndex: index, rawType: "tracker", rawTypeTwo: type})
        }
    }

    var matchesUpdate = condition.match(truRegex)

    if(matchesUpdate != null) {
        var uniq = [...new Set(matchesUpdate)];
        for(var match of uniq!) {
            var index = 0
            match = match.replace("TRU:", "TR:")
            for(var ind of indexMap){
                if(("TR:"+ind.name) == match) {
                    index = ind.id
                }
            }
            names.push({name: match, tIndex: index, rawType: "tracker"})
        }
    } 
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
 * @returns The updated condition string with FC expressions replaced by placeholders.
 *
 * @remarks
 * - FC expressions are identified using the regular expression `/FC:[a-zA-Z]+\([^)]+\)/g`.
 * - If an FC expression is already present in the `names` array, its existing placeholder
 *   is reused.
 * - Each new FC expression is assigned a unique placeholder in the format `FC:<index>`.
 */
function parseForeignCalls(condition: string, names: any[], foreignCallNameToID: FCNameToID[]) {
    let iter = 0
    // Use a regular expression to find all FC expressions
    const fcRegex = /FC:[a-zA-Z]+\([^)]+\)/g
    const matches = condition.matchAll(fcRegex);
    let processedCondition = condition
    // Convert matches iterator to array to process all at once
    for (const match of matches) {
        const fullFcExpr = match[0];
        
        if (names.indexOf(match) !== -1) {
            let ph = names[names.indexOf(match)].fcPlaceholder
            processedCondition = processedCondition.replace(fullFcExpr, ph)
            continue
        }
        // Create a unique placeholder for this FC expression
        var placeholder = `FC:${iter}`;
        for(var existing of names) {
            if(existing.name == fullFcExpr) {
                placeholder = existing.fcPlaceholder
            }
        }
        
        processedCondition = processedCondition.replace(fullFcExpr, placeholder);
        var alreadyFound = false
        for(var existing of names) {
            if(existing.name == fullFcExpr) {
                alreadyFound = true
                break
            }
        }
        if(!alreadyFound) {

            var index = 0
            for(var fcMap of foreignCallNameToID) {
                if(("FC:" + fcMap.name.split('(')[0]) == fullFcExpr.split('(')[0]) {

                    index = fcMap.id
                }
            }
            names.push({name: match, tIndex: index, rawType: "foreign call", fcPlaceholder: placeholder})
        }
        iter++;
    }

    condition = processedCondition
    return condition
}

// --------------------------------------------------------------------------------------------------
// Internal Helper Functions
// --------------------------------------------------------------------------------------------------
/**
 * Interprets an arithmetic operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The arithmetic operator symbol (e.g., "+", "-", "*", "/") to use in the operation.
 * @returns The string representation of the arithmetic operation if `currentActionIndex` is 1, otherwise an empty string.
 */
function arithmeticOperatorReverseInterpretation(instruction: number, currentMemAddress: number, memAddressesMap: any[], 
    currentActionIndex: number, currentInstructionValues: any[], symbol: string) {
    for(var memValue of memAddressesMap) {
        if(memValue.memAddr == instruction) {
            currentInstructionValues.push(memValue.value)
        }
    }
    if(currentActionIndex == 1) {
        var currentString = currentInstructionValues[0] + symbol + currentInstructionValues[1]
        memAddressesMap.push({memAddr: currentMemAddress, value: currentString})
        return currentString
    }
    return ""
}

/**
 * Interprets a logical operation in reverse by mapping memory addresses to their values
 * and constructing a string representation of the operation.
 *
 * @param instruction - The memory address of the instruction to interpret.
 * @param currentMemAddress - The current memory address where the result will be stored.
 * @param memAddressesMap - An array of objects mapping memory addresses to their values.
 * @param currentActionIndex - The index of the current action being processed.
 * @param currentInstructionValues - An array to store the values of the current instruction.
 * @param symbol - The logical operator symbol (e.g., "&&", "||") used in the operation.
 * @returns The string representation of the logical operation if `currentActionIndex` is 1,
 *          otherwise an empty string.
 */
function logicalOperatorReverseInterpretation(instruction: number, currentMemAddress: number, memAddressesMap: any[], 
    currentActionIndex: number, currentInstructionValues: any[], symbol: string) {
    for(var memValue of memAddressesMap) {
        if(memValue.memAddr == instruction) {
            currentInstructionValues.push(memValue.value)
        }
    }
    if(currentActionIndex == 1) {
        var currentString = "( " + currentInstructionValues[0] + symbol + currentInstructionValues[1] + " )"
        memAddressesMap.push({memAddr: currentMemAddress, value: currentString})
        return currentString
    }
    return ""
}

/**
 * Builds an individual mapping for a function call argument and adds it to the provided mappings array.
 * 
 * @param parameter - The parameter string to check against the argument tracker name.
 * @param argumentIterator - The index of the current argument being processed.
 * @param argTracker - An object containing metadata about the argument being tracked, including its name and raw type.
 * @param mappings - An array to which the constructed `IndividualArugmentMapping` will be added.
 * @param tracker - A boolean value indicating whether the tracker is active.
 * @returns A boolean indicating whether the mapping was successfully created and added to the mappings array.
 */
function buildIndividualMapping(parameter: string, argumentIterator: number, argTracker: any, mappings: IndividualArugmentMapping[], tracker: boolean) {
    if (parameter.includes(argTracker.name)) {
        var enumer = 0
        for(var pType of PT) {
            if(pType.name == argTracker.rawType) {
                enumer = pType.enumeration
            }
        }
        var placeholder: PlaceholderStruct = {
            pType: enumer,
            typeSpecificIndex: argumentIterator,
            trackerValue: tracker,
            foreignCall: false
        }
        var individualMapping: IndividualArugmentMapping = {
            functionCallArgumentType: enumer,
            functionSignatureArg: placeholder
        }
        mappings.push(individualMapping)
        return true
    }
    return false
}

/**
 * Interprets a given syntax string into an instruction set and placeholders.
 * 
 * This function processes a syntax string by constructing an Abstract Syntax Tree (AST),
 * splitting it based on logical operators (AND/OR), and recursively iterating over the tree
 * to generate an instruction set. It also handles placeholders and maps indices for tracking.
 * 
 * @param syntax - The input syntax string to be interpreted.
 * @param names - An array of names used in the instruction set.
 * @param indexMap - A mapping of tracker indices to names.
 * @param existingPlaceHolders - An array of existing placeholders to be considered.
 * 
 * @returns An object containing:
 * - `instructionSet`: The generated instruction set based on the input syntax.
 * - `placeHolders`: The placeholders used in the instruction set.
 */
function interpretToInstructionSet(syntax: string, names: any[], indexMap: trackerIndexNameMapping[], existingPlaceHolders: PlaceholderStruct[]) {
        // Create the initial Abstract Syntax Tree (AST) splitting on AND
        var array = convertToTree(syntax, "AND")
        if(array.length == 0) {
            // If array is empty the top level conditional must be an OR instead of an AND
            array = convertToTree(syntax, "OR")
        }
        
        if(array.length == 1) {
            array = array[0]
        } else if(array.length == 0) {
            // If the array is still empty than a single top level statement without an AND or OR was used.
            array.push(syntax)
        }
        
        if(array.length > 0) {
            // Recursively iterate over the tree splitting on the available operators
            for(var matchCase of matchArray) {
                iterate(array, matchCase)
            }
            removeArrayWrappers(array)
            intify(array)
        }
        var instructionSet: any[] = []
        var mem: any[] = []
        var placeHolders: PlaceholderStruct[] = []
        const iter = { value: 0 };
        // Convert the AST into the Instruction Set Syntax 
        plhIndex = 0
        convertToInstructionSet(instructionSet, mem, array, iter, names, existingPlaceHolders, indexMap)
        return {instructionSet: instructionSet, placeHolders: placeHolders}
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
function parseEffect(effect: string, names: any[], placeholders: PlaceholderStruct[], indexMap: trackerIndexNameMapping[]) {
    var effectType = EffectType.REVERT
    var effectText = ""
    var effectInstructionSet: any[] = []
    const revertTextPattern = /(revert)\("([^"]*)"\)/;
    var pType = 2
    var parameterValue: any = 0
    if(effect.includes("emit")) {
        effectType = EffectType.EVENT
        var placeHolder = effect.replace("emit ", "").trim()
        var spli = placeHolder.split(", ")
        if(spli.length > 1) {
            effectText = spli[0]
            if(isAddress(spli[1].trim())) {
                pType = 0
                parameterValue = spli[1].trim()
            } else if(!isNaN(Number(spli[1].trim()))) {
                pType = 2
                parameterValue = BigInt(spli[1].trim())
            } else {
                pType = 1
                parameterValue = spli[1].trim() 
            }
        } else {
            effectText = spli[0]

        }
    } else if (effect.includes("revert")) {
        effectType = EffectType.REVERT
        const match = effect.match(revertTextPattern);
        effectText = match ? match[2] : "";
    } else {
        effectType = EffectType.EXPRESSION
        var effectStruct = interpretToInstructionSet(effect, names, indexMap, placeholders)
        effectInstructionSet = effectStruct.instructionSet

    }

    return {type: effectType, text: effectText, instructionSet: effectInstructionSet, pType: pType, parameterValue: parameterValue}
}

/**
 * Converts a logical condition string into a tree-like syntax array representation.
 * This function processes the input string by handling parenthesis and splitting
 * based on a specified delimiter, ultimately constructing a nested array structure
 * that represents the logical condition.
 *
 * @param condition - The logical condition string to be converted into a tree structure.
 *                     Example: "(A AND B) OR C".
 * @param splitOn - The delimiter used to split the condition string. Typically a logical operator
 *                  such as "AND" or "OR".
 * @returns A nested array representing the tree structure of the logical condition.
 *          Example: ["OR", ["AND", ["A"], ["B"]], ["C"]].
 */
function convertToTree(condition : string, splitOn : string) {
    // Recursive Function steps:
    // 1. Replace anything in parenthesis with i:n
    var substrs = new Array()

    var delimiterSplit = condition.split(splitOn)

    let iter = 0

    let leng = condition.split('(').length

    while(iter <= (leng - 2)) {

        // Start with the final instance of "(" in the string, create a substring
        // to the next instance of ")" and replace that with i:n
        // Repeat this process until all parenthesis have been accounted for
        var start = condition.lastIndexOf("(")
        var substr = condition.substring(start, condition.indexOf(")", start) + 1)
        condition = condition.replace(substr, "i:".concat(iter.toString()))
        var index = "i:".concat(iter.toString())
        var tuple: Tuple = { i: index, s: substr }
        substrs.push(tuple)
        iter++
    }

    // 2. Split based on the passed in delimiter (splitOn)
    var delimiterSplit = condition.split(" " + splitOn + " ")
    // 3. Convert to syntax array
    // Start from the back of the array and work forwards
    var endIndex = delimiterSplit.length - 1

    var overAllArray = new Array()
    while (endIndex > 0) {
        if(endIndex >= 1) {
            var innerArray = new Array()
            // Retrieve the contents of the parenthesis for the last two i:n values
            var actualValue = retrieveParenthesisContent(delimiterSplit[endIndex - 1], substrs) 
            var actualValueTwo = retrieveParenthesisContent(delimiterSplit[endIndex], substrs) 
        
            if(actualValue.startsWith('(')) {
                actualValue = actualValue.substring(1, actualValue.length - 1)
            }

            if(actualValueTwo.startsWith('(')) {
                actualValueTwo = actualValueTwo.substring(1, actualValueTwo.length - 1)
            }
            // Add the contents to an inner array
            var innerArrayTwo = new Array()
            innerArray.push(actualValue)
            innerArrayTwo.push(actualValueTwo)
            // If this is the first entry in the overall array, add the values in an array wrapper
            // otherwise add them directly
            if(overAllArray.length == 0) {
                var outerArray = new Array()
                outerArray.push(splitOn)
                outerArray.push(innerArray)
                outerArray.push(innerArrayTwo)
                overAllArray.unshift(outerArray)
            } else {
                overAllArray.unshift(innerArrayTwo)
                overAllArray.unshift(innerArray)
                overAllArray.unshift(splitOn)
            }
            endIndex -= 2
        }
        // Slightly modified process for the final index in the array
        if(endIndex == 0) {
            var innerArray = new Array()
            var actualValue = retrieveParenthesisContent(delimiterSplit[endIndex], substrs)
            if(actualValue.includes('(')) {
                actualValue = actualValue.substring(1, actualValue.length - 1)
            }
            innerArray.push(actualValue)
            var outerArray = new Array()
            overAllArray.unshift(innerArray)
            overAllArray.unshift(splitOn)
            endIndex -= 1
        }
    }
    return overAllArray

}

/**
 * Iterates through an array and processes its elements based on a specified delimiter.
 * If an element contains the delimiter, it is converted into a tree structure using `convertToTree`.
 * The function handles nested arrays recursively.
 *
 * @param array - The array to iterate over and process. Can contain nested arrays.
 * @param splitOn - The delimiter string used to split and process elements in the array.
 */
function iterate(array: any[], splitOn: string) {
    var iter = 0
    
    while(iter < array.length) {
        if(!Array.isArray(array[iter])) {
            var checkVal = " " + splitOn + " "
            if(array[iter].includes(checkVal)) {
                var output = convertToTree(array[iter], splitOn)
                if(output.length > 0) {
                    if(output.length == 1) {
                        output = output[0]
                    }
                    array.splice(iter, 1, output[0])
                }
                if(output.length > 1) {
                    var iterTwo = 1
                    while(iterTwo < output.length) {
                        array.splice(iter+iterTwo, 0, output[iterTwo])
                        iterTwo++
                    }
                }
                iter -= 1
            }
        } else {
            if(array[iter].length > 0) {
                iterate(array[iter], splitOn)
            }
        }

        iter += 1
    }
}

/**
 * Retrieves and processes the content within parentheses from a given string
 * based on a list of tuples. If the content includes a specific pattern (`i:`),
 * it recursively resolves the content using the provided tuples.
 *
 * @param str - The input string to process.
 * @param tuples - An array of `Tuple` objects, where each tuple contains
 *                 a key (`i`) and a substitution value (`s`).
 * @returns The processed string with resolved content from the tuples.
 */
function retrieveParenthesisContent(str: string, tuples: Tuple[]) {
    var actualValue = str
    var iter = 0
    while(iter < tuples.length) {
        let tuple: Tuple = tuples[iter]
        if(str.includes(tuple.i)) {
            actualValue = tuple.s
            if(actualValue.includes('i:')) {
                var substr = actualValue.substring(actualValue.indexOf("i:"), actualValue.indexOf('i:') + 3)
                actualValue = actualValue.replace(substr, retrieveParenthesisContent(substr, tuples))
            }
            break
        }
        iter++
    }
    return actualValue
}

/**
 * Recursively removes unnecessary array wrappers from a nested array structure.
 * If an element in the array is itself an array with only one element, it replaces
 * that element with its single value. If the element is a nested array with more
 * than one element, the function is called recursively on that nested array.
 *
 * @param array - The array to process, which may contain nested arrays.
 */
function removeArrayWrappers(array: any[]) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            if(array[iter].length == 1) {
                array[iter] = array[iter][0]
            } else {
                removeArrayWrappers(array[iter])
            }
        }
        iter++
    }
}

/**
 * Recursively converts elements of an array to `BigInt` where applicable.
 * 
 * This function traverses through the provided array and its nested arrays.
 * If an element is determined to be an address (via the `isAddress` function),
 * it is converted to a `BigInt`. If the element is numeric and not an address,
 * it is also converted to a `BigInt`. Non-numeric and non-address elements
 * remain unchanged.
 * 
 * @param array - The array to process. Can contain nested arrays and elements
 *                of any type.
 */
function intify(array: any[]) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            intify(array[iter])
         } else {
            if(isAddress(array[iter])) {
                array[iter] = BigInt(array[iter])
            } else {
                if(!isNaN(Number(array[iter]))) {
                    array[iter] = BigInt(array[iter])
                } 
        }
                
        }
        iter++
    }
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
function buildRawData(instructionSet: any[], excludeArray: string[], rawDataArray: any[]) {
    var raw : RawData
    var instructionSetArray: number[] = []
    var argumentTypes: number[] = [] // string: 1
    var dataValues: ByteArray[] = []
    let iter = 0
    while(iter < instructionSet.length) {
            // Only capture values that aren't naturally numbers
            if(!isNaN(Number(instructionSet[iter]))) {
                instructionSet[iter] = BigInt(instructionSet[iter])
            } else {
                if (!excludeArray.includes(instructionSet[iter].trim())) {
                    const currentInstruction = instructionSet[iter].trim();
                
                    // Determine if the current instruction is a bytes type (hex string starting with "0x")
                    const isBytes = currentInstruction.startsWith('0x');
                
                    // Create the raw data entry
                    rawDataArray.push({
                        rawData: currentInstruction,
                        iSetIndex: iter,
                        dataType: isBytes ? "bytes" : "string"
                    });
                    instructionSetArray.push(iter);
                    argumentTypes.push(isBytes ? 2 : 1); // Use 2 for bytes, 1 for string
                    dataValues.push(isBytes ? toBytes(currentInstruction) : toBytes(currentInstruction));
                
                    if (!operandArray.includes(currentInstruction)) {
                        // Convert the string or bytes to a keccak256 hash then to a uint256
                        instructionSet[iter] = BigInt(keccak256(encodeAbiParameters(
                            parseAbiParameters(isBytes ? 'bytes' : 'string'),
                            [currentInstruction]
                        )));
                    }
                }
            } 
        iter++
    }
    raw = {
        instructionSetIndex: instructionSetArray,
        argumentTypes: argumentTypes,
        dataValues: dataValues
    }
    return raw
}
var plhIndex = 0
var truIndex = -1

/**
 * Converts an AST into an instruction set syntax.
 * 
 * @param retVal - The resulting instruction set.
 * @param mem - The memory map for the instruction set.
 * @param expression - The AST to convert.
 * @param iterator - An iterator for tracking memory locations.
 * @param parameterNames - An array of argument placeholders.
 * @param placeHolders - An array to store placeholders.
 * @param indexMap - A mapping of tracker IDs to their names and types.
 */
function convertToInstructionSet(retVal: any[], mem: any[], expression: any[], iterator: { value: number }, parameterNames: any[], placeHolders: PlaceholderStruct[], indexMap: trackerIndexNameMapping[]) { 
    if (!expression || expression.length === 0) {
        return;
    }

    // If it's a number add it directly to the instruction set and store its memory location in mem
    if(typeof expression == "number" || typeof expression == "bigint") {
        retVal.push("N")
        retVal.push(BigInt(expression))
        mem.push(iterator.value)
        iterator.value += 1
    // If it's an array with a string as the first index, recursively run starting at the next index
    // Then add the the string and the two memory addresses generated from the recusive run to the instruction set 
    } else if(typeof expression[0] == "string") {
        var foundMatch = false

        for(var parameter of parameterNames) {
            
            if(parameter.name == expression[0].trim()) {
                foundMatch = true
                var plhIter = 0
                var copyFound = false
                for(var place of placeHolders) {
                    if(place.typeSpecificIndex == parameter.tIndex && !place.foreignCall && !place.trackerValue) {
                        retVal.push("PLH")
                        retVal.push(plhIter)
                        copyFound = true
                        break
                    }
                    plhIter += 1
                    
                }
                if(!copyFound) { 
                    retVal.push("PLH")
                    retVal.push(plhIndex)
                    plhIndex += 1
                    var placeHolderEnum = 0
                    var tracker = false
                    if(parameter.rawType == "address") {
                        placeHolderEnum = 0
                    } else if (parameter.rawType == "string") {
                        placeHolderEnum = 1
                    } else if(parameter.rawType == "uint256") {
                        placeHolderEnum = 2
                    } else if(parameter.rawType == "bytes") {
                        placeHolderEnum = 5
                    } else if(parameter.rawType == "tracker") {
                        if(parameter.rawTypeTwo == "address") {
                            placeHolderEnum = 0
                        } else if(parameter.rawTypeTwo == "string") {
                            placeHolderEnum = 1
                        } else if(parameter.rawTypeTwo == "bytes") {
                            placeHolderEnum = 5
                        } else {
                            placeHolderEnum = 2
                        }
                        tracker = true
                    }

                    var placeHolder : PlaceholderStruct = {
                        pType: placeHolderEnum,
                        typeSpecificIndex: parameter.tIndex,
                        trackerValue: tracker,
                        foreignCall: false
                    }
                    placeHolders.push(placeHolder)
                }
                var sliced = expression.slice(1)
                mem.push(iterator.value)
                iterator.value += 1
                convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
            } else if(parameter.fcPlaceholder) {
                if(parameter.fcPlaceholder == expression[0].trim()) {
                    foundMatch = true
                    retVal.push("PLH")
                    retVal.push(plhIndex)
                    plhIndex += 1
                    var found = false
                    for(var pHold of placeHolders) {
                        if(pHold.foreignCall && pHold.typeSpecificIndex == parameter.tIndex) {
                            found = true
                        }
                    }
                    if(!found) {
                        var placeHolder : PlaceholderStruct = {
                            pType: 0,
                            typeSpecificIndex: parameter.tIndex,
                            trackerValue: false,
                            foreignCall: true
                        }
                        placeHolders.push(placeHolder)
                    }
                    var sliced = expression.slice(1)
                    mem.push(iterator.value)
                    iterator.value += 1
                    convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
                }
            } else if(expression[0].trim().includes('TRU:')) {
                foundMatch = true
                var trackerName = expression[0].replace('TRU:', 'TR:')
                var values = trackerName.split(' ')

                if(values[1] == parameter.name) {
                    retVal.push("PLH")
                    retVal.push(plhIndex)
                    plhIndex += 1

                    var placeHolder : PlaceholderStruct = {
                        pType: 0,
                        typeSpecificIndex: parameter.tIndex,
                        trackerValue: true,
                        foreignCall: false
                    }

                    for(var ind of indexMap) {
                        if(parameter.name == "TR:"+ind.name) {
                            truIndex = ind.id 
                        }
                    }
                    
                    placeHolders.push(placeHolder)
                    var sliced = expression.slice(1)
                    mem.push(iterator.value)
                    iterator.value += 1
                    convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)

                }
            }
        }
        if(!foundMatch) {
            if(matchArray.includes(expression[0].trim()) ) {
                foundMatch = true
                var sliced = expression.slice(1)
                convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
                if(truMatchArray.includes(expression[0].trim())) {
                    switch(expression[0].trim()) {
                        case '+=':
                            retVal.push('+')
                            break
                        case '-=':
                            retVal.push('-')
                            break
                        case '*=':
                            retVal.push('*')
                            break
                        case '/=':
                            retVal.push('/')
                            break
                        case '=':
                            retVal.push('=')
                            break
                    }
                } else {
                    retVal.push(expression[0])
                }
                retVal.push(mem[mem.length - 2])
                retVal.push(mem[mem.length - 1])
                mem.pop()
                mem.pop()
                
                if(truMatchArray.includes(expression[0].trim())) {
                    retVal.push('TRU')
                    retVal.push(truIndex)
                    retVal.push(iterator.value)
                    // Currently only supporting Memory type need to expand to support placeholder usage in tracker updates
                    retVal.push(0)
                } else {
                    mem.push(iterator.value)
                }
                iterator.value += 1
            }
        }
        if(!foundMatch) {
            retVal.push("N")
            retVal.push(expression[0].trim())
            var sliced = expression.slice(1)
            mem.push(iterator.value)
            iterator.value += 1
            convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
        }

    // If it's an array with a number as the first index, add the number to the instruction set, add its memory
    // location to the memory map and recursively run starting at the next index
    } else if (typeof expression[0] == "number" || typeof expression[0] == "bigint") {
        retVal.push("N")
        retVal.push(BigInt(expression[0]))
        var sliced = expression.slice(1)
        mem.push(iterator.value)
        iterator.value += 1
        convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
    // If it's an array with a nested array as the first index recursively run with the nested array, update the memory map 
    // and recursively run starting at the next index
    } else if(Array.isArray(expression[0])) {
        convertToInstructionSet(retVal, mem, expression[0], iterator, parameterNames, placeHolders, indexMap)
        expression = expression.slice(1)
        convertToInstructionSet(retVal, mem, expression, iterator, parameterNames, placeHolders, indexMap)
    }
    return plhIndex
}


/**
 * Cleans a given string by removing line breaks, reducing multiple spaces to a single space,
 * and trimming leading and trailing whitespace.
 *
 * @param str - The input string to be cleaned.
 * @returns The cleaned string with normalized whitespace.
 */
export function cleanString(str: string) {
    return str.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Cleans up a given string by removing unnecessary parentheses and replacing specific patterns
 * with placeholders for later restoration. The function processes two types of patterns:
 * 1. Substrings starting with "FC:" and ending with a closing parenthesis.
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
function removeExtraParenthesis(strToClean: string) {
    var holders: string[] = []
    var fcHolder: string[] = []
    var iter = 0

    while(strToClean.includes('FC:')) {
        var initialIndex = strToClean.lastIndexOf('FC:')
        var closingIndex = strToClean.indexOf(')', initialIndex)
        var sub = strToClean.substring(initialIndex, closingIndex + 1)
        fcHolder.push(sub)
        var replacement = "fcRep:" + iter
        iter += 1
        strToClean = strToClean.replace(sub, replacement)
    }

    iter = 0
    while(strToClean.includes('(')) {
        var initialIndex = strToClean.lastIndexOf('(')
        var closingIndex = strToClean.indexOf(')', initialIndex)
        var sub = strToClean.substring(initialIndex, closingIndex + 1)
        var removed = false

        if(sub.includes('AND') || sub.includes('OR')) {
            holders.push(sub)
            var replacement = "rep:" + iter
            iter += 1
            strToClean = strToClean.replace(sub, replacement)
        } else {
            removed = true
            strToClean = strToClean.substring(0, initialIndex) + '' + strToClean.substring(initialIndex + 1);
            strToClean = strToClean.substring(0, closingIndex - 1) + '' + strToClean.substring(closingIndex);
        }
    }
    
    var replaceCount = 0
    while(replaceCount < holders.length) {
        iter = 0
        for(var hold of holders) {
            var str = "rep:" + iter
            if(strToClean.includes(str)) {
                strToClean = strToClean.replace(str, holders[iter])
                replaceCount += 1
            }
            iter += 1
        }
    }
    iter = 0
    for(var hold of fcHolder) {
        var str = "fcRep:" + iter
        strToClean = strToClean.replace(str, fcHolder[iter])
        iter += 1
    }
    return strToClean
}

// --------------------------------------------------------------------------------------------------
