/// SPDX-License-Identifier: BUSL-1.1
import { expect, test } from 'vitest'
import { parseRuleSyntax, parseForeignCallDefinition, parseTrackerSyntax,stringReplacement, 
  buildForeignCallArgumentMapping, reverseParseRule, cleanInstructionSet } from '../src/modules/Parser.ts';
import { EffectType, pTypeEnum } from '../src/modules/types.ts';
import { keccak256, hexToNumber, encodePacked, getAddress, toBytes, toHex, encodeAbiParameters, parseAbiParameters } from 'viem';

test('Evaluates a simple syntax string (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
   * 
   * Abtract Tree Syntax:
   * [AND,
   *  [">",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   * 
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH', 0n,   'PLH', 1n,     '+',  0n,
    1n,     'N', 5n,     '>',   2n,    3n,
    'PLH', 1n,   'N',   1n,     '==', 5n,
    6n,     'N', 2n,     'PLH', 1n,    '==',
    8n,     9n,   'AND', 7n,     10n,   'AND',
    4n,     11n
  ]

  var ruleStringA = `{
  "condition": "value + sAND > 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value, uint256 sAND)",
  "encodedValues": "uint256 value, uint256 sAND"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  console.log(retVal.instructionSet)
  expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Evaluates a simple syntax string with >= (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 >= 5 AND (1 == 1 AND 2 == 2)
   * 
   * Abtract Tree Syntax:
   * [AND,
   *  [">=",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   * 
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '>=', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH', 0n,   'PLH', 1n,     '+',  0n,
    1n,     'N', 5n,     '>=',   2n,    3n,
    'PLH', 1n,   'N',   1n,     '==', 5n,
    6n,     'N', 2n,     'PLH', 1n,    '==',
    8n,     9n,   'AND', 7n,     10n,   'AND',
    4n,     11n
  ]

  var ruleStringA = `{
  "condition": "value + sAND >= 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value, uint256 sAND)",
  "encodedValues": "uint256 value, uint256 sAND"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  console.log(retVal.instructionSet)
  expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Evaluates a simple syntax string with <= (using only values and operators)', () => {
  /**
   * Original Syntax:
   * 3 + 4 <= 5 AND (1 == 1 AND 2 == 2)
   * 
   * Abtract Tree Syntax:
   * [AND,
   *  ["<=",
   *      ["+", "3", "4"],
   *      "5"]
   *  [AND,
   *      ["==", "1", "1"],
   *      ["==", "2", "2"]
   *  ]
   * ]
   * 
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0,
   *    1, 'N', 5, '<=', 2, 3,
   *   'N', 1, 'N', 1, '==', 5,
   *    6, 'N', 2, 'N', 2, '==',
   *    8, 9, 'AND', 7, 10, 'AND',
   *    4, 11 ]
   */
  var expectedArray = [
    'PLH', 0n,   'PLH', 1n,     '+',  0n,
    1n,     'N', 5n,     '<=',   2n,    3n,
    'PLH', 1n,   'N',   1n,     '==', 5n,
    6n,     'N', 2n,     'PLH', 1n,    '==',
    8n,     9n,   'AND', 7n,     10n,   'AND',
    4n,     11n
  ]

  var ruleStringA = `{
  "condition": "value + sAND <= 5 AND (sAND == 1 AND 2 == sAND)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value, uint256 sAND)",
  "encodedValues": "uint256 value, uint256 sAND"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  console.log(retVal.instructionSet)
  expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using only values and operators" test', () => {
  let instructionSet = [
    'N', 3, 'N', 4, '+', 0,
     1, 'N', 5, '>', 2, 3,
    'N', 1, 'N', 1, '==', 5,
     6, 'N', 2, 'N', 2, '==',
     8, 9, 'AND', 7, 10, 'AND',
     4, 11
  ]
  var expectedString = "3 + 4 > 5 AND ( 1 == 1 AND 2 == 2 )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = []
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
});

test('Evaluates a complex syntax string (using only values and operators)', () => {

  /*
   * Original Syntax:
   * ( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4)
   * 
   * Abstract Tree Syntax:
   * [AND,
   *  [1 + 1 == 2],
   *  [AND,
   *      [AND,
   *          [3 + 4 > 5],
   *          [AND,
   *              [2 == 2],
   *              [1 == 1],
   *          ]
   *      ],
   *      [4 == 4]
   *  ]
   * ] 
   *
   * Instruction Set Syntax:
   * [ 'N', 1, 'N', 1, '+', 0, 1, 'N',
   *    2, '==', 2, 3, 'N', 3, 'N', 4,
   *   '+', 5, 6, 'N', 5, '>', 7, 8,
   *   'N', 1, 'N', 1, '==', 10, 11, 'N',
   *    2, 'N', 2, '==', 13, 14, 'AND', 12,
   *    15, 'AND', 9, 16, 'N', 4, 'N', 4,
   *   '==', 18, 19, 'AND', 17, 20, 'AND', 4,
   *    21 ] 
   */
  var expectedArray = [
    'N', 1n, 'N', 1n, '+', 0n, 1n, 'N',
     2n, '==', 2n, 3n, 'N', 3n, 'N', 4n,
    '+', 5n, 6n, 'N', 5n, '>', 7n, 8n,
    'N', 1n, 'N', 1n, '==', 10n,  11n, 'N',
     2n, 'N', 2n, '==', 13n, 14n, 'AND', 12n,
     15n, 'AND', 9n, 16n, 'N', 4n, 'N', 4n,
    '==', 18n, 19n, 'AND', 17n, 20n, 'AND', 4n,
     21n ] 

     var ruleStringA = `{
     "condition": "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4)",
     "positiveEffects": ["revert"],
     "negativeEffects": [],
     "functionSignature": "addValue(uint256 value)",
     "encodedValues": "uint256 value"
     }`

    var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
    expect(retVal.instructionSet).toEqual(expectedArray)
  });

  test('Reverse Interpretation for the: "Evaluates a complex syntax string (using only values and operators)" test', () => {
    let instructionSet = [
      'N', 1, 'N', 1, '+', 0, 1, 'N',
      2, '==', 2, 3, 'N', 3, 'N', 4,
     '+', 5, 6, 'N', 5, '>', 7, 8,
     'N', 1, 'N', 1, '==', 10,  11, 'N',
      2, 'N', 2, '==', 13, 14, 'AND', 12,
      15, 'AND', 9, 16, 'N', 4, 'N', 4,
     '==', 18, 19, 'AND', 17, 20, 'AND', 4,
      21 
    ] 
    var expectedString = "1 + 1 == 2 AND ( ( 3 + 4 > 5 AND ( 1 == 1 AND 2 == 2 ) ) AND 4 == 4 )"
    cleanInstructionSet(instructionSet)
    var placeholderArray = []
    var retVal = reverseParseRule(instructionSet, placeholderArray, [])
    expect(retVal).toEqual(expectedString)
  });

test('Evaluates a simple syntax string (using AND + OR operators)', () => {
    /*
   * Original Syntax:
   * (3 + 4 > 5 AND 5 == 5) OR (1 == 1 OR 2 == 3)
   * 
   * Abstract Tree Syntax:
   * [OR,
   *  [AND,
   *    [>,
   *      [+, 3, 4] ,5],
   *    [==, 5, 5]],
   *  [OR,
   *    [==, 1, 1],
   *    [==, 2, 3]
   *  ]
   * ]
   *
   * Instruction Set Syntax:
   * [ 'N', 3, 'N', 4, '+', 0, 1,
   *   'N', 5, '>', 2, 3, 'N', 5,
   *   'N', 5, '==', 5, 6, 'AND', 4,
   *    7, 'N', 1, 'N', 1, '==', 9,
   *    10, 'N', 2, 'N', 3, '==', 12,
   *    13, 'OR', 11, 14, 'OR', 8, 15 ]
   */
  var expectedArray = [
    'N', 3n, 'N', 4n, '+', 0n, 1n,
    'N', 5n, '>', 2n, 3n, 'N', 5n,
    'N', 5n, '==', 5n, 6n, 'AND', 4n,
    7n, 'N', 1n, 'N', 1n, '==', 9n,
    10n, 'N', 2n, 'N', 3n, '==', 12n,
    13n, 'OR', 11n, 14n, 'OR', 8n, 15n
  ]

  var ruleStringA = `{
  "condition": "(3 + 4 > 5 AND 5 == 5) OR (1 == 1 OR 2 == 3)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`

  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators)" test', () => {
  let instructionSet = [
    'N', 3, 'N', 4, '+', 0, 1,
    'N', 5, '>', 2, 3, 'N', 5,
    'N', 5, '==', 5, 6, 'AND', 4,
    7, 'N', 1, 'N', 1, '==', 9,
    10, 'N', 2, 'N', 3, '==', 12,
    13, 'OR', 11, 14, 'OR', 8, 15
  ] 
  var expectedString = "( 3 + 4 > 5 AND 5 == 5 ) OR ( 1 == 1 OR 2 == 3 )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = []
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
});

test('Evaluates a simple syntax string (using AND + OR operators and function parameters)', () => {
  /*
 * Original Syntax:
 * (value + 4 > 5 AND 5 == 5) OR (info == "test" OR addr == '0x1234567')  --> revert --> addValue(uint256 value, string info, address addr)
 * 
 * Abstract Tree Syntax:
 * [OR,
 *  [AND,
 *    [>,
 *      [+, "value", 4], 5],
 *    [==, 5, 5]],
 *  [OR,
 *    [==, "info", "test"],
 *    [==, "addr", '0x1234567']
 *  ]
 * ]
 * 
 * Instruction Set Syntax:
 * [ 'PLH', 0, 0, 'N',
 *    4, '+', 0, 1,
 *   'N', 5, '>', 2,
 *    3, 'N', 5, 'N',
 *    5, '==', 5, 6,
 *   'AND', 4, 7, 'PLH',
 *    1, 0, 'test', '==',
 *    9, 10, 'PLH',  2,
 *    0, "'0x1234567'", '==', 12,
 *    13, 'OR', 11, 14,
 *   'OR', 8, 15 ]
 */
var expectedArray = [
  'PLH', 0n, 'N',
  4n, '+', 0n, 1n,
  'N', 5n, '>', 2n,
  3n, 'N', 5n, 'N',
  5n, '==', 5n, 6n,
  'AND', 4n, 7n, 'PLH',
  1n, 'N', BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['test']))), '==',
  9n, 10n, 'PLH',  2n, 'N', BigInt('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'), '==', 12n,
  13n, 'OR', 11n, 14n,
  'OR', 8n, 15n
]

var expectedRawDataArray =  { 
  "argumentTypes": [1],
  "instructionSetIndex": [25],
  "dataValues": [toBytes("test")],
}


var ruleStringA = `{
"condition": "(value + 4 > 5 AND 5 == 5) OR (info == test OR addr == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)",
"positiveEffects": ["revert"],
"negativeEffects": [],
"functionSignature": "addValue(uint256 value, string info, address addr)",
"encodedValues": "uint256 value, string info, address addr"
}`

var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
expect(retVal.instructionSet).toEqual(expectedArray)
expect(retVal.rawData).toEqual(expectedRawDataArray)
});

test('Creates a simple uint256 tracker', () => {
  var str = `{
        "name": "Simple Int Tracker",
        "type": "uint256",
        "defaultValue": "14"
        }`
var retVal = parseTrackerSyntax(JSON.parse(str))
expect(retVal.name).toEqual("Simple Int Tracker")
expect(retVal.type).toEqual(pTypeEnum.UINT256)
expect(retVal.defaultValue).toEqual(encodeAbiParameters(
  parseAbiParameters('uint256'), ['14']))
});

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators and function parameters)" test', () => {
  let instructionSet = [
    'PLH', 0, 'N',
    4, '+', 0, 1,
    'N', 5, '>', 2,
    3, 'N', 5, 'N',
    5, '==', 5, 6,
    'AND', 4, 7, 'PLH',
    1, 'N', parseInt(keccak256('test'), 16), '==',
    9, 10, 'PLH',  2, 'N', '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC', '==', 12,
    13, 'OR', 11, 14,
    'OR', 8, 15
  ] 
  var expectedString = "( value + 4 > 5 AND 5 == 5 ) OR ( info == test OR addr == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = ["value", "info", "addr"]
  var retVal = reverseParseRule(instructionSet, placeholderArray, [{instructionSetIndex: 25, originalData: "test"}])
  expect(retVal).toEqual(expectedString)
});

test('Creates a simple address tracker', () => {
  var str = `{
  "name": "Simple Address Tracker",
  "type": "address",
  "defaultValue": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC"
  }`
var retVal = parseTrackerSyntax(JSON.parse(str))
expect(retVal.name).toEqual("Simple Address Tracker")
expect(retVal.type).toEqual(pTypeEnum.ADDRESS)
expect(retVal.defaultValue).toEqual(encodeAbiParameters(
  parseAbiParameters('address'), ['0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC']))
});

test('Creates a simple string tracker', () => {
  var str = `{
  "name": "Simple String Tracker",
  "type": "string",
  "defaultValue": "test"
  }`
var retVal = parseTrackerSyntax(JSON.parse(str))
expect(retVal.name).toEqual("Simple String Tracker")
expect(retVal.type).toEqual(pTypeEnum.STRING)
expect(retVal.defaultValue).toEqual(encodeAbiParameters(
  parseAbiParameters('string'), ['test']))
});


test('Tests unsupported type', () => {
  var str = `{
  "name": "Simple String Tracker",
  "type": "bool",
  "defaultValue": "test"
  }`
expect(() => parseTrackerSyntax(JSON.parse(str))).toThrowError("Unsupported type")
});

test('Creates a simple foreign call', () => {
 var str = `{
  "name": "Simple Foreign Call",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "signature": "testSig(address,string,uint256)",
  "returnType": "uint256",
  "parameterTypes": "address, string, uint256",
  "encodedIndices": "0, 1, 2"
  }`

var retVal = parseForeignCallDefinition(JSON.parse(str))
expect(retVal.name).toEqual("Simple Foreign Call")
expect(retVal.address).toEqual(getAddress("0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC"))
expect(retVal.signature).toEqual("testSig(address,string,uint256)")
expect(retVal.returnType).toEqual(2)
expect(retVal.parameterTypes).toEqual([0,1,2])
});


test('Tests incorrect format for address', () => {
  var str = `{
  "name": "Simple Foreign Call",
  "address": "test",
  "signature": "testSig(address,string,uint256)",
  "returnType": "uint256",
  "parameterTypes": "address, string, uint256",
  "encodedIndices": "0, 1, 2"
  }`

expect(() => parseForeignCallDefinition(JSON.parse(str))).toThrowError('Address "test" is invalid')
});

test('Tests unsupported return type', () => {
  var str = `{
  "name": "Simple Foreign Call",
  "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
  "signature": "testSig(address,string,uint256)",
  "returnType": "notAnInt",
  "parameterTypes": "address, string, uint256",
  "encodedIndices": "0, 1, 2"
  }`
expect(() => parseForeignCallDefinition(JSON.parse(str))).toThrowError('Unsupported return type')
});

test('Tests unsupported argument type', () => {
    var str = `{
    "name": "Simple Foreign Call",
    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
    "signature": "testSig(address,string,uint256)",
    "returnType": "uint256",
    "parameterTypes": "address, notAnInt, uint256",
    "encodedIndices": "0, 1, 2"
    }`

expect(() => parseForeignCallDefinition(JSON.parse(str))).toThrowError('Unsupported argument type')
});

test('Evaluates a simple syntax string with a Foreign Call', () => {
/*
 * Original Syntax:
 * FC:leaderboard(to) > 100 AND value == 100 --> revert --> transfer(address to, uint256 value) --> address to, uint256 value
 * 
 * Abstract Tree Syntax:
 *  [AND,
 *    [>,
 *      [FC:leaderboard, "to"], 100],
 *    [==, "value", 100],
 * ]
 * 
 * Instruction Set Syntax:
 * [ 'PLH, 0, 
 *   'N', 100, 
 *   '>', 0, 1, 
 *   'PLH', 1, 
 *   'N', 100, 
 *   '==', 3, 4, 
 *   'AND', 2, 5, 
 */
  let expectedArray = [
    'PLH', 0n, 'N', 100n,
    '>', 0n, 1n,
    'PLH', 1n, 'N', 100n, '==',
    3n, 4n, 'AND', 2n, 5n
  ]
  var ruleStringA = `{
  "condition": "FC:leaderboard(to) > 100 AND value == 100 ",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "transfer(address to, uint256 value)",
  "encodedValues": "address to, uint256 value"
  }`

  let retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluates a simple syntax string with a Foreign Call" test', () => {
  let instructionSet = [
    'PLH', 0, 'N', 100,
    '>', 0, 1,
    'PLH', 1, 'N', 100, '==',
    3, 4, 'AND', 2, 5
  ] 
  var expectedString = "FC:leaderboard(to) > 100 AND value == 100"
  cleanInstructionSet(instructionSet)
  var placeholderArray = ["FC:leaderboard(to)", "value"]
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
});

test('Evaluate a complex syntax string with multiple foreign calls', () => {
  /*
  * Original Syntax:
  * (FC:isAllowed(to) == 1 AND sender == 0xdeadbeefdeadbeef) OR (FC:isSuperCoolGuy(to) AND (FC:isRich(to) == 1) AND (FC:creditRisk(amount) < 500 )) -> revert --> “transfer(address to, uint256 value)” --> address to, uint256 value
  * 
  * Abstract Tree Syntax:
  *  [OR,
  *    [AND,
  *      [==, "FC:isAllowed(to)", 1],
  *      [==, "to", 0xdeadbeefdeadbeef]],
  *    [AND,
  *      [==, "FC:isSuperCoolGuy(to)", 1],
  *      [AND,
  *        [==, "FC:isRich(to)", 1],
  *        [<, "FC:creditRisk(amount)", 500]]]
  * ]
  * 
  * Instruction Set Syntax:
  * [
  * 'PLH', 0, 
  *  'N', 1,
  * '==', 0, 1,
  * 'PLH', 1,
  * 'N', 0xdeadbeefdeadbeef, '==',
  * 3, 4, 'AND',
  * 2, 5, 'PLH',
  * 2, 'PLH', 3,
  * 'N', 1, 
  * '==', 8, 9, 
  * 'AND', 7, 10, 
  * 'PLH', 4, 'N', 500,
  * '<', 12, 13,
  * 'AND', 11, 14,
  * 'OR', 6, 15
  ]
  */

  let expectedArray = [
    'PLH', 0n, 
    'N', 1n,
    '==', 0n, 1n,
    'PLH', 1n,
    'N', BigInt('0xdeadbeefdeadbeef'), '==',
    3n, 4n, 'AND',
    2n, 5n, 'PLH',
    2n, 'PLH', 3n,
    'N', 1n, 
    '==', 8n, 9n, 
    'AND', 7n, 10n, 
    'PLH', 4n, 'N', 500n,
    '<', 12n, 13n,
    'AND', 11n, 14n,
    'OR', 6n, 15n
  ]
 
   var ruleStringA = `{
   "condition": "( FC:isAllowed(to) == 1 AND to == 0xdeadbeefdeadbeef ) OR ( (FC:isSuperCoolGuy(to) AND FC:isRich(to) == 1) AND FC:creditRisk(amount) < 500 )",
   "positiveEffects": ["revert"],
   "negativeEffects": [],
   "functionSignature": "transfer(address to, uint256 value)",
   "encodedValues": "address to, uint256 value" }`
  let retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.instructionSet).toEqual(expectedArray)

})

test('Reverse Interpretation for the: "Evaluates a simple syntax string with a Foreign Call" test', () => {
  let instructionSet = [
    'PLH', 0, 
    'N', 1,
    '==', 0, 1,
    'PLH', 1,
    'N', 0xdeadbeefdeadbeef, '==',
    3, 4, 'AND',
    2, 5, 'PLH',
    2, 'PLH', 3,
    'N', 1, 
    '==', 8, 9, 
    'AND', 7, 10, 
    'PLH', 4, 'N', 500,
    '<', 12, 13,
    'AND', 11, 14,
    'OR', 6, 15
  ] 
  var expectedString = "( FC:isAllowed(to) == 1 AND to == 16045690984833335000 ) OR ( ( FC:isSuperCoolGuy(to) AND FC:isRich(to) == 1 ) AND FC:creditRisk(amount) < 500 )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = ["FC:isAllowed(to)", "to", "FC:isSuperCoolGuy(to)", "FC:isRich(to)", "FC:creditRisk(amount)" ]
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
});

test('Evaluate complex expression with placeholders', () => {

  /*
  * Original Syntax:
  * (to == 1 AND sender == 0xdeadbeefdeadbeef) OR (value == 1 AND to == 1 AND value < 500) -> revert --> “transfer(address to, uint256 value)” --> address to, uint256 value
  * 
  * Abstract Tree Syntax:
  *  [OR,
  *    [AND,
  *      [==, "to", 1],
  *      [==, "sender", 0xdeadbeefdeadbeef]],
  *    [AND,
  *      [==, "value", 1],
  *      [AND,
  *        [==, "to", 1],
  *        [<, "value", 500]]]
  * ]
  * 
  * Instruction Set Syntax:
  * [
  *  'PLH', 0,
  *  'N', 1,
  *  '==', 0, 1,
  *  'PLH', 1,
  *  'N', 0xdeadbeefdeadbeef, '==',
  *  3, 4, 'AND',
  *  2, 5, 'PLH',
  *  2, 'PLH', 3,
  *  'N', 1, 
  *  '==', 8, 9, 
  *  'AND', 7, 10, 
  *  'PLH', 4, 'N', 500,
  *  '<', 12, 13,
  *  'AND', 11, 14,
  *  'OR', 6, 15
  *]
  */
  let expectedArray = [
    'PLH', 0n,                    'N',
    1n,     '==',                 0n,
    1n,     'PLH',                0n,
    'N',   BigInt('0xdeadbeefdeadbeef'), '==',
    3n,     4n,                    'AND',
    2n,     5n,                    'PLH',
    1n,     'N',                  1n,
    '==',  7n,                    8n,
    'PLH', 0n,                    'N',
    1n,     '==',                 10n,
    11n,    'AND',                9n,
    12n,    'PLH',                1n,
    'N',   500n,                  '<',
    14n,    15n,                   'AND',
    13n,    16n,                   'OR',
    6n,     17n
  ]
  var ruleStringA = `{
  "condition": "( to == 1 AND to == 0xdeadbeefdeadbeef ) OR (( value == 1 AND to == 1) AND value < 500 )",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "transfer(address to, uint256 value)",
  "encodedValues": "address to, uint256 value"
  }`
  let retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.instructionSet).toEqual(expectedArray)
})

test('Reverse Interpretation for the: "Evaluate complex expression with placeholders" test', () => {
  let instructionSet = [
    'PLH', 0,                    'N',
    1,     '==',                 0,
    1,     'PLH',                1,
    'N',   "0xdeadbeefdeadbeef", '==',
    3,     4,                    'AND',
    2,     5,                    'PLH',
    2,     'N',                  1,
    '==',  7,                    8,
    'PLH', 3,                    'N',
    1,     '==',                 10,
    11,    'AND',                9,
    12,    'PLH',                4,
    'N',   500,                  '<',
    14,    15,                   'AND',
    13,    16,                   'OR',
    6,     17
  ]
  var expectedString = "( to == 1 AND sender == 0xdeadbeefdeadbeef ) OR ( ( value == 1 AND to == 1 ) AND value < 500 )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = ["to", "sender", "value", "to", "value"]
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
})

test('Evaluates a simple syntax string (using AND + OR operators, trackers and function parameters)', () => {
  /*
 * Original Syntax:
 * (FC:isAllowed(to) + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)  --> revert --> addValue(uint256 value, string info, address addr)
 * 
 * Abstract Tree Syntax:
 * [OR,
 *  [AND,
 *    [>,
 *      [+, "FC:isAllowed(to)", 4], 5],
 *    [==, TR:testOne, 5]],
 *  [OR,
 *    [==, "info", TR:testTwo],
 *    [==, TR:testOne, '0x1234567']
 *  ]
 * ]
 * 
 * Instruction Set Syntax:
 * 'PLH', 0, 'N',
 *  4, '+', 0, 1,
 * 'N', 5, '>', 2,
 *  3, 'PLH', 1, 'N',
 *  5, '==', 5, 6,
 * 'AND', 4, 7, 'PLH',
 *  2, 'PLH', 3, '==',
 *  9, 10, 'PLH', 4, 'N', 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC, '==', 12,
 *  13, 'OR', 11, 14,
 * 'OR', 8, 15
 */
var expectedArray = [
  'PLH', 0n, 'N',
  4n, '+', 0n, 1n,
  'N', 5n, '>', 2n,
  3n, 'PLH', 1n, 'N',
  5n, '==', 5n, 6n,
  'AND', 4n, 7n, 'PLH',
  2n, 'PLH', 3n, '==',
  9n, 10n, 'PLH', 1n, 'N', BigInt('0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'), '==', 12n,
  13n, 'OR', 11n, 14n,
  'OR', 8n, 15n
]

var ruleStringA = `{
"condition": "(FC:isAllowed(to) + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)",
"positiveEffects": ["revert"],
"negativeEffects": [],
"functionSignature": "addValue(uint256 value, string info, address addr)",
"encodedValues": "uint256 value, string info, address addr"
}`

var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Reverse Interpretation for the: "Evaluates a simple syntax string (using AND + OR operators, trackers and function parameters)" test', () => {
  var instructionSet = [
    'PLH', 0, 'N',
    4, '+', 0, 1,
    'N', 5, '>', 2,
    3, 'PLH', 1, 'N',
    5, '==', 5, 6,
    'AND', 4, 7, 'PLH',
    2, 'PLH', 3, '==',
    9, 10, 'PLH', 4, 'N', "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC", '==', 12,
    13, 'OR', 11, 14,
    'OR', 8, 15
  ]
  var expectedString = "( FC:isAllowed(to) + 4 > 5 AND TR:testOne == 5 ) OR ( info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC )"
  cleanInstructionSet(instructionSet)
  var placeholderArray = ["FC:isAllowed(to)", "TR:testOne", "info", "TR:testTwo", "TR:testOne"]
  var retVal = reverseParseRule(instructionSet, placeholderArray, [])
  expect(retVal).toEqual(expectedString)
})

test('Tests building foreign call argument mapping', () => {
  var fc = ["testCall(to, value, somethingElse, TR:trackerTest)"];
  var strings = [
    {name:'to', tIndex: 0, rawType: "address"}, 
    {name: 'someValue', tIndex: 0, rawType: "uint256"}, 
    {name: 'someString', tIndex: 0, rawType: "string"}, 
    {name: 'somethingElse', tIndex: 0, rawtype: "string"}, 
    {name: 'value', tIndex: 0, rawType: "uint256"}, 
    {name: 'anotherValue', tIndex: 0, rawType: "uint256"}
  ]
  var trackers = [
    {name: 'trackerTest', rawType: "address"}
  ]
  
  var expected = [
    { 
      foreignCallIndex: 0,
      mappings: [
        { 
          functionCallArgumentType: 0, functionSignatureArg: {
            pType: 0,
            typeSpecificIndex: 0,
            trackerValue: false,
            foreignCall: false
          } 
        }, { 
          functionCallArgumentType: 2, functionSignatureArg:  {
            pType: 2,
            typeSpecificIndex: 4,
            trackerValue: false,
            foreignCall: false
          }
        }, { 
          functionCallArgumentType: 0, functionSignatureArg: {
              pType: 0,
              typeSpecificIndex: 3,
              trackerValue: false,
              foreignCall: false
            } 
        }, { 
          functionCallArgumentType: 0, functionSignatureArg: {
              pType: 0,
              foreignCall: false,
              trackerValue: true,
              typeSpecificIndex: 6,
          },
        },
      ]
    }
  ]
  
  var retVal = buildForeignCallArgumentMapping([0], fc, strings, trackers)
  expect(retVal).toEqual(expected)
});

test('Evaluate a simple syntax string for a revert effect', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.REVERT);
  expect(retVal.positiveEffects[0].value).toBeUndefined();
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a revert effect with message', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["revert(\\"Didn\'t pass the sniff test\\")"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var str = `(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> revert("Didn't pass the sniff test") --> addValue(uint256 value) --> uint256 value`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.REVERT);
  expect(retVal.positiveEffects[0].text).toEqual("Didn't pass the sniff test");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a event effect', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["emit Something wrong"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[0].text).toEqual("Something wrong");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a event effect without text', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["emit Goodvibes"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[0].text).toEqual("Goodvibes");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string that contains a positive and negative effect', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["emit Goodvibes"],
  "negativeEffects": [ "revert" ],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[0].text).toEqual("Goodvibes");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
  expect(retVal.negativeEffects[0].type).toBe(EffectType.REVERT);
  expect(retVal.negativeEffects[0].text).toEqual("");
  expect(retVal.negativeEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string that contains multiple positive effects and a negative effect', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["emit Goodvibes", "emit OtherGoodvibes"],
  "negativeEffects": [ "revert" ],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[0].text).toEqual("Goodvibes");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
  expect(retVal.positiveEffects[1].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[1].text).toEqual("OtherGoodvibes");
  expect(retVal.positiveEffects[1].instructionSet).toEqual([]);
  expect(retVal.negativeEffects[0].type).toBe(EffectType.REVERT);
  expect(retVal.negativeEffects[0].text).toEqual("");
  expect(retVal.negativeEffects[0].instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string that contains multiple positive and negative effects', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["emit Goodvibes", "emit OtherGoodvibes"],
  "negativeEffects": [ "emit badVibes", "FC:updateOracle(value) AND FC:alert(value)" ],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[0].text).toEqual("Goodvibes");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([]);
  expect(retVal.positiveEffects[1].type).toBe(EffectType.EVENT);
  expect(retVal.positiveEffects[1].text).toEqual("OtherGoodvibes");
  expect(retVal.positiveEffects[1].instructionSet).toEqual([]);
  expect(retVal.negativeEffects[0].type).toBe(EffectType.EVENT);
  expect(retVal.negativeEffects[0].text).toEqual("badVibes");
  expect(retVal.negativeEffects[0].instructionSet).toEqual([]);
  expect(retVal.negativeEffects[1].type).toBe(EffectType.EXPRESSION)
  expect(retVal.negativeEffects[1].text).toEqual("");
  expect(retVal.negativeEffects[1].instructionSet).toEqual([
    'PLH', 0,
    'PLH', 1,
    'AND', 0, 1,
  ])
  expect(retVal.effectPlaceHolders.length).toEqual(2)
  expect(retVal.effectPlaceHolders[0].foreignCall).toEqual(true)
  expect(retVal.effectPlaceHolders[1].pType).toEqual(0)
})

test('Evaluate a simple syntax string for an event effect with an instruction set', () => {
  var ruleStringA = `{
  "condition": "(TR:simpleTrackler + 2 == 5) AND (value < 10000)",
  "positiveEffects": ["FC:updateOracle(value) AND FC:alert(value)"],
  "negativeEffects": ["FC:alert(value)"],
  "functionSignature": "addValue(uint256 value)",
  "encodedValues": "uint256 value"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.positiveEffects[0].type).toBe(EffectType.EXPRESSION);
  expect(retVal.positiveEffects[0].text).toEqual("");
  expect(retVal.positiveEffects[0].instructionSet).toEqual([
    'PLH', 0,
    'PLH', 1,
    'AND', 0, 1,
  ])
})

test('Simple Reverse Interpretation', () => {
    var numbers = [0, 1, 0, 2, 1, 0, 1, 0, 3, 7, 2, 3, 0, 1, 11, 0, 7, 5, 6, 8, 4, 7]
    var placeholderArray = ["value"]
    var retVal = reverseParseRule(numbers, placeholderArray, [])
    expect(retVal).toEqual("1 + 2 == 3 AND 1 == value")
})

test('Evaluates a simple effect involving a tracker update (TRU))', () => {

var expectedArray = [
  'PLH', 0,     'N',
  1n,     '-',  0,
  1,     'TRU', 4,
  2, 0
]

var ruleStringA = `{
"condition": " value > 5 ",
"positiveEffects": [" TRU:testOne -= 1 "],
"negativeEffects": [],
"functionSignature": "addValue(uint256 value, string info)",
"encodedValues": "uint256 value, string info, address addr"
}`

var str = "value > 5  --> TRU:testOne -= value --> addValue(uint256 value, string info, address addr)";
var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [{id: 4, name: "testOne"}])
expect(retVal.positiveEffects[0].instructionSet).toEqual(expectedArray)
expect(retVal.effectPlaceHolders.length).toEqual(1)
expect(retVal.effectPlaceHolders[0].trackerValue).toEqual(true)
});

test('Multiple copies of the same placeholder test', () => {

var expectedArray = [
  'PLH', 0n,    'N',  4n,   '+',   0n,
  1n,     'N',  5n,    '>', 2n,     3n,
  'PLH', 0n,    'N',  5n,   '==',  5n,
  6n,     'OR', 4n,    7n,   'PLH', 0n,
  'PLH', 1n,    '==', 9n,   10n,    'OR',
  8n,     11n
]

var ruleStringA = `{
"condition": "(value + 4 > 5 OR value == 5) OR value == TR:testTwo",
"positiveEffects": ["revert"],
"negativeEffects": [],
"functionSignature": "addValue(uint256 value, string info, address addr)",
"encodedValues": "uint256 value, string info, address addr"
}`

var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
expect(retVal.instructionSet).toEqual(expectedArray)
});

test('Extraneous paraenthesis', () => {

  var expectedArray = [
    'PLH', 0n,    'N',  4n,   '+',   0n,
    1n,     'N',  5n,    '>', 2n,     3n,
    'PLH', 0n,    'N',  5n,   '==',  5n,
    6n,     'OR', 4n,    7n,   'PLH', 0n,
    'PLH', 1n,    '==', 9n,   10n,    'OR',
    8n,     11n
  ]
  
  var ruleStringA = `{
  "condition": "(((value + 4 > 5) OR value == 5)) OR ((value == TR:testTwo))",
  "positiveEffects": ["revert"],
  "negativeEffects": [],
  "functionSignature": "addValue(uint256 value, string info, address addr)",
  "encodedValues": "uint256 value, string info, address addr"
  }`
  var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
  expect(retVal.instructionSet).toEqual(expectedArray)
  });

  test('Evaluates a syntax string that includes keywords in variable names and raw string values', () => {
    /**
     * Original Syntax:
     * value + sAND > 5 AND (lORe == 1 AND bORe test == lORe)
     * 
     * [
     *  'PLH', 0,
     *  'PLH', 1,
     *  '+',   0,
     *  1,     'N',
     *  5,     '>',
     *  2,     3,
     *  'PLH', 2,
     *  'N',   1,
     *  '==',  5,
     *  6,     parseInt(keccak256('bORe test')),
     *  'PLH', 2,
     *  '==',  8,
     *  9,     'AND',
     *  7,     10,
     *  'AND', 4,
     *   11
     * ]
     */

    var expectedArray = [
      'PLH', 0n,
      'PLH', 1n,
      '+',   0n,
      1n,     'N',
      5n,     '>',
      2n,     3n,
      'PLH', 2n,
      'N',   1n,
      '==',  5n,
      6n,   'N', BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['bORe test']))),
      'PLH', 2n,
      '==',  8n,
      9n,     'AND',
      7n,     10n,
      'AND', 4n,
      11n
    ]

    var ruleStringA = `{
    "condition": "value + sAND > 5 AND (lORe == 1 AND bORe test == lORe)",
    "positiveEffects": ["revert"],
    "negativeEffects": [],
    "functionSignature": "addValue(uint256 value, uint256 sAND, address lORe)",
    "encodedValues": "uint256 value, uint256 sAND, address lORe"
    }`

    var str = "value + sAND > 5 AND (lORe == 1 AND bORe test == lORe) --> revert --> addValue(uint256 value, uint256 sAND, address lORe)"
    var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
    expect(retVal.instructionSet).toEqual(expectedArray)
  });

  test('Ensure that the parser can handle FC in various parts of a string', () => {
    var expectedArray = [
      'PLH', 0n, 'N',
      BigInt(keccak256(encodeAbiParameters(parseAbiParameters('string'), ['FCalert']))),
      '==', 0n, 1n
    ]

    var ruleStringA = `{
    "condition": "(FC:updateOracle(value) == FCalert)",
    "positiveEffects": ["revert"],
    "negativeEffects": [],
    "functionSignature": "addValue(uint256 value, string info, address addr)",
    "encodedValues": ""
    }`
    
    var retVal = parseRuleSyntax(JSON.parse(ruleStringA), [])
    expect(retVal.instructionSet).toEqual(expectedArray)
  });
