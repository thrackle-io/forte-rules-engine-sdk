import { Address } from "viem"
import { FCNameToID, hexToFunctionSignature, RulesEngineComponentABI, RulesEngineComponentContract, RulesEnginePolicyABI, RulesEnginePolicyContract, RuleStruct } from "./modules/types"

export interface IRulesEngine{

    /**
     * Creates a policy in the Rules Engine.
     * 
     * @param policyJSON - Policy defined in a JSON string.
     * @returns The ID of the newly created policy.
     */
    createPolicy(policyJSON: string): Promise<number> 
    /**
     * Updates an existing policy in the Rules Engine.
     * 
     * @param policyId - The ID of the policy to update.
     * @param signatures - The function signatures associated with the policy.
     * @param ids - The IDs of the rules associated with the policy.
     * @param ruleIds - The mapping of rules to function signatures.
     * @returns The result of the policy update.
     */
    updatePolicy(policyId: number, signatures: any[], ids: number[], ruleIds: any[]): Promise<number>

    /**
     * Applies a policy to a specific contract address.
     * 
     * @param policyId - The ID of the policy to apply.
     * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
     * @returns The result of the policy application.
     */
    applyPolicy(policyId: number, contractAddressForPolicy: Address): Promise<number>

    /**
     * Deletes a policy from the Rules Engine.
     * 
     * @param policyId - The ID of the policy to delete.
     * @returns `0` if successful, `-1` if an error occurs.
     */
    deletePolicy(policyId: number): Promise<number>

    /**
     * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
     * 
     * @param policyId - The ID of the policy to retrieve.
     * @param functionSignatureMappings - A mapping of function signatures to their hex representations.
     * @returns A JSON string representing the full policy.
     */
    getPolicy(policyId: number, functionSignatureMappings: hexToFunctionSignature[]): Promise<string>


    /**
     * Asynchronously creates a new rule in the rules engine policy contract.
     *
     * @param policyId - The ID of the policy to which the rule belongs.
     * @param ruleS - A JSON string representing the rule to be created.
     * @param foreignCallNameToID - An array mapping foreign call names to their corresponding IDs.
     * @param trackerNameToID - An array mapping tracker names to their corresponding IDs.
     * @returns A promise that resolves to the result of the rule creation operation. Returns the rule ID if successful, or -1 if the operation fails.
     *
     * @throws Will log errors to the console if the contract simulation fails and retry the operation after a delay.
     *
     * @remarks
     * - The function parses the rule JSON string to build the rule and effect structures.
     * - It uses a retry mechanism with a delay to handle potential failures during contract simulation.
     */
    createNewRule(policyId: number, ruleS: string, foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[]): Promise<number>

    /**
     * Updates an existing rule in the Rules Engine Policy Contract.
     *
     * @param policyId - The ID of the policy to which the rule belongs.
     * @param ruleId - The ID of the rule to be updated.
     * @param ruleS - A JSON string representing the rule's structure and logic.
     * @param foreignCallNameToID - A mapping of foreign call names to their corresponding IDs.
     * @param trackerNameToID - A mapping of tracker names to their corresponding IDs.
     * @returns A promise that resolves to the result of the rule update operation. Returns the result ID if successful, or -1 if the operation fails.
     *
     * @throws Will retry indefinitely if the contract simulation fails, with a 1-second delay between retries.
     */
    updateRule(policyId: number, ruleId: number, ruleS: string, foreignCallNameToID: FCNameToID[], trackerNameToID: FCNameToID[]): Promise<number>

    /**
     * Deletes a rule from the rules engine component contract.
     *
     * @param policyId - The ID of the policy to which the rule belongs.
     * @param ruleId - The ID of the rule to be deleted.
     * @returns A promise that resolves to a number:
     *          - `0` if the rule was successfully deleted.
     *          - `-1` if an error occurred during the deletion process.
     *
     * @throws This function does not throw errors directly but returns `-1` in case of an exception.
     */
    deleteRule(policyId: number, ruleId: number): Promise<number>

    /**
     * Retrieves a specific rule from the Rules Engine.
     * 
     * @param policyId - The ID of the policy containing the rule.
     * @param ruleId - The ID of the rule to retrieve.
     * @returns The retrieved rule as a `RuleStruct`, or `null` if retrieval fails.
     */
    getRule(policyId: number, ruleId: number): Promise<RuleStruct | null>

    /**
     * Retrieves all rules associated with a specific policy ID from the Rules Engine Policy Contract.
     *
     * @param policyId - The unique identifier of the policy for which rules are to be retrieved.
     * @returns A promise that resolves to an array of rules if successful, or `null` if an error occurs.
     *
     * @throws Will log an error to the console if the operation fails.
     */
    getAllRules(policyId: number): Promise<any[] | null>

    // Foreign Call Management
    /**
     * Creates a foreign call in the rules engine component contract.
     *
     * @param policyId - The ID of the policy to associate with the foreign call.
     * @param fcSyntax - A JSON string representing the foreign call definition.
     * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
     *
     * @remarks
     * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
     * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
     * - The `writeContract` function is used to execute the contract interaction on the blockchain.
     * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
     *
     * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
     */
    createForeignCall(policyId: number, fcSyntax: string): Promise<number>

    /**
     * Updates a foreign call in the rules engine component contract.
     *
     * @param policyId - The ID of the policy to associate with the foreign call.
     * @param foreignCallId - The ID of the foreign call to update.
     * @param fcSyntax - A JSON string representing the foreign call definition.
     * @returns A promise that resolves to the foreign call index. Returns `-1` if the operation fails.
     *
     * @remarks
     * - The function retries the contract interaction in case of failure, with a delay of 1 second between attempts.
     * - The `simulateContract` function is used to simulate the contract interaction before writing to the blockchain.
     * - The `writeContract` function is used to execute the contract interaction on the blockchain.
     * - The function returns the `foreignCallIndex` for an updated foreign call or the result of the newly created foreign call.
     *
     * @throws Will throw an error if the JSON parsing of `fcSyntax` fails.
     */
    updateForeignCall(policyId: number, foreignCallId: number, fcSyntax: string): Promise<number>
    
    /**
     * Deletes a foreign call associated with a specific policy in the rules engine component contract.
     *
     * @param policyId - The ID of the policy to which the foreign call belongs.
     * @param foreignCallId - The ID of the foreign call to be deleted.
     * @returns A promise that resolves to a number:
     *          - `0` if the operation is successful.
     *          - `-1` if an error occurs during the simulation of the contract interaction.
     *
     * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
     */
    deleteForeignCall(policyId: number, foreignCallId: number): Promise<number>
    
    /**
     * Retrieves the result of a foreign call from the rules engine component contract.
     *
     * @param policyId - The ID of the policy associated with the foreign call.
     * @param foreignCallId - The ID of the foreign call to retrieve.
     * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
     *
     * @throws Will log an error to the console if the contract interaction fails.
     */
    getForeignCall(policyId: number, foreignCallId: number): Promise<any | null>
    
    /**
     * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
     *
     * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
     * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
     *
     * @throws Will log an error to the console if the operation fails.
     */
    getAllForeignCalls(policyId: number): Promise<any[] | null>

    /**
    * Asynchronously creates a tracker in the rules engine component contract.
    *
    * @param policyId - The ID of the policy associated with the tracker.
    * @param trSyntax - A JSON string representing the tracker syntax.
    * @returns A promise that resolves to the new tracker ID
    *
    * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
    *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
    */
    createTracker(policyId: number, trSyntax: string): Promise<number>
    
    /**
     * Asynchronously updates a tracker in the rules engine component contract.
     *
     * @param policyId - The ID of the policy associated with the tracker.
     * @param trackerId - The ID of the tracker to update.
     * @param trSyntax - A JSON string representing the tracker syntax.
     * @returns A promise that resolves to the existing tracker ID is returned. Returns -1 if the operation fails.
     *
     * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
     *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
     */
    updateTracker(policyId: number, trackerId: number, trSyntax: string): Promise<number>
    
    /**
     * Deletes a tracker associated with a specific policy in the rules engine component contract.
     *
     * @param policyId - The ID of the policy to which the tracker belongs.
     * @param trackerId - The ID of the tracker to be deleted.
     * @returns A promise that resolves to a number:
     *          - `0` if the tracker was successfully deleted.
     *          - `-1` if an error occurred during the simulation of the contract interaction.
     *
     * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
     */
    deleteTracker(policyId: number, trackerId: number): Promise<number>
    
    /**
     * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
     *
     * @param policyId - The ID of the policy associated with the tracker.
     * @param trackerId - The ID of the tracker to retrieve.
     * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
     *
     * @throws Will log an error to the console if the contract interaction fails.
     */
    getTracker(policyId: number, trackerId: number): Promise<any | null>
    
    /**
     * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
     *
     * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
     * including its address and ABI.
     * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
     *
     * @throws Will log an error to the console if the operation fails.
     */
    getAllTrackers(policyId: number): Promise<any[] | null>

    /**
     * Creates a function signature in the rules engine component contract.
     *
     * This function parses the provided function signature, maps its arguments to their respective
     * types, and interacts with the smart contract to create the function signature. If the contract
     * interaction fails, it retries with a delay until successful.
     *
     * @param policyId - The ID of the policy for which the function signature is being created.
     * @param functionSignature - The function signature string to be parsed and added to the contract.
     * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
     *
     * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
     */
    createFunctionSignature(policyId: number, functionSignature: string): Promise<number>
}