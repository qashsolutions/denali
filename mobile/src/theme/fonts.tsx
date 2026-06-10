/**
 * Redesign fonts — expo-font loading + deterministic role resolution.
 *
 * Three roles (docs/design/denali-redesign-mockups.html :root):
 *   display → Bricolage Grotesque (600/700)  — titles, card names
 *   numbers → Inter Tight        (600/700)  — numeric values, tabular
 *   body    → Inter              (400/500/600) — everything else
 *
 * RN does NOT support CSS-style font stacks, so each (role, weight) pair
 * resolves to exactly ONE registered face. The FLOOR is the OS system
 * font: when the custom face hasn't loaded (or a weight has no face),
 * `fontStyle()` returns `{ fontWeight }` with `fontFamily` unset — RN's
 * idiom for "platform default" (SF Pro on iOS, Roboto on Android).
 *
 * Display path: (a) @expo-google-fonts/bricolage-grotesque installed
 * cleanly, so Bricolage ships as a packaged asset alongside Inter /
 * Inter Tight. All faces load in ONE useFonts() call from local assets —
 * there is no per-font network wait, so awaiting the batch never blocks
 * on Bricolage specifically. If loading errors, FontProvider renders the
 * app anyway and every role sits on the system-font floor.
 */

import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  InterTight_600SemiBold,
  InterTight_700Bold,
} from "@expo-google-fonts/inter-tight";
import { useFonts } from "expo-font";
import React, { createContext, useContext } from "react";
import { View, type TextStyle } from "react-native";

import { fw } from "@/onboarding/fontWeight";

import { redesign } from "./tokens";

/**
 * Registration keys — these strings ARE the fontFamily values used across
 * the theme (tokens.typography.fonts) and by fontStyle(). One key per face.
 */
export const FONT_ASSETS = {
  "Inter-Regular": Inter_400Regular,
  "Inter-Medium": Inter_500Medium,
  "Inter-SemiBold": Inter_600SemiBold,
  "InterTight-SemiBold": InterTight_600SemiBold,
  "InterTight-Bold": InterTight_700Bold,
  "Bricolage-SemiBold": BricolageGrotesque_600SemiBold,
  "Bricolage-Bold": BricolageGrotesque_700Bold,
} as const;

export type FontRole = "display" | "numbers" | "body";
export type FontRoleWeight = 400 | 500 | 600 | 700;

/** (role, weight) → registered face. Missing pairs fall to the OS floor. */
const ROLE_FACES: Readonly<
  Record<FontRole, Partial<Record<FontRoleWeight, keyof typeof FONT_ASSETS>>>
> = {
  body: {
    400: "Inter-Regular",
    500: "Inter-Medium",
    600: "Inter-SemiBold",
  },
  numbers: {
    600: "InterTight-SemiBold",
    700: "InterTight-Bold",
  },
  display: {
    600: "Bricolage-SemiBold",
    700: "Bricolage-Bold",
  },
};

/**
 * Resolve a font role + weight to a TextStyle fragment.
 *
 * Loaded + face available → `{ fontFamily }` only (the face already carries
 * its weight; adding fontWeight would invite synthetic bolding on Android
 * and nearest-face re-matching on iOS).
 * Otherwise → `{ fontWeight }` with no fontFamily: the OS system font.
 */
export function fontStyle(
  role: FontRole,
  weight: FontRoleWeight,
  fontsLoaded: boolean,
): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  const face = fontsLoaded ? ROLE_FACES[role][weight] : undefined;
  return face ? { fontFamily: face } : { fontWeight: fw(weight) };
}

const FontsLoadedContext = createContext(false);

/** True once the redesign faces are registered; false = system-font floor. */
export function useFontsLoaded(): boolean {
  return useContext(FontsLoadedContext);
}

export interface FontProviderProps {
  children: React.ReactNode;
}

/**
 * Loads the packaged faces and gates the FIRST render on the batch (local
 * assets — resolves in one tick). On a load error the app renders anyway:
 * `loaded` stays false and every fontStyle() call returns the system floor.
 */
export function FontProvider({ children }: FontProviderProps): React.ReactElement {
  const [loaded, error] = useFonts(FONT_ASSETS);

  if (!loaded && !error) {
    // Paper-colored placeholder, not app content — avoids a flash of
    // system-font UI before the faces register.
    return <View style={{ flex: 1, backgroundColor: redesign.paper }} />;
  }

  return (
    <FontsLoadedContext.Provider value={loaded}>
      {children}
    </FontsLoadedContext.Provider>
  );
}
