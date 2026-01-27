# User Flow & Use Case

## Use Case: Medicare Prior Auth & Denial Intelligence Platform

### User Flow

1. Enter: CPT + ICD-10 diagnosis + Provider NPI + State
2. System returns:
   - ✅ CPT code description & category (AMA API)
   - ✅ ICD-10 validation + medical necessity fit
   - ✅ NPI verification + specialty match
   - ✅ Relevant NCD/LCD policies for that CPT/condition
   - ✅ SAD check (Part B billable or Part D?)
   - ✅ PubMed evidence supporting the service
   - 🤖 Claude synthesizes: approval likelihood, documentation gaps, appeal strategy

### Outputs

- Prior auth checklist
- Appeal letter draft (if denied)
- Citation bundle (policies + studies)

---

## Simplified Patient Flow

### Step 1: Patient Tells Us Their Problem

- "My mom needs a scan for her back pain"
- "Doctor wants me to get physical therapy for my shoulder"
- "I need a sleep study"

### Step 2: We Ask Smart Follow-Up Questions

Claude-powered conversation to narrow down the ICD-10:
- "How long has the back pain been going on?"
- "Did it start after an injury or just gradually?"
- "Does it go down into the legs?"
- "Any numbness or tingling?"
- "Has she tried any treatment so far — medication, PT, injections?"

We're not asking for codes — we're having a human conversation that maps to the right clinical picture.

### Step 3: Doctor & Location

- "Who's your doctor?" (we search NPI by name + state/city)
- Confirm the right one from a short list

### Step 4: We Tell Them How to Get Approved

Plain English guidance:

> "Medicare usually covers a back MRI for your mom's situation, but here's what the doctor needs to document to avoid a denial:
> 
> 1. Pain has lasted more than 6 weeks
> 2. She's tried medication or PT first
> 3. There are neurological symptoms (the leg tingling you mentioned)
> 
> Print this and bring it to her appointment. Ask the doctor to include these details in the order."

---

## Agentic Learning Loop

1. Patient says: "My dad needs a scan for his dizzy spells"
2. Claude interprets → maps to likely ICD-10s (vertigo, dizziness NOS, etc.)
3. Stores the mapping: `"dizzy spells" → R42`
4. Next patient says same thing → system is faster, more confident
5. If patient corrects ("no, it's actually his ears") → feedback updates the model
6. Over time: denali.health gets smarter from real patient language

---

## Account Management

### Account Deletion Flow

Users can delete their account from Settings → Delete Account:

1. User taps "Delete Account" (red text, danger zone)
2. Confirmation dialog appears:
   > "Are you sure you want to delete your account? This will permanently remove:
   > - Your conversation history
   > - Saved preferences
   > - Subscription (if active)
   >
   > This action cannot be undone."
3. User must type "DELETE" to confirm
4. System processes deletion:
   - Cancels active Stripe subscription (if any)
   - Deletes all user data from database
   - Anonymizes feedback/mappings (keeps learning data, removes user link)
   - Signs out and clears local storage
5. Success message: "Your account has been deleted. Thank you for using denali.health."

### Data Retained (Anonymized)

To preserve system learning while respecting privacy:
- `symptom_mappings` — phrase→code mappings (no user link)
- `procedure_mappings` — phrase→code mappings (no user link)
- `coverage_paths` — successful approval patterns (no user link)

### Data Deleted

- `users` row
- `user_verification` row
- `subscriptions` row
- `usage` rows
- `conversations` and `messages`
- `user_feedback` rows (or anonymized)
