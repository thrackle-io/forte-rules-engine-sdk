import { expect, test } from 'vitest'
import { parseSyntax } from '../src/index.ts';

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
   * [ 'N', 3, 'N', 4, '+',  0,
   *    1, 'N', 5, '>', 2, 3,
   *   'N', 1, 'N', 1, '==', 4,
   *    5, 'N', 2, 'N', 2, '==',
   *    6, 7, 'AND', 8, 9, 'AND',
   *    10, 11 ]
   */
  var expectedArray = [
    'N', 3, 'N', 4, '+',  0,
     1, 'N', 5, '>', 2, 3,
    'N', 1, 'N', 1, '==', 4,
     5, 'N', 2, 'N', 2, '==',
     6, 7, 'AND', 8, 9, 'AND',
     10, 11
  ]
  var str = "3 + 4 > 5 AND (1 == 1 AND 2 == 2) --> revert --> addValue(uint256)"
  var retVal = parseSyntax(str)
  expect(retVal).toEqual(expectedArray)
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
   *  [ 'N',  1,     'N', 1,     '+',  0,   1,     'N',
   *     2,    '==',  2,   3,     'N',  3,   'N',   4,
   *    '+',  4,     5,   'N',   5,    '>', 6,     7,
   *    'N',  1,     'N', 1,     '==', 8,   9,     'N',
   *     2,    'N',   2,   '==',  10,   11,  'AND', 12,
   *     13,   'AND', 14,  15,    'N',  4,   'N',   4,
   *    '==', 16,    17,  'AND', 18,   19,  'AND', 20,
   *     21 ]
   */
    var expectedArray = [
      'N',  1,     'N', 1,     '+',  0,   1,     'N',
      2,    '==',  2,   3,     'N',  3,   'N',   4,
      '+',  4,     5,   'N',   5,    '>', 6,     7,
      'N',  1,     'N', 1,     '==', 8,   9,     'N',
      2,    'N',   2,   '==',  10,   11,  'AND', 12,
      13,   'AND', 14,  15,    'N',  4,   'N',   4,
      '==', 16,    17,  'AND', 18,   19,  'AND', 20,
      21
    ]
    var str = "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4) --> revert --> addValue(uint256)"
    var retVal = parseSyntax(str)
    expect(retVal).toEqual(expectedArray)
  });