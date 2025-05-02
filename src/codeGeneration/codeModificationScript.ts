import * as fs from 'fs';
import * as path from 'path';
import { generateModifier } from './generateSolidity';
import { injectModifier } from './injectModifier';

interface ForeignCall {
    name: string;
    address: string;
    signature: string;
    returnType: string;
    parameterTypes: string;
    encodedIndices: string;
}

interface Tracker {
    name: string;
    type: string;
    defaultValue: any;
}

interface Rule {
    condition: string;
    positiveEffects: string[];
    negativeEffects: string[];
    functionSignature: string;
    encodedValues: string;
}

interface PolicyConfig {
    Policy: string;
    ForeignCalls: ForeignCall[];
    Trackers: Tracker[];
    RulesJSON: Rule[];
}

/**
 * Validates a list of file paths to ensure they exist and have .sol extension
 * @param filePaths Array of file paths to validate
 * @returns Array of valid Solidity file paths
 */
function validateSolidityFiles(filePaths: string[]): string[] {
    const validFiles: string[] = [];
    
    for (const filePath of filePaths) {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.warn(`Warning: File does not exist: ${filePath}`);
            continue;
        }
        
        // Check if file has .sol extension
        if (path.extname(filePath).toLowerCase() !== '.sol') {
            console.warn(`Warning: File is not a Solidity file: ${filePath}`);
            continue;
        }
        
        validFiles.push(filePath);
    }
    
    return validFiles;
}

/**
 * Checks if a file contains a specific function signature
 * @param filePath Path to the file to check
 * @param functionSignature Function signature to look for
 * @returns True if the function signature is found in the file
 */
function fileContainsFunction(filePath: string, functionSignature: string): boolean {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    
    // Extract function name and parameters from the signature
    const functionNameMatch = functionSignature.match(/^([^(]+)\s*\(/);
    if (!functionNameMatch) return false;
    
    const functionName = functionNameMatch[1].trim();
    
    // Create a regex pattern that looks for the function name followed by parameters
    // This is a simplified approach and might need refinement for complex cases
    const regexPattern = `function\\s+${functionName}\\s*\\([^)]*\\)`;
    const regex = new RegExp(regexPattern, 'i');
    
    return regex.test(fileContent);
}

/**
 * Processes a policy configuration file and injects modifiers into matching Solidity files
 * @param configPath Path to the policy JSON configuration file
 * @param outputFile The directory and name of the file to create for the modifiers
 * @param filePaths Array of Solidity file paths to process
 */
export function policyModifierGeneration(configPath: string, outputFile: string, filePaths: string[]): void {
    // Validate Solidity files
    const validFiles = validateSolidityFiles(filePaths);
    if (validFiles.length === 0) {
        console.error('Error: No valid Solidity files provided');
        return;
    }
    
    console.log(`Found ${validFiles.length} valid Solidity files to process`);
    
    // Read and parse the policy configuration
    const configData = fs.readFileSync(configPath, 'utf-8');
    const policyConfig: PolicyConfig = JSON.parse(configData);
    
    console.log(`Processing policy: ${policyConfig.Policy}`);
    console.log(`Found ${policyConfig.RulesJSON.length} rules to process`);
    
    // Create a temporary directory for modifier files
    const tempDir = path.join(process.cwd(), '.temp-modifiers');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    generateModifier(configData, outputFile)
    // Process each rule
    policyConfig.RulesJSON.forEach((rule, index) => {
        const functionName = rule.functionSignature.split('(')[0].trim();
        
        // Find files that contain the function signature and inject the modifier
        let injectionCount = 0;
        for (const filePath of validFiles) {
            if (fileContainsFunction(filePath, rule.functionSignature)) {
                console.log(`Found matching function in ${filePath}`);
                
                // Inject the modifier (without creating a diff file)
                injectModifier(
                    functionName,
                    rule.encodedValues,
                    filePath,
                    'diff.diff', // Empty string means no diff file will be created
                    outputFile
                );
                
                injectionCount++;
            }
        }
        
        if (injectionCount === 0) {
            console.warn(`Warning: No files found containing function ${rule.functionSignature}`);
        } else {
            console.log(`Injected modifier for ${functionName} into ${injectionCount} files`);
        }
    });
    
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    console.log('Policy processing complete!');
}

/**
 * Command-line entry point
 */
if (require.main === module) {
    // Parse command line arguments
    const args = process.argv.slice(3);
    
    if (args.length < 3) {
        console.error('Usage: node codeModificationScript.js <config-path> < > <file-path-1> [file-path-2] ...');
        process.exit(1);
    }
    
    const configPath = args[0];
    const outputFile = args[1]
    const filePaths = args.slice(2); // All remaining arguments are file paths
    
    policyModifierGeneration(configPath, outputFile, filePaths);
}