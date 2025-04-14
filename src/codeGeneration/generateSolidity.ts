import { 
    cleanString
} from '../modules/Parser';

import * as fs from 'fs';
import * as path from 'path';
import { ruleJSON } from '../modules/ContractInteraction';

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
        var encodeStr = '\t\tbytes memory encoded = abi.encodeWithSelector(msg.sig,[], msg.sender);\n'
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