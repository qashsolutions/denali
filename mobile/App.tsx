/**
 * Root entry — Phase 1 mobile.
 *
 * Pass 1 just mounts the navigation container around the placeholder graph.
 * Pass 2 layers in: theme provider (from mobile-theme-bridge), DAL provider
 * (from mobile-local-data-modeler), and ApiClient provider (from
 * mobile-auth-wirer). All three injected as React context so consumers can
 * call `useDal()`, `useTheme()`, `useApi()` against the frozen contracts.
 */

import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ApiClientProvider } from "@/auth";
import { DalProvider } from "@/db/DalProvider";
import { RootNavigator } from "@/navigation/RootNavigator";
import { FontProvider } from "@/theme/fonts";

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
  return (
    <SafeAreaProvider>
      <FontProvider>
        <ApiClientProvider>
          <DalProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <RootNavigator />
            </NavigationContainer>
          </DalProvider>
        </ApiClientProvider>
      </FontProvider>
    </SafeAreaProvider>
  );
}
