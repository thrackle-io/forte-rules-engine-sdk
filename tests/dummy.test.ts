/// SPDX-License-Identifier: BUSL-1.1
import { getAddress, toFunctionSelector, toHex } from "viem";
import { expect, test, describe, beforeAll, beforeEach } from "vitest";
import {
  getConfig,
  DiamondAddress,
  connectConfig,
  createTestConfig,
  foundryAccountAddress,
} from "../src/config";
import {
  getRulesEnginePolicyContract,
  getRulesEngineComponentContract,
  getRulesEngineRulesContract,
  getRulesEngineAdminContract,
  getRulesEngineForeignCallContract,
} from "../src/modules/contract-interaction-utils";
import {
  createForeignCall,
  deleteForeignCall,
  updateForeignCall,
  getForeignCall,
  getAllForeignCalls,
} from "../src/modules/foreign-calls";
import {
  createCallingFunction,
  deleteCallingFunction,
} from "../src/modules/calling-functions";
import {
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicy,
  policyExists,
  getAppliedPolicyIds,
  setPolicies,
  isClosedPolicy,
  closePolicy,
  openPolicy,
  isClosedPolicySubscriber,
  addClosedPolicySubscriber,
  removeClosedPolicySubscriber,
  cementPolicy,
  isCementedPolicy,
  getPolicyMetadata,
} from "../src/modules/policy";
import {
  createRule,
  getAllRules,
  updateRule,
  deleteRule,
  getRuleMetadata,
} from "../src/modules/rules";
import {
  createTracker,
  updateTracker,
  getTracker,
  getAllTrackers,
  deleteTracker,
} from "../src/modules/trackers";
import { sleep } from "../src/modules/contract-interaction-utils";
import { Config } from "@wagmi/core";
import {
  confirmNewCallingContractAdmin,
  confirmNewForeignCallAdmin,
  confirmNewPolicyAdmin,
  isCallingContractAdmin,
  isForeignCallAdmin,
  isPolicyAdmin,
  proposeNewCallingContractAdmin,
  proposeNewForeignCallAdmin,
  proposeNewPolicyAdmin,
} from "../src/modules/admin";

// Hardcoded address of the diamond in diamondDeployedAnvilState.json
var config: Config;
var client: any;
var secondUserConfig: Config;
var secondUserClient: any;

// Take snapshot
export const takeSnapshot = async () => {
  const snapshotId = await client.snapshot();
  return snapshotId;
};

// Revert to snapshot
export const revertToSnapshot = async (snapshotId: any) => {
  await client.revert({ id: snapshotId });
};

describe("Rules Engine Interactions", async () => {
  const rulesEngineContract: `0x${string}` = DiamondAddress;
  // Vanity address for now, lets try to eventually deploy a real token contract and use that here instead
  const policyApplicant: `0x${string}` = getAddress(
    "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef"
  );
  let snapshotId: `0x${string}`;
  config = await createTestConfig();
  client = config.getClient({ chainId: config.chains[0].id });
  secondUserConfig = await createTestConfig(false);
  secondUserClient = secondUserConfig.getClient({
    chainId: secondUserConfig.chains[0].id,
  });

  let emptyPolicyJSON = `
        {
        "Policy": "Test Policy",
        "Description": "This is a test policy",
        "PolicyType": "open",
        "CallingFunctions": [

        ],
        "ForeignCalls": [

        ],
        "Trackers": [

        ],
        "MappedTrackers": [],
        "Rules": [
            ]
            }`;

  beforeAll(async () => {
    await connectConfig(config, 0);
    await connectConfig(secondUserConfig, 0);
    snapshotId = await takeSnapshot();
  });

  beforeEach(async () => {
    await revertToSnapshot(snapshotId);
  });

  const options = {
    timeout: 999999,
  };
  test("Can retrieve a full simple policy", async () => {
    var policyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "Test Policy Description",
            "PolicyType": "open",
            "CallingFunctions": [
              {
                "name": "transfer(address to, uint256 value)",
                "functionSignature": "transfer(address to, uint256 value)",
                "encodedValues": "address to, uint256 value"
              }
            ],
            "ForeignCalls": [],
            "Trackers": [
            {
                "name": "testTracker",
                "type": "string",
                "initialValue": "1000"
            }
            ],
            "MappedTrackers": [],
            "Rules": [
                {
                    "Name": "Rule A",
                    "Description": "Rule A Description",
                    "condition": "value > 500",
                    "positiveEffects": ["revert('Positive')"],
                    "negativeEffects": ["revert('Negative')"],
                    "callingFunction": "transfer(address to, uint256 value)"
                }
            ]
            }`;


    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyJSON
    );
    expect(result.policyId).toBeGreaterThanOrEqual(0);
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    );

    expect(resultFC?.length).toEqual(0);
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(resultTR?.length).toEqual(1);
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    );

    const parsed = JSON.parse(retVal);

    const input = JSON.parse(policyJSON);
    input.Trackers[0].initialValue = "";
    input.Rules[0].positiveEffects = ["revert()"];
    input.Rules[0].negativeEffects = ["revert()"];

    expect(parsed.Policy).toEqual(input.Policy);
    expect(retVal).toEqual(JSON.stringify(input));
  });

  /**
  test("Can retrieve a full policy", async () => {
    var policyJSON = `
            {
            "Policy": "Test Policy",
            "Description": "Test Policy Description",
            "PolicyType": "open",
            "CallingFunctions": [
              {
                "name": "TestCallingFunction",
                "functionSignature": "transfer(address to, uint256 value)",
                "encodedValues": "address to, uint256 value"
              }
            ],
            "ForeignCalls": [
                {
                    "name": "ATestForeignCall",
                    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                    "function": "testSig(address,uint256,uint256)",
                    "returnType": "uint256",
                    "valuesToPass": "to, FC:testSigTwo, TR:testTracker",
                    "mappedTrackerKeyValues": "",
                    "callingFunction": "transfer(address to, uint256 value)"
                },
                {
                    "name": "AnotherTestForeignCall",
                    "address": "0xa5cc3c03994DB5b0d9A5eEdD10CabaB0813678AC",
                    "function": "testAnotherSig(address)",
                    "returnType": "uint256",
                    "valuesToPass": "to",
                    "mappedTrackerKeyValues": "",
                    "callingFunction": "transfer(address to, uint256 value)"
                }
            ],
            "Trackers": [
            {
                "name": "testTracker",
                "type": "string",
                "initialValue": "1000"
            }
            ],
            "MappedTrackers": [
            {
                "name": "testMappedTracker",
                "keyType": "address",
                "valueType": "uint256",
                "initialKeys": ["0xb7f8bc63bbcad18155201308c8f3540b07f84f5e"],
                "initialValues": ["1"]
            }
            ],
            "Rules": [
                {
                    "Name": "Rule A",
                    "Description": "Rule A Description",
                    "condition": "TR:testTracker > 500 AND TR:testMappedTracker(to) < 10",
                    "positiveEffects": ["emit Success", "TRU:testTracker -= 1", "TRU:testMappedTracker(to) += 1"],
                    "negativeEffects": ["revert()"],
                    "callingFunction": "transfer(address to, uint256 value)"
                }
            ]
            }`;
  
  
    var result = await createPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      policyJSON
    );
    expect(result.policyId).toBeGreaterThanOrEqual(0);
    var resultFC = await getAllForeignCalls(
      config,
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    );
  
    expect(resultFC?.length).toEqual(1);
    var resultTR = await getAllTrackers(
      config,
      getRulesEngineComponentContract(rulesEngineContract, client),
      result.policyId
    );
    expect(resultTR?.length).toEqual(2);
    var retVal = await getPolicy(
      config,
      getRulesEnginePolicyContract(rulesEngineContract, client),
      getRulesEngineRulesContract(rulesEngineContract, client),
      getRulesEngineComponentContract(rulesEngineContract, client),
      getRulesEngineForeignCallContract(rulesEngineContract, client),
      result.policyId
    );
  
    const parsed = JSON.parse(retVal);
  
    const input = JSON.parse(policyJSON);
    input.Trackers[0].initialValue = "";
    input.MappedTrackers[0].initialKeys = [];
    input.MappedTrackers[0].initialValues = [];
    input.ForeignCalls[0].function = "0x33be85f8";
  
    expect(parsed.Policy).toEqual(input.Policy);
    expect(retVal).toEqual(JSON.stringify(input));
  });
  */



});
