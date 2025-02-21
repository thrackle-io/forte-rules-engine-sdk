import { expect, test } from 'vitest'
import { keccak256, hexToNumber, encodePacked, getAddress, toBytes, toHex } from 'viem';
import { generateModifier } from '../src/codeGeneration/generateSolidity'
import { injectModifier } from '../src/codeGeneration/injectModifier'
import * as fs from 'fs';

test('Code Generation test)', () => {
    generateModifier("value > 4 --> revert --> transfer(address to, uint256 value) --> address to, uint256 value, uint256 somethinElse", "src/testOutput/testFileA.sol")
    injectModifier("transfer", 'address to, uint256 value, uint256 somethinElse', 'src/testOutput/UserContract.sol', 'src/testOutput/diff.diff')
    expect(fs.existsSync('src/testOutput/diff.diff')).toBeTruthy()
    expect(fs.existsSync('src/testOutput/testFileA.sol')).toBeTruthy()

    fs.readFile('src/testOutput/UserContract.sol', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        expect(data.includes('checkRulesBefore(')).toBeTruthy()
    })

});


