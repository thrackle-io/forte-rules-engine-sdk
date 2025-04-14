## Glossary of Terms 

### Policy 

A policy consists of Trackers and Rules that a calling contract can register with to enforce rule evaluations on specific functions within its contract. A `policyId` is used to connect rules, trackers, foreign calls and effects for determining if a rule results in a true or false and the effects from that determination. 

### Rule  

A statement with a conditional expression that triggers a specific set of effects based on whether the condition evaluates to true or false. 

Examples of rules are: 
- If the transfer amount of the token is less than 4, revert. 
- If a uint256 tracker value is greater than the current `block.timestamp`, fire an event with defined string. 


### Foreign Call 

An invocation of a foreign contract. The rules engine allows for the result of a foreign call from the rules engine to be used as a rule conditional value or and effect of the rule. 

Example of foreign call: The sender and recipient addresses of the transaction are checked if they are on an approval list. This means the rule syntax will allow the rules engine to call `isApproved(address,address)` at the address of an approve/denied oracle contract. 


### Tracker

An on-chain variable, stored within the Rules Engine, that contains data that may be updated.
- Uint256
- String
- Address
- Boolean
- Bytes


### Conditionals

The values that are used in rule processing. These values can be from the calling functions parameters, encoded data, return value from a foriegn call or a tracker value. 

### Operators 
Operators that a rule can use to determine if a rule should evaluate true or false. Operators consist of: 

- addition `+`
- subtraction `-`
- multiplication `*`
- division `/`
- equal to `==`
- not equal to `!=`
- greater than `>`
- less than `<`
- and `&&`
- or `||`

Example: 3 + 4 > 5 AND (1 == 1 AND 2 == 2) 

It is important to note that certain conditionals may only use specific operators. Address evaluations can only be `==` or `!=`. 

### Effect 

An on-chain action. Effects are: 
- Revert 
- Event 
- Foreign Call 
- Update Tracker 


### Instruction Set

The human readable syntax that defines the rule conditions, effects, function signature of the calling function and any foreign call(s). 

The SDK will translate this to the on-chain instruction set syntax ingested by the rules engine to execute during a transaction. 

#### Expression 

A series of statements that can be evaluated to return a specific data type (e.g. boolean, number, string, etc).
