
// Get a default encoded values string from a function signature
export function getEncodedValues(functionSignature: string) {
    // Extract content between parentheses
    const match = functionSignature.match(/\(([^)]*)\)/);

    // Return the matched group or empty string if no match
    const encodedValues = match ? match[1] : '';
    
    return encodedValues;
}