/**
 * SignInScreen — email OTP sign-in for Phase 1 mobile.
 *
 * Wave 1 (mobile-auth-wirer). Minimal-but-real two-step UI:
 *   1. Email entry → `sendOtp(email)`
 *   2. 6-digit OTP entry → `verifyOtp(email, otp)` → navigate
 *
 * Tokens are stored by `verifyOtp` via the secure tokenStore — this screen
 * does not handle tokens directly. On success, we navigate to
 * `CohortOnboarding`. Wave 2's `mobile-onboarding-builder` will refine the
 * post-auth gate to "skip cohort if local profile present" via
 * `LocalDataDAL.getProfile()`; for now we always advance to the
 * interstitial because the local DB will be empty on first sign-in.
 *
 * Theme: every color / spacing / radius comes from `useTheme()`. No
 * hardcoded hex literals.
 */

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApiClient } from "@/auth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "SignIn">;

type Step = "email" | "otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInScreen(): React.ReactElement {
  const api = useApiClient();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: active.bgPrimary,
          padding: theme.spacing.lg,
          justifyContent: "center",
        },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["3xl"],
          marginBottom: theme.spacing.sm,
        },
        subtitle: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          marginBottom: theme.spacing.xl,
        },
        label: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          marginBottom: theme.spacing.xs,
        },
        input: {
          backgroundColor: active.bgSecondary,
          color: active.textPrimary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          minHeight: 44,
          marginBottom: theme.spacing.md,
        },
        button: {
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        buttonDisabled: {
          opacity: 0.6,
        },
        buttonText: {
          color: active.bgPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        link: {
          color: active.accentPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          marginTop: theme.spacing.md,
          textAlign: "center",
        },
        error: {
          color: active.error,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          marginBottom: theme.spacing.sm,
        },
      }),
    [active, theme],
  );

  const trimmedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const otpValid = /^\d{6}$/.test(otp);

  const onSendOtp = React.useCallback(async () => {
    setErrorMsg(null);
    if (!emailValid) {
      setErrorMsg("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await api.sendOtp(trimmedEmail);
      setStep("otp");
    } catch {
      // Intentionally generic — server returns localized messages but we
      // never want to mistakenly surface token-bearing payloads.
      setErrorMsg("Couldn't send your code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [api, emailValid, trimmedEmail]);

  const onVerifyOtp = React.useCallback(async () => {
    setErrorMsg(null);
    if (!otpValid) {
      setErrorMsg("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      await api.verifyOtp(trimmedEmail, otp);
      // Wave 2: route through PrivacyNotice first (mobile-onboarding-builder
      // added the data-locality notice as the pre-cohort acknowledgement
      // screen — see PrivacyNoticeScreen.tsx). Wave 3 will further refine to
      // skip the whole interstitial chain when a local profile is already
      // present via LocalDataDAL.getProfile().
      navigation.reset({
        index: 0,
        routes: [{ name: "PrivacyNotice" }],
      });
    } catch {
      setErrorMsg("That code didn't work. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [api, navigation, otp, otpValid, trimmedEmail]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: active.bgPrimary }}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Sign in to Denali</Text>
        <Text style={styles.subtitle}>
          We&rsquo;ll email you a 6-digit code. No passwords.
        </Text>

        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        {step === "email" ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="signin_email_input"
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
              inputMode="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              onSubmitEditing={onSendOtp}
              placeholder="you@example.com"
              placeholderTextColor={active.textMuted}
              returnKeyType="send"
              style={styles.input}
              textContentType="emailAddress"
              value={email}
            />
            <Pressable
              testID="signin_send_code_button"
              accessibilityRole="button"
              accessibilityLabel="Send code"
              disabled={submitting || !emailValid}
              onPress={onSendOtp}
              style={({ pressed }) => [
                styles.button,
                (submitting || !emailValid || pressed) && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={active.bgPrimary} />
              ) : (
                <Text style={styles.buttonText}>Send code</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>6-digit code</Text>
            <TextInput
              testID="signin_otp_input"
              accessibilityLabel="Six digit verification code"
              autoComplete="one-time-code"
              editable={!submitting}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(text) => setOtp(text.replace(/\D/g, ""))}
              onSubmitEditing={onVerifyOtp}
              placeholder="123456"
              placeholderTextColor={active.textMuted}
              returnKeyType="done"
              style={styles.input}
              textContentType="oneTimeCode"
              value={otp}
            />
            <Pressable
              testID="signin_verify_button"
              accessibilityRole="button"
              accessibilityLabel="Verify code"
              disabled={submitting || !otpValid}
              onPress={onVerifyOtp}
              style={({ pressed }) => [
                styles.button,
                (submitting || !otpValid || pressed) && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={active.bgPrimary} />
              ) : (
                <Text style={styles.buttonText}>Verify code</Text>
              )}
            </Pressable>
            <Pressable
              testID="signin_use_different_email_button"
              accessibilityRole="button"
              accessibilityLabel="Use a different email"
              disabled={submitting}
              onPress={() => {
                setOtp("");
                setStep("email");
                setErrorMsg(null);
              }}
            >
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
