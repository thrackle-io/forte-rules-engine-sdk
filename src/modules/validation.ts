import { z, ZodError } from "zod/v4";
import { Either, RulesError } from "./types";
import { isLeft, makeLeft, makeRight, unwrapEither } from "./utils";

const safeParseJson = (input: string): Either<RulesError, object> => {
    try {
        const result = JSON.parse(input);
        return makeRight(result);
    } catch (error) {
        return makeLeft({
            errorType: "INPUT",
            state: { input },
            message: "Failed to parse JSON",
        });
    }
};

const ruleValidator = z.object({
    condition: z.string(),
    positiveEffects: z.array(z.string()),
    negativeEffects: z.array(z.string()),
    callingFunction: z.string(),
    encodedValues: z.string(),
});

export interface ruleJSON extends z.infer<typeof ruleValidator> { }

export const validateRuleJSON = (rule: string): Either<RulesError[], ruleJSON> => {
    const parsedJson = safeParseJson(rule);

    if (isLeft(parsedJson)) return makeLeft([unwrapEither(parsedJson)]);

    const parsed = ruleValidator.safeParse(unwrapEither(parsedJson));

    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        const errors: RulesError[] = parsed.error.issues.map(err => ({
            errorType: "INPUT",
            message: `Error: ${err.message}: Field ${err.path.join('.')}`,
            state: { input: rule },
        }));
        return makeLeft(errors);
    }
};