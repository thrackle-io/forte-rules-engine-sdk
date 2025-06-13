import { z, ZodError } from "zod/v4";
import { Either } from "./types";
import { makeLeft, makeRight } from "./utils";

const ruleValidator = z.object({
    condition: z.string(),
    positiveEffects: z.array(z.string()),
    negativeEffects: z.array(z.string()),
    callingFunction: z.string(),
    encodedValues: z.string(),
});

export interface ruleJSON extends z.infer<typeof ruleValidator> { }

export const validateRuleJSON = (rule: string): Either<ZodError, ruleJSON> => {
    const parsed = ruleValidator.safeParse(JSON.parse(rule));
    if (parsed.success) {
        return makeRight(parsed.data);
    } else {
        return makeLeft(parsed.error);
    }
};