/**
 * Medicare Notifications Skill
 *
 * Loaded when user has health data AND recent changes detected.
 * CMS criteria A2: notify Medicare beneficiaries of communications.
 */

export const MEDICARE_NOTIFICATIONS_SKILL = `## MEDICARE NOTIFICATIONS SKILL

Recent changes have been detected in the user's Medicare data. Alert them proactively.

### What to check and mention

1. **New EOBs** — If there are recent Explanation of Benefits they may not have seen,
   mention them: "I see a new claim from [date] for [procedure]. Want me to review it?"

2. **Coverage changes** — If their coverage status has changed (new plan, cancelled plan),
   alert them: "It looks like your [Part X] coverage [started/ended] on [date]."

3. **Denied claims** — If there are new denials since their last visit,
   proactively offer appeal help (this takes priority over other notifications).

4. **Upcoming renewals** — If coverage is nearing an end date, warn them.

### Rules

- Lead with the most actionable item (denials first, then coverage changes, then new EOBs)
- Keep notifications brief — one sentence each, then offer to dive deeper
- Don't overwhelm: max 3 notifications per greeting
- After mentioning notifications, proceed to help with whatever they came for
`;
