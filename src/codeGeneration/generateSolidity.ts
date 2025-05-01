/// SPDX-License-Identifier: BUSL-1.1
import { 
    cleanString
} from '../modules/Parser';

import * as fs from 'fs';
import * as path from 'path';
import { ruleJSON } from '../modules/ContractInteractionUtils';
/**
 * @file generateSolidity.ts
 * @description This file contains functionality for dynamically generating Solidity modifiers based on rule definitions.
 *              It reads a template Solidity file, injects the generated modifiers, and writes the updated content to an output file.
 * 
 * @module CodeGeneration
 * 
 * @dependencies
 * - `fs`: Used for reading and writing files.
 * - `path`: Used for resolving file paths.
 * - `Parser`: Provides helper functions for cleaning strings.
 * - `ContractInteraction`: Provides the `ruleJSON` type for defining rule structures.
 * 
 * @functions
 * - `generateModifier`: Generates Solidity modifiers based on a rule JSON string and writes them to a template file.
 * 
 * @usage
 * - Use this file to generate Solidity modifiers dynamically based on rule definitions.
 * - Example:
 *   ```typescript
 *   import { generateModifier } from './generateSolidity';
 *   const ruleJSON = '{"encodedValues": "address user, uint256 amount"}';
 *   generateModifier(ruleJSON, './output/GeneratedContract.sol');
 *   ```
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license UNLICENSED
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling the dynamic generation of Solidity code
 *       for enforcing rules in smart contracts.
 */


/**
 * Generates Solidity modifiers and inserts them into a template file.
 * 
 * This function takes a JSON string representing rule data and generates two Solidity modifiers:
 * `checkRulesBefore` and `checkRulesAfter`. These modifiers are then inserted into a Solidity 
 * template file at the placeholder `// Modifier Here`. The modified Solidity code is written 
 * to the specified output file.
 * 
 * @param ruleS - A JSON string representing the rule data. It must include an `encodedValues` 
 *                property containing the argument list for the modifiers.
 * @param outputFileName - The path to the output file where the modified Solidity code will be written.
 * 
 * @throws Will throw an error if the input JSON string is invalid or if file operations fail.
 */
export function generateModifier(ruleS: string, outputFileName: string) { 
    let syntax: ruleJSON = JSON.parse(ruleS);
        var absPath = path.join(__dirname, "Template.sol")
        const filePathOutput = outputFileName
        var argList = syntax.encodedValues
        
        var modifierNameStr = 'modifier checkRulesBefore([]) {\n'
        var modifierNameAfterStr = '\tmodifier checkRulesAfter([]) {\n'

        var argListUpdate = argList.replace(/address /g , '')
        argListUpdate = argListUpdate.replace(/uint256 /g, '')
        argListUpdate = argListUpdate.replace(/string /g, '')
        argListUpdate = argListUpdate.replace(/bool /g, '')
        argListUpdate = argListUpdate.replace(/bytes /g, '')

        modifierNameStr = modifierNameStr.replace('[]', argList.trim())
        modifierNameAfterStr = modifierNameAfterStr.replace('[]', argList.trim())
        var encodeStr = '\t\tbytes memory encoded = abi.encodeWithSelector(msg.sig,[]);\n'
        encodeStr = encodeStr.replace('[]', argListUpdate)
        var thirdLine = '\t\t_invokeRulesEngine(encoded);\n'
        var fourthLine = '\t\t_;\n'
        var finalLine = '\t}'
        var outputString = modifierNameStr + encodeStr + thirdLine + fourthLine + finalLine
        var outputStringTwo = modifierNameAfterStr + encodeStr + fourthLine + thirdLine + finalLine
        var replaceStr = outputString + '\n\n' + outputStringTwo
        var data = fs.readFileSync(absPath, 'utf-8')
        var modifiedData = data.replace('// Modifier Here', replaceStr);
        
        // Write the modified data back to the file
        fs.writeFileSync(filePathOutput, modifiedData, 'utf-8');
}
