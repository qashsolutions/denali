import { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Auth mock profiles
// ---------------------------------------------------------------------------

export async function mockUnauthenticatedUser(page: Page) {
  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: null,
        plan: null,
        role: null,
        is_admin: false,
        appeal_count: 0,
        appeal_credits: 0,
      }),
    })
  );
  await page.route("**/api/conversations", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    })
  );
}

export async function mockAuthenticatedUser(
  page: Page,
  overrides: {
    email?: string;
    plan?: "trial" | "starter" | "plus" | "unlimited";
    is_admin?: boolean;
    appeal_credits?: number;
    firstName?: string;
    trialStatus?: "active" | "expired";
    trialDaysRemaining?: number;
  } = {}
) {
  const {
    email = "test@example.com",
    plan = "trial",
    is_admin = false,
    appeal_credits = 0,
    firstName,
    trialStatus = "active",
    trialDaysRemaining = 10,
  } = overrides;

  await page.route("**/api/profile", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: true,
        userId: "test-user-id-000",
        email,
        plan,
        role: null,
        is_admin,
        isAdmin: is_admin,
        appeal_count: 0,
        appeal_credits,
        appealCount: 0,
        appealCredits: appeal_credits,
        ...(firstName ? { firstName } : {}),
      }),
    })
  );

  await page.route("**/api/conversations", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    })
  );

  await page.route("**/api/trial", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: trialStatus,
        daysRemaining: trialDaysRemaining,
      }),
    })
  );

  await page.route("**/api/auth/mfa/status", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enrolled: false }),
    })
  );
}

export async function mockAdminUser(page: Page) {
  return mockAuthenticatedUser(page, {
    email: "admin@denali.health",
    plan: "unlimited",
    is_admin: true,
    appeal_credits: 999,
  });
}

// ---------------------------------------------------------------------------
// SSE chat mock
// ---------------------------------------------------------------------------

export function buildSSEResponse(
  content: string,
  options: {
    suggestions?: string[];
    conversationId?: string;
    appealLetter?: string;
  } = {}
) {
  const {
    suggestions = [],
    conversationId = "test-conv-id",
    appealLetter,
  } = options;

  const lines = [
    `event: delta\ndata: ${JSON.stringify({ text: content })}\n\n`,
    `event: done\ndata: ${JSON.stringify({
      content,
      conversationId,
      suggestions,
      sessionState: {},
      toolsUsed: [],
      ...(appealLetter ? { appealLetter } : {}),
    })}\n\n`,
  ];
  return lines.join("");
}

export async function mockChatSSE(
  page: Page,
  content: string,
  suggestions: string[] = []
) {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: buildSSEResponse(content, { suggestions }),
    })
  );
}

export async function mockChatError(page: Page, status: number, error: string, code?: string) {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error, ...(code ? { code } : {}) }),
    })
  );
}

// ---------------------------------------------------------------------------
// FHIR / Health data mock
// ---------------------------------------------------------------------------

export const MOCK_FHIR_CONNECTED = {
  connected: true,
  patient: { age: 68, gender: "male" },
  coverage: [
    { type: "Part A", status: "Active", planName: null },
    { type: "Part B", status: "Active", planName: null },
  ],
  claims: [
    {
      id: "claim-1",
      type: "Carrier",
      serviceDate: "2026-01-15",
      provider: "Dr. Smith",
      procedures: ["Office visit"],
      procedureCodes: ["99213"],
      diagnosis: "Type 2 diabetes",
      diagnosisCodes: ["E11.65"],
      totalCharged: "$150.00",
      medicarePaid: "$120.00",
      youOwe: "$30.00",
      status: "Processed",
      denialReasons: null,
    },
    {
      id: "claim-2",
      type: "Carrier",
      serviceDate: "2026-02-10",
      provider: "Dr. Jones",
      procedures: ["Blood test"],
      procedureCodes: ["83036"],
      diagnosis: "Diabetes screening",
      diagnosisCodes: ["Z13.1"],
      totalCharged: "$50.00",
      medicarePaid: "$50.00",
      youOwe: "$0.00",
      status: "Denied",
      denialReasons: ["Service not covered"],
    },
  ],
  conditions: [
    { code: "E11.65", name: "Type 2 diabetes mellitus with hyperglycemia", category: "type2" },
    { code: "I10", name: "Essential hypertension", category: "other" },
    { code: "D64.9", name: "Anemia, unspecified", category: "other" },
  ],
  medications: [
    { name: "Metformin", status: "active", isDiabetesMed: true, isObesityMed: false, daysSupply: 30, isBrandName: false, gapDays: 0 },
  ],
  screenings: [
    { screeningType: "a1c", displayName: "A1C Test", lastDate: "2025-06-15", monthsSinceLast: 9, isOverdue: true },
    { screeningType: "eye-exam", displayName: "Diabetic Eye Exam", lastDate: "2025-01-10", monthsSinceLast: 14, isOverdue: true },
  ],
  providers: [
    { name: "Dr. Smith", specialty: "Internal Medicine", visitCount: 5, lastSeen: "2026-01-15", npi: "1234567890" },
  ],
  hospitalizations: [],
  labs: [],
  dme: [],
  isHospice: false,
};

export const MOCK_FHIR_DISCONNECTED = {
  connected: false,
  patient: null,
  coverage: [],
  claims: [],
  conditions: [],
  medications: [],
  screenings: [],
  providers: [],
  hospitalizations: [],
  labs: [],
  dme: [],
  isHospice: false,
};

export async function mockFHIRData(page: Page, connected = true) {
  await page.route("**/api/fhir/data", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(connected ? MOCK_FHIR_CONNECTED : MOCK_FHIR_DISCONNECTED),
    })
  );
}

// ---------------------------------------------------------------------------
// Consent mock
// ---------------------------------------------------------------------------

export async function mockConsent(
  page: Page,
  consent: {
    health_data_ai?: boolean;
    health_data_storage?: boolean;
    analytics?: boolean;
  } = {},
  putHandler?: (body: { consentType: string; granted: boolean }) => void
) {
  const merged = {
    health_data_ai: false,
    health_data_storage: false,
    analytics: false,
    ...consent,
  };

  await page.route("**/api/consent", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: merged }),
      });
    }
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      if (putHandler) putHandler(body);
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Conversation history mock
// ---------------------------------------------------------------------------

export async function mockConversationHistory(
  page: Page,
  conversations: Array<{
    id: string;
    preview: string;
    created_at: string;
    has_appeal?: boolean;
  }> = []
) {
  // Convert simplified test format to the shape useConversationHistory expects
  const apiConversations = conversations.map((c) => ({
    id: c.id,
    title: null,
    isAppeal: c.has_appeal || false,
    createdAt: c.created_at,
    firstUserMessage: c.preview,
    lastAssistantMessage: `Response to: ${c.preview}`,
  }));

  // Remove any previously registered handler for this route (e.g., from mockAuthenticatedUser)
  await page.unroute("**/api/conversations");
  await page.route("**/api/conversations", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: true,
        conversations: apiConversations,
      }),
    })
  );
}

// ---------------------------------------------------------------------------
// Health report mock
// ---------------------------------------------------------------------------

export const MOCK_HEALTH_REPORT = {
  id: "report-123",
  status: "ready",
  shareToken: "share-token-abc",
  data: {
    redFlags: { items: [] },
    diabetesSection: { classification: "type2", items: ["A1C screening overdue"] },
    obesitySection: { classification: "none", items: [] },
    preDiabetesSection: { items: [] },
    conditionsSection: { items: ["Type 2 diabetes", "Hypertension"] },
    medicationsSection: { items: ["Metformin"] },
    dmeSection: { items: [] },
    screeningsSection: { items: ["A1C overdue"] },
    careTeamSection: { items: ["Dr. Smith - Internal Medicine"] },
    denialsSection: { items: [] },
    hospiceSection: null,
    summary: "Health report summary text.",
  } as Record<string, unknown> | null,
  created_at: "2026-03-20T10:00:00Z",
  expires_at: "2026-04-19T10:00:00Z",
};

export async function mockHealthReport(page: Page, report = MOCK_HEALTH_REPORT) {
  await page.route("**/api/health-report", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report }),
      });
    }
    return route.continue();
  });
}

// ---------------------------------------------------------------------------
// Diabetes mocks
// ---------------------------------------------------------------------------

export async function mockDiabetesSnapshots(page: Page, snapshots: unknown[] = []) {
  await page.route("**/api/diabetes/snapshots", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshots }),
    })
  );
}

export async function mockDiabetesLog(page: Page, entries: unknown[] = []) {
  await page.route("**/api/diabetes/log", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
    }
    if (route.request().method() === "POST") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, entry: { id: "new-entry-id", ...route.request().postDataJSON() } }),
      });
    }
    return route.continue();
  });
}

export async function mockDiabetesInsights(page: Page, insight: unknown = null) {
  await page.route("**/api/diabetes/insights", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insight }),
    })
  );
}

// ---------------------------------------------------------------------------
// Audit log mock
// ---------------------------------------------------------------------------

export async function mockAuditLog(page: Page, logs: unknown[] = []) {
  await page.route("**/api/audit-log", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authenticated: true, logs, total: logs.length, page: 1, hasMore: false }),
    })
  );
}

// ---------------------------------------------------------------------------
// Topic preferences mock
// ---------------------------------------------------------------------------

export async function mockTopicPreferences(page: Page, topics: string[] = []) {
  await page.route("**/api/preferences/topics", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics }),
      });
    }
    if (route.request().method() === "PUT") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, topics: route.request().postDataJSON().topics }),
      });
    }
    return route.continue();
  });
}
