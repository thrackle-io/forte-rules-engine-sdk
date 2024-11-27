import { expect, test } from 'vitest'
import { parseSyntax } from '../src/index.ts';
import { keccak256, hexToNumber, encodePacked } from 'viem';

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
  'PLH', 0, 0, 'N',
  4, '+', 0, 1,
  'N', 5, '>', 2,
  3, 'N', 5, 'N',
  5, '==', 5, 6,
  'AND', 4, 7, 'PLH',
  1, 0, parseInt(keccak256('test'), 16), '==',
  9, 10, 'PLH',  2,
  0, hexToNumber(keccak256(encodePacked(['address'], ["0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC"]))), '==', 12,
  13, 'OR', 11, 14,
  'OR', 8, 15
]

var expectedRawDataArray = [
     {
       "dataType": "string",
       "iSetIndex": 26,
       "rawData": "test",
     },
     {
       "dataType": "address",
       "iSetIndex": 33,
       "rawData": "'0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC'",
     },
   ]

var str = "(value + 4 > 5 AND 5 == 5) OR (info == test OR addr == '0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC')  --> revert --> addValue(uint256 value, string info, address addr)";
var retVal = parseSyntax(str)
expect(retVal.instructionSet).toEqual(expectedArray)
expect(retVal.rawData).toEqual(expectedRawDataArray)
});