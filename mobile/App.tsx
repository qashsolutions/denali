/**
 * Root entry — Phase 1 mobile.
 *
 * Pass 1 just mounts the navigation container around the placeholder graph.
 * Pass 2 layers in: theme provider (from mobile-theme-bridge), DAL provider
 * (from mobile-local-data-modeler), and ApiClient provider (from
 * mobile-auth-wirer). All three injected as React context so consumers can
 * call `useDal()`, `useTheme()`, `useApi()` against the frozen contracts.
 */

import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiClientProvider } from "@/auth";
import { DalProvider } from "@/db/DalProvider";
import { RootNavigator } from "@/navigation/RootNavigator";
import { FontProvider } from "@/theme/fonts";
import { ThemeModeProvider } from "@/theme/ThemeMode";
import { useTheme } from "@/theme/useTheme";

/**
 * Bridges the resolved theme scheme into React Navigation's container theme so
 * the inter-screen background (and safe-area edges) match the active palette —
 * otherwise dark mode flashes the library's default white between transitions.
 * Lives below ThemeModeProvider so useTheme() resolves the override.
 */
function NavRoot(): React.ReactElement {
  const { scheme, active } = useTheme();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: active.bgPrimary,
      card: active.bgSecondary,
      text: active.textPrimary,
      border: active.border,
      primary: active.accentPrimary,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="auto" />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  // SafeAreaProvider wraps everything so screens that consume
  // `useSafeAreaInsets()` (e.g. HealthDashboardScreen, DomainDetailScreen)
  // get the device's real top/bottom inset. Without it, the hook returns
  // zeroed insets and headers slide under the system status bar.
  //
  // FontProvider loads the redesign faces (Inter / Inter Tight / Bricolage
  // Grotesque) via expo-font before the first content render; on load
  // error it renders anyway with the OS system-font floor (see
  // src/theme/fonts.tsx).
  // ThemeModeProvider sits above everything that calls useTheme() so the
  // Light/Dark/System choice resolves app-wide; StatusBar style="auto" already
  // flips the status-bar text to match the active scheme.
  return (
    <SafeAreaProvider>
      <ThemeModeProvider>
        <FontProvider>
          <ApiClientProvider>
            <DalProvider>
              <NavRoot />
            </DalProvider>
          </ApiClientProvider>
        </FontProvider>
      </ThemeModeProvider>
    </SafeAreaProvider>
  );
}
