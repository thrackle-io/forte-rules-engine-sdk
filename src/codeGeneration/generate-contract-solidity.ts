/// SPDX-License-Identifier: BUSL-1.1
import * as fs from "fs";
import * as path from "path";
import {
  getRulesErrorMessages,
  validatePolicyJSON,
} from "../modules/validation";
import { isLeft, unwrapEither } from "../modules/utils";
import { fileURLToPath } from "url";
import { dirname } from "path";

export function generateTestContract(
  policyS: string,
  outputFileName: string
): void {
  const validatedPolicySyntax = validatePolicyJSON(policyS);
  if (isLeft(validatedPolicySyntax)) {
    throw new Error(getRulesErrorMessages(unwrapEither(validatedPolicySyntax)));
  }
  const policySyntax = unwrapEither(validatedPolicySyntax);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  let templateFilePath = path.join(__dirname, "UserContractTemplate.sol");
  let contractTemplate = fs.readFileSync(templateFilePath, "utf-8");

  const testFn = policySyntax.CallingFunctions[0].name;
  const testFnParams =
    policySyntax.CallingFunctions[0].encodedValues.split(",");
  const writeableFnParams = testFnParams.map(
    (param: string) => `${param.trim().split(" ")[1]};`
  );

  if (!fs.existsSync(path.dirname(outputFileName))) {
    fs.mkdirSync(path.dirname(outputFileName), { recursive: true });
  }
  const filePathOutput = outputFileName;

  contractTemplate = contractTemplate.replace("[[FUNCTION_SIGNATURE]]", testFn);
  contractTemplate = contractTemplate.replace(
    "[[FUNCTION_PARAMS]]",
    writeableFnParams.join("\n")
  );

  // Write the modified data back to the file
  fs.writeFileSync(filePathOutput, contractTemplate, "utf-8");
}
