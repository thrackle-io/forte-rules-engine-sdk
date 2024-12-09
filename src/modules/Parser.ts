import { keccak256, hexToNumber, encodePacked, Address, getAddress, toFunctionSelector, toBytes, ByteArray } from 'viem';

type Tuple = {
    i: string;
    s: string;
  }

type ForeignCallDefinition = {
    name: string;
    address: Address;
    signature: ByteArray;
    parameterTypes: number[];
    policyId: number;
}

type PlaceholderStruct = {
    PTEnumeration: number;
    typeSpecificIndex: number;
    trackerValue: boolean;
    foreignCallReturnValue: boolean;
}

type IndividualArugmentMapping = {
    PTEnumeration: number;
    functionSignatureArg: PlaceholderStruct;
}

type ForeignCallArgumentMappings = {
    foreignCallIndex: number;
    mappings: IndividualArugmentMapping[];
}

type FunctionArgument = {
    name: string
    tIndex: number
    rawType: string
}

type TrackerDefinition = {
    name: string
    rawType: string
}

const matchArray: string[] = ['OR', 'AND', '==', '>=', '>', '<', '<=', '+', '-', '/', '*']
const operandArray: string[] = ['PLH', 'N']
const supportedTrackerTypes: string[] = ['uint256', 'string', 'address']
const PT = [ {name: 'address', enumeration: 0}, {name: 'string', enumeration: 1}, {name: 'uint256', enumeration: 2}, {name: 'bool', enumeration: 3}, 
    {name: 'void', enumeration: 4}, {name: 'bytes', enumeration: 5} ]
const FC_PREFIX: string = 'FC:'

export function parseTrackerSyntax(syntax: string) {
    var initialSplit = syntax.split('-->')
    if(initialSplit.length != 4) {
        throw new Error("Incorrect Tracker Definition Syntax")
    }
    let trackerName = initialSplit[0]
    let trackerType = initialSplit[1].trim()
    if(!supportedTrackerTypes.includes(trackerType)) {
        throw new Error("Unsupported type")
    }
    var trackerDefaultValue: any
    if(trackerType == "uint256" || trackerType == "address") {
        if(!isNaN(Number(initialSplit[2]))) {
            trackerDefaultValue = Number(initialSplit[2])
        } else {
            throw new Error("Default Value doesn't match type")
        }
    } else {
        trackerDefaultValue = initialSplit[2].trim()
    }

    var trackerPolicyId = 0
    if(!isNaN(Number(initialSplit[3]))) {
        trackerPolicyId = Number(initialSplit[3])
    } else {
        throw new Error("policy Id must be an integer")
    }

    return {name: initialSplit[0].trim(), type: trackerType, defaultValue: trackerDefaultValue, policyId: trackerPolicyId}
}

export function parseForeignCallDefinition(syntax: string) {
    var initialSplit = syntax.split('-->')
    if(initialSplit.length != 6) {
        throw new Error("Incorrect Foreign Call Syntax")
    }
    var address: Address = getAddress(initialSplit[1].trim())
    var signature = toBytes(toFunctionSelector(initialSplit[2].trim()))
    var returnType = 4 // default to void
    if(!PT.some(parameter => parameter.name === initialSplit[3].trim())) {
        throw new Error("Unsupported return type")
    }
    for(var parameterType of PT) {
        if(parameterType.name == initialSplit[3].trim()) {
            returnType = parameterType.enumeration
        }
    }
    var parameterTypes: number[] = []
    var parameterSplit = initialSplit[4].trim().split(',')
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

    return {name: initialSplit[0].trim(), address: address, signature: signature, 
        returnType: returnType, parameterTypes: parameterTypes, policyId: Number(initialSplit[5].trim())} as ForeignCallDefinition
}

export function buildForeignCallArgumentMapping(fCalls: string[], argumentNames: FunctionArgument[], trackers: TrackerDefinition[]) {
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
        var foreignCallMappings : ForeignCallArgumentMappings = {
            foreignCallIndex: 0,
            mappings: mappings
        }
        return foreignCallMappings
    }
}

function buildIndividualMapping(parameter: string, argumentIterator: number, argTracker: any, mappings: IndividualArugmentMapping[], tracker: boolean) {
    if (parameter.includes(argTracker.name)) {
        var enumer = 0
        for(var pType of PT) {
            if(pType.name == argTracker.rawType) {
                enumer = pType.enumeration
            }
        }
        var placeholder: PlaceholderStruct = {
            PTEnumeration: enumer,
            typeSpecificIndex: argumentIterator,
            trackerValue: tracker,
            foreignCallReturnValue: false
        }
        var individualMapping: IndividualArugmentMapping = {
            PTEnumeration: enumer,
            functionSignatureArg: placeholder
        }
        mappings.push(individualMapping)
        return true
    }
    return false
}

export function parseSyntax(syntax: string) {
    // Split the initial syntax string into condition, effect and function signature 
    syntax = cleanString(syntax)
    var initialSplit = syntax.split('-->')
    var condition = initialSplit[0]

    var functionSignature = initialSplit[2]

    var names = parseFunctionArguments(functionSignature)
    condition = parseForeignCalls(condition, names.length, names)
    parseTrackers(condition, names.length, names)

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

    var retVal: any[] = []
    var mem: any[] = []
    const iter = { value: 0 };
    // Convert the AST into the Instruction Set Syntax 
    convertToInstructionSet(retVal, mem, array, iter, names)//, FCs)
    var excludeArray = []
    for(var name of names) {
        excludeArray.push(name.name)
    }

    excludeArray.push(...matchArray)
    excludeArray.push(...operandArray)
    var rawData: any[] = []
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

function parseTrackers(condition: string, nextIndex: number, names: any[]) {
    const trRegex = /TR:[a-zA-Z]+/g
    var matches = condition.match(trRegex)

    if(matches != null) {
        var uniq = [...new Set(matches)];
        for(var match of uniq!) {
            names.push({name: match, tIndex: nextIndex, rawType: "tracker"})
            nextIndex++
        }
    }
}

function parseForeignCalls(condition: string, nextIndex: number, names: any[]) {
    let iter = 0
    // Use a regular expression to find all FC expressions
    const fcRegex = /FC:[a-zA-Z]+\([^)]+\)/g
    const matches = condition.matchAll(fcRegex);
    let processedCondition = condition
    // Convert matches iterator to array to process all at once
    for (const match of matches) {
        const fullFcExpr = match[0];
        
        // Create a unique placeholder for this FC expression
        const placeholder = `FC:${iter}`;
        processedCondition = processedCondition.replace(fullFcExpr, placeholder);
        names.push({name: match, tIndex: nextIndex, rawType: "foreign call", fcPlaceholder: placeholder})
        iter++;
        nextIndex++;
    }

    condition = processedCondition
    return condition
}

// Convert the original human-readable rules condition syntax to an Abstract Syntax Tree
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

// Iterate over the array and recursively split based on the splitOn delimiter 
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

// Remove extraneous array wrappers created during the recursion 
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

// Replace string representations of numbers with actual numbers
function intify(array: any[]) {
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
function buildRawData(instructionSet: any[], excludeArray: string[], rawDataArray: any[]) {
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
                        // Convert the string to a keccak356 has then to a uint256
                        instructionSet[iter] = hexToNumber(keccak256(encodePacked(['string'], [instructionSet[iter].trim()])))
                    }
                }
            } 
        iter++
    }
}

// Convert AST to Instruction Set Syntax
function convertToInstructionSet(retVal: any[], mem: any[], expression: any[], iterator: { value: number }, parameterNames: any[]) { 
    if (!expression || expression.length === 0) {
        return;
    }

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
            } else if(parameter.fcPlaceholder) {
                if(parameter.fcPlaceholder == expression[0].trim()) {
                    foundMatch = true
                    retVal.push("PLH")
                    retVal.push(parameter.tIndex)
                    var sliced = expression.slice(1)
                    mem.push(iterator.value)
                    iterator.value += 1
                    convertToInstructionSet(retVal, mem, sliced, iterator, parameterNames)
                }
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


// removes newlines and extra spaces from a string
function cleanString(str: string) {
    return str.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}