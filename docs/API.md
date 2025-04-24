## Integating The SDK

An example application that integrates the Rules SDK can be found at [SDK Integration Test](https://github.com/thrackle-io/forte-rules-engine-sdk-integration-test)

In order to Integrate the SDK with your project you'll need to place both in the same parent directory (this requirement will be removed once the SDK has been setup as a NPM package).

In your project you'll want to import the SDK calls you intend to use from 'forte-rules-sdk/src/index'. For example if you intended to use the createFullPolicy and retrieveFullPolicy SDK calls to create a policy and verify that the policy created on chain matches what you submitted you'd use the following import statement (you'll also likely want to the getRulesEngineContract helper function):

```c
import { getRulesEngineContract, createFullPolicy, retrieveFullPolicy } from "../../forte-rules-engine-sdk/src/index"
```

## Available API Calls

### getRulesEngineContract

#### Overview

This utility call is used to retrieve a RulesEngineContract object representing the rules engine instance the SDK will be communicating with. (This RulesEngineContract object will be a required parameter for the vast majority of the rest of the SDK calls)

#### Parameters

- address: The address of the Rules Engine instance the SDK will be communicating with
- client: The viem client object to be used for on chain communication

#### Return

The RulesEngineContract object representing the Rules Engine instance the SDK will be communicating with.

### createBlankPolicy

#### Overview

This call is used to create an empty policy

#### Parameters

- contractAddressForPolicy: address of the user contract to apply the policy to
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.

#### Return

The policy id

### retrieveRule

#### Overview

Retrieve the Rules Struct for a specific rule

#### Parameters

- policyId: The id of the policy the rule belongs to
- ruleId: The id of the rule itself
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.

#### Return

The Rule struct for the requested rule.

### retrieveFullPolicy

#### Overview

Retrieves the JSON representation of a policy

#### Parameters

- policyId: The id of the requested policy
- functionSignatureMappings: mapping of the function signature bytes4 repesentation to the string represetation
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.

#### Return

The JSON (string) representation of the requested policy

### createFullPolicy

#### Overview

Creates a full policy including the policy itself and any associated rules, foreign calls and trackers.
The call also generates the Solidity modifiers necessary to integrate the rules engine in the users contract.
If the location of the users contract is passed in to the optional contractToModify parameter, the call will also
modify the users contract to add the modifiers to the appropriate function(s)

#### Parameters

- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.
- policySyntax: The JSON representation of the policy
- contractAddressForPolicy: The address of the users contract to apply the policy to.
- outputFileName: the location and name of the file to write the solidity modifiers to
- contractToModify: optional parameter for the location of the users contract to modify (adding the modifiers)

#### Return

The Policy Id

### updatePolicy

#### Overview

Update the function signatures and/or rules associated with a policy

#### Parameters

- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.
- policyId: The Id of the policy to update
- signatures: The bytes4 represntations of the function signatures
- ids: The Ids for the function signatures
- ruleIds: The Ids for the rules

#### Return

The Policy Id

### createFunctionSignature

#### Overview

Creates a new function signature

#### Parameters

- policyId: The Id of the policy the function signature belongs to
- functionSignature: The string representation of the function signature
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

The function signature Id

### createForeignCall

#### Overview

Creates a new foreign call

#### Parameters

- policyId: The Id of the policy the foreign call belongs to
- fcSyntax: The string representation of the foreign call
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

The foreign call Id.

### createTracker

#### Overview

Creates a new tracker

#### Parameters

- policyId: The Id of the policy the tracker belongs to
- trSyntax: The string representation of the tracker
- rulesEngineConrtact: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

The tracker Id.

### getForeignCall

#### Overview

Retrieve a specific foreign call

#### Parameters

- policyId: The Id of the policy the foreign call belongs to
- foreignCallId: The Id of the foreign call
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

The Foreign Call struct

### getTracker

#### Overview

Retrieve a specific tracker

#### Parameters

- policyId: The Id of the policy the tracker belongs to
- trackerId: The Id of the tracker
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

The Tracker struct

### getAllForeignCalls

#### Overview

Retrieves all of the foreign calls for a policy.

#### Parameters

- policyId: The Id of the policy the foreign calls belong to
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

Array of Foreign Call structures for all foreign calls associated with the policy

### getAllTrackers

#### Overview

Retrieves all of the trackers for a policy.

#### Parameters

- policyId: The Id of the policy the trackers belong to
- rulesEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating

#### Return

Array of Tracker structures for all trackers associated with the policy

### createNewRule

#### Overview

Creates a new rule and attaches it to the specified policy

#### Parameters

- policyId: The Id of the policy the rule will be tied to
- ruleSyntax: The human readable syntax definition of the rule
- ruleEngineContract: The RulesEngineContract object representing the Rules Engine instance the SDk will be communicating with.
- foreignCallNameToID: The ampping of foreign call names to their Ids
- outputFileName: the location and name of the file to write the solidity modifiers to
- contractToModify: optional parameter for the location of the users contract to modify (adding the modifiers)

#### Return

The Rule Id
