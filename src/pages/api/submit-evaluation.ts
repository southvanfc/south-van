import type { APIRoute } from "astro";
import { getVercelOidcToken } from "@vercel/oidc";

const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function env(name: string): string {
  const v = import.meta.env[name] ?? process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1) Get Vercel OIDC token
    const vercelOidcJwt = await getVercelOidcToken();

    // 2) Exchange with Google STS (Workload Identity Federation)
    const audience =
      `//iam.googleapis.com/projects/${env("GCP_PROJECT_NUMBER")}` +
      `/locations/global/workloadIdentityPools/${env("GCP_WORKLOAD_IDENTITY_POOL_ID")}` +
      `/providers/${env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")}`;

    const stsRes = await fetch("https://sts.googleapis.com/v1/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        subject_token: vercelOidcJwt,
        audience,
        scope: "https://www.googleapis.com/auth/cloud-platform",
      }),
    });

    if (!stsRes.ok) return new Response(await stsRes.text(), { status: 500 });
    const { access_token: federatedAccessToken } = await stsRes.json();

    // 3) Impersonate service account → Sheets-scoped token
    const iamRes = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(
        env("GCP_SERVICE_ACCOUNT_EMAIL")
      )}:generateAccessToken`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${federatedAccessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ scope: SHEETS_SCOPES, lifetime: "3600s" }),
      }
    );

    if (!iamRes.ok) return new Response(await iamRes.text(), { status: 500 });
    const { accessToken } = await iamRes.json();

    // 4) Parse form data
    const form = await request.formData();

    // ── Honeypot check ──────────────────────────────────────────
    if (String(form.get("company") ?? "").trim()) {
      // Bot detected — silent success redirect
      return new Response(null, { status: 303, headers: { Location: "/success" } });
    }

    // ── Original fields (preserved) ────────────────────────────
    const fullName      = String(form.get("full_name")      ?? "").trim();
    const email         = String(form.get("email")          ?? "").trim();
    const phone         = String(form.get("phone")          ?? "").trim();
    const dob           = String(form.get("dob")            ?? "").trim();
    const ageGroup      = String(form.get("age_group")      ?? "").trim();
    const positions     = form.getAll("positions").map(String).join(", ");
    const dominantFoot  = String(form.get("preferred_foot") ?? "").trim();
    const club          = String(form.get("club")           ?? "").trim();

    // ── New enhanced fields ─────────────────────────────────────
    const parentName      = String(form.get("parent_name")     ?? "").trim();
    const programInterest = form.getAll("program_interest").map(String).join(", ");
    const goals           = String(form.get("goals")           ?? "").trim();
    const referral        = String(form.get("referral")        ?? "").trim();

    // ── Validation ──────────────────────────────────────────────
    if (!fullName || !email || !dob || !ageGroup) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields: full_name, email, dob, age_group." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 5) Append to Google Sheet
    // ⚠️  Make sure your Sheet has these columns in this order (Row 1 headers):
    // Timestamp | Full Name | Email | Phone | Club | DOB | Age Group |
    // Positions | Dominant Foot | Parent/Guardian | Programs of Interest |
    // Development Goals | Referral Source
    const createdAt = new Date().toISOString();
    const TAB_NAME  = "submission";
    const range     = `${TAB_NAME}!A:Z`;

    const appendUrl =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env("GOOGLE_SHEET_ID"))}` +
      `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const sheetsRes = await fetch(appendUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        values: [[
          createdAt,
          fullName,
          email,
          phone,
          club,
          dob,
          ageGroup,
          positions,
          dominantFoot,
          // — new columns below —
          parentName,
          programInterest,
          goals,
          referral,
        ]],
      }),
    });

    if (!sheetsRes.ok) return new Response(await sheetsRes.text(), { status: 500 });

    return new Response(null, { status: 303, headers: { Location: "/success" } });

  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
