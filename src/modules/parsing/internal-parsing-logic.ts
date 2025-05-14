/// SPDX-License-Identifier: BUSL-1.1
import { isAddress } from "viem"
import { trackerIndexNameMapping, PlaceholderStruct, matchArray, truMatchArray, Tuple } from "../types"

/**
 * @file internal-parsing-logic.ts
 * @description This module contains the internal parsing logic used to convert human readable syntax to instruction set syntax
 * 
 * @module parser
 * 
 * @exports
 * - General functions for parsing human readable syntax into instruction set syntax
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license BUSL-1.1
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling the translation of human-readable
 *       rule definitions into machine-readable formats and vice versa.
 */

var truIndex = -1

// --------------------------------------------------------------------------------------------------
// Main Parsing Logic:
// Converting the Human Readable Expression syntax to the Executable Instruction set syntax takes
//   place in two major steps:
//   - Convert the Human Readable Expression syntax into an Abstrct Syntax Tree (AST)
//   - Convert the Abstract Syntax Tree into the Executable Instruction set syntax
// These two steps are captured in the following two functions:
//   - convertHumanReadableToInstructionSet
//   - convertASTToInstructionSet
// --------------------------------------------------------------------------------------------------

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
export function convertHumanReadableToInstructionSet(syntax: string, names: any[], indexMap: trackerIndexNameMapping[], existingPlaceHolders: PlaceholderStruct[]) {
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
        convertASTToInstructionSet(instructionSet, mem, array, iter, names, existingPlaceHolders, indexMap)
        return {instructionSet: instructionSet, placeHolders: placeHolders}
}

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
function convertASTToInstructionSet(retVal: any[], mem: any[], expression: any[], iterator: { value: number }, parameterNames: any[], placeHolders: PlaceholderStruct[], indexMap: trackerIndexNameMapping[]) { 
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
        var plhIndex = 0
        for(var parameter of parameterNames) {
            if(parameter.name == expression[0].trim()) {
                foundMatch = true
                var plhIter = 0
                var copyFound = false
                for(var place of placeHolders) {
                    // Check if the expression is an exact match for one of our placeholders
                    // This will cover all placeholders except foreign calls and tracker updates
                    // these two get their own cases (found below)
                    if(expression[0].trim().includes("TR:")) {
                        if(place.typeSpecificIndex == parameter.tIndex && !place.foreignCall && place.trackerValue) {
                            retVal.push("PLH")
                            retVal.push(plhIter)
                            copyFound = true
                            break
                        }
                    } else {
                        if(place.typeSpecificIndex == parameter.tIndex && !place.foreignCall && !place.trackerValue) {
                            retVal.push("PLH")
                            retVal.push(plhIter)
                            copyFound = true
                            break
                        }
                    }
                    plhIter += 1
                    
                }
                if(!copyFound) { 
                    retVal.push("PLH")
                    retVal.push(plhIndex)
                }
                var sliced = expression.slice(1)
                mem.push(iterator.value)
                iterator.value += 1
                convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
            } else if(parameter.fcPlaceholder) {
                if(parameter.fcPlaceholder == expression[0].trim()) {
                    foundMatch = true
                    retVal.push("PLH")
                    retVal.push(plhIndex)
                    var found = false
                    for(var pHold of placeHolders) {
                        if(pHold.foreignCall && pHold.typeSpecificIndex == parameter.tIndex) {
                            found = true
                        }
                    }
                    var sliced = expression.slice(1)
                    mem.push(iterator.value)
                    iterator.value += 1
                    convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
                } else {
                    plhIndex += 1
                }
            } else if(expression[0].trim().includes('TRU:')) {
                foundMatch = true
                var trackerName = expression[0].replace('TRU:', 'TR:')
                var values = trackerName.split(' ')
                var comparison = values[0]
                if(values.length > 1) {
                    comparison = values[1]
                }
                if(comparison == parameter.name) {
                    retVal.push("PLH")
                    retVal.push(plhIndex)

                    for(var ind of indexMap) {
                        if(parameter.name == "TR:"+ind.name) {
                            truIndex = ind.id 
                        }
                    }
                    
                    var sliced = expression.slice(1)
                    mem.push(iterator.value)
                    iterator.value += 1
                    convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)

                } else {
                    plhIndex += 1
                }
            } else {
                plhIndex += 1
            }
        }
        if(!foundMatch) {
            if(matchArray.includes(expression[0].trim()) ) {
                foundMatch = true
                var sliced = expression.slice(1)
                convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
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
            convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
        }

    // If it's an array with a number as the first index, add the number to the instruction set, add its memory
    // location to the memory map and recursively run starting at the next index
    } else if (typeof expression[0] == "number" || typeof expression[0] == "bigint") {
        retVal.push("N")
        retVal.push(BigInt(expression[0]))
        var sliced = expression.slice(1)
        mem.push(iterator.value)
        iterator.value += 1
        convertASTToInstructionSet(retVal, mem, sliced, iterator, parameterNames, placeHolders, indexMap)
    // If it's an array with a nested array as the first index recursively run with the nested array, update the memory map 
    // and recursively run starting at the next index
    } else if(Array.isArray(expression[0])) {
        convertASTToInstructionSet(retVal, mem, expression[0], iterator, parameterNames, placeHolders, indexMap)
        expression = expression.slice(1)
        convertASTToInstructionSet(retVal, mem, expression, iterator, parameterNames, placeHolders, indexMap)
    }
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