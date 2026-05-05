import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import type { MensApplicationInsert } from "../../types/types";

export const POST: APIRoute = async ({ request }) => {
  try {
    // 4) Read form fields
    const form = await request.formData();

    // Honeypot
    if (String(form.get("company") ?? "").trim()) {
      return new Response(null, { status: 303, headers: { Location: "/success" } });
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
      return new Response(
        JSON.stringify({ ok: false, error: error.message }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(null, { status: 303, headers: { Location: "/success" } });

  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? "Server error" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
