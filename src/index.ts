// index.ts

// export { parse } from './modules/Parser';

// Export any utility functions or constants
export const VERSION = '1.0.0';

type Tuple = {
    i: string;
    s: string;
  }

// Examples 
// ----------------------------------------------------------------------------------------------------------------
/**
 * Example A: 
 * ( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4)
 * 
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
 */

/**
 * Example B:
 * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
 * [AND,
 *  [3 + 4 > 5],
 *  [AND,
 *      [1 == 1],
 *      [2 == 2]
 *  ]
 * ]
 */
// ----------------------------------------------------------------------------------------------------------------

// Comment/Uncomment accordingly to run the two examples (outlined above)

// Example A:
// var str = "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4) --> revert --> addValue(uint256)"
// var initialSplit = str.split('-->')
// var condition = initialSplit[0]


// Example B:
var condition = "3 + 4 > 5 AND (1 == 1 AND 2 == 2)"

var array = convertToTree(condition, "AND")
if(array.length == 1) {
    array = array[0]
}

if(array.length > 0) {
    iterate(array, "AND")
}

// console.log(JSON.stringify(array, null, 0));

// Experiment
// ----------------------------------------------------------------------------------------------------------------

/**
 * Example B:
 * 3 + 4 > 5 AND (1 == 1 AND 2 == 2)
 * [AND,
 *  [">",
 *      ["+", "3", "4"],
 *      "5"]
 *  [AND,
 *      ["==", "1", "1"],
 *      ["==", "2", "2"]
 *  ]
 * ]
 */

iterate(array, "==")
console.log(JSON.stringify(array, null, 0))

iterate(array, ">")
console.log(JSON.stringify(array, null, 0))

iterate(array, "+")
console.log(JSON.stringify(array, null, 0))

singleify(array)
console.log(JSON.stringify(array, null, 0))
// ----------------------------------------------------------------------------------------------------------------


function convertToTree(condition : string, splitOn : string) {
    // Recursive Function steps:
    // replace anything in parenthesis with i:n

    var substrs = new Array()

    var iter = 0
    var leng = condition.split('(').length
    while(iter <= (leng - 2)) {
        var start = condition.lastIndexOf("(")
        var substr = condition.substring(start, condition.indexOf(")", start) + 1)
        condition = condition.replace(substr, "i:".concat(iter.toString()))
        var index = "i:".concat(iter.toString())
        var tuple: Tuple = { i: index, s: substr }
        substrs.push(tuple)
        iter++
    }

    // split based on AND
    var newSplit = condition.split(splitOn)

    // convert to syntax array
    var endIndex = newSplit.length - 1
    var overAllArray = new Array()
    while (endIndex > 0) {
        if(endIndex >= 1) {
            var innerArray = new Array()
            var actualValue = unconvertTuple(newSplit[endIndex - 1], substrs) 
            var actualValueTwo = unconvertTuple(newSplit[endIndex], substrs) 
        
            if(actualValue.includes('(')) {
                actualValue = actualValue.substring(1, actualValue.length - 1)
            }

            if(actualValueTwo.includes('(')) {
                actualValueTwo = actualValueTwo.substring(1, actualValueTwo.length - 1)
            }
            var innerArrayTwo = new Array()
            innerArray.push(actualValue)
            innerArrayTwo.push(actualValueTwo)
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
        if(endIndex == 0) {
            var innerArray = new Array()
            var actualValue = unconvertTuple(newSplit[endIndex], substrs)
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

function unconvertTuple(str: String, tuples: Tuple[]) {
    var actualValue = str
    var iter = 0
    while(iter < tuples.length) {
        var tuple: Tuple = tuples[iter]
        if(str.includes(tuple.i)) {
            actualValue = tuple.s
            if(actualValue.includes('i:')) {
                var substr = actualValue.substring(actualValue.indexOf("i:"), actualValue.indexOf(':') + 2)
                actualValue = actualValue.replace(substr, unconvertTuple(substr, tuples))
            }
            break
        }
        iter++
    }
    return actualValue
}

function singleify(array) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            if(array[iter].length == 1) {
                array[iter] = array[iter][0]
            } else {
                singleify(array[iter])
            }
        }
        iter++
    }
}