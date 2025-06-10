import { expect, test } from "vitest";

import { getRandom } from '../src/modules/utils.js';

test("getRandom to generate unique strings", () => {
    const random1 = getRandom()
    const random2 = getRandom()
    const random3 = getRandom()
    expect(random1).not.toEqual(random2)
    expect(random2).not.toEqual(random3)
    expect(random1).not.toEqual(random3)
});