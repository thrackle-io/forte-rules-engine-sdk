// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "./RulesEngineClient.sol";

/**
 * @title Rules Engine Client Custom Modifiers
 */
abstract contract RulesEngineClientCustom is RulesEngineClient {
    modifier checkRulesBefore(uint256 value) {
		bytes memory encoded = abi.encodeWithSelector(msg.sig, value, msg.sender);
		_invokeRulesEngine(encoded);
		_;
	}

	modifier checkRulesAfter(uint256 value) {
		bytes memory encoded = abi.encodeWithSelector(msg.sig, value, msg.sender);
		_;
		_invokeRulesEngine(encoded);
	}
}
