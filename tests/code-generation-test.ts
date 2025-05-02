/// SPDX-License-Identifier: BUSL-1.1
import { expect, test } from 'vitest'
import { keccak256, hexToNumber, encodePacked, getAddress, toBytes, toHex } from 'viem';
import { generateModifier } from '../src/codeGeneration/generate-solidity'
import { injectModifier } from '../src/codeGeneration/inject-modifier'
import * as fs from 'fs';

test('Code Generation test)', () => {
    var policyJSON = `
        {
        "Policy": "Test Policy", 
        "PolicyType": "open",
        "ForeignCalls": [
            {
                "name": "Simple Foreign Call",
                "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                "signature": "testSig(address)",
                "returnType": "uint256",
                "parameterTypes": "address",
                "encodedIndices": "0"
            }
        ], 
        "Trackers": [
        {
            "name": "Simple String Tracker",
            "type": "string",
            "defaultValue": "test" 
        }
        ],
        "RulesJSON": [
            {
                "condition": "value > 500",
                "positiveEffects": ["emit Success"],
                "negativeEffects": ["revert()"],
                "functionSignature": "transfer(address to, uint256 value)",
                "encodedValues": "address to, uint256 value"
            }
        ]
        }`;
    generateModifier(policyJSON, "src/testOutput/testFileA.sol")
    injectModifier("transfer", 'address to, uint256 value, uint256 somethinElse', 'src/testOutput/UserContract.sol', 'src/testOutput/diff.diff', "src/testOutput/testFileA.sol")
    expect(fs.existsSync('src/testOutput/diff.diff')).toBeTruthy()
    expect(fs.existsSync('src/testOutput/testFileA.sol')).toBeTruthy()

    fs.readFile('src/testOutput/UserContract.sol', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        expect(data.includes('checkRulesBeforetransfer(')).toBeTruthy()
    })

});


