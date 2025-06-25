import { expect, test } from "vitest";
import { validateRuleJSON } from "../src/modules/validation";
import { isLeft, isRight, unwrapEither } from "../src/modules/utils";

test("Can return error if rule JSON is invalid", () => {
  var ruleStringA = `{
        "positiveEffects": ["revert"],
        "negativeEffects": [],
        "callingFunction": "addValue(uint256 value)",
        "encodedValues": "uint256 value"
        }`;
  const parsedRule = validateRuleJSON(ruleStringA);
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);
    expect(errors.length).toEqual(1);
    expect(errors[0].message).toEqual(
      "Error: Invalid input: expected string, received undefined: Field condition"
    );
  }
});

test("Can return multiple errors if rule JSON is invalid", () => {
  var ruleStringA = `{
        "positiveEffects": ["revert"],
        "negativeEffects": []
        }`;
  const parsedRule = validateRuleJSON(ruleStringA);
  expect(isLeft(parsedRule)).toBeTruthy();
  if (isLeft(parsedRule)) {
    const errors = unwrapEither(parsedRule);
    expect(errors.length).toEqual(2);
    expect(errors[0].message).toEqual(
      "Error: Invalid input: expected string, received undefined: Field condition"
    );
    expect(errors[1].message).toEqual(
      "Error: Invalid input: expected string, received undefined: Field callingFunction"
    );
  }
});
