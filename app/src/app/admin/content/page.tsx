import { notFound } from "next/navigation";
import { getAuthUserFromServerContext } from "@/lib/auth-server";
import { query } from "@/lib/db";
import AdminContent from "./AdminContent";

export default async function AdminContentPage() {
  const user = await getAuthUserFromServerContext();
  if (!user) notFound();

  const result = await query<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
    [user.userId],
  );
  if (!result.rows[0]?.is_admin) notFound();

  return <AdminContent />;
}
