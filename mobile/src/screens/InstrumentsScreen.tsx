/**
 * InstrumentsScreen — Wave 2 redesign (PHQ-2-first + opt-in check-ins).
 *
 * Burden model:
 *   - Mood runs FIRST and is the only mandatory item — and only as
 *     PHQ-2 (two items). If the PHQ-2 score is ≥ 3 (the published
 *     positive-screen threshold per Kroenke 2003), the flow expands
 *     into PHQ-9 items 3–9 to capture the full depression severity
 *     score AND surface item 9 (self-harm) with the 988 safety modal.
 *   - All other instruments (GAD-7, AUDIT-C, Epworth, IPSS men,
 *     MRS/ADAM sex-branched) are surfaced AFTER the mood path as a
 *     "tap to contribute" check-in menu. Each is optional and can be
 *     skipped individually or skipped en masse via "I'm done — go to
 *     Denali."
 *
 * One item per screen via OneItemScreen + LikertInput. Instrument
 * acronyms ARE NEVER SHOWN to the user — sections are labeled with
 * plain-language headings ("Your mood", "Anxiety", "Sleep", etc.).
 * The instrument code is stored only in observation metadata.
 *
 * LOAD-BEARING 988 safety flow:
 *   - When the user selects any response > 0 on PHQ-9 item 9, the
 *     Crisis988Modal opens IMMEDIATELY, before the response is
 *     recorded. The observation is recorded ONLY after acknowledgment.
 *   - This preserves the hard rule from .claude/agents/mobile-onboarding-builder.md:
 *     "Never silently record a positive PHQ-9 item 9 without surfacing 988."
 */
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useApiClient } from "@/auth";
import type { ObservationInsertInput } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { runOnceInFlight } from "@/lib/runOnceInFlight";
import type { RootStackParamList } from "@/navigation/types";
import { Crisis988Modal } from "@/onboarding/Crisis988Modal";
import { fw } from "@/onboarding/fontWeight";
import { assembleNextResponses, LikertInput } from "@/onboarding/inputs";
import {
  ADAM,
  AUDIT_C,
  EPWORTH,
  GAD7,
  IPSS,
  type InstrumentDefinition,
  MRS,
  PHQ2,
  PHQ9,
  PHQ9_ITEM_9_INDEX,
} from "@/onboarding/instruments";
import { OneItemScreen } from "@/onboarding/OneItemScreen";
import { useTheme } from "@/theme/useTheme";

import {
  finishTarget,
  isFocusComplete,
  resolveFocus,
  type MenuKey,
} from "./instrumentsFocus";

type Nav = NativeStackNavigationProp<RootStackParamList, "Instruments">;
type InstrumentsRoute = RouteProp<RootStackParamList, "Instruments">;

// ─── Section identification ──────────────────────────────────────────────
// MenuKey lives in ./instrumentsFocus (pure helper module) so the
// focus-mode resolution and this screen share one definition.

interface MenuItem {
  key: MenuKey;
  title: string;
  blurb: string;
  instrument: InstrumentDefinition;
}

interface PendingItem9 {
  value: number;
}

const PHQ2_POSITIVE_THRESHOLD = 3;

// ─── Component ────────────────────────────────────────────────────────────

export function InstrumentsScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const route = useRoute<InstrumentsRoute>();
  // Step 4: repeat check-in re-entry. Absent → onboarding battery,
  // byte-identical. Present → exactly one section, then back.
  const focus = route.params?.focus;
  const { active, theme } = useTheme();

  const [sexAtBirth, setSexAtBirth] = React.useState<
    "male" | "female" | "intersex" | "unknown" | null
  >(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  React.useEffect(() => {
    if (dal == null) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await dal.getProfile();
        if (cancelled) return;
        setSexAtBirth(profile?.sex_at_birth ?? null);
      } catch {
        if (cancelled) return;
        setSexAtBirth(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dal]);

  // ─── Mood path state ──────────────────────────────────────────────────
  // PHQ-2 + PHQ-9 share items 1 and 2 — when we expand to PHQ-9 we
  // carry the existing 0-1 responses forward and ask items 2..8 (0-based).
  // The combined response array is always indexed against PHQ-9 (length 9).
  const [phqResponses, setPhqResponses] = React.useState<Array<number | null>>(
    () => Array.from({ length: 9 }, () => null),
  );
  const [phqStep, setPhqStep] = React.useState(0); // 0..8
  const [phqExpanded, setPhqExpanded] = React.useState(false);
  const [moodDone, setMoodDone] = React.useState(false);
  const [pendingItem9, setPendingItem9] = React.useState<PendingItem9 | null>(
    null,
  );

  // ─── Optional check-ins state ─────────────────────────────────────────
  const [activeMenuKey, setActiveMenuKey] = React.useState<MenuKey | null>(
    null,
  );
  const [menuResponses, setMenuResponses] = React.useState<
    Partial<Record<MenuKey, Array<number | null>>>
  >({});
  const [menuStepIdx, setMenuStepIdx] = React.useState(0);
  const [doneKeys, setDoneKeys] = React.useState<ReadonlySet<MenuKey>>(
    () => new Set<MenuKey>(),
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // ─── Menu composition ─────────────────────────────────────────────────

  const menu: ReadonlyArray<MenuItem> = React.useMemo(() => {
    const base: MenuItem[] = [
      {
        key: "anxiety",
        title: "Anxiety",
        blurb: "A quick check-in on worry and tension.",
        instrument: GAD7,
      },
      {
        key: "alcohol",
        title: "Alcohol",
        blurb: "Three short questions about your drinking.",
        instrument: AUDIT_C,
      },
      {
        key: "sleep",
        title: "Sleep",
        blurb: "How likely you are to doze off during the day.",
        instrument: EPWORTH,
      },
    ];
    if (sexAtBirth === "male") {
      base.push(
        {
          key: "urinary",
          title: "Urinary symptoms",
          blurb: "Common with age — common to ignore.",
          instrument: IPSS,
        },
        {
          key: "hormonalMale",
          title: "Hormonal changes",
          blurb: "Energy, mood, and other shifts.",
          instrument: ADAM,
        },
      );
    } else if (sexAtBirth === "female") {
      base.push({
        key: "hormonalFemale",
        title: "Menopausal symptoms",
        blurb: "Hot flashes, sleep, mood — and more.",
        instrument: MRS,
      });
    }
    return base;
  }, [sexAtBirth]);

  // ─── Persistence helpers ──────────────────────────────────────────────

  const persistInstrument = React.useCallback(
    async (
      inst: InstrumentDefinition,
      values: ReadonlyArray<number | null>,
      itemSlice: number, // how many leading items are "real" (PHQ-2 = 2, PHQ-9 = 9)
    ): Promise<void> => {
      const userId = api.getCurrentUser()?.userId ?? null;
      if (dal == null || userId == null) {
        throw new Error("Local database not ready");
      }
      const now = new Date().toISOString();

      for (let i = 0; i < itemSlice; i++) {
        const v = values[i];
        if (v == null) continue;
        const item = inst.items[i];
        if (item == null) continue;
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "questionnaire",
          code_system: inst.codeSystem,
          code: item.itemCode,
          display: `${inst.displayName} item ${item.number}`,
          value_num: v,
          value_text: null,
          unit: null,
          source: "self_reported",
          effective_at: now,
          report_id: null,
          supersedes_id: null,
          metadata_json: JSON.stringify({
            instrument: inst.id,
            itemNumber: item.number,
            itemText: item.text,
          }),
        };
        await dal.insertObservation(obs);
      }

      // Score the slice.
      const sliceVals = values.slice(0, itemSlice);
      const score = inst.score(sliceVals);
      if (score != null) {
        const summary: ObservationInsertInput = {
          user_id: userId,
          category: "questionnaire",
          code_system: inst.codeSystem,
          code: inst.loincCode,
          display: `${inst.displayName} total score`,
          value_num: score,
          value_text: inst.interpret ? inst.interpret(score) : null,
          unit: null,
          source: "derived",
          effective_at: now,
          report_id: null,
          supersedes_id: null,
          metadata_json: JSON.stringify({ instrument: inst.id }),
        };
        await dal.insertObservation(summary);
      }
    },
    [api, dal],
  );

  // ─── Mood path logic ──────────────────────────────────────────────────

  const acknowledge988 = React.useCallback(() => {
    if (pendingItem9 == null) return;
    setPhqResponses((prev) => {
      const next = [...prev];
      next[PHQ9_ITEM_9_INDEX] = pendingItem9.value;
      return next;
    });
    setPendingItem9(null);
  }, [pendingItem9]);

  const handlePhqItemChange = React.useCallback(
    (idx: number, value: number) => {
      // LOAD-BEARING: PHQ-9 item 9 + value > 0 → defer + open modal.
      if (phqExpanded && idx === PHQ9_ITEM_9_INDEX && value > 0) {
        setPendingItem9({ value });
        return;
      }
      setPhqResponses((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    [phqExpanded],
  );

  // Auto-advance the mood path when the user picks a response. Takes the
  // current responses snapshot as an EXPLICIT arg (not from closure) so
  // the last-item persist sees the just-set value. Closure-captured
  // phqResponses would lag — same stale-closure class as Cohort/Intake.
  // `phqResponses` is no longer in this callback's deps for that reason.
  // Once-only guard for the mood-path persist. Wraps both the PHQ-2
  // negative persist AND the PHQ-9 persist so that a rapid double-fire
  // (modal-ack racing the line-380 effect) writes one row, not two.
  // The `!moodDone` gate in the effect is correctness-by-convention;
  // this ref is correctness-by-structure. See lib/runOnceInFlight.ts
  // + its tests for the invariant.
  const moodPersistInFlightRef = React.useRef(false);

  const advanceMoodAfterResponse = React.useCallback(
    (idx: number, responses: ReadonlyArray<number | null>) => {
      const totalItems = phqExpanded ? 9 : 2;
      if (idx + 1 < totalItems) {
        setPhqStep((s) => s + 1);
        return;
      }
      // Just answered the last item.
      if (!phqExpanded) {
        // PHQ-2 complete. Score and decide expansion.
        const phq2Score = PHQ2.score(responses.slice(0, 2));
        if (phq2Score != null && phq2Score >= PHQ2_POSITIVE_THRESHOLD) {
          setPhqExpanded(true);
          setPhqStep(2); // jump into item 3 (index 2)
          return;
        }
        // Negative PHQ-2 — persist + flag mood done.
        setSubmitting(true);
        setErrorMsg(null);
        runOnceInFlight(moodPersistInFlightRef, () =>
          persistInstrument(PHQ2, responses, 2),
        )
          .then(() => {
            setSubmitting(false);
            setMoodDone(true);
          })
          .catch((e: unknown) => {
            setSubmitting(false);
            setErrorMsg(
              e instanceof Error
                ? `Could not save: ${e.message}`
                : "Could not save responses.",
            );
          });
        return;
      }
      // PHQ-9 expanded path complete — persist as PHQ-9. Guard prevents
      // the once-only persist defect in the 988 modal-ack flow.
      setSubmitting(true);
      setErrorMsg(null);
      runOnceInFlight(moodPersistInFlightRef, () =>
        persistInstrument(PHQ9, responses, 9),
      )
        .then(() => {
          setSubmitting(false);
          setMoodDone(true);
        })
        .catch((e: unknown) => {
          setSubmitting(false);
          setErrorMsg(
            e instanceof Error
              ? `Could not save: ${e.message}`
              : "Could not save responses.",
          );
        });
    },
    [phqExpanded, persistInstrument],
  );

  // Wrap the response handler so item 9 only advances after the user
  // acknowledges the 988 modal (and the deferred response lands).
  const onMoodSelectResponse = React.useCallback(
    (value: number) => {
      const idx = phqStep;
      const isItem9 = phqExpanded && idx === PHQ9_ITEM_9_INDEX;
      if (isItem9 && value > 0) {
        // Modal will open via handlePhqItemChange's defer. The modal-
        // acknowledged path advances via the effect below using the
        // already-committed phqResponses (item-9 lands after the user
        // taps the 988 modal's acknowledge button).
        handlePhqItemChange(idx, value);
        return;
      }
      // Synchronous path: compute the next-responses snapshot LOCALLY so
      // advanceMoodAfterResponse sees the just-set value on the last
      // item. Closure-captured phqResponses would lag — same stale-
      // closure class as Cohort gender + Intake lifestyle. The pure
      // helper is what the regression tests exercise.
      const nextResponses = assembleNextResponses(
        phqResponses,
        idx,
        value,
        phqResponses.length,
      );
      handlePhqItemChange(idx, value);
      advanceMoodAfterResponse(idx, nextResponses);
    },
    [
      advanceMoodAfterResponse,
      handlePhqItemChange,
      phqExpanded,
      phqResponses,
      phqStep,
    ],
  );

  // After acknowledgment of the 988 modal (which lands the item-9
  // response value), advance to the next step. We pass the latest
  // phqResponses explicitly — the effect re-fires when phqResponses
  // changes (it's a dep) so the value passed here IS the just-committed
  // item-9 response, not a stale snapshot.
  //
  // ALL closure-captured values are in deps now — `moodDone`, `phqStep`,
  // and `advanceMoodAfterResponse` were previously omitted behind an
  // eslint-disable. They're safe to include: the gate inside (`!moodDone
  // && phqResponses[8] != null && phqStep === 8`) prevents double-
  // execution when the effect re-fires on those deps changing. Concretely:
  //   - moodDone flips true after persist completes → next fire bails on
  //     `!moodDone`.
  //   - phqStep changes when advance moves us past item 9 → next fire
  //     bails on `phqStep === 8`.
  //   - advanceMoodAfterResponse re-memoizes when phqExpanded flips false
  //     → true (PHQ-2 to PHQ-9 expansion); at that moment
  //     phqResponses[8] is still null, so the gate bails.
  React.useEffect(() => {
    if (pendingItem9 != null) return;
    if (!phqExpanded) return;
    if (!moodDone && phqResponses[PHQ9_ITEM_9_INDEX] != null) {
      // Are we currently sitting on item 9? Then advance.
      if (phqStep === PHQ9_ITEM_9_INDEX) {
        advanceMoodAfterResponse(PHQ9_ITEM_9_INDEX, phqResponses);
      }
    }
  }, [
    advanceMoodAfterResponse,
    moodDone,
    pendingItem9,
    phqExpanded,
    phqResponses,
    phqStep,
  ]);

  // ─── Check-in section logic ───────────────────────────────────────────

  const startMenuItem = React.useCallback((key: MenuKey) => {
    setActiveMenuKey(key);
    setMenuStepIdx(0);
    setMenuResponses((m) => {
      if (m[key] != null) return m;
      const itemCount =
        key === "anxiety"
          ? GAD7.items.length
          : key === "alcohol"
            ? AUDIT_C.items.length
            : key === "sleep"
              ? EPWORTH.items.length
              : key === "urinary"
                ? IPSS.items.length
                : key === "hormonalFemale"
                  ? MRS.items.length
                  : ADAM.items.length;
      return { ...m, [key]: Array.from({ length: itemCount }, () => null) };
    });
    setErrorMsg(null);
  }, []);

  // Persist a menu instrument with an EXPLICIT responses array. Same
  // closure-safety pattern as Cohort's submitCohort and Intake's
  // persistLifestyle: the auto-advance path on the last item must not
  // depend on closure-captured menuResponses (which would lag behind
  // the just-set value), so the caller computes the final array
  // locally and passes it in.
  const finishMenuItem = React.useCallback(
    async (
      key: MenuKey,
      inst: InstrumentDefinition,
      responses: ReadonlyArray<number | null>,
    ) => {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        await persistInstrument(inst, responses, inst.items.length);
        setDoneKeys((s) => {
          const next = new Set(s);
          next.add(key);
          return next;
        });
        setActiveMenuKey(null);
        setMenuStepIdx(0);
      } catch (e) {
        setErrorMsg(
          e instanceof Error
            ? `Could not save: ${e.message}`
            : "Could not save responses.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [persistInstrument],
  );

  const skipMenuItem = React.useCallback(() => {
    setActiveMenuKey(null);
    setMenuStepIdx(0);
  }, []);

  const onMenuSelectResponse = React.useCallback(
    (key: MenuKey, inst: InstrumentDefinition, value: number) => {
      const idx = menuStepIdx;
      // Compute the next-responses snapshot LOCALLY so the last-item
      // persist gets the just-set value. Closure-captured menuResponses
      // would still be the pre-tap array at this tick — same stale-
      // closure class as the Cohort gender step. Passing the snapshot
      // explicitly to finishMenuItem makes React's batching irrelevant
      // to correctness; no microtask defer needed. The pure helper is
      // what the regression tests exercise.
      const nextArr = assembleNextResponses(
        menuResponses[key],
        idx,
        value,
        inst.items.length,
      );
      setMenuResponses((m) => ({ ...m, [key]: nextArr }));
      if (idx + 1 < inst.items.length) {
        setMenuStepIdx((s) => s + 1);
      } else {
        void finishMenuItem(key, inst, nextArr);
      }
    },
    [finishMenuItem, menuResponses, menuStepIdx],
  );

  const goToApp = React.useCallback(() => {
    // Defensive: the finish button only renders in onboarding mode, but
    // the destination is decided by the pure helper either way.
    if (finishTarget(focus) === "back") navigation.goBack();
    else navigation.navigate("MainTabs");
  }, [focus, navigation]);

  // ─── Focus mode (Step 4) ──────────────────────────────────────────────
  // All decisions come from the pure helpers in ./instrumentsFocus;
  // these effects only execute the verdicts.

  const focusResolution = React.useMemo(
    () => resolveFocus(focus, sexAtBirth),
    [focus, sexAtBirth],
  );

  // G2 — sex-gated mismatch (or umbrella domain): defined fallback,
  // never a blank render and never the gated instrument.
  React.useEffect(() => {
    if (profileLoading) return;
    if (focus != null && focusResolution.kind === "unavailable") {
      navigation.goBack();
    }
  }, [focus, focusResolution, navigation, profileLoading]);

  // Auto-start the focused menu instrument (once per mount).
  const focusStartedRef = React.useRef(false);
  React.useEffect(() => {
    if (profileLoading || focusResolution.kind !== "menu") return;
    if (focusStartedRef.current) return;
    if (doneKeys.has(focusResolution.menuKey)) return;
    focusStartedRef.current = true;
    startMenuItem(focusResolution.menuKey);
  }, [doneKeys, focusResolution, profileLoading, startMenuItem]);

  // G3 — completion signals are post-persist only (moodDone flips after
  // the mood persist resolves; doneKeys gains its key inside
  // finishMenuItem AFTER persistInstrument resolved). goBack therefore
  // cannot fire before the write landed.
  React.useEffect(() => {
    if (focus == null || profileLoading) return;
    if (isFocusComplete(focusResolution, moodDone, doneKeys)) {
      navigation.goBack();
    }
  }, [doneKeys, focus, focusResolution, moodDone, navigation, profileLoading]);

  // ─── Styles ───────────────────────────────────────────────────────────

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
        title: {
          fontSize: theme.typography.sizes["3xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
        },
        subtitle: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
          lineHeight:
            theme.typography.sizes.base *
            theme.typography.lineHeights.relaxed,
        },
        menuCard: {
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          backgroundColor: active.bgSecondary,
          gap: theme.spacing.xs,
        },
        menuTitle: {
          fontSize: theme.typography.sizes.lg,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        menuBlurb: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
        },
        menuStatus: {
          fontSize: theme.typography.sizes.xs,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: theme.spacing.xs,
        },
        statusDone: {
          color: theme.colors.conditions.light.checkTeal.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        statusTap: {
          color: active.accentPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        primaryAction: {
          backgroundColor: active.accentPrimary,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: theme.spacing.md,
        },
        primaryLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        emptyWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active.bgPrimary,
          padding: theme.spacing.lg,
        },
      }),
    [active, theme],
  );

  // ─── Loading / submitting overlays ────────────────────────────────────

  if (profileLoading) {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={active.accentPrimary} />
        <Text style={[styles.subtitle, { marginTop: theme.spacing.sm }]}>
          Loading…
        </Text>
      </View>
    );
  }

  if (submitting) {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={active.accentPrimary} />
        <Text style={[styles.subtitle, { marginTop: theme.spacing.sm }]}>
          Saving…
        </Text>
      </View>
    );
  }

  // ─── Mood path (PHQ-2 → optional PHQ-9 expansion) ─────────────────────
  // G1 — focus "mood" enters this FULL path (phqStep starts 0, moodDone
  // starts false) with the item-9 → Crisis988Modal wiring untouched.
  // Menu-focused entries never reach it (the modal mounts only here).

  if (
    (focusResolution.kind === "none" || focusResolution.kind === "mood") &&
    !moodDone
  ) {
    const totalItems = phqExpanded ? 9 : 2;
    const inst = phqExpanded ? PHQ9 : PHQ2;
    const itemIndex = phqStep;
    const item = inst.items[itemIndex];
    if (item == null) {
      // Defensive fallback — shouldn't happen.
      return (
        <View style={styles.emptyWrap}>
          <Text style={styles.subtitle}>Loading questions…</Text>
        </View>
      );
    }
    return (
      <View style={{ flex: 1, backgroundColor: active.bgPrimary }}>
        <OneItemScreen
          stepIndex={itemIndex + 1}
          totalSteps={totalItems}
          sectionLabel="Your mood"
          question={item.text}
          helperText={
            itemIndex === 0
              ? "Over the last 2 weeks, how often have you been bothered by this?"
              : undefined
          }
          autoAdvance
          onBack={
            itemIndex === 0
              ? undefined
              : () => setPhqStep((s) => Math.max(0, s - 1))
          }
          hideBack={itemIndex === 0}
          errorMessage={errorMsg}
        >
          <LikertInput
            options={inst.responseOptions.map((opt) => ({
              ...opt,
              // Distinguish PHQ-9 item 9 from the others so the
              // crisis-path Maestro flow can target it directly.
              testID:
                itemIndex === PHQ9_ITEM_9_INDEX
                  ? `instruments_phq9_item9_option_${opt.value}`
                  : `instruments_mood_item${itemIndex + 1}_option_${opt.value}`,
            }))}
            value={phqResponses[itemIndex] ?? null}
            onChange={onMoodSelectResponse}
            accessibilityLabel={`Mood question ${itemIndex + 1}`}
          />
        </OneItemScreen>
        <Crisis988Modal
          visible={pendingItem9 != null}
          onAcknowledge={acknowledge988}
        />
      </View>
    );
  }

  // ─── Optional check-in: active item ───────────────────────────────────

  if (activeMenuKey != null) {
    const menuItem = menu.find((m) => m.key === activeMenuKey);
    if (menuItem != null) {
      const { instrument } = menuItem;
      const item = instrument.items[menuStepIdx];
      if (item != null) {
        const responses = menuResponses[activeMenuKey] ?? [];
        return (
          <OneItemScreen
            stepIndex={menuStepIdx + 1}
            totalSteps={instrument.items.length}
            sectionLabel={menuItem.title}
            question={item.text}
            autoAdvance
            onBack={
              menuStepIdx === 0
                ? () =>
                    focusResolution.kind === "menu"
                      ? navigation.goBack()
                      : skipMenuItem()
                : () => setMenuStepIdx((s) => Math.max(0, s - 1))
            }
            onSkipSection={
              focusResolution.kind === "menu"
                ? () => navigation.goBack()
                : skipMenuItem
            }
            skipLabel="Skip this section"
            errorMessage={errorMsg}
          >
            <LikertInput
              options={instrument.responseOptions.map((opt) => ({
                ...opt,
                testID: `instruments_${activeMenuKey}_item${menuStepIdx + 1}_option_${opt.value}`,
              }))}
              value={responses[menuStepIdx] ?? null}
              onChange={(v) => onMenuSelectResponse(activeMenuKey, instrument, v)}
              accessibilityLabel={`Question ${menuStepIdx + 1}`}
            />
          </OneItemScreen>
        );
      }
    }
  }

  // ─── Focus-mode fallback ──────────────────────────────────────────────
  // A focused entry never shows the onboarding menu. The frames that
  // reach here (pre-auto-start, post-completion before goBack, the
  // unavailable case) render a quiet spinner while the effects act.

  if (focusResolution.kind !== "none") {
    return (
      <View style={styles.emptyWrap}>
        <ActivityIndicator color={active.accentPrimary} />
      </View>
    );
  }

  // ─── Optional check-in: menu ──────────────────────────────────────────

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Quick check-ins</Text>
        <Text style={styles.subtitle}>
          These are all optional. Tap any topic to add a quick check-in — or
          skip ahead to Denali.
        </Text>

        {menu.map((m) => {
          const done = doneKeys.has(m.key);
          return (
            <Pressable
              key={m.key}
              testID={`instruments_menu_${m.key}`}
              style={styles.menuCard}
              onPress={() => startMenuItem(m.key)}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <Text style={styles.menuTitle}>{m.title}</Text>
              <Text style={styles.menuBlurb}>{m.blurb}</Text>
              <Text
                style={[
                  styles.menuStatus,
                  done ? styles.statusDone : styles.statusTap,
                ]}
              >
                {done ? "Saved" : "Tap to contribute"}
              </Text>
            </Pressable>
          );
        })}

        {errorMsg ? (
          <Text style={{ color: theme.colors.conditions.light.healthRed.base }}>
            {errorMsg}
          </Text>
        ) : null}

        <Pressable
          testID="instruments_finish_button"
          style={styles.primaryAction}
          onPress={goToApp}
          accessibilityRole="button"
          accessibilityLabel="I'm done — go to Denali"
        >
          <Text style={styles.primaryLabel}>I&apos;m done — go to Denali</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
