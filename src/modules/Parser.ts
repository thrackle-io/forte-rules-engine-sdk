// const ethers = require('ethers');

type Tuple = {
    i: string;
    s: string;
  }

export function parseSyntax(syntax: string) {

    var initialSplit = syntax.split('-->')
    var condition = initialSplit[0]

    var array = convertToTree(condition, "AND")
    if(array.length == 1) {
        array = array[0]
    }  

    if(array.length > 0) {
        iterate(array, "AND")
    }

    iterate(array, "==")
    console.log(JSON.stringify(array, null, 0))

    iterate(array, ">")
    console.log(JSON.stringify(array, null, 0))

    iterate(array, "+")
    console.log(JSON.stringify(array, null, 0))

    singleify(array)
    console.log(JSON.stringify(array, null, 0))
    intify(array)
    console.log(JSON.stringify(array, null, 0))

    var retVal = []
    var mem = []
    const iter = { value: 0 };
    compileM(retVal, mem, array, iter)
    console.log(retVal)
    return retVal
}

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

function intify(array) {
    var iter = 0
    while(iter < array.length) {
        if(Array.isArray(array[iter])) {
            intify(array[iter])
         } else {
            if(!isNaN(Number(array[iter]))) {
                array[iter] = Number(array[iter])
                console.log(Number(array[iter]))
            }
                
        }
        iter++
    }
}

function compileM(retVal, mem, expression, iterator: { value: number}) {
    if(typeof expression == "number") {
        retVal.push("N")
        retVal.push(expression)
        mem.push(iterator.value)
        iterator.value += 1
    } else if(typeof expression[0] == "string") {
        var sliced = expression.slice(1)
        compileM(retVal, mem, sliced, iterator)
        retVal.push(expression[0])
        retVal.push(mem[0])
        retVal.push(mem[1])
        mem.shift()
        mem.shift()
    } else if (typeof expression[0] == "number") {
        retVal.push("N")
        retVal.push(expression[0])
        var sliced = expression.slice(1)
        mem.push(iterator.value)
        iterator.value += 1
        compileM(retVal, mem, sliced, iterator)
    } else if(Array.isArray(expression[0])) {
        compileM(retVal, mem, expression[0], iterator)
        mem.push(iterator.value)
        iterator.value += 1
        expression = expression.slice(1)
        compileM(retVal, mem, expression, iterator)
    }
}