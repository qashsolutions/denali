/**
 * Onboarding profile capture: sex at birth (Chunk 3, gated), Medicare
 * enrollment (Chunk 2, gated), gender identity (Chunk 3, optional).
 *
 * URL stays /onboarding/medicare even though the page is no longer
 * Medicare-only — renaming the route would orphan the redirect targets in
 * middleware, verify-otp, the onboarding form's healMedicareCookie heal
 * path, and any analytics. Keep the URL; broaden the page's scope.
 */
import { redirect } from "next/navigation";
import { getAuthUserFromServerContext } from "@/lib/auth-server";
import { query } from "@/lib/db";
import MedicareOnboardingForm from "./MedicareOnboardingForm";

export const dynamic = "force-dynamic";

export default async function MedicareOnboardingPage() {
  const user = await getAuthUserFromServerContext();
  if (!user) {
    redirect("/");
  }

  // Pull both gated fields. alreadyAnswered = the user has answered BOTH
  // required onboarding questions (medicare + sex_at_birth). If either is
  // still null, the page renders the form. Mirrors the middleware gate
  // which requires both cookies to be set before letting /app/* through.
  const result = await query<{
    is_on_medicare: boolean | null;
    sex_at_birth: string | null;
  }>(
    `SELECT is_on_medicare, sex_at_birth FROM users WHERE id = $1 LIMIT 1`,
    [user.userId],
  );
  const row = result.rows[0];
  const alreadyAnswered =
    (row?.is_on_medicare ?? null) !== null &&
    (row?.sex_at_birth ?? null) !== null;

  return <MedicareOnboardingForm alreadyAnswered={alreadyAnswered} />;
}
