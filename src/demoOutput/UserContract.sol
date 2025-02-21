// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/**
 * @title Example contract for testing the Rules Engine
 * @dev This contract provides the ability to test the rules engine with an external contract
 * @author @mpetersoCode55
 */
contract ExampleUserContract {
    /**
     @dev This is a generic function that showcases custom arguments being sent to the Rules Engine
     */
    function transfer(address to, uint256 value, uint256 somethingElse) public returns (bool) {
        somethingElse;
        to;
        value;
    }

}
