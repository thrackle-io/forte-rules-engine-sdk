// index.ts

// export { parse } from './modules/Parser';

// Export any utility functions or constants
export const VERSION = '1.0.0';

type Tuple = {
    i: string;
    s: string;
  }

var str = "( 1 + 1 == 2 ) AND ( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) ) AND (4 == 4) --> revert --> addValue(uint256)"

var initialSplit = str.split('-->')
var condition = initialSplit[0]
// var condition = "( 3 + 4 > 5 AND (1 == 1 AND 2 == 2) )"
var array = convertToTree(condition)

if(array.length > 0) {
    iterate(array)
}

console.log(array)
var secondArray = array[2][1][0]
console.log(secondArray)
console.log(secondArray[0][1][1])


function convertToTree(condition : string) {
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
    var newSplit = condition.split(" AND ")

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

            innerArray.push(actualValue, actualValueTwo)
            var outerArray = new Array()
            outerArray.push("AND")
            outerArray.push(innerArray)
            endIndex -= 2
            overAllArray.unshift(outerArray)
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
            overAllArray.unshift("AND")
            endIndex -= 1
        }
    }

    return overAllArray

}

function logArray(array) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            logArray(array[iter])
        } else {
            console.log(array[iter])
        }
        iter += 1
    }
}

function iterate(array) {
    var iter = 0
    while(iter < array.length) {
        if(!Array.isArray(array[iter])) {
            if(array[iter].includes(" AND " )) {
                var output = convertToTree(array[iter])
                array[iter] = output
                iter -= 1
            }
        } else {
            if(array[iter].length > 0) {
                iterate(array[iter])
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