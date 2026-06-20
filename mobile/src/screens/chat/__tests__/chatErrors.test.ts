/**
 * chatErrors — offline vs. generic classification (chat-offline).
 */
import { describe, expect, it } from "vitest";

import {
  CHAT_GENERIC_ERROR_MESSAGE,
  CHAT_OFFLINE_MESSAGE,
  chatErrorMessage,
  isLikelyOfflineError,
} from "../chatErrors";

describe("isLikelyOfflineError", () => {
  it("treats the RN fetch offline failure (TypeError: Network request failed) as offline", () => {
    expect(isLikelyOfflineError(new TypeError("Network request failed"))).toBe(
      true,
    );
  });

  it("matches other connectivity-failure shapes", () => {
    expect(isLikelyOfflineError(new Error("Failed to fetch"))).toBe(true);
    expect(isLikelyOfflineError(new Error("Unable to resolve host"))).toBe(true);
    expect(isLikelyOfflineError("Connection reset")).toBe(true);
  });

  it("does NOT treat a user-initiated abort as offline", () => {
    const abort = new Error("Aborted");
    abort.name = "AbortError";
    expect(isLikelyOfflineError(abort)).toBe(false);
  });

  it("does NOT mislabel an unrelated error/TypeError as offline", () => {
    expect(isLikelyOfflineError(new TypeError("x is not a function"))).toBe(
      false,
    );
    expect(isLikelyOfflineError(new Error("Internal Server Error"))).toBe(false);
    expect(isLikelyOfflineError(undefined)).toBe(false);
    expect(isLikelyOfflineError({})).toBe(false);
  });
});

describe("chatErrorMessage", () => {
  it("returns the offline copy for a connectivity failure", () => {
    expect(chatErrorMessage(new TypeError("Network request failed"))).toBe(
      CHAT_OFFLINE_MESSAGE,
    );
  });

  it("returns the generic copy otherwise", () => {
    expect(chatErrorMessage(new Error("500"))).toBe(CHAT_GENERIC_ERROR_MESSAGE);
  });

  // ChatScreen's error-EVENT branch passes the raw event.message STRING (the
  // offline failure arrives as an error event, not a thrown error — see
  // chatStream.ts). Pin that the string path classifies the same way.
  it("classifies an error-event message STRING (offline vs server)", () => {
    expect(chatErrorMessage("Network request failed")).toBe(
      CHAT_OFFLINE_MESSAGE,
    );
    expect(chatErrorMessage("Chat request failed (HTTP 500).")).toBe(
      CHAT_GENERIC_ERROR_MESSAGE,
    );
    expect(chatErrorMessage("HTTP 500")).toBe(CHAT_GENERIC_ERROR_MESSAGE);
  });
});
