/**
 * Bottom-tab navigator — mirrors the web's BottomTabs idiom
 * (app/src/components/layout/BottomTabs.tsx): four primary surfaces.
 *
 * Order matches the web's IA: Home(Timeline) / MyHealth(Upload) /
 * Ask Denali(Chat) / Settings.
 */

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { ChatScreen } from "@/screens/ChatScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";
import { UploadScreen } from "@/screens/UploadScreen";

import type { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Timeline" component={TimelineScreen} />
      <Tab.Screen name="Upload" component={UploadScreen} />
      <Tab.Screen name="Chat" component={ChatScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
