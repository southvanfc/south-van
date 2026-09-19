import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import { BLOCKED_CONTENT_MESSAGE, findBlockedField } from "../../lib/profanity";
import type { MensApplicationInsert } from "../../types/types";

export const POST: APIRoute = async ({ request }) => {
  try {
    // 4) Read form fields
    const form = await request.formData();

    // Honeypot
    if (String(form.get("company") ?? "").trim()) {
      return new Response(null, { status: 303, headers: { Location: "/success/" } });
    }

    // Required fields
    const fullName          = String(form.get("full_name")          ?? "").trim();
    const email             = String(form.get("email")              ?? "").trim();
    const phone             = String(form.get("phone")              ?? "").trim();
    const dob               = String(form.get("dob")               ?? "").trim();
    const positions         = form.getAll("positions").map(String).join(", ");
    const preferredFoot     = String(form.get("preferred_foot")     ?? "").trim();
    const leagueExperience  = String(form.get("league_experience")  ?? "").trim();
    const availability      = form.getAll("availability").map(String).join(", ");
    const seasonCommitment  = String(form.get("season_commitment")  ?? "").trim();
    const whySouthVan       = String(form.get("why_southvan")       ?? "").trim();

    // Optional fields
    const currentClub       = String(form.get("current_club")       ?? "").trim();
    const referral          = String(form.get("referral")           ?? "").trim();

    if (!fullName || !email || !dob || !phone || !positions || !leagueExperience || !seasonCommitment || !whySouthVan) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (fullName.length > 200 || email.length > 200 || phone.length > 50 || whySouthVan.length > 5000 || currentClub.length > 200) {
      return new Response(
        JSON.stringify({ ok: false, error: "One or more fields exceed the maximum allowed length." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // Content check on free-text fields only. Selects, radios, checkboxes and
    // dates are not user typed, so there is nothing to screen there.
    // The client runs the same check first; this is the authoritative gate for
    // anything that bypasses it.
    const blocked = findBlockedField({
      full_name:    fullName,
      email,
      current_club: currentClub,
      why_southvan: whySouthVan,
    });

    if (blocked) {
      // Field and term only. The applicant's own text stays out of the logs.
      console.warn(`[submit-application] blocked content: field=${blocked.field} term=${blocked.term}`);
      return new Response(
        JSON.stringify({ ok: false, error: BLOCKED_CONTENT_MESSAGE }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 5) Insert into Supabase
    const payload: MensApplicationInsert = {
      full_name:          fullName,
      email,
      phone,
      dob,
      positions,
      preferred_foot:     preferredFoot || undefined,
      current_club:       currentClub || undefined,
      league_experience:  leagueExperience,
      availability,
      season_commitment:  seasonCommitment,
      why_south_van:      whySouthVan,
      referral:           referral || undefined,
    };

    const { error } = await supabase.from("mens_applications").insert(payload);

    if (error) {
      console.error("[submit-application] Supabase error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(null, { status: 303, headers: { Location: "/success/" } });

  } catch (e) {
    console.error("[submit-application] Unexpected error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
