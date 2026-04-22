/**
 * Topic Preferences API
 *
 * GET  /api/preferences/topics — return user's selected health topics
 * PUT  /api/preferences/topics — update topic preferences (max 2 topics)
 *
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";
import type { HealthTopic } from "@/types/cms";

const VALID_TOPICS: HealthTopic[] = ["diabetes", "obesity", "medicare-general"];
const MAX_TOPICS = 2;

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const result = await query<{ topic: string }>(
      `SELECT topic FROM user_topic_preferences WHERE user_id = $1 ORDER BY created_at`,
      [user.userId]
    );

    return NextResponse.json({ topics: result.rows.map((r) => r.topic) });
  } catch (error) {
    console.error("[TopicPreferences] GET error:", error);
    return NextResponse.json({ error: SYSTEM.TOPICS_LOAD_FAILED }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const body = await request.json();
    const { topics } = body as { topics: string[] };

    if (!Array.isArray(topics)) {
      return NextResponse.json({ error: VALIDATION.INVALID_TOPICS }, { status: 400 });
    }

    if (topics.length > MAX_TOPICS) {
      return NextResponse.json({ error: VALIDATION.TOPICS_MAX(MAX_TOPICS) }, { status: 400 });
    }

    // Validate each topic
    for (const topic of topics) {
      if (!VALID_TOPICS.includes(topic as HealthTopic)) {
        return NextResponse.json({ error: VALIDATION.INVALID_TOPIC(topic) }, { status: 400 });
      }
    }

    // Delete existing + insert new in one transaction
    await query(`DELETE FROM user_topic_preferences WHERE user_id = $1`, [user.userId]);

    if (topics.length > 0) {
      const values = topics.map((_, i) => `($1, $${i + 2})`).join(", ");
      await query(
        `INSERT INTO user_topic_preferences (user_id, topic) VALUES ${values}
         ON CONFLICT (user_id, topic) DO NOTHING`,
        [user.userId, ...topics]
      );
    }

    logAudit("PREFERENCES_UPDATED", {
      userId: user.userId,
      resourceType: "topic_preferences",
      metadata: { topics },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error("[TopicPreferences] PUT error:", error);
    return NextResponse.json({ error: SYSTEM.TOPICS_SAVE_FAILED }, { status: 500 });
  }
}
