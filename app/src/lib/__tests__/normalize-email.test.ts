import { describe, it, expect } from "vitest";
import { normalizeEmail } from "../normalize-email";

describe("normalizeEmail", () => {
  it("strips +tag from Gmail addresses", () => {
    expect(normalizeEmail("user+tag@gmail.com")).toBe("user@gmail.com");
    expect(normalizeEmail("user+anything+else@gmail.com")).toBe("user@gmail.com");
  });

  it("strips +tag from Googlemail addresses", () => {
    expect(normalizeEmail("user+tag@googlemail.com")).toBe("user@googlemail.com");
  });

  it("normalizes domain case", () => {
    expect(normalizeEmail("user+tag@Gmail.COM")).toBe("user@gmail.com");
    expect(normalizeEmail("user+tag@GOOGLEMAIL.COM")).toBe("user@googlemail.com");
  });

  it("passes through Gmail addresses without +tag unchanged", () => {
    expect(normalizeEmail("user@gmail.com")).toBe("user@gmail.com");
  });

  it("does NOT strip +tag from non-Gmail domains", () => {
    expect(normalizeEmail("user+tag@outlook.com")).toBe("user+tag@outlook.com");
    expect(normalizeEmail("user+tag@yahoo.com")).toBe("user+tag@yahoo.com");
    expect(normalizeEmail("user+tag@company.com")).toBe("user+tag@company.com");
  });

  it("does NOT strip dots from Gmail local part", () => {
    expect(normalizeEmail("u.s.e.r@gmail.com")).toBe("u.s.e.r@gmail.com");
  });

  it("handles edge cases", () => {
    expect(normalizeEmail("noemail")).toBe("noemail");
    expect(normalizeEmail("+only@gmail.com")).toBe("@gmail.com");
    expect(normalizeEmail("user+@gmail.com")).toBe("user@gmail.com");
  });
});
