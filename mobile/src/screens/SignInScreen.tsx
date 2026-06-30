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
import type { StyleProp, TextStyle } from "react-native";

import { HttpError, useApiClient } from "@/auth";
import { PressableScale } from "@/components/PressableScale";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "SignIn">;

type Step = "email" | "otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Step-aware sign-in subtitle. The OTP step surfaces the 10-minute code expiry
 * (the email states it, but users wait on this screen, not their inbox).
 * Pure helper of live `step` per the mobile pure-helper rule.
 */
export function signInSubtitle(step: Step): string {
  return step === "email"
    ? "We’ll email you a 6-digit code. No passwords."
    : "Enter the 6-digit code we just emailed you. It expires in 10 minutes.";
}

/** Seconds the "Resend code" action stays disabled after a send, so rapid taps
 * can't trip the server's per-email send cap (3 / 15 min). */
const RESEND_COOLDOWN_SEC = 30;

/**
 * Map a send/resend failure to a user-facing message. A 429 (the server's
 * per-email / per-IP send cap) is called out so the user waits rather than
 * retrying into the same wall; everything else uses `fallback`. Never surfaces
 * raw server text (which could carry token-bearing payloads).
 */
export function otpSendErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError && err.status === 429) {
    return "Too many code requests. Please wait a few minutes, then try again.";
  }
  return fallback;
}

/** "Resend code" link with in-flight + cooldown disabled states. */
function ResendButton({
  cooldown,
  submitting,
  onPress,
  linkStyle,
}: {
  cooldown: number;
  submitting: boolean;
  onPress: () => void;
  linkStyle: StyleProp<TextStyle>;
}): React.ReactElement {
  const disabled = submitting || cooldown > 0;
  const label =
    cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code";
  return (
    <Pressable
      testID="signin_resend_code_button"
      accessibilityRole="button"
      accessibilityLabel="Resend code"
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={[linkStyle, disabled && { opacity: 0.5 }]}>{label}</Text>
    </Pressable>
  );
}

/** One status line — an error takes precedence over an info confirmation. */
function StatusMessage({
  error,
  info,
  errorStyle,
  infoStyle,
}: {
  error: string | null;
  info: string | null;
  errorStyle: StyleProp<TextStyle>;
  infoStyle: StyleProp<TextStyle>;
}): React.ReactElement | null {
  if (error) return <Text style={errorStyle}>{error}</Text>;
  if (info) return <Text style={infoStyle}>{info}</Text>;
  return null;
}

export function SignInScreen(): React.ReactElement {
  const api = useApiClient();
  const navigation = useNavigation<Nav>();
  const dal = useDal();
  const { active, theme } = useTheme();

  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [infoMsg, setInfoMsg] = React.useState<string | null>(null);
  const [cooldown, setCooldown] = React.useState(0);

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
          minHeight: 48,
          marginBottom: theme.spacing.md,
        },
        button: {
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          minHeight: 48,
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
        info: {
          color: active.textSecondary,
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

  // Tick the resend cooldown down. setTimeout (not setInterval) keeps the dep
  // array exhaustive-deps-clean: each new `cooldown` value schedules the next
  // decrement, and reaching 0 schedules nothing.
  React.useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const onSendOtp = React.useCallback(async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!emailValid) {
      setErrorMsg("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      await api.sendOtp(trimmedEmail);
      setStep("otp");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      // Generic by default; never surface raw server text (token-bearing
      // payloads). A 429 send cap is called out so the user knows to wait.
      setErrorMsg(
        otpSendErrorMessage(err, "Couldn't send your code. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [api, emailValid, trimmedEmail]);

  const onVerifyOtp = React.useCallback(async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!otpValid) {
      setErrorMsg("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      await api.verifyOtp(trimmedEmail, otp);
      // Returning-user short-circuit: if a COMPLETED local profile already
      // exists (the permanent birth-year + sex fields are written at the
      // cohort confirm step), the user has onboarded before — skip the whole
      // interstitial chain and go straight to the app, mirroring RootNavigator's
      // cold-launch restore. Re-walking PrivacyNotice → the 5-step cohort
      // (re-confirming fields Settings locks) → Intake → PHQ-2 reads as "the
      // app forgot me". A fresh user (no profile) still onboards.
      const profile = dal ? await dal.getProfile() : null;
      const onboarded =
        profile != null &&
        profile.birth_year != null &&
        profile.sex_at_birth != null;
      navigation.reset({
        index: 0,
        routes: [{ name: onboarded ? "MainTabs" : "PrivacyNotice" }],
      });
    } catch {
      setErrorMsg("That code didn't work. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [api, dal, navigation, otp, otpValid, trimmedEmail]);

  // Re-send a code to the SAME email without leaving the OTP step — covers the
  // 10-minute expiry, where the only prior recourse was "Use a different email"
  // + retyping. Clears any stale code and confirms via infoMsg.
  const onResend = React.useCallback(async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setOtp("");
    setSubmitting(true);
    try {
      await api.sendOtp(trimmedEmail);
      setInfoMsg("New code sent — check your email.");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setErrorMsg(
        otpSendErrorMessage(err, "Couldn't resend your code. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }, [api, trimmedEmail]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: active.bgPrimary }}
    >
      <View style={styles.screen}>
        <Text style={styles.title}>Sign in to Denali</Text>
        <Text style={styles.subtitle}>{signInSubtitle(step)}</Text>

        <StatusMessage
          error={errorMsg}
          info={infoMsg}
          errorStyle={styles.error}
          infoStyle={styles.info}
        />

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
            <PressableScale
              testID="signin_send_code_button"
              haptic
              accessibilityRole="button"
              accessibilityLabel="Send code"
              disabled={submitting || !emailValid}
              onPress={onSendOtp}
              style={[
                styles.button,
                (submitting || !emailValid) && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={active.bgPrimary} />
              ) : (
                <Text style={styles.buttonText}>Send code</Text>
              )}
            </PressableScale>
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
            <PressableScale
              testID="signin_verify_button"
              haptic
              accessibilityRole="button"
              accessibilityLabel="Verify code"
              disabled={submitting || !otpValid}
              onPress={onVerifyOtp}
              style={[
                styles.button,
                (submitting || !otpValid) && styles.buttonDisabled,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={active.bgPrimary} />
              ) : (
                <Text style={styles.buttonText}>Verify code</Text>
              )}
            </PressableScale>
            <ResendButton
              cooldown={cooldown}
              submitting={submitting}
              onPress={onResend}
              linkStyle={styles.link}
            />
            <Pressable
              testID="signin_use_different_email_button"
              accessibilityRole="button"
              accessibilityLabel="Use a different email"
              disabled={submitting}
              onPress={() => {
                setOtp("");
                setEmail("");
                setStep("email");
                setErrorMsg(null);
                setInfoMsg(null);
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
