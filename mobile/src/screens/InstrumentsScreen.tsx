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
import { useNavigation } from "@react-navigation/native";
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
import type { RootStackParamList } from "@/navigation/types";
import { Crisis988Modal } from "@/onboarding/Crisis988Modal";
import { fw } from "@/onboarding/fontWeight";
import { LikertInput } from "@/onboarding/inputs";
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

type Nav = NativeStackNavigationProp<RootStackParamList, "Instruments">;

// ─── Section identification ───────────────────────────────────────────────

type MenuKey =
  | "anxiety"
  | "alcohol"
  | "sleep"
  | "urinary"
  | "hormonalFemale"
  | "hormonalMale";

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
      values: Array<number | null>,
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

  // Auto-advance the mood path when the user picks a response.
  const advanceMoodAfterResponse = React.useCallback(
    (idx: number) => {
      const totalItems = phqExpanded ? 9 : 2;
      if (idx + 1 < totalItems) {
        setPhqStep((s) => s + 1);
        return;
      }
      // Just answered the last item.
      if (!phqExpanded) {
        // PHQ-2 complete. Score and decide expansion.
        const phq2Score = PHQ2.score(phqResponses.slice(0, 2));
        if (phq2Score != null && phq2Score >= PHQ2_POSITIVE_THRESHOLD) {
          setPhqExpanded(true);
          setPhqStep(2); // jump into item 3 (index 2)
          return;
        }
        // Negative PHQ-2 — persist + flag mood done.
        setSubmitting(true);
        setErrorMsg(null);
        persistInstrument(PHQ2, phqResponses, 2)
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
      // PHQ-9 expanded path complete — persist as PHQ-9.
      setSubmitting(true);
      setErrorMsg(null);
      persistInstrument(PHQ9, phqResponses, 9)
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
    [phqExpanded, phqResponses, persistInstrument],
  );

  // Wrap the response handler so item 9 only advances after the user
  // acknowledges the 988 modal (and the deferred response lands).
  const onMoodSelectResponse = React.useCallback(
    (value: number) => {
      const idx = phqStep;
      const isItem9 = phqExpanded && idx === PHQ9_ITEM_9_INDEX;
      if (isItem9 && value > 0) {
        // Modal will open via handlePhqItemChange's defer.
        handlePhqItemChange(idx, value);
        return;
      }
      handlePhqItemChange(idx, value);
      advanceMoodAfterResponse(idx);
    },
    [
      advanceMoodAfterResponse,
      handlePhqItemChange,
      phqExpanded,
      phqStep,
    ],
  );

  // After acknowledgment of the 988 modal (which lands the item-9
  // response value), advance to the next step.
  React.useEffect(() => {
    if (pendingItem9 != null) return;
    if (!phqExpanded) return;
    if (!moodDone && phqResponses[PHQ9_ITEM_9_INDEX] != null) {
      // Are we currently sitting on item 9? Then advance.
      if (phqStep === PHQ9_ITEM_9_INDEX) {
        advanceMoodAfterResponse(PHQ9_ITEM_9_INDEX);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingItem9, phqResponses, phqExpanded]);

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

  const finishMenuItem = React.useCallback(
    async (key: MenuKey, inst: InstrumentDefinition) => {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        const values = menuResponses[key] ?? [];
        await persistInstrument(inst, values, inst.items.length);
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
    [menuResponses, persistInstrument],
  );

  const skipMenuItem = React.useCallback(() => {
    setActiveMenuKey(null);
    setMenuStepIdx(0);
  }, []);

  const onMenuSelectResponse = React.useCallback(
    (key: MenuKey, inst: InstrumentDefinition, value: number) => {
      const idx = menuStepIdx;
      setMenuResponses((m) => {
        const cur = m[key] ?? Array.from({ length: inst.items.length }, () => null);
        const next = [...cur];
        next[idx] = value;
        return { ...m, [key]: next };
      });
      if (idx + 1 < inst.items.length) {
        setMenuStepIdx((s) => s + 1);
      } else {
        // Defer so the setState above lands before persistence reads it.
        Promise.resolve().then(() => {
          void finishMenuItem(key, inst);
        });
      }
    },
    [finishMenuItem, menuStepIdx],
  );

  const goToApp = React.useCallback(() => {
    navigation.navigate("MainTabs");
  }, [navigation]);

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

  if (!moodDone) {
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
            options={[...inst.responseOptions]}
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
                ? () => skipMenuItem()
                : () => setMenuStepIdx((s) => Math.max(0, s - 1))
            }
            onSkipSection={skipMenuItem}
            skipLabel="Skip this section"
            errorMessage={errorMsg}
          >
            <LikertInput
              options={[...instrument.responseOptions]}
              value={responses[menuStepIdx] ?? null}
              onChange={(v) => onMenuSelectResponse(activeMenuKey, instrument, v)}
              accessibilityLabel={`Question ${menuStepIdx + 1}`}
            />
          </OneItemScreen>
        );
      }
    }
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
