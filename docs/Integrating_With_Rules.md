## Integrating with Rules

You now have a policy created with the rules you want defined. All that's left is to integrate the rules into your contract. The easiest way to do this is to use the `generateModifier` function. This function will generate a solidity contract with a modifier for your contract that will check the rules before the function is called.

```typescript
generateModifier(ruleString, outputFileName)
```

From here you can use the `injectModifier` function to inject the modifier into your contract.

```typescript
injectModifier(functionName, argList, contractFileName, outputFileName)
```

Alternatively you can manually inject the modifier into your contract by adding the modifier to your contract and then calling the `_invokeRulesEngine` function.

```solidity
modifier checkRulesBefore() {
    bytes memory encoded = abi.encodeWithSelector(msg.sig, ...yourArgsHere);
    _invokeRulesEngine(encoded);
    _;
}
```

and then add the `checkRulesBefore` modifier to your function that you want rules applied on.

## Becoming the Contract Admin For Your Rules

In order to become the contract admin for your rules, you need to call the `setCallingContractAdmin` function which will come as part of the inherited `RulesClient` contract. 

```solidity
    function setCallingContractAdmin(address callingContractAdmin) external;
```

This function will set the calling contract admin to the address of the contract that is calling the function. It can only be set by the contract itself and a contract can only limit itself. It also will only grant one admin at a time, but this can take the form of a multisig wallet. 

Once your admin is set you will now be able to apply your policy to the contract. From the admin account, call the `applyPolicy` function.

```solidity
    function applyPolicy(address contractAddress, uint256[] memory policyIds) external;
```

This function will apply a list of policy ids to the contract.

Once the policy is applied, the rules will be checked before the function is called.

## Testing Your Rules

You can test that your rules are working by calling the contract function that you applied the policy to. If the rules are not met, the function, the negative effects will be invoked. This could take the form of a revert, a log, or a call to another contract. To test this it's recommended that you use a framework like [foundry](https://book.getfoundry.sh/index.html) or [hardhat](https://hardhat.org/hardhat-runner/docs/getting-started) and write a fork test or a unit test that can be called on live state (forked testnet or local network). This will allow you to simulate the proper results of the rules.