/// SPDX-License-Identifier: BUSL-1.1
/**
 * @file RulesEngineInteraction.ts
 * @description This module provides a comprehensive set of functions for interacting with the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting policies, rules, foreign calls,
 *              trackers and calling functions.
 *
 * @module RulesEngine
 *
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 *
 *
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 *
 * @license BUSL-1.1
 *
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

import { Address, getContract } from "viem";
import {
  FCNameToID,
  CallingFunctionHashMapping,
  RulesEngineComponentABI,
  RulesEngineComponentContract,
  RulesEnginePolicyABI,
  RulesEnginePolicyContract,
  RuleStruct,
  Maybe,
  RulesEngineRulesContract,
  RulesEngineRulesABI,
  RulesEngineAdminContract,
  RulesEngineAdminABI,
} from "./types";
import {
  createPolicy as createPolicyInternal,
  updatePolicy as updatePolicyInternal,
  setPolicies as setPoliciesInternal,
  appendPolicy as appendPolicyInternal,
  deletePolicy as deletePolicyInternal,
  getPolicy as getPolicyInternal,
  policyExists as policyExistsInternal,
  getAppliedPolicyIds as getAppliedPolicyIdsInternal,
  isClosedPolicy as isClosedPolicyInternal,
  closePolicy as closePolicyInternal,
  openPolicy as openPolicyInternal,
  isClosedPolicySubscriber as isClosedPolicySubscriberInternal,
  addClosedPolicySubscriber as addClosedPolicySubscriberInternal,
  removeClosedPolicySubscriber as removeClosedPolicySubscriberInternal,
} from "./policy";

import {
  createRule as createRuleInternal,
  updateRule as updateRuleInternal,
  deleteRule as deleteRuleInternal,
  getRule as getRuleInternal,
  getAllRules as getAllRulesInternal,
} from "./rules";

import {
  createForeignCall as createForeignCallInternal,
  updateForeignCall as updateForeignCallInternal,
  deleteForeignCall as deleteForeignCallInternal,
  getForeignCall as getForeignCallInternal,
  getAllForeignCalls as getAllForeignCallsInternal,
  getForeignCallMetadata as getForeignCallMetadataInternal,
} from "./foreign-calls";

import {
  createTracker as createTrackerInternal,
  updateTracker as updateTrackerInternal,
  deleteTracker as deleteTrackerInternal,
  getTracker as getTrackerInternal,
  getAllTrackers as getAllTrackersInternal,
  getTrackerMetadata as getTrackerMetadataInternal,
} from "./trackers";

import {
  proposeNewPolicyAdmin as proposeNewPolicyAdminInternal,
  confirmNewPolicyAdmin as confirmNewPolicyAdminInternal,
  isPolicyAdmin as isPolicyAdminInternal,
  proposeNewCallingContractAdmin as proposeCallingContractAdminInternal,
  confirmNewCallingContractAdmin as confirmNewCallingContractAdminInternal,
  isCallingContractAdmin as isCallingContractAdminInternal,
} from "./admin";

import {
  createCallingFunction as createCallingFunctionInternal,
  getCallingFunctionMetadata as getCallingFunctionMetadataInternal,
} from "./calling-functions";
import { Config } from "@wagmi/core";

var config: Config;

export class RulesEngine {
  private rulesEnginePolicyContract: RulesEnginePolicyContract;
  private rulesEngineComponentContract: RulesEngineComponentContract;
  private rulesEngineRulesContract: RulesEngineRulesContract;
  private rulesEngineAdminContract: RulesEngineAdminContract;

  /**
   * @constructor
   * @param {Address} rulesEngineAddress - The address of the deployed Rules Engine smart contract.
   * @param {any} client - The client instance for interacting with the blockchain.
   */
  constructor(rulesEngineAddress: Address, localConfig: Config, client: any) {
    this.rulesEnginePolicyContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEnginePolicyABI,
      client,
    });
    this.rulesEngineComponentContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineComponentABI,
      client,
    });
    this.rulesEngineRulesContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineRulesABI,
      client,
    });
    this.rulesEngineAdminContract = getContract({
      address: rulesEngineAddress,
      abi: RulesEngineAdminABI,
      client,
    });
    config = localConfig;
  }
  public getRulesEnginePolicyContract(): RulesEnginePolicyContract {
    return this.rulesEnginePolicyContract;
  }
  public getRulesEngineComponentContract(): RulesEngineComponentContract {
    return this.rulesEngineComponentContract;
  }
  public getRulesEngineRulesContract(): RulesEngineRulesContract {
    return this.rulesEngineRulesContract;
  }
  /**
   * Creates a policy in the Rules Engine.
   *
   * @param policyJSON - Policy defined in a JSON string.
   * @returns The ID of the newly created policy.
   */
  createPolicy(policyJSON: string): Promise<{ policyId: number }> {
    return createPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      policyJSON
    );
  }

  /**
   * Checks if a policy exists in the Rules Engine.
   *
   * @param policyId - The ID of the policy to check.
   * @returns True if the policy exists, false otherwise.
   */
  policyExists(policyId: number): Promise<boolean> {
    return policyExistsInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineComponentContract,
      policyId
    );
  }

  /**
   * Updates an existing policy in the Rules Engine.
   *
   * @param policyId - The ID of the policy to update.
   * @param callingFunctions - The calling functions associated with the policy.
   * @param ids - The IDs of the rules associated with the policy.
   * @param ruleIds - The mapping of rules to calling functions.
   * @returns The result of the policy update.
   */
  updatePolicy(
    policyId: number,
    callingFunctions: any[],
    ids: number[],
    ruleIds: any[]
  ): Promise<number> {
    return updatePolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId,
      callingFunctions,
      ids,
      ruleIds
    );
  }

  /**
   * Sets the policies appled to a specific contract address.
   *
   * @param rulesEnginePolicyContract - The contract instance for interacting with the Rules Engine Policy.
   * @param policyIds - The list of IDs of all of the policies that will be applied to the contract
   * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
   */
  setPolicies(policyIds: [number], contractAddressForPolicy: Address) {
    setPoliciesInternal(
      config,
      this.rulesEnginePolicyContract,
      policyIds,
      contractAddressForPolicy
    );
  }

  /**
   * Appends a policy to the list of policies applied to a specific contract address.
   *
   * @param policyId - The ID of the policy to apply.
   * @param contractAddressForPolicy - The address of the contract to which the policy will be applied.
   */
  appendPolicy(policyId: number, contractAddressForPolicy: Address) {
    appendPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId,
      contractAddressForPolicy
    );
  }

  /**
   * Deletes a policy from the Rules Engine.
   *
   * @param policyId - The ID of the policy to delete.
   * @returns `0` if successful, `-1` if an error occurs.
   */
  deletePolicy(policyId: number): Promise<number> {
    return deletePolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId
    );
  }

  /**
   * Retrieves the full policy, including rules, trackers, and foreign calls, as a JSON string.
   *
   * @param policyId - The ID of the policy to retrieve.
   * @returns A JSON string representing the full policy.
   */
  getPolicy(policyId: number): Promise<string> {
    return getPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      this.rulesEngineRulesContract,
      this.rulesEngineComponentContract,
      policyId
    );
  }

  /**
   * Retrieves the IDs of all of the policies that have been applied to a contract address.
   * @param address - The ID of the policy to check.
   * @returns array of all of the policy ids applied to the contract
   */
  getAppliedPolicyIds(address: string): Promise<number[]> {
    return getAppliedPolicyIdsInternal(
      config,
      this.rulesEnginePolicyContract,
      address
    );
  }

  /**
   * Retrieves whether a policy is open or closed.
   * @param policyId - The ID of the policy to check.
   * @returns array of all of the policy ids applied to the contract
   */
  isClosedPolicy(policyId: number): Promise<boolean> {
    return isClosedPolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId
    );
  }

  /**
   * Opens a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to open.
   * @returns `0` if successful, `-1` if an error occurs.
   */
  openPolicy(policyId: number): Promise<number> {
    return openPolicyInternal(config, this.rulesEnginePolicyContract, policyId);
  }

  /**
   * Closes a policy on the Rules Engine.
   *
   * @param policyId - The ID of the policy to close.
   * @returns `0` if successful, `-1` if an error occurs.
   */
  closePolicy(policyId: number): Promise<number> {
    return closePolicyInternal(
      config,
      this.rulesEnginePolicyContract,
      policyId
    );
  }

  /**
   * Retrieves whether an address is a possible subscriber to the closed policy.
   * @param policyId - The ID of the policy to check.
   * @param subscriber - The address to check
   * @returns array of all of the policy ids applied to the contract
   */
  isClosedPolicySubscriber(
    policyId: number,
    subscriber: Address
  ): Promise<boolean> {
    return isClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber
    );
  }

  /** Adds a subscriber to the closed policy.
   *
   * @param policyId - The ID of the policy to add to.
   * @returns `0` if successful, `-1` if an error occurs.
   */
  addClosedPolicySubscriber(
    policyId: number,
    subscriber: Address
  ): Promise<number> {
    return addClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber
    );
  }

  /**
   * Removes a subscriber from the closed policy.
   *
   * @param policyId - The ID of the policy to remove from.
   * @returns `0` if successful, `-1` if an error occurs.
   */
  removeClosedPolicySubscriber(
    policyId: number,
    subscriber: Address
  ): Promise<number> {
    return removeClosedPolicySubscriberInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      subscriber
    );
  }

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
  createNewRule(
    policyId: number,
    ruleS: string,
    foreignCallNameToID: FCNameToID[],
    trackerNameToID: FCNameToID[]
  ): Promise<number> {
    return createRuleInternal(
      config,
      this.rulesEngineRulesContract,
      policyId,
      ruleS,
      foreignCallNameToID,
      trackerNameToID
    );
  }

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
  updateRule(
    policyId: number,
    ruleId: number,
    ruleS: string,
    foreignCallNameToID: FCNameToID[],
    trackerNameToID: FCNameToID[]
  ): Promise<number> {
    return updateRuleInternal(
      config,
      this.rulesEngineRulesContract,
      policyId,
      ruleId,
      ruleS,
      foreignCallNameToID,
      trackerNameToID
    );
  }

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
  deleteRule(policyId: number, ruleId: number): Promise<number> {
    return deleteRuleInternal(
      config,
      this.rulesEngineRulesContract,
      policyId,
      ruleId
    );
  }

  /**
   * Retrieves a specific rule from the Rules Engine.
   *
   * @param policyId - The ID of the policy containing the rule.
   * @param ruleId - The ID of the rule to retrieve.
   * @returns The retrieved rule as a `RuleStruct`, or `null` if retrieval fails.
   */
  getRule(policyId: number, ruleId: number): Promise<Maybe<RuleStruct>> {
    return getRuleInternal(
      config,
      this.rulesEngineRulesContract,
      policyId,
      ruleId
    );
  }

  /**
   * Retrieves all rules associated with a specific policy ID from the Rules Engine Policy Contract.
   *
   * @param policyId - The unique identifier of the policy for which rules are to be retrieved.
   * @returns A promise that resolves to an array of rules if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllRules(policyId: number): Promise<Maybe<any[]>> {
    return getAllRulesInternal(config, this.rulesEngineRulesContract, policyId);
  }

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
  createForeignCall(policyId: number, fcSyntax: string): Promise<number> {
    return createForeignCallInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      fcSyntax
    );
  }

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
  updateForeignCall(
    policyId: number,
    foreignCallId: number,
    fcSyntax: string
  ): Promise<number> {
    return updateForeignCallInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      foreignCallId,
      fcSyntax
    );
  }

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
  deleteForeignCall(policyId: number, foreignCallId: number): Promise<number> {
    return deleteForeignCallInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      foreignCallId
    );
  }

  /**
   * Retrieves the result of a foreign call from the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the foreign call.
   * @param foreignCallId - The ID of the foreign call to retrieve.
   * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getForeignCall(policyId: number, foreignCallId: number): Promise<Maybe<any>> {
    return getForeignCallInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      foreignCallId
    );
  }

  /**
   * Retrieves all foreign calls associated with a specific policy ID from the Rules Engine Component Contract.
   *
   * @param policyId - The ID of the policy for which foreign calls are to be retrieved.
   * @returns A promise that resolves to an array of foreign calls if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllForeignCalls(policyId: number): Promise<Maybe<any[]>> {
    return getAllForeignCallsInternal(
      config,
      this.rulesEngineComponentContract,
      policyId
    );
  }

  /**
   * Retrieves the metadata for a foreign call from the rules engine component contract.
   *
   * @param policyId - The ID of the policy associated with the foreign call.
   * @param foreignCallId - The ID of the foreign call to retrieve.
   * @returns A promise that resolves to the result of the foreign call, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getForeignCallMetadata(
    policyId: number,
    foreignCallId: number
  ): Promise<Maybe<any>> {
    return getForeignCallMetadataInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      foreignCallId
    );
  }

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
  createTracker(policyId: number, trSyntax: string): Promise<number> {
    return createTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trSyntax
    );
  }

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
  updateTracker(
    policyId: number,
    trackerId: number,
    trSyntax: string
  ): Promise<number> {
    return updateTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trackerId,
      trSyntax
    );
  }

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
  deleteTracker(policyId: number, trackerId: number): Promise<number> {
    return deleteTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trackerId
    );
  }

  /**
   * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker to retrieve.
   * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getTracker(policyId: number, trackerId: number): Promise<Maybe<any>> {
    return getTrackerInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trackerId
    );
  }

  /**
   * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
   *
   * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
   * including its address and ABI.
   * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the operation fails.
   */
  getAllTrackers(policyId: number): Promise<Maybe<any[]>> {
    return getAllTrackersInternal(
      config,
      this.rulesEngineComponentContract,
      policyId
    );
  }

  /**
   * Retrieves the metadata for a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
   *
   * @param policyId - The ID of the policy associated with the tracker.
   * @param trackerId - The ID of the tracker to retrieve.
   * @returns A promise that resolves to the tracker metadata result if successful, or `null` if an error occurs.
   *
   * @throws Will log an error to the console if the contract interaction fails.
   */
  getTrackerMetadata(
    policyId: number,
    trackerId: number
  ): Promise<Maybe<string>> {
    return getTrackerMetadataInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      trackerId
    );
  }

  /**
   * Creates a calling function in the rules engine component contract.
   *
   * This function parses the provided calling function, maps its arguments to their respective
   * types, and interacts with the smart contract to create the calling function. If the contract
   * interaction fails, it retries with a delay until successful.
   *
   * @param policyId - The ID of the policy for which the calling contract is being created.
   * @param callingFunction - The calling function string to be parsed and added to the contract.
   * @param encodedValues - the encoded values that will be sent along with the rules invocation.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  createCallingFunction(
    policyId: number,
    callingFunction: string,
    encodedValues: string
  ): Promise<number> {
    return createCallingFunctionInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunction,
      encodedValues
    );
  }

  /**
   * retrieves the metadata for a calling function from the rules engine component contract.
   *
   * @param rulesEngineComponentContract - The contract instance containing the address and ABI
   * @param policyId - The ID of the policy which the calling function belongs to.
   * @param callingFunctionId - The Calling Function ID.
   * @returns A promise that resolves to the result of the contract interaction.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  getCallingFunctionMetadata(
    policyId: number,
    callingFunctionId: number
  ): Promise<CallingFunctionHashMapping> {
    return getCallingFunctionMetadataInternal(
      config,
      this.rulesEngineComponentContract,
      policyId,
      callingFunctionId
    );
  }

  /**
   * Propose a new admin in the rules engine admin contract.
   *
   * This function proposes a new admin for a specific policy.
   *
   * @param policyId - The ID of the policy to set the admin for.
   * @param newAdminAddress - The address to propose as the new admin
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  proposeNewPolicyAdmin(policyId: number, newAdminAddress: Address) {
    proposeNewPolicyAdminInternal(
      config,
      this.rulesEngineAdminContract,
      policyId,
      newAdminAddress
    );
  }

  /**
   * Confirm a new admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific policy.
   *
   * @param policyId - The ID of the policy to set the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  confirmNewPolicyAdmin(policyId: number) {
    confirmNewPolicyAdminInternal(
      config,
      this.rulesEngineAdminContract,
      policyId
    );
  }

  /**
   * Determine if address is policy admin.
   *
   * This function determines whether or not an address is the admin for a specific policy.
   *
   * @param policyId - The ID of the policy to check the admin for.
   * @param adminAddress - The address to check
   * @returns whether or not the address is the policy admin.
   *
   */
  isPolicyAdmin(policyId: number, adminAddress: Address): Promise<boolean> {
    return isPolicyAdminInternal(
      config,
      this.rulesEngineAdminContract,
      policyId,
      adminAddress
    );
  }

  /**
   * Propose a new calling contract admin in the rules engine admin contract.
   *
   * This function proposes a new admin for a specific calling contract.
   *
   * @param rulesEngineAdminContract - The contract instance containing the address and ABI
   * @param callingContractAddress - The address of the calling contract to set the admin for.
   * @param newAdminAddress - The address to propose as the new admin
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  proposeCallingContractAdmin(
    callingContractAddress: Address,
    newAdminAddress: Address
  ) {
    proposeCallingContractAdminInternal(
      config,
      this.rulesEngineAdminContract,
      callingContractAddress,
      newAdminAddress
    );
  }

  /**
   * Confirm a new calling contract admin in the rules engine admin contract.
   *
   * This function confirms a new admin for a specific callng contract.
   *
   * @param rulesEngineAdminContract - The contract instance containing the address and ABI
   * @param callingContractAddress - The address of the calling contract to set the admin for.
   * @returns A promise that resolves to the result of the contract interaction, or -1 if unsuccessful.
   *
   * @throws Will retry indefinitely on contract interaction failure, with a delay between attempts.
   */
  confirmNewCallingContractAdmin(callingContractAddress: Address) {
    confirmNewCallingContractAdminInternal(
      config,
      this.rulesEngineAdminContract,
      callingContractAddress
    );
  }

  /**
   * Determine if address is the calling contract admin.
   *
   * This function determines whether or not an address is the admin for a specific calling contract.
   *
   * @param rulesEngineAdminContract - The contract instance containing the address and ABI
   * @param callingContract - The address of the contract to check the admin for.
   * @param adminAddress - The address to check
   * @returns whether or not the address is the calling contract admin.
   *
   */
  isCallingContractAdmin(
    callingContract: Address,
    account: Address
  ): Promise<boolean> {
    return isCallingContractAdminInternal(
      config,
      this.rulesEngineAdminContract,
      callingContract,
      account
    );
  }
}
