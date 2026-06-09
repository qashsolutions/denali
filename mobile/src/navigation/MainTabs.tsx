/**
 * Bottom-tab navigator — mirrors the web's BottomTabs idiom
 * (app/src/components/layout/BottomTabs.tsx): four primary surfaces.
 *
 * Order matches the web's IA: Home(Timeline) / MyHealth(Upload) /
 * Ask Denali(Chat) / Settings.
 *
 * Icons: lucide-react-native (MIT, react-native-svg-based). SVG paths
 * — NOT a glyph font — so we sidestep the missing-glyph "tofu" failure
 * mode we hit when no icon was wired. Color is driven by React
 * Navigation's per-tab focused/blurred state (active tint vs muted).
 */

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import {
  Activity,
  MessageCircle,
  Settings as SettingsIcon,
  Upload as UploadIcon,
} from "lucide-react-native";
import React from "react";

import { ChatScreen } from "@/screens/ChatScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";
import { UploadScreen } from "@/screens/UploadScreen";

import type { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICON_SIZE = 24;

interface TabIconProps {
  color: string;
  size: number;
}

// Top-level icon components (not inline arrows) so React Navigation can
// memoize them and avoid re-rendering the tab bar on every parent render.
function TimelineIcon({ color, size }: TabIconProps): React.ReactElement {
  return <Activity color={color} size={size} />;
}
function UploadTabIcon({ color, size }: TabIconProps): React.ReactElement {
  return <UploadIcon color={color} size={size} />;
}
function ChatTabIcon({ color, size }: TabIconProps): React.ReactElement {
  return <MessageCircle color={color} size={size} />;
}
function SettingsTabIcon({ color, size }: TabIconProps): React.ReactElement {
  return <SettingsIcon color={color} size={size} />;
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIconStyle: { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE },
      }}
    >
      {/*
       * Maestro targets each tab by its visible label text ("Timeline",
       * "Upload", "Chat", "Settings"). React Navigation 7's typed options
       * don't expose `tabBarTestID`, but they do expose
       * `tabBarAccessibilityLabel`, which Maestro reads via the
       * accessibility tree — same effect, type-safe.
       */}
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          tabBarIcon: TimelineIcon,
          tabBarAccessibilityLabel: "Timeline tab",
        }}
      />
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{
          tabBarIcon: UploadTabIcon,
          tabBarAccessibilityLabel: "Upload tab",
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ChatTabIcon,
          tabBarAccessibilityLabel: "Chat tab",
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: SettingsTabIcon,
          tabBarAccessibilityLabel: "Settings tab",
        }}
      />
    </Tab.Navigator>
  );
}
