## Integrating with Rules

You now have a policy created with the rules you want defined. All that's left is to integrate the rules into your contract. To begin you should generate a client contract that will act as the interface between your contract and the rules engine.

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./IRulesEngine.sol";

/**
 * @title Rules Engine Client
 * @author @ShaneDuncan602
 * @dev The abstract contract containing function to connect to the Rules Engine.
 */
abstract contract RulesEngineClient {

    address public rulesEngineAddress;

    /**
     * Set the Rules Engine address
     * @dev Function should be overridden within inheriting contracts to add Role Based Controls appropriate for your needs.
     * @param rulesEngine rules engine address
     */
    function setRulesEngineAddress(address rulesEngine) public virtual {
        rulesEngineAddress = rulesEngine;
    }

    /**
     * @dev This function makes the call to the Rules Engine. This requires the parameters to be properly encoded. The preferred encoding strategy is: bytes memory encoded = abi.encodeWithSelector(msg.sig, to, value, msg.sender);
     * @param encoded encoded data to be passed to the rules engine
     * @return retval return value from the rules engine
     */
    function _invokeRulesEngine(bytes memory encoded) internal returns (uint256 retval) {
        if (rulesEngineAddress != address(0)) return IRulesEngine(rulesEngineAddress).checkPolicies(address(this), encoded);
    }

    /**
     * @dev Set the calling contract admin address
     */
    function setCallingContractAdmin(address callingContractAdmin) external {
        IRulesEngine(rulesEngineAddress).grantCallingContractRole(address(this), callingContractAdmin);
    }
}
```

This should be inherited by your contract and the `setRulesEngineAddress` function should be called upon deployment to set the rules engine address to the address of your rules engine.

Once this is complete you can create a modifier that will check the rules before the function is called and also add any extraneous parameters to the function that are required by your rules (msg.sender, msg.value, block.timestamp, etc).

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
