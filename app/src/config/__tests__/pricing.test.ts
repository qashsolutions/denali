import { describe, it, expect } from "vitest";
import { getUploadLimitForPlan, formatPrice, formatFileSize } from "../pricing";

describe("getUploadLimitForPlan", () => {
  it("returns 0 for anonymous (unauthenticated) users", () => {
    expect(getUploadLimitForPlan(null, false, false)).toBe(0);
  });

  it("returns trial limit for trial plan", () => {
    expect(getUploadLimitForPlan("trial", false, true)).toBe(2 * 1024 * 1024);
  });

  it("returns starter limit for starter plan", () => {
    expect(getUploadLimitForPlan("starter", false, true)).toBe(
      4 * 1024 * 1024
    );
  });

  it("returns plus limit for plus plan", () => {
    expect(getUploadLimitForPlan("plus", false, true)).toBe(
      6 * 1024 * 1024
    );
  });

  it("returns unlimited limit for unlimited plan", () => {
    expect(getUploadLimitForPlan("unlimited", false, true)).toBe(
      10 * 1024 * 1024
    );
  });

  it("returns -1 (unlimited) for admin users", () => {
    expect(getUploadLimitForPlan(null, true, true)).toBe(-1);
  });

  it("falls back to trial limit for unknown plan", () => {
    expect(getUploadLimitForPlan("unknown_plan", false, true)).toBe(
      2 * 1024 * 1024
    );
  });
});

describe("formatPrice", () => {
  it("formats integer price with default USD currency", () => {
    expect(formatPrice(10)).toBe("$10");
  });

  it("formats price with explicit USD currency", () => {
    expect(formatPrice(20, "USD")).toBe("$20");
  });
});

describe("formatFileSize", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe("2 MB");
  });

  it("formats small byte values", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
  });
});
