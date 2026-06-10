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
import { HealthDashboardScreen } from "@/screens/HealthDashboardScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { UploadScreen } from "@/screens/UploadScreen";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import type { MainTabsParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICON_SIZE = 22;

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
  // Redesign step-1 tab bar (mockup .tabbar): white surface, hairline top
  // border, teal active tint, ink-3 inactive, small medium-weight labels.
  const { redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarIconStyle: { width: TAB_ICON_SIZE, height: TAB_ICON_SIZE },
        tabBarActiveTintColor: redesign.teal,
        tabBarInactiveTintColor: redesign.ink3,
        tabBarStyle: {
          backgroundColor: redesign.surface,
          borderTopColor: redesign.line,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          ...fontStyle("body", 500, fontsLoaded),
        },
      }}
    >
      {/*
       * Maestro targets each tab by its accessibility label ("Timeline
       * tab", ...). React Navigation 7's typed options don't expose
       * `tabBarTestID`, but they do expose `tabBarAccessibilityLabel`,
       * which Maestro reads via the accessibility tree — same effect,
       * type-safe. The Timeline route keeps its name; only the visible
       * label changes to the mockup's "Health".
       */}
      {/*
       * Phase-3 increment 1: the Timeline TAB now lands on the
       * domain-organized HealthDashboardScreen. The chronological
       * feed (TimelineScreen) is reached through the dashboard's
       * "All activity" footer entry, gated by EXPO_PUBLIC_LEGACY_TIMELINE,
       * so its `LegacyTimeline` route lives in the root stack.
       */}
      <Tab.Screen
        name="Timeline"
        component={HealthDashboardScreen}
        options={{
          tabBarIcon: TimelineIcon,
          tabBarLabel: "Health",
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
