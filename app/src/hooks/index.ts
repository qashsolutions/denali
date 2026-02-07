export { useChat, type UseChatOptions } from "./useChat";
// DEAD CODE — useTheme: all consumers import from @/components/ThemeProvider
// export { useTheme } from "./useTheme";
export { useSettings, type UserSettings } from "./useSettings";
// DEAD CODE — useSupabase: no consumers, components use createClient() directly
// export { useSupabase } from "./useSupabase";
export { useAuth, type AuthState, type AppealAccessStatus } from "./useAuth";
export {
  useConversationHistory,
  groupConversationsByDate,
  type ConversationHistoryItem,
} from "./useConversationHistory";
