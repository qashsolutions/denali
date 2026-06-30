# Maestro flows + testID inventory

Phase 1 of the automation work installs Maestro and seeds the codebase
with stable testIDs / accessibilityLabels. Phase 3 (deferred until the
server-side test-OTP mode lands) authors the actual end-to-end flows
under `flows/` and wires them into CI.

## Toolchain

Maestro CLI is installed at `~/.maestro/bin/maestro`. To verify locally:

```bash
~/.maestro/bin/maestro test mobile/maestro/smoke/_install_check.yaml
```

The flow launches the app on the running emulator (or simulator),
takes a screenshot, and asserts any visible text — proves the
toolchain is wired. Screenshot output is gitignored.

## MCP registration

The Maestro MCP server can be registered with Claude Code at project
scope:

```bash
claude mcp add maestro --scope project -- ~/.maestro/bin/maestro mcp
```

Note: `.mcp.json` is gitignored repo-wide (root `.gitignore:14`), so
each developer re-runs the command in their own checkout. The Maestro
CLI itself (which the CI flows in Phase 3 will use) works without MCP
— MCP is only needed for interactive Maestro use from inside a Claude
Code session.

## testID convention

Every interactive element the flows need is selectable by a stable
testID. Naming: `screen_purpose` or `screen_purpose_detail`. Snake
case, lowercase. Maestro flows reference these IDs verbatim.

## testID inventory (Phase 1)

### Pre-auth

| testID | Element |
|---|---|
| `signin_email_input` | SignIn email TextInput |
| `signin_send_code_button` | SignIn "Send code" Pressable |
| `signin_otp_input` | SignIn 6-digit OTP TextInput |
| `signin_verify_button` | SignIn "Verify code" Pressable |
| `signin_use_different_email_button` | SignIn "Use a different email" Pressable |
| `privacy_acknowledge_button` | PrivacyNotice "Acknowledge and continue" Pressable |

### Shared onboarding shell

| testID | Element |
|---|---|
| `oneitem_back_button` | OneItemScreen Back affordance (when shown) |
| `oneitem_skip_button` | OneItemScreen "Skip this section" / "Skip" Pressable (when shown) |
| `oneitem_continue_button` | OneItemScreen Continue Pressable (when not auto-advance) |

### Cohort interstitial

| testID | Element |
|---|---|
| `cohort_step1_birth_year_input` | Step 1 birth-year TextInput |
| `cohort_step2_option_male` / `cohort_step2_option_female` / `cohort_step2_option_unknown` | Step 2 sex-at-birth options |
| `cohort_step3_option_yes` / `cohort_step3_option_no` | Step 3 Medicare options |
| `cohort_step4_option_male` / `cohort_step4_option_female` / `cohort_step4_option_non_binary` / `cohort_step4_option_transgender_male` / `cohort_step4_option_transgender_female` / `cohort_step4_option_other` / `cohort_step4_option_prefer_not_to_say` | Step 4 gender-identity options |

### Intake

| testID | Element |
|---|---|
| `intake_section_complaint` / `intake_section_history` / `intake_section_family` / `intake_section_lifestyle` | Section-menu Pressables |
| `intake_finish_button` | Intake "Finish intake" Pressable |

### Instruments

| testID | Element |
|---|---|
| `instruments_menu_${key}` | Each menu-section card (e.g. `instruments_menu_anxiety`, `instruments_menu_alcohol`) |
| `instruments_mood_item${N}_option_${value}` | PHQ items 1-8 Likert options |
| `instruments_phq9_item9_option_${value}` | **PHQ-9 item 9** — distinguished for the 988-crisis flow |
| `instruments_${menuKey}_item${N}_option_${value}` | Menu-instrument item Likert options (GAD-7 / AUDIT-C / Epworth / IPSS / MRS / ADAM) |
| `instruments_finish_button` | "I'm done — go to Denali" Pressable |

### Onboarding shell

| testID | Element |
|---|---|
| `oneitem_continue_button` | OneItemScreen "Continue" Pressable (cohort birth-year step; later steps auto-advance on tap) |

### Health Hub dashboard (Phase-3 increment 1)

| testID | Element |
|---|---|
| `dashboard_card_${domainId}` | Each domain card (e.g. `dashboard_card_mood`, `_anxiety`, `_sleep`, `_health_markers`) |
| `dashboard_card_pill` | Verdict pill on an instrument-domain card |
| `dashboard_card_sparkline` | Increment-2 mini-trend sparkline on a card (≥2 sessions) |
| `dashboard_today_label` | Date line under the "Your health" title |
| `dashboard_all_activity` | "See all activity (chronological)" footer entry (legacy-timeline flag) |
| `dashboard_disclaimer` / `dashboard_provisional_footnote` | Pinned standing disclaimer + ‡ legend |

### Domain detail — trend layer (Step 3/4)

| testID | Element |
|---|---|
| `domain_detail_back` | Back chip in the detail header |
| `domain_detail_start_checkin` | "Start a check-in" CTA (repeat check-in re-entry; navigates Instruments with `focus`) |
| `domain_detail_provisional_footnote` | ‡ legend in the detail's pinned disclaimer strip |
| `trend_chart_${instrumentId}` | Per-instrument trend chart container (e.g. `trend_chart_GAD-7`) |
| `trend_range_3m` / `trend_range_6m` / `trend_range_y` / `trend_range_all` | Range-control segments |
| `trend_empty_state` | n=1 quiet-state line |
| `trend_delta` | Factual delta line under the chart |

### Crisis 988 modal

| testID | Element |
|---|---|
| `crisis988_modal` | Modal container backdrop |
| `crisis988_call_button` | Call 988 Pressable |
| `crisis988_text_button` | Text 988 Pressable |
| `crisis988_acknowledge_button` | "I understand" Acknowledge Pressable |

### MainTabs (accessibility-label-based, NOT testID)

React Navigation 7's typed `BottomTabNavigationOptions` doesn't expose
`tabBarTestID`. We use `tabBarAccessibilityLabel` instead — Maestro
reads the accessibility tree, same effect:

| Accessibility label | Tab |
|---|---|
| `Timeline tab` | Timeline |
| `Upload tab` | Upload |
| `Chat tab` | Chat |
| `Settings tab` | Settings |

### Timeline cards

| testID | Element |
|---|---|
| `timeline_card` | Card container (both `instrument-session` and `single` variants) |
| `timeline_card_pill` | Range / category pill |
| `timeline_card_details_toggle` | "Show details" / "Hide details" Pressable |
| `timeline_card_disclaimer` | Standing disclaimer line |
| `timeline_card_provisional_footnote` | "‡ Interpretation pending clinical review." (instrument-session cards only when band is provisional) |

## Selector policy

- **Selectors must be text/id-based, never coordinate-based.**
- Prefer testID for interactive elements (taps, text-input).
- Prefer `tapOn: { text: "…" }` for elements with stable visible copy
  that's part of the UX contract (e.g. tab labels).
- Avoid selecting by ordinal position or screen coordinates.

## Why this layer matters

Once the Phase 2 server-side test-OTP mode ships, the Phase 3 Maestro
flows reach into `signin_*` → `privacy_acknowledge_button` →
`cohort_step*` → `intake_*` → `instruments_*` → MainTabs Timeline tab →
`timeline_card_*` to drive the onboarding-happy-path and the PHQ-9
988-crisis path end-to-end on the CI emulator.
