import { describe, expect, it } from "vitest";
import { secretMatches } from "./secrets";

describe("secretMatches", () => {
  it("accepts only the exact secret", () => {
    expect(secretMatches("s3cret", "s3cret")).toBe(true);
    expect(secretMatches("s3cre", "s3cret")).toBe(false);
    expect(secretMatches("s3cret!", "s3cret")).toBe(false);
  });

  it("refuses everything when no secret is configured or none is presented", () => {
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches("x", undefined)).toBe(false);
    expect(secretMatches(null, "s3cret")).toBe(false);
  });
});
