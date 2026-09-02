import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  canProcessEmail,
  shouldSkipDeletedEmail,
} from "./email-job-guards";

describe("email job guards", () => {
  it("skips deleted emails before processing", () => {
    assert.equal(shouldSkipDeletedEmail(null), true);
    assert.equal(shouldSkipDeletedEmail(undefined), true);
    assert.equal(shouldSkipDeletedEmail({ id: 12, status: "SCHEDULED" }), false);
  });

  it("treats sent or missing emails as non-processable", () => {
    assert.equal(canProcessEmail(null), false);
    assert.equal(canProcessEmail({ id: 12, status: "SENT" }), false);
    assert.equal(canProcessEmail({ id: 12, status: "SCHEDULED" }), true);
  });
});
