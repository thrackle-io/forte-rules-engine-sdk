import {
    simulateContract,
    writeContract, 
    readContract
} from "@wagmi/core";
import { account, getConfig } from "../../config"
import { sleep } from "./ContractInteractionUtils"
import { parseTrackerSyntax } from "./Parser"
import { RulesEngineComponentContract, trackerJSON, TrackerDefinition } from "./types"

/**
 * @file Trackers.ts
 * @description This module provides a comprehensive set of functions for interacting with the Trackers within the Rules Engine smart contracts.
 *              It includes functionality for creating, updating, retrieving, and deleting trackers.
 * 
 * @module ContractInteraction
 * 
 * @dependencies
 * - `viem`: Provides utilities for encoding/decoding data and interacting with Ethereum contracts.
 * - `Parser`: Contains helper functions for parsing rule syntax, trackers, and foreign calls.
 * - `@wagmi/core`: Provides utilities for simulating, reading, and writing to Ethereum contracts.
 * - `config`: Provides configuration for interacting with the blockchain.
 * 
 * 
 * @author @mpetersoCode55, @ShaneDuncan602, @TJ-Everett, @VoR0220
 * 
 * @license UNLICENSED
 * 
 * @note This file is a critical component of the Rules Engine SDK, enabling seamless integration with the Rules Engine smart contracts.
 */

const config = getConfig()

/**
 * Asynchronously sets or updates a tracker in the rules engine component contract.
 *
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to update. If 0, a new tracker will be created.
 * @param trSyntax - A JSON string representing the tracker syntax.
 * @param rulesEngineComponentContract - The contract instance for interacting with the rules engine component.
 * @returns A promise that resolves to the tracker ID. If a new tracker is created, the new tracker ID is returned.
 *          If an update is performed, the existing tracker ID is returned. Returns -1 if the operation fails.
 *
 * @throws Will retry indefinitely with a 1-second delay between attempts if an error occurs during the contract simulation.
 *         Ensure proper error handling or timeout mechanisms are implemented to avoid infinite loops.
 */
export const setTracker = async(policyId: number, trackerId: number, trSyntax: string, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {
    var json : trackerJSON = JSON.parse(trSyntax)
    var tracker: TrackerDefinition = parseTrackerSyntax(json)
    var transactionTracker = {set: true, pType: tracker.type, trackerValue: tracker.defaultValue }
    var addTR
    while(true) {
        try {
            addTR = trackerId == 0 ? await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "createTracker",
                args: [ policyId,  transactionTracker ],
            }) : await simulateContract(config, {
                address: rulesEngineComponentContract.address,
                abi: rulesEngineComponentContract.abi,
                functionName: "updateTracker",
                args: [ policyId,  trackerId, transactionTracker ],
            });
            break
        } catch (err) {
            // TODO: Look into replacing this loop/sleep with setTimeout
            await sleep(1000)
        }
    }
    if(addTR != null) {
        await writeContract(config, {
            ...addTR.request,
            account
        });

        let trackerResult = addTR.result 
        return trackerId == 0 ? trackerResult : trackerId;
    }
    return -1;
}

/**
 * Deletes a tracker associated with a specific policy in the rules engine component contract.
 *
 * @param policyId - The ID of the policy to which the tracker belongs.
 * @param trackerId - The ID of the tracker to be deleted.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @returns A promise that resolves to a number:
 *          - `0` if the tracker was successfully deleted.
 *          - `-1` if an error occurred during the simulation of the contract interaction.
 *
 * @throws This function does not explicitly throw errors but will return `-1` if an error occurs during the simulation phase.
 */
export const deleteTracker = async(policyId: number, trackerId: number,  
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<number> => {

    var addFC
    try {
        addFC = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "deleteTracker",
            args: [ policyId, trackerId ],
        })
    } catch (err) {
        return -1
    }

    if(addFC != null) {
        await writeContract(config, {
            ...addFC.request,
            account
        });
    }
    
    return 0
}

/**
 * Retrieves a tracker from the Rules Engine Component Contract based on the provided policy ID and tracker ID.
 *
 * @param policyId - The ID of the policy associated with the tracker.
 * @param trackerId - The ID of the tracker to retrieve.
 * @param rulesEngineComponentContract - The contract instance containing the address and ABI for interaction.
 * @returns A promise that resolves to the tracker result if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the contract interaction fails.
 */
export const getTracker = async(policyId: number, trackerId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getTracker",
            args: [ policyId, trackerId ],
        });
    

        await readContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result
        return trackerResult;
    } catch (error) {
    console.error(error);
        return null;
    }
}

/**
 * Retrieves all trackers associated with a specific policy ID from the Rules Engine Component Contract.
 *
 * @param policyId - The unique identifier of the policy for which trackers are to be retrieved.
 * @param rulesEngineComponentContract - An object representing the Rules Engine Component Contract, 
 * including its address and ABI.
 * @returns A promise that resolves to an array of trackers if successful, or `null` if an error occurs.
 *
 * @throws Will log an error to the console if the operation fails.
 */
export const getAllTrackers = async(policyId: number, 
    rulesEngineComponentContract: RulesEngineComponentContract): Promise<any[] | null> => {
    try {
        const retrieveTR = await simulateContract(config, {
            address: rulesEngineComponentContract.address,
            abi: rulesEngineComponentContract.abi,
            functionName: "getAllTrackers",
            args: [ policyId],
        });
    

        await readContract(config, {
            ...retrieveTR.request,
            account
        });

        let trackerResult = retrieveTR.result
        return trackerResult;
    } catch (error) {
        console.error(error);
        return null;
    }
}