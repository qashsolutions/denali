---
name: provider-lookup
description: Search and validate healthcare providers using the NPI Registry
version: 1.0.0
triggers:
  - user_mentions_doctor
  - user_asks_who_can_do_this
  - user_provides_doctor_name
  - provider_validation_needed
---

# Provider Lookup Skill

This skill searches the NPI Registry to find and validate healthcare providers. It helps confirm the user's doctor and ensures their specialty matches the service needed.

## Purpose

We need provider information for:
1. Validating specialty matches the procedure
2. Checking if provider accepts Medicare
3. Including accurate provider info in appeals
4. Finding specialists if user needs one

## Process

### 1. Gather Provider Information

Ask for:
- Provider name (first and last, or practice name)
- Location (city/state or ZIP code)
- Specialty (if known)

### 2. Search NPI Registry

Use the NPI Registry MCP tool:

```typescript
searchNPI({
  name: "Smith",
  first_name: "John",
  state: "CA",
  city: "Los Angeles",
  specialty: "Orthopedic Surgery"
});
```

### 3. Present Results

Show a short list (max 5) for user to confirm:

```
I found a few doctors matching that name:

1. Dr. John Smith, MD
   Orthopedic Surgery
   Los Angeles, CA

2. Dr. John Smith, DO
   Family Medicine
   Pasadena, CA

Which one is your mom's doctor?
```

### 4. Store Confirmed Provider

Save to session for use in coverage check and appeals:

```typescript
session.provider = {
  npi: "1234567890",
  name: "John Smith, MD",
  specialty: "Orthopedic Surgery",
  address: "123 Medical Center Dr, Los Angeles, CA 90001",
  accepts_medicare: true
};
```

## Question Patterns

### Getting Doctor's Name

```
"Who's her doctor for this?"

"What's the name of the doctor who ordered the [test/procedure]?"

"Do you know which doctor will be doing the [procedure]?"
```

### Getting Location

```
"And where is Dr. Smith located — what city or state?"

"What's the ZIP code where she sees Dr. Smith?"
```

### If Multiple Matches

```
"I found a few doctors with that name. Which one sounds right?"

[Present list with specialty and location]

"Or you can tell me more details to help narrow it down."
```

### If No Matches

```
"I couldn't find a Dr. Smith in Los Angeles. Let me try a few things:

- Is the spelling correct?
- Could they be in a nearby city?
- Is it a practice name instead of a doctor's name?"
```

## Specialty Validation

After identifying the provider, verify their specialty matches the service:

| Service | Expected Specialties |
|---------|---------------------|
| Lumbar MRI | Orthopedics, Neurology, Pain Management, Primary Care (for ordering) |
| Knee replacement | Orthopedic Surgery |
| Cataract surgery | Ophthalmology |
| Sleep study | Sleep Medicine, Pulmonology |
| Physical therapy | Physical Therapy, Physiatry (for ordering) |

### If Specialty Mismatch

```
"I notice Dr. Smith is a Family Medicine doctor. For [procedure],
Medicare sometimes requires an order from a specialist like an orthopedist.

Has she seen a specialist for this, or is Dr. Smith handling everything?"
```

## NPI Registry Fields

Key fields from NPI lookup:

| Field | Use |
|-------|-----|
| NPI | Unique 10-digit identifier |
| Provider Name | Full name with credentials |
| Credential | MD, DO, NP, PA, etc. |
| Specialty | Primary taxonomy description |
| Address | Practice location |
| Phone | Contact number |
| Gender | For reference |

## Handling Edge Cases

### User Doesn't Know Doctor's Name

```
"That's okay — do you have any paperwork from them?
The doctor's name is usually at the top of any orders or referral letters.

Or we can continue without it for now and add it later."
```

### Multiple Locations

```
"Dr. Smith has offices in both Downtown and Westside.
Which location does she usually go to?"
```

### Provider Not in NPI Registry

```
"I couldn't find that provider in the national registry. This could mean:
- They're very new to practice
- They practice under a different name
- The spelling might be different

Do you have any paperwork with their information?"
```

### User Wants to Find a Doctor

```
"I can help you find specialists in your area who do [procedure].

What's your ZIP code?"

[Search NPI by specialty + location]

"Here are some [specialty] doctors near you who might be able to help..."
```

## Medicare Participation

Check if provider accepts Medicare assignment:

```
Accepts Assignment: Provider accepts Medicare's approved amount as full payment
Non-Participating: May charge up to 15% more than Medicare rate
Opt-Out: Does not accept Medicare (patient pays full cost)
```

### If Provider Doesn't Accept Medicare

```
"I found Dr. Smith, but it looks like they may not accept Medicare assignment.
This means you might have higher out-of-pocket costs.

Would you like me to find other [specialty] doctors nearby who accept Medicare?"
```

## What NOT to Do

- **Never require NPI**: Help users even without provider info
- **Never overwhelm with options**: Show max 5 results
- **Never skip confirmation**: Always verify with user
- **Never assume specialty**: Confirm it matches the service

## Example Conversation

**User**: "Her doctor is Dr. Patel"

**Assistant**: "Dr. Patel — got it. Do you know roughly where the office is? A city or ZIP code helps me find the right one."

**User**: "San Jose, California"

**Assistant**: *[Searches NPI: last_name=Patel, state=CA, city=San Jose]*

"I found a few Dr. Patels in San Jose:

1. **Dr. Anita Patel, MD**
   Orthopedic Surgery
   San Jose, CA

2. **Dr. Raj Patel, MD**
   Internal Medicine
   San Jose, CA

3. **Dr. Priya Patel, DO**
   Family Medicine
   San Jose, CA

Which one is your mom's doctor?"

**User**: "The first one, orthopedic"

**Assistant**: *[Stores: NPI, name, specialty, location]*

"Perfect — Dr. Anita Patel, orthopedic surgery. She's a good fit for ordering a back MRI.

Let me check what Medicare typically requires for this..."
