export { useChat, type UseChatOptions } from "./useChat";
// DEAD CODE — useTheme: all consumers import from @/components/ThemeProvider
// export { useTheme } from "./useTheme";
export { useSettings, type UserSettings } from "./useSettings";
// Removed: useSupabase hook (Supabase fully replaced by Cognito + RDS)
export { useAuth, type AuthState, type AppealAccessStatus } from "./useAuth";
export {
  useConversationHistory,
  groupConversationsByDate,
  type ConversationHistoryItem,
} from "./useConversationHistory";
