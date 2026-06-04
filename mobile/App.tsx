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

import { RootNavigator } from "@/navigation/RootNavigator";

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <RootNavigator />
    </NavigationContainer>
  );
}
