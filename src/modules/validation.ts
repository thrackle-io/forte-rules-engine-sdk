import { z } from "zod/v4";
import { Either, PT, RulesError } from "./types";
import { isLeft, makeLeft, makeRight, unwrapEither } from "./utils";
import { Address, checksumAddress, isAddress } from "viem";

const trimPossibleString = (input: any): any => {
    if (typeof input === "string") {
        return input.trim()
    } else {
        return input
    }
}

const safeParseJson = (input: string): Either<RulesError[], object> => {
    try {
        const result = JSON.parse(input);
        return makeRight(result);
    } catch (error) {
        return makeLeft([{
            errorType: "INPUT",
            state: { input },
            message: "Failed to parse JSON",
        }]);
    }
};

const ruleValidator = z.object({
    condition: z.string(),
    positiveEffects: z.array(z.string()),
    negativeEffects: z.array(z.string()),
    callingFunction: z.string(),
});

export const getRulesErrorMessages = (errors: RulesError[]): string => {
    console.log(errors[0])
    return errors.map(err => `${err.message}`).join("\n");
}
export interface RuleJSON extends z.infer<typeof ruleValidator> { }

export const validateRuleJSON = (rule: string): Either<RulesError[], RuleJSON> => {
    const parsedJson = safeParseJson(rule);

    if (isLeft(parsedJson)) return parsedJson;

    const parsed = ruleValidator.safeParse(unwrapEither(parsedJson));

    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `${err.message}: Field ${err.path.join('.')}`,
            state: { input: rule },
        }));
        return makeLeft(errors);
    }
};

export const PType = PT.map((p) => p.name); // ["address", "string", "uint256", "bool", "void", "bytes"]

export const splitFunctionInput = (input: string): string[] => {
    return input
        .split("(")[1]
        .split(")")[0]
        .split(",");
}

export const validateFCFuncionInput = (input: string): boolean => {
    const parameterSplit = splitFunctionInput(input);

    return parameterSplit.filter(
        (parameter) => !PType.includes(parameter.trim())
    ).length === 0;
}

export const foreignCallValidator = z.object({
    name: z.string(),
    function: z.string()
        .trim()
        .refine(
            validateFCFuncionInput,
            { message: "Unsupported argument type" }
        ),
    address: z.string()
        .trim()
        .refine((input) => isAddress(input), {
            message: `Address is invalid`,
        })
        .transform((input) => checksumAddress(input.trim() as Address)),
    returnType: z.preprocess(trimPossibleString, z.literal(PType, "Unsupported return type")),
    valuesToPass: z.string()
        .trim(),
    callingFunction: z.string()
        .trim()

});

export interface ForeignCallJSON extends z.infer<typeof foreignCallValidator> { }

export const validateForeignCallJSON = (foreignCall: string): Either<RulesError[], ForeignCallJSON> => {
    const parsedJson = safeParseJson(foreignCall);

    if (isLeft(parsedJson)) return parsedJson;

    const parsed = foreignCallValidator.safeParse(unwrapEither(parsedJson));

    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `${err.message}: Field ${err.path.join('.')}`,
            state: { input: foreignCall },
        }));
        return makeLeft(errors);
    }
};

export const supportedTrackerTypes: string[] = [
    "uint256",
    "string",
    "address",
    "bytes",
    "bool",
];

export const trackerType = z.discriminatedUnion("type", [
    z.object({ type: z.literal("uint256"), initialValue: z.number() }),
    z.object({ type: z.literal("string"), initialValue: z.string() }),
    z.object({ type: z.literal("address"), initialValue: z.string() }),
    z.object({ type: z.literal("bytes"), initialValue: z.string() }),
    z.object({ type: z.literal("bool"), initialValue: z.literal(["true", "false"]) }),
])

const validateTrackerValue = (data: any) => {
    // Validate that the initialValue matches the type
    switch (data.type) {
        case "uint256":
            return !isNaN(Number(data.initialValue));
        case "string":
            return typeof data.initialValue === "string";
        case "address":
            return isAddress(data.initialValue);
        case "bytes":
            return typeof data.initialValue === "string"; // Assuming bytes are represented as hex strings
        case "bool":
            return true;
        default:
            return false; // Should never happen due to z.literal
    }
}

export const trackerValidator = z.object({
    name: z.string()
        .trim(),
    type: z.preprocess(trimPossibleString, z.literal(supportedTrackerTypes, "Unsupported type")),
    initialValue: z.string()
        .trim()
}).refine(validateTrackerValue, {
    message: "Initial Value doesn't match type",
});

export interface TrackerJSON extends z.infer<typeof trackerValidator> { }

export const validateTrackerJSON = (tracker: string): Either<RulesError[], TrackerJSON> => {
    const parsedJson = safeParseJson(tracker);

    if (isLeft(parsedJson)) return parsedJson;

    const parsed = trackerValidator.safeParse(unwrapEither(parsedJson));

    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `${err.message}: Field ${err.path.join('.')}`,
            state: { input: tracker },
        }));
        return makeLeft(errors);
    }
};

export const callingFunctionValidator = z.object({
    name: z.string()
        .trim(),
    functionSignature: z.string()
        .trim(),
    encodedValues: z.string()
        .trim()
});

export interface CallingFunctionJSON extends z.infer<typeof callingFunctionValidator> { }
export const validateCallingFunctionJSON = (callingFunction: string): Either<RulesError[], CallingFunctionJSON> => {
    const parsedJson = safeParseJson(callingFunction);
    if (isLeft(parsedJson)) return parsedJson;
    const parsed = callingFunctionValidator.safeParse(unwrapEither(parsedJson));
    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `${err.message}: Field ${err.path.join('.')}`,
            state: { input: callingFunction },
        }));
        return makeLeft(errors);
    }
};

export const policyJSONValidator = z.object({
    Policy: z.string(),
    PolicyType: z.string(),
    CallingFunctions: z.array(callingFunctionValidator),
    ForeignCalls: z.array(foreignCallValidator),
    Trackers: z.array(trackerValidator),
    Rules: z.array(ruleValidator),
});
export interface PolicyJSON extends z.infer<typeof policyJSONValidator> { }
export const validatePolicyJSON = (policy: string): Either<RulesError[], PolicyJSON> => {
    const parsedJson = safeParseJson(policy);

    if (isLeft(parsedJson)) return parsedJson;

    const parsed = policyJSONValidator.safeParse(unwrapEither(parsedJson));

    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `${err.message}: Field ${err.path.join('.')}`,
            state: { input: policy },
        }));
        return makeLeft(errors);
    }
};