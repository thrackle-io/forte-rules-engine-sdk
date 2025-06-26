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
        return makeLeft([
            {
                errorType: "INPUT",
                state: { input },
                message: "Failed to parse JSON",
            },
        ]);
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
        const errors: RulesError[] = parsed.error.issues.map((err) => ({
            errorType: "INPUT",
            message: `Error: ${err.message}: Field ${err.path.join(".")}`,
            state: { input: rule },
        }));
        return makeLeft(errors);
    }
};
