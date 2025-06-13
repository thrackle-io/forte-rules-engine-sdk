import { expect, test } from "vitest";
import { validateRuleJSON } from "../src/modules/validation";
import { isLeft, isRight, unwrapEither } from "../src/modules/utils";

test("Can validate rule JSON", () => {

    const ruleStringA = `{
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
        const errors = unwrapEither(parsedRule);
        expect(errors.length).toEqual(1);
        expect(errors[0].message).toEqual("Error: Invalid input: expected string, received undefined: Field condition");
    }
});

test("Can return multiple errors if rule JSON is invalid", () => {

    var ruleStringA = `{
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)"
        }`;
    const parsedRule = validateRuleJSON(ruleStringA)
    expect(isLeft(parsedRule)).toBeTruthy();
    if (isLeft(parsedRule)) {
        const errors = unwrapEither(parsedRule);
        expect(errors.length).toEqual(2);
        expect(errors[0].message).toEqual("Error: Invalid input: expected string, received undefined: Field condition");
        expect(errors[1].message).toEqual("Error: Invalid input: expected string, received undefined: Field encodedValues");

    }
});


