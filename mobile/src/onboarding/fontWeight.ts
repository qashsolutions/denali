/**
 * fontWeight bridge — Theme tokens store numeric weights (400/500/600/700),
 * React Native's `TextStyle.fontWeight` is a string-literal union.
 * `String(token)` would satisfy the type if it returned a literal, but TS
 * widens it to `string`. This helper narrows to the exact literal union RN
 * accepts.
 *
 * Pure module — no theme dependency.
 */
import type { TextStyle } from "react-native";

export function fw(value: number): TextStyle["fontWeight"] {
  switch (value) {
    case 100:
      return "100";
    case 200:
      return "200";
    case 300:
      return "300";
    case 400:
      return "400";
    case 500:
      return "500";
    case 600:
      return "600";
    case 700:
      return "700";
    case 800:
      return "800";
    case 900:
      return "900";
    default:
      // Theme tokens only ship 400/500/600/700 — fall back to "normal".
      return "normal";
  }
}
