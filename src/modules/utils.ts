// Get a default encoded values string from a Calling Function
export function getEncodedValues(callingFunction: string) {
  // Extract content between parentheses
  const match = callingFunction.match(/\(([^)]*)\)/);

  // Return the matched group or empty string if no match
  const encodedValues = match ? match[1] : "";

  return encodedValues;
}
