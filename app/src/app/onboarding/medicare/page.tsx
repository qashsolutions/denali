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

  const result = await query<{ is_on_medicare: boolean | null }>(
    `SELECT is_on_medicare FROM users WHERE id = $1 LIMIT 1`,
    [user.userId],
  );
  const isOnMedicare = result.rows[0]?.is_on_medicare ?? null;

  return <MedicareOnboardingForm alreadyAnswered={isOnMedicare !== null} />;
}
