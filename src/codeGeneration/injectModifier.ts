import { 
    cleanString
} from '../modules/Parser';

import * as fs from 'fs';
import * as diff from 'diff';

export function injectModifier(funcName: string, variables: string, userFilePath: string, diffPath: string) {
    funcName = cleanString(funcName)

    //find pragma line and inject import statement after 
    var data = fs.readFileSync(userFilePath, 'utf-8')
    var reg = /(?<=pragma).+?(?=;)/g;
    const matches = data.matchAll(reg);
    var modifiedData = ''
    for (const match of matches) {
        const fullFcExpr = match[0];
        modifiedData = data.replace(fullFcExpr, fullFcExpr + ';\nimport "src/client/RulesEngineClientCustom.sol"')
        break
    }  

    // Find and replace Contract Name Line
    var regNew = /(?<=contract).+?(?={)/g;
    const contractMatches = data.matchAll(regNew);
    for (const match of contractMatches) {
        const fullFcExpr = match[0];
        modifiedData = modifiedData.replace(fullFcExpr, fullFcExpr + 'is RulesEngineClientCustom ')
        break
    }

    // Find Function and place modifier
    var functionName = "function "

    var argListUpdate = variables.replace(/address /g , '')
    argListUpdate = argListUpdate.replace(/uint256 /g, '')
    argListUpdate = argListUpdate.replace(/string /g, '')
    argListUpdate = argListUpdate.replace(/bool /g, '')
    argListUpdate = argListUpdate.replace(/bytes /g, '')
    const regex = new RegExp(`${functionName + funcName}(.*?)\\)`, 'g');
    const funcMatches = data.matchAll(regex);
    for (const match of funcMatches) {
        const fullFcExpr = match[0];
        modifiedData = modifiedData.replace(fullFcExpr, fullFcExpr + ' checkRulesBefore(' + argListUpdate + ')')
        break
    }
    
    // Write the modified data back to the file
    fs.writeFileSync(userFilePath, modifiedData, 'utf-8')

    const diffResult = diff.diffLines(data, modifiedData);
    var newData = ''
    diffResult.forEach((part) => {
        if (part.added) {
            newData += '+' + part.value + '\n'
        } else if (part.removed) {
            newData += '-' + part.value + '\n'
        } else {
            newData += ' ' + part.value + '\n'
        }
    })

    fs.writeFileSync(diffPath, newData, 'utf-8')
}
