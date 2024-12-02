import { keccak256, hexToNumber, encodePacked } from 'viem';

type Tuple = {
    i: string;
    s: string;
  }

const matchArray: string[] = ['OR', 'AND', '==', '>=', '>', '<', '<=', '+', '-', '/', '*']
const operandArray: string[] = ['PLH', 'N']

export function parseSyntax(syntax: string) {
    // Split the initial syntax string into condition, effect and function signature 
    var initialSplit = syntax.split('-->')
    var condition = initialSplit[0]

    var functionSignature = initialSplit[2]
    var names = parseFunctionArguments(functionSignature)

    // Create the initial Abstract Syntax Tree (AST) splitting on AND
    var array = convertToTree(condition, "AND")
    if(array.length == 0) {
        // If array is empty the top level conditional must be an OR instead of an AND
        array = convertToTree(condition, "OR")
    }

    if(array.length == 1) {
        array = array[0]
    } else if(array.length == 0) {
        // If the array is still empty than a single top level statement without an AND or OR was used.
        array.push(condition)
    }
    
    if(array.length > 0) {
        // Recursively iterate over the tree splitting on the available operators
        for(var matchCase of matchArray) {
            iterate(array, matchCase)
        }
        removeArrayWrappers(array)
        intify(array)
    }

    var retVal = []
    var mem = []
    const iter = { value: 0 };
    // Convert the AST into the Instruction Set Syntax 
    convertToInstructionSet(retVal, mem, array, iter, names)
    
    var excludeArray = []
    for(var name of names) {
        excludeArray.push(name.name)
    }

    excludeArray.push(...matchArray)
    excludeArray.push(...operandArray)
    var rawData = []
    buildRawData(retVal, excludeArray, rawData)

    return {instructionSet: retVal, rawData: rawData}
}

// Parse the function signature string and build the placeholder data structure
function parseFunctionArguments(functionSignature: string) {
    var start = functionSignature.lastIndexOf("(")
    var substr = functionSignature.substring(start+1, functionSignature.indexOf(")", start))
    var params = substr.split(", ");
    var names = []
    var typeIndex = 0
    var addressIndex = 0
    var uint256Index = 0
    var stringIndex = 0
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
        }
        typeIndex++
    }
    return names
}

// Convert the original human-readable rules condition syntax to an Abstract Syntax Tree
function convertToTree(condition : string, splitOn : string) {
    // Recursive Function steps:
    // 1. Replace anything in parenthesis with i:n
    var substrs = new Array()
    var iter = 0
    var leng = condition.split('(').length
    var delimiterArray = []

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
    var delimiterSplit = condition.split(splitOn)

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
        
            if(actualValue.includes('(')) {
                actualValue = actualValue.substring(1, actualValue.length - 1)
            }

            if(actualValueTwo.includes('(')) {
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

// Iterate over the array and recursively split based on the splitOn delimiter 
function iterate(array, splitOn: string) {
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

// Replace the i: syntax with the original contents of the parenthesis
function retrieveParenthesisContent(str: string, tuples: Tuple[]) {
    var actualValue = str
    var iter = 0
    while(iter < tuples.length) {
        var tuple: Tuple = tuples[iter]
        if(str.includes(tuple.i)) {
            actualValue = tuple.s
            if(actualValue.includes('i:')) {
                var substr = actualValue.substring(actualValue.indexOf("i:"), actualValue.indexOf(':') + 2)
                actualValue = actualValue.replace(substr, retrieveParenthesisContent(substr, tuples))
            }
            break
        }
        iter++
    }
    return actualValue
}

// Remove extraneous array wrappers created during the recursion 
function removeArrayWrappers(array) {
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

// Replace string representations of numbers with actual numbers
function intify(array) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            intify(array[iter])
         } else {
            if(!isNaN(Number(array[iter]))) {
                array[iter] = Number(array[iter])
            } 
                
        }
        iter++
    }
}

// Build the rawData array that contains the string representations of strings and addresses and
// convert them to numbers in the instruction set.
function buildRawData(instructionSet, excludeArray, rawDataArray) {
    let iter = 0
    while(iter < instructionSet.length) {
            // Only capture values that aren't naturally numbers
            if(!isNaN(Number(instructionSet[iter]))) {
                instructionSet[iter] = Number(instructionSet[iter])
            } else {
                if(!excludeArray.includes(instructionSet[iter].trim())) {
                    // Create the raw data entry
                    rawDataArray.push({rawData: instructionSet[iter].trim(), iSetIndex: iter, dataType: "string"})
                    if(!operandArray.includes(instructionSet[iter].trim())) {
                        console.log(instructionSet[iter].trim())
                        // Convert the string to a keccak356 has then to a uint256
                        instructionSet[iter] = hexToNumber(keccak256(encodePacked(['string'], [instructionSet[iter].trim()])))
                    }
                }
            } 
        iter++
    }
}

// Convert AST to Instruction Set Syntax
function convertToInstructionSet(retVal, mem, expression, iterator: { value: number}, parameterNames) {
    // If it's a number add it directly to the instruction set and store its memory location in mem
    if(typeof expression == "number") {
        retVal.push("N")
        retVal.push(expression)
        mem.push(iterator.value)
        iterator.value += 1
    // If it's an array with a string as the first index, recursively run starting at the next index
    // Then add the the string and the two memory addresses generated from the recusive run to the instruction set 
    } else if(typeof expression[0] == "string") {
        var foundMatch = false
        for(var parameter of parameterNames) {
            if(parameter.name == expression[0].trim()) {
                foundMatch = true
    
                retVal.push("PLH")
                retVal.push(parameter.tIndex)
                var sliced = expression.slice(1)
                mem.push(iterator.value)
                iterator.value += 1
                convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames)
            }
        }
        if(!foundMatch) {
            if(matchArray.includes(expression[0].trim()) ) {
                foundMatch = true
                var sliced = expression.slice(1)
                convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames)
                retVal.push(expression[0])
                retVal.push(mem[mem.length - 2])
                retVal.push(mem[mem.length - 1])
                mem.pop()
                mem.pop()
                mem.push(iterator.value)
                iterator.value += 1
            }
        }
        
        if(!foundMatch) {
            retVal.push(expression[0].trim())
            var sliced = expression.slice(1)
            mem.push(iterator.value)
            iterator.value += 1
            convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames)
        }

    // If it's an array with a number as the first index, add the number to the instruction set, add its memory
    // location to the memory map and recursively run starting at the next index
    } else if (typeof expression[0] == "number") {
        retVal.push("N")
        retVal.push(expression[0])
        var sliced = expression.slice(1)
        mem.push(iterator.value)
        iterator.value += 1
        convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames)
    // If it's an array with a nested array as the first index recursively run with the nested array, update the memory map 
    // and recursively run starting at the next index
    } else if(Array.isArray(expression[0])) {
        convertToInstructionSet(retVal, mem, expression[0], iterator, parameterNames)
        expression = expression.slice(1)
        convertToInstructionSet(retVal, mem, expression, iterator, parameterNames)
    }
}