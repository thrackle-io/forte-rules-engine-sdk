import { expect, test } from 'vitest'
import { parseSyntax, parseForeignCallDefinition, parseTrackerSyntax, EffectType, buildForeignCallArgumentMapping } from '../src/index.ts';
import { keccak256, hexToNumber, encodePacked, getAddress, toBytes } from 'viem';

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
    'N', 3, 'N', 4, '+', 0,
     1, 'N', 5, '>', 2, 3,
    'N', 1, 'N', 1, '==', 5,
     6, 'N', 2, 'N', 2, '==',
     8, 9, 'AND', 7, 10, 'AND',
     4, 11
  ]
  var str = "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256 value)"
  var retVal = parseSyntax(str)
  expect(retVal.instructionSet).toEqual(expectedArray)
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
    'N', 1, 'N', 1, '+', 0, 1, 'N',
     2, '==', 2, 3, 'N', 3, 'N', 4,
    '+', 5, 6, 'N', 5, '>', 7, 8,
    'N', 1, 'N', 1, '==', 10,  11, 'N',
     2, 'N', 2, '==', 13, 14, 'AND', 12,
     15, 'AND', 9, 16, 'N', 4, 'N', 4,
    '==', 18, 19, 'AND', 17, 20, 'AND', 4,
     21 ] 
    var str = "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4) --> revert --> addValue(uint256 value)"
    var retVal = parseSyntax(str)
    expect(retVal.instructionSet).toEqual(expectedArray)
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
    'N', 3, 'N', 4, '+', 0, 1,
    'N', 5, '>', 2, 3, 'N', 5,
    'N', 5, '==', 5, 6, 'AND', 4,
    7, 'N', 1, 'N', 1, '==', 9,
    10, 'N', 2, 'N', 3, '==', 12,
    13, 'OR', 11, 14, 'OR', 8, 15
  ]
  var str = "(3 + 4 > 5 AND 5 == 5) OR (1 == 1 OR 2 == 3)  --> revert --> addValue(uint256 value)"; 
  var retVal = parseSyntax(str)
  expect(retVal.instructionSet).toEqual(expectedArray)
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
  'PLH', 0, 'N',
  4, '+', 0, 1,
  'N', 5, '>', 2,
  3, 'N', 5, 'N',
  5, '==', 5, 6,
  'AND', 4, 7, 'PLH',
  1, parseInt(keccak256('test'), 16), '==',
  9, 10, 'PLH',  2, 'N', 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC, '==', 12,
  13, 'OR', 11, 14,
  'OR', 8, 15
]

var expectedRawDataArray =  { 
  "argumentTypes": [1],
  "instructionSetIndex": [24],
  "dataValues": [toBytes("test")],
}
   

var str = "(value + 4 > 5 AND 5 == 5) OR (info == test OR addr == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)  --> revert --> addValue(uint256 value, string info, address addr)";
var retVal = parseSyntax(str)
expect(retVal.instructionSet).toEqual(expectedArray)
expect(retVal.rawData).toEqual(expectedRawDataArray)
});

test('Creates a simple uint256 tracker', () => {
var str = "Simple Int Tracker --> uint256 --> 14 --> 3";
var retVal = parseTrackerSyntax(str)
expect(retVal.name).toEqual("Simple Int Tracker")
expect(retVal.type).toEqual("uint256")
expect(retVal.defaultValue).toEqual(14)
expect(retVal.policyId).toEqual(3)
});

test('Creates a simple address tracker', () => {
var str = "Simple Address Tracker --> address --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> 3";
var retVal = parseTrackerSyntax(str)
expect(retVal.name).toEqual("Simple Address Tracker")
expect(retVal.type).toEqual("address")
expect(retVal.defaultValue).toEqual(0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)
expect(retVal.policyId).toEqual(3)
});

test('Creates a simple string tracker', () => {
var str = "Simple String Tracker --> string --> test --> 3";
var retVal = parseTrackerSyntax(str)
expect(retVal.name).toEqual("Simple String Tracker")
expect(retVal.type).toEqual("string")
expect(retVal.defaultValue).toEqual("test")
expect(retVal.policyId).toEqual(3)
});

test('Tests an incorrect type', () => {
var str = "Simple Address Tracker --> address --> thisShouldFail --> 3";
expect(() => parseTrackerSyntax(str)).toThrowError("Default Value doesn't match type")
});

test('Tests incorrect amount of items', () => {
var str = "Simple Address Tracker --> address --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC";
expect(() => parseTrackerSyntax(str)).toThrowError("Incorrect Tracker Definition Syntax")
});

test('Tests unsupported type', () => {
var str = "Simple String Tracker --> bool --> test --> 3";
expect(() => parseTrackerSyntax(str)).toThrowError("Unsupported type")
});

test('Tests incorrectly formated Policy Id', () => {
var str = "Simple String Tracker --> string --> test --> otherTest";
expect(() => parseTrackerSyntax(str)).toThrowError("policy Id must be an integer")
});

test('Creates a simple foreign call', () => {
var str = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 3";
var retVal = parseForeignCallDefinition(str)
expect(retVal.name).toEqual("Simple Foreign Call")
expect(retVal.address).toEqual(getAddress("0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC"))
expect(retVal.signature).toEqual(toBytes("0x324eef7a"))
expect(retVal.returnType).toEqual(2)
expect(retVal.parameterTypes).toEqual([0,1,2])
expect(retVal.policyId).toEqual(3)
});

test('Tests incorrect amount of items for Foreign Call', () => {
var str = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, string, uint256";
expect(() => parseForeignCallDefinition(str)).toThrowError("Incorrect Foreign Call Syntax")
});

test('Tests incorrect format for address', () => {
var str = "Simple Foreign Call --> test --> testSig(address,string,uint256) --> uint256 --> address, string, uint256 --> 3";
expect(() => parseForeignCallDefinition(str)).toThrowError('Address "test" is invalid')
});

test('Tests unsupported return type', () => {
var str = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> notAnInt --> address, string, uint256 --> 3";
expect(() => parseForeignCallDefinition(str)).toThrowError('Unsupported return type')
});

test('Tests unsupported argument type', () => {
var str = "Simple Foreign Call --> 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC --> testSig(address,string,uint256) --> uint256 --> address, notAnInt, uint256 --> 3";
expect(() => parseForeignCallDefinition(str)).toThrowError('Unsupported argument type')
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
 * [ 'PLH, 2, 
 *   'N', 100, 
 *   '>', 0, 1, 
 *   'PLH', 1, 
 *   'N', 100, 
 *   '==', 3, 4, 
 *   'AND', 2, 5, 
 */
  let expectedArray = [
    'PLH', 2, 'N', 100,
    '>', 0, 1,
    'PLH', 1, 'N', 100, '==',
    3, 4, 'AND', 2, 5
  ]
  let str = "FC:leaderboard(to) > 100 AND value == 100 --> revert --> transfer(address to, uint256 value) --> address to, uint256 value"
  let retVal = parseSyntax(str)
  expect(retVal.instructionSet).toEqual(expectedArray)
})

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
  *  'PLH', 2, 
  *  'N', 1,
  *  '==', 0, 1,
  *  'PLH', 0,
  *  'N', 0xdeadbeefdeadbeef, '==',
  *  3, 4, 'AND',
  *  2, 5, 'PLH',
  *  3, 'PLH', 4,
  *  'N', 1, 
  *  '==', 8, 9, 
  *  'AND', 7, 10, 
  *  'PLH', 5, 'N', 500,
  *  '<', 12, 13,
  *  'AND', 11, 14,
  *  'OR', 6, 15
  *]
  */

  let expectedArray = [
    'PLH', 2, 
    'N', 1,
    '==', 0, 1,
    'PLH', 0,
    'N', 0xdeadbeefdeadbeef, '==',
    3, 4, 'AND',
    2, 5, 'PLH',
    3, 'PLH', 4,
    'N', 1, 
    '==', 8, 9, 
    'AND', 7, 10, 
    'PLH', 5, 'N', 500,
    '<', 12, 13,
    'AND', 11, 14,
    'OR', 6, 15
  ]
 
  let str = `( FC:isAllowed(to) == 1 AND to == 0xdeadbeefdeadbeef )
   OR 
   (
    (
      FC:isSuperCoolGuy(to)
      AND 
      FC:isRich(to) == 1
    )
    AND 
    FC:creditRisk(amount) < 500 
   ) --> revert --> transfer(address to, uint256 value) --> address to, uint256 value`
  let retVal = parseSyntax(str)
  expect(retVal.instructionSet).toEqual(expectedArray)

})

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
  *  'PLH', 0,
  *  'N', 0xdeadbeefdeadbeef, '==',
  *  3, 4, 'AND',
  *  2, 5, 'PLH',
  *  3, 'PLH', 4,
  *  'N', 1, 
  *  '==', 8, 9, 
  *  'AND', 7, 10, 
  *  'PLH', 5, 'N', 500,
  *  '<', 12, 13,
  *  'AND', 11, 14,
  *  'OR', 6, 15
  *]
  */
  let expectedArray = [
    'PLH', 0,                    'N',
    1,     '==',                 0,
    1,     'PLH',                0,
    'N',   0xdeadbeefdeadbeef, '==',
    3,     4,                    'AND',
    2,     5,                    'PLH',
    1,     'N',                  1,
    '==',  7,                    8,
    'PLH', 0,                    'N',
    1,     '==',                 10,
    11,    'AND',                9,
    12,    'PLH',                1,
    'N',   500,                  '<',
    14,    15,                   'AND',
    13,    16,                   'OR',
    6,     17
  ]

  let str = `( to == 1 AND to == 0xdeadbeefdeadbeef )
  OR
  (
   (
     value == 1
     AND 
     to == 1
   )
   AND 
   value < 500 
  ) --> revert --> transfer(address to, uint256 value) --> address to, uint256 value`
  let retVal = parseSyntax(str)
  expect(retVal.instructionSet).toEqual(expectedArray)
})


test('Evaluates a simple syntax string (using AND + OR operators, trackers and function parameters)', () => {
  /*
 * Original Syntax:
 * (value + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)  --> revert --> addValue(uint256 value, string info, address addr)
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
  'PLH', 3, 'N',
  4, '+', 0, 1,
  'N', 5, '>', 2,
  3, 'PLH', 4, 'N',
  5, '==', 5, 6,
  'AND', 4, 7, 'PLH',
  1, 'PLH', 5, '==',
  9, 10, 'PLH', 4, 'N', 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC, '==', 12,
  13, 'OR', 11, 14,
  'OR', 8, 15
 */
var expectedArray = [
  'PLH', 3, 'N',
  4, '+', 0, 1,
  'N', 5, '>', 2,
  3, 'PLH', 4, 'N',
  5, '==', 5, 6,
  'AND', 4, 7, 'PLH',
  1, 'PLH', 5, '==',
  9, 10, 'PLH', 4, 'N', 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC, '==', 12,
  13, 'OR', 11, 14,
  'OR', 8, 15
]

var str = "(FC:isAllowed(to) + 4 > 5 AND TR:testOne == 5) OR (info == TR:testTwo OR TR:testOne == 0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC)  --> revert --> addValue(uint256 value, string info, address addr)";
var retVal = parseSyntax(str)
expect(retVal.instructionSet).toEqual(expectedArray)
});

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
  var str = "(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> revert --> addValue(uint256 value) --> uint256 value"
  var retVal = parseSyntax(str)
  expect(retVal.effect.type).toBe(EffectType.REVERT);
  expect(retVal.effect.value).toBeUndefined();
  expect(retVal.effect.instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a revert effect with message', () => {
  var str = `(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> revert("Didn't pass the sniff test") --> addValue(uint256 value) --> uint256 value`
  var retVal = parseSyntax(str)
  expect(retVal.effect.type).toBe(EffectType.REVERT);
  expect(retVal.effect.text).toEqual("Didn't pass the sniff test");
  expect(retVal.effect.instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a event effect', () => {
  var str = `(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> emit SomethingWentWrong("Something wrong") --> addValue(uint256 value) --> uint256 value`
  var retVal = parseSyntax(str)
  expect(retVal.effect.type).toBe(EffectType.EVENT);
  expect(retVal.effect.text).toEqual("Something wrong");
  expect(retVal.effect.instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for a event effect without text', () => {
  var str = `(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> emit Goodvibes() --> addValue(uint256 value) --> uint256 value`
  var retVal = parseSyntax(str)
  expect(retVal.effect.type).toBe(EffectType.EVENT);
  expect(retVal.effect.text).toEqual("");
  expect(retVal.effect.instructionSet).toEqual([]);
})

test('Evaluate a simple syntax string for an event effect with an instruction set', () => {
  var str = `(TR:simpleTrackler + 2 == 5) AND (value < 10000) --> FC:updateOracle(value) AND FC:alert(value)  --> addValue(uint256 value) --> uint256 value`
  var retVal = parseSyntax(str)
  expect(retVal.effect.type).toBe(EffectType.EXPRESSION);
  expect(retVal.effect.text).toEqual("");
  expect(retVal.effect.instructionSet).toEqual([
    'PLH', 1,
    'PLH', 2,
    'AND', 0, 1,
  ])

})
