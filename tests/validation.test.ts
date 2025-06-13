import { expect, test } from "vitest";
import { validateRuleJSON } from "../src/modules/validation";
import { isLeft, isRight, unwrapEither } from "../src/modules/utils";

test("Can validate rule JSON", () => {

    var ruleStringA = `{
        "condition": "3 + 4 > 5 AND (1 == 1 AND 2 == 2)",
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`;
    const parsedRule = validateRuleJSON(ruleStringA)
    expect(isRight(parsedRule)).toBeTruthy();
    if (isRight(parsedRule)) {
        const rule = unwrapEither(parsedRule);

        expect(rule.encodedValues).toEqual("uint256 value");
    }
});

test("Can return error if rule JSON is invalid", () => {

    var ruleStringA = `{
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`;
    const parsedRule = validateRuleJSON(ruleStringA)
    expect(isLeft(parsedRule)).toBeTruthy();
    if (isLeft(parsedRule)) {
        const error = unwrapEither(parsedRule);
        expect(error.issues.length).toEqual(1);
        expect(error.issues[0].message).toEqual("Invalid input: expected string, received undefined");
        expect(error.issues[0].path).toEqual(["condition"]);
    }
});


