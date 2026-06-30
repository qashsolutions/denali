# Zero-Knowledge Backup — Design v1 (mobile, Phase 1.5)

> **Status:** RATIFIED 2026-06-14 (Venkata). §8 supersession applied to
> `mobile/CLAUDE.md` + `OBJECTIVE.md`; recorded as decision D16. Shipped so
> far: crypto core (`ba899e8`), export/import (`8503781`). Building: wire codec
> → server (`/api/backup`) under HIPAA + privacy-guard review → recovery UX.
>
> **Decisions (Venkata, 2026-06-14):** recovery model = on-device recovery key
> + **device keychain (iCloud / Google Password Manager) + downloadable kit**
> (server can never hold/derive/email the key); kit rendering = **BIP39
> mnemonic**; backup trigger = **manual + automatic**.

---

## 0. Why this exists

Phase 1 is local-first: the entire multi-year health record **and** the
SQLCipher key live only on the device (Invariants 2 & 3). **Lose / break /
wipe / replace the phone → the record is gone forever.** For an app whose
whole value is "build your longitudinal record," that is the single biggest
UX risk. ZK backup fixes device-loss + phone-migration **without** making the
server a custodian of readable PHI.

This is the bridge OBJECTIVE.md already names: *"once trust is earned — later
opts into … cloud backup."*

---

## 1. The guarantee (and the one thing we can't promise)

**Guarantee (zero-knowledge against the operator):** the server, the database,
the object store, an AWS insider, a subpoena, and an SES/email breach all see
**only opaque ciphertext + non-secret metadata**. None can decrypt. The
decryption secret exists only on the user's devices (and their OS keychain /
printed kit).

**The unavoidable cost:** if a user loses *every* device **and** their saved
recovery key, the backup is **permanently unrecoverable**. That is the literal
meaning of "no one but you can read it." We make it very unlikely (keychain
sync across the user's devices + recovery kit + setup confirmation + re-view
while signed in); we do **not** give ourselves a backdoor to eliminate it.

**Explicitly rejected (and why):** server-generated or emailed recovery codes.
If we create/email the key, we (and anyone who breaches SES or the inbox) can
decrypt — that is ordinary cloud backup (the banned D2 item), not ZK. Email
stays an **authentication** factor (OTP to download your blob), never a **key**
factor. (An 8-digit numeric code is also only ~26 bits — brute-forced offline
against a stolen blob in seconds.)

---

## 2. Threat model

| Adversary | Sees | Can decrypt? |
|---|---|---|
| Passive DB / S3 breach | ciphertext + wrapped-DEK + salt + nonce + manifest meta | No |
| Denali insider / subpoena | same | No |
| SES / registered-inbox compromise | OTP emails (auth), backup *salt* (non-secret) | No |
| Network MITM | TLS-protected ciphertext | No (TLS + AEAD) |
| Lost/stolen unlocked device | local SQLCipher DB (already the Phase-1 risk) | (unchanged) |
| Malicious app build | plaintext on-device | Out of scope — true of any client; mitigated by store review + (aspirational) reproducible builds |

**Trusted component (documented assumption):** the platform keychain
(iCloud Keychain / Google Password Manager) is trusted to end-to-end protect
the synced recovery key. This is the same trust model as 1Password/Signal
recovery and is acceptable for v1; called out so it's an explicit, reviewable
assumption rather than a hidden one.

---

## 3. Cryptographic design (envelope encryption)

Key hierarchy — three keys, each with one job:

1. **Recovery Key (RK)** — 256-bit, from the platform CSPRNG (`expo-crypto`,
   the same FIPS-grade source as the SQLCipher key). **Generated on-device,
   never derived from any Cognito/login secret** (honors Invariant 3). This is
   the root the user safeguards. Rendered two ways for the same bytes:
   - raw → saved to the OS keychain for autofill;
   - a BIP39-style mnemonic (or grouped Base32) → the printable recovery kit.
2. **Data Encryption Key (DEK)** — 256-bit random, per backup. The payload is
   AEAD-encrypted under the DEK. (Indirection bought deliberately: lets RK
   rotate and lets a *second* recovery factor wrap the same DEK later without
   re-encrypting the whole blob.)
3. **Key-Encryption Key (KEK)** — `HKDF-SHA256(RK, salt, info="denali-backup-kek-v1")`.
   Wraps the DEK: `wrapped_dek = AEAD_KEK(DEK)`.

**AEAD:** AES-256-GCM (or XChaCha20-Poly1305 if the chosen lib provides it),
random 96/192-bit nonce per encryption, chunked for large payloads.

**Restore path:** user supplies RK (keychain autofill or kit) → `KEK =
HKDF(RK, salt)` → unwrap DEK → AEAD-decrypt payload → import into a fresh local
SQLCipher DB (with a brand-new device-local SQLCipher key — see §4).

> **Dependency spike (gating, like the OCR item):** RN/Expo-56/New-Arch/Hermes
> AEAD. Candidates: `react-native-libsodium`, `react-native-quick-crypto`,
> `expo-crypto` (digest/CSPRNG only today — verify AEAD), or Web Crypto
> `subtle` under Hermes. The crypto core does not start until one is verified
> on SDK 56 + New Arch. **No hand-rolled AEAD/KDF — ever.**

---

## 4. What is backed up (and what isn't)

- **Backed up:** a versioned, consistent **export** of the append-only health
  record — `observations`, `profile`, instrument sessions. Serialized →
  AEAD-encrypted → uploaded. We back up the *export*, **not** the raw SQLCipher
  file, so the device-local SQLCipher key stays device-only and ephemeral
  (Invariant 3 intact) and the backup is self-contained under the RK hierarchy.
- **NOT backed up:** chat (ephemeral by D11 — never persisted anywhere), the
  device SQLCipher key, any Cognito token.
- **Restore** writes through the existing append-only DAL (`ON CONFLICT DO
  NOTHING`), so re-importing is idempotent and supersede-only — no value is
  ever overwritten (Invariant 4 intact).

**v1 sync model:** last-write-wins **full snapshot**, versioned. Append-only
delta sync + multi-device merge is later (multi-device is an OBJECTIVE
non-goal). v1 is single-user disaster-recovery + phone migration.

---

## 5. Server side (the net-new, mobile-only surface)

Ciphertext is opaque but it *is* the user's (encrypted) health data, so storing
it server-side is the deliberate invariant reversal (see §8). Mirrors the
transient `/api/parse-report` pattern: auth required, mobile-only, additive.

**Storage:** S3 object (SSE) for the blob + a DB pointer row.

```
backup_blobs(
  user_id        — FK, Cognito sub; WHERE user_id = $1 on every read
  blob_id, version
  s3_key         — ciphertext location (opaque bytes)
  wrapped_dek, kdf_salt, nonce   — wrapping metadata (non-secret)
  manifest_meta  — schema version, record counts, content_hash (no PHI)
  size, created_at
)
```

**API (net-new):**
- `PUT /api/backup` — auth; accepts ciphertext + wrapped_dek + salt + nonce +
  manifest. Stores. **Never receives plaintext or RK.**
- `GET /api/backup` — auth; returns latest ciphertext + wrapping metadata.
- `DELETE /api/backup` — auth; opt-out / account-deletion cascade.

**Guard (extends `guard-persistence.sh` discipline):** a `query()`/body-spy
test proving the `PUT /api/backup` request body is high-entropy ciphertext with
**no plaintext markers** and that **no key material is ever transmitted**.

---

## 6. Recovery UX (operator-chosen: keychain + kit)

- **Setup:** generate RK → wrap DEK → upload first snapshot → offer RK to the
  OS keychain with one tap (autofill credential) → **force save-confirmation**
  (user re-confirms it's saved) → offer the **downloadable/printable recovery
  kit** (mnemonic + QR). Re-viewable anytime while signed in on a device that
  still has the key.
- **Restore (new phone):** sign in (OTP) → fetch ciphertext → RK arrives via
  keychain **autofill** (or paste from kit) → decrypt → import to fresh local
  DB.
- **On-switch:** the currently-inert `health_data_storage` consent toggle (D10:
  "Phase 2's cloud backup gate, INERT in Phase 1") becomes the real opt-in.
  Reword its copy from "not available" to the live behavior.

> **Spike:** exact "save to keychain as autofill credential" mechanism on
> iOS (AutoFill credential APIs / `expo-secure-store` iCloud sync) vs Android
> (Block Store / Password Manager). Verified before the recovery-UX stage.

---

## 7. HIPAA / compliance

- Encrypted blobs are still PHI (encrypted) → S3 bucket + RDS pointer are
  in-scope for the existing AWS BAA (S3/RDS already covered). Belt: S3 SSE +
  app-layer ZK encryption.
- Audit-log backup `create` / `restore` / `delete` events (event only, **no
  PHI, no key material**).
- Account deletion cascades to `backup_blobs` + the S3 object.
- ZK is a *strengthened* posture (operator literally cannot read it), but the
  design + diff route through **`hipaa-security-reviewer`** and
  **`mobile-privacy-invariant-guard`** before ship.

---

## 8. Invariant supersession (requires Venkata ratification)

This feature supersedes **Invariant 6** and an OBJECTIVE non-goal. Proposed
exact wording — *not applied until this doc is approved* (only Venkata edits
intent):

- `mobile/CLAUDE.md` Invariant 6 → *"No longitudinal model in Phase 1.
  **Cloud backup is permitted only as zero-knowledge backup:** the server
  stores client-side-encrypted ciphertext it cannot decrypt; the decryption
  key never leaves the user's devices/keychain. Invariant 1's spirit — no
  *readable* server-side health data — is preserved."*
- `OBJECTIVE.md` §4 non-goal "zero-knowledge cloud backup, sync, multi-device"
  → split: **ZK backup is now in-scope (single-device DR + migration)**; sync /
  multi-device remain non-goals.
- Decision record: **D16 — ZK backup** (this doc), with the recovery-model
  decisions.

---

## 9. Staged build sequence (each stage = its own reviewed step)

1. **Design doc (this)** → approve. ⟵ *we are here; STOP for approval.*
2. **Compat spikes:** AEAD lib + keychain-autofill on SDK 56 / New Arch. If a
   spike fails, surface it (same dead-end class as pdfjs/OCR) before building on
   it.
3. **On-device crypto core** — pure + exhaustively unit-tested: RK gen, HKDF
   KEK, DEK wrap/unwrap, AEAD encrypt/decrypt, manifest, round-trip property
   tests. **No network.**
4. **Backup export/import** — SQLCipher snapshot ↔ encrypted payload, idempotent
   restore through the append-only DAL.
5. **Server** — `backup_blobs` + S3 + `PUT/GET/DELETE /api/backup` +
   ciphertext-only body-spy guard test.
6. **Recovery UX** — keychain save/autofill + recovery kit + setup confirmation
   + Settings opt-in rewording.
7. **Reviews** — `hipaa-security-reviewer` + `mobile-privacy-invariant-guard`.
8. **Rollout** — flag-gated (off by default), opt-in, **staging-first**, then a
   deliberate prod flag flip. Maestro E2E for setup + restore.

---

## 10. Open decisions for Venkata (before stage 3)

1. **Approve this design** (and the §8 invariant supersession wording)?
2. **Backup trigger:** manual ("Back up now") only for v1, or also automatic
   (e.g., daily when on Wi-Fi + charging)? (I'd ship manual first, add auto
   later.)
3. **Recovery-key rendering in the kit:** BIP39 mnemonic (familiar, longer) vs
   grouped Base32 code (shorter)? (I'd pick BIP39 — better error-detection +
   ecosystem.)
