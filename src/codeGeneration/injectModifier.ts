/// SPDX-License-Identifier: BUSL-1.1
import { 
    cleanString
} from '../modules/Parser';

import * as fs from 'fs';
import * as diff from 'diff';
/**
 * @file injectModifier.ts
 * @description This file contains functionality for injecting Solidity modifiers into existing Solidity contracts.
 *              It modifies the contract by adding import statements, updating the contract declaration, and appending
 *              modifiers to specified functions. Additionally, it generates a diff file to track the changes made.
 * 
 * @module CodeGeneration
 * 
 * @dependencies
 * - `fs`: Used for reading and writing files.
 * - `diff`: Used for generating a diff of the changes made to the contract file.
 * - `Parser`: Provides helper functions for cleaning strings.
 * 
 * @functions
 * - `injectModifier`: Injects a Solidity modifier into a specified function within a contract file, updates the contract
 *   declaration, and generates a diff file to track the changes.
 * 
 * @usage
 * - Use this file to dynamically inject modifiers into Solidity contracts for enforcing rules.
 * - Example:
 *   ```typescript
 *   import { injectModifier } from './injectModifier';
 *   injectModifier('transfer', 'address user, uint256 amount', './contracts/UserContract.sol', './diffs/UserContract.diff');
 *   ```
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license UNLICENSED
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling the dynamic modification of Solidity contracts
 *       to integrate rule enforcement logic.
 */


/**
 * Injects a modifier into a Solidity contract file by modifying its content.
 * 
 * This function performs the following operations:
 * 1. Adds an import statement for `RulesEngineClientCustom` after the pragma line.
 * 2. Updates the contract declaration to inherit from `RulesEngineClientCustom`.
 * 3. Adds a `checkRulesBefore` modifier to the specified function with the provided arguments.
 * 4. Writes the modified content back to the file and generates a diff file showing the changes.
 * 
 * @param funcName - The name of the function to which the modifier will be added.
 * @param variables - A comma-separated string of variables to be passed to the modifier.
 *                    Supported types include `address`, `uint256`, `string`, `bool`, and `bytes`.
 * @param userFilePath - The file path of the Solidity contract to be modified.
 * @param diffPath - The file path where the diff of the changes will be saved.
 * 
 * @remarks
 * - The function assumes the Solidity file uses standard formatting for pragma, contract declaration, and function definitions.
 * - The `checkRulesBefore` modifier is added to the function signature with the provided arguments.
 * - The diff file is generated in a format that highlights added and removed lines.
 * 
 * @throws Will throw an error if the file at `userFilePath` cannot be read or written.
 * @throws Will throw an error if the provided function name or variables are invalid.
 */
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
