import { keccak256, hexToNumber, encodePacked, Address, getAddress, toFunctionSelector, toBytes, ByteArray, toHex, isAddress, encodeAbiParameters, parseAbiParameters, stringToBytes } from 'viem';
import { foreignCallJSON, ruleJSON, trackerJSON } from './ContractInteraction';

// Types:
// --------------------------------------------------------------------------------------------------

type Tuple = {
    i: string;
    s: string;
}

export enum EffectType {
    REVERT = 0,
    EVENT = 1,
    EXPRESSION = 2
    
}

type Effect = {
    type: EffectType;
    text?: string;
    instructionSet?: any[]
}

export type RuleStruct = {
    instructionSet: number[],
    rawData: RawData,          
    placeHolders: any[],
    effectPlaceHolders: any[],
    fcArgumentMappingsConditions: any[],
    fcArgumentMappingsEffects: any[],
    posEffects: any[],
    negEffects: any[]
}

export type ForeignCallDefinition = {

    name: string;
    address: Address;
    signature: string;
    returnType: number;
    parameterTypes: number[];
    encodedIndices: number[];
}

type PlaceholderStruct = {
    pType: number;
    typeSpecificIndex: number;
    trackerValue: boolean;
    foreignCall: boolean;
}

type IndividualArugmentMapping = {
    functionCallArgumentType: number;
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

export type stringReplacement = {
    instructionSetIndex: number
    originalData: string
}

export type trackerIndexNameMapping = {
    id: number
    name: string
    type: number
}

export type TrackerDefinition = {
    name: string
    type: number
    defaultValue: any
}

export type RawData = {
    instructionSetIndex: number[]
    argumentTypes: number[]
    dataValues: ByteArray[]
}


const matchArray: string[] = ['OR', 'AND', '==', '>=', '>', '<', '<=', '+', '-', '/', '*', '+=', '-=', '*=', '/=', '=']
const truMatchArray: string[] = ['+=', '-=', '*=', '/=', '=']
const operandArray: string[] = ['PLH', 'N']
const supportedTrackerTypes: string[] = ['uint256', 'string', 'address', 'bytes']
export enum pTypeEnum {
    ADDRESS = 0,
    STRING = 1,
    UINT256 = 2,
    BOOL = 3,
    VOID = 4,
    BYTES = 5
}
export const PT = [ {name: 'address', enumeration: pTypeEnum.ADDRESS}, {name: 'string', enumeration: pTypeEnum.STRING}, 
    {name: 'uint256', enumeration: pTypeEnum.UINT256}, {name: 'bool', enumeration: pTypeEnum.BOOL}, 
    {name: 'void', enumeration: pTypeEnum.VOID}, {name: 'bytes', enumeration: pTypeEnum.BYTES} ]
const LC = [ {name: 'N', enumeration: 0}]
const FC_PREFIX: string = 'FC:'
// --------------------------------------------------------------------------------------------------


// External Parsing Functions:
// --------------------------------------------------------------------------------------------------

export function parseRuleSyntax(syntax: ruleJSON, indexMap: trackerIndexNameMapping[]) {

    var condition = syntax.condition

    condition = removeExtraParenthesis(condition)

    var functionSignature = syntax.encodedValues
    var names = parseFunctionArguments(functionSignature)
    var effectNames: any[] = []
    condition = parseForeignCalls(condition, names.length, names)
    parseTrackers(condition, names.length, names, indexMap)
    
    for(var effectP in syntax.positiveEffects) {
        syntax.positiveEffects[effectP] = parseForeignCalls(syntax.positiveEffects[effectP], effectNames.length, effectNames)
        parseTrackers(syntax.positiveEffects[effectP], effectNames.length, effectNames, indexMap)
    }
    for(var effectN in syntax.negativeEffects) {
        syntax.negativeEffects[effectN] = parseForeignCalls(syntax.negativeEffects[effectN], effectNames.length, effectNames)
        parseTrackers(syntax.negativeEffects[effectN], effectNames.length, effectNames, indexMap)
    }

    var effectPlaceHolders: PlaceholderStruct[] = []
    var positiveEffectsFinal = []
    var negativeEffectsFinal = []
    for(var effectP of syntax.positiveEffects) {
        let effect = parseEffect(effectP, effectNames, effectPlaceHolders, indexMap)
        positiveEffectsFinal.push(effect)

    }
    for(var effectN of syntax.negativeEffects) {
        let effect = parseEffect(effectN, effectNames, effectPlaceHolders, indexMap)
        negativeEffectsFinal.push(effect)
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
        }

        iter++
    }
}

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

// Parse the function signature string and build the placeholder data structure
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

export function parseTrackers(condition: string, nextIndex: number, names: any[], indexMap: trackerIndexNameMapping[]) {
    const trRegex = /TR:[a-zA-Z]+/g
    const truRegex = /TRU:[a-zA-Z]+/g
    var matches = condition.match(trRegex)

    if(matches != null) {
        var uniq = [...new Set(matches)];
        for(var match of uniq!) {
            var type = "address"
            for(var ind of indexMap){
                if(("TR:"+ind.name) == match) {
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
            names.push({name: match, tIndex: nextIndex, rawType: "tracker", rawTypeTwo: type})
            nextIndex++
        }
    }

    var matchesUpdate = condition.match(truRegex)

    if(matchesUpdate != null) {
        var uniq = [...new Set(matchesUpdate)];
        for(var match of uniq!) {
            match = match.replace("TRU:", "TR:")
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
            names.push({name: match, tIndex: nextIndex, rawType: "foreign call", fcPlaceholder: placeholder})
        }
        iter++;
        nextIndex++;
    }

    condition = processedCondition
    return condition
}

// --------------------------------------------------------------------------------------------------


// Internal Helper Functions
// --------------------------------------------------------------------------------------------------
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

// Build the rawData array that contains the string representations of strings and addresses and
// convert them to numbers in the instruction set.
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

// Convert AST to Instruction Set Syntax
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
                    if(place.typeSpecificIndex == parameter.tIndex) {
                        retVal.push("PLH")
                        retVal.push(plhIter)
                        copyFound = true
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


// removes newlines and extra spaces from a string
export function cleanString(str: string) {
    return str.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

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
