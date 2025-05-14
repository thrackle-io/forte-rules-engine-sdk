/// SPDX-License-Identifier: BUSL-1.1

import { stringReplacement, RuleStruct, ruleJSON, PT } from "../types"
import { parseFunctionArguments } from "./parsing-utilities"

/**
 * @file reverse-parsing-logic.ts
 * @description This module provides set of parsing utilities used to convert back from the instruction set syntax
 * to the original human readable syntax
 * 
 * @module parser
 * 
 * @exports
 * - Functions for reverse parsing rule syntax, trackers, foreign calls, and converting between formats.
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license BUSL-1.1
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

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