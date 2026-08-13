import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import type { PlayerEvaluationInsert } from "../../types/types";

function calcAge(dobStr: string): number | null {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 4) Parse form data
    const form = await request.formData();

    // ── Honeypot check ──────────────────────────────────────────
    if (String(form.get("company") ?? "").trim()) {
      // Bot detected — silent success redirect
      return new Response(null, { status: 303, headers: { Location: "/success/" } });
    }

    // ── 01 Player Details ───────────────────────────────────────
    const fullName      = String(form.get("full_name")    ?? "").trim();
    const dob           = String(form.get("dob")          ?? "").trim();
    const ageGroup      = String(form.get("age_group")    ?? "").trim();
    const club          = String(form.get("club")         ?? "").trim();
    const yearsPlaying  = String(form.get("years_playing") ?? "").trim();
    const schoolGrade   = String(form.get("school_grade") ?? "").trim();

    // ── 02 Playing Profile ──────────────────────────────────────
    const positions        = form.getAll("positions").map(String).join(", ");
    const dominantFoot     = String(form.get("preferred_foot")    ?? "").trim();
    const trainingHours    = String(form.get("training_hours")    ?? "").trim();
    const competitionLevel = String(form.get("competition_level") ?? "").trim();
    const otherSports      = String(form.get("other_sports")      ?? "").trim();

    // ── 03 Parent / Guardian (under 18) ─────────────────────────
    const parentName         = String(form.get("parent_name")         ?? "").trim();
    const parentRelationship = String(form.get("parent_relationship") ?? "").trim();
    const parentEmail        = String(form.get("parent_email")        ?? "").trim();
    const parentPhone        = String(form.get("parent_phone")        ?? "").trim();

    // ── 03b Player Contact (18+) ─────────────────────────────────
    const playerEmail = String(form.get("player_email") ?? "").trim();
    const playerPhone = String(form.get("player_phone") ?? "").trim();

    // Age is derived server-side from DOB — never trust client-side branching.
    const isAdult = (calcAge(dob) ?? 0) >= 18;

    // ── 04 Player Background ────────────────────────────────────
    const previousCoaching    = String(form.get("previous_coaching")    ?? "").trim();
    const injuries            = String(form.get("injuries")             ?? "").trim();
    const playerStrengths     = String(form.get("player_strengths")     ?? "").trim();
    const areasToImprove      = String(form.get("areas_to_improve")     ?? "").trim();

    // ── 05 Goals & Referral ─────────────────────────────────────
    const longTermGoal = String(form.get("long_term_goal") ?? "").trim();
    const goals        = String(form.get("goals")          ?? "").trim();
    const referral     = String(form.get("referral")       ?? "").trim();

    // ── Validation ──────────────────────────────────────────────
    const missing: string[] = [];
    if (!fullName)           missing.push("full_name");
    if (!dob)                missing.push("dob");
    if (!ageGroup)           missing.push("age_group");
    if (!yearsPlaying)       missing.push("years_playing");
    if (!dominantFoot)       missing.push("preferred_foot");
    if (!trainingHours)      missing.push("training_hours");
    if (!competitionLevel)   missing.push("competition_level");
    if (isAdult) {
      if (!playerEmail) missing.push("player_email");
      if (!playerPhone) missing.push("player_phone");
    } else {
      if (!parentName)         missing.push("parent_name");
      if (!parentRelationship) missing.push("parent_relationship");
      if (!parentEmail)        missing.push("parent_email");
      if (!parentPhone)        missing.push("parent_phone");
    }
    if (!previousCoaching)   missing.push("previous_coaching");
    if (!longTermGoal)       missing.push("long_term_goal");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const contactEmail = isAdult ? playerEmail : parentEmail;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    if (
      fullName.length > 200 || parentName.length > 200 || parentEmail.length > 200 ||
      parentPhone.length > 50 || playerEmail.length > 200 || playerPhone.length > 50 ||
      longTermGoal.length > 5000
    ) {
      return new Response(
        JSON.stringify({ ok: false, error: "One or more fields exceed the maximum allowed length." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    // 5) Insert into Supabase
    const payload: PlayerEvaluationInsert = {
      full_name:            fullName,
      dob,
      age_group:            ageGroup,
      current_club:         club || undefined,
      years_playing:        yearsPlaying,
      school_grade:         schoolGrade || undefined,
      positions,
      dominant_foot:        dominantFoot,
      training_hours:       trainingHours,
      competition_level:    competitionLevel,
      other_sports:         otherSports || undefined,
      parent_name:          isAdult ? undefined : parentName,
      parent_relationship:  isAdult ? undefined : parentRelationship,
      parent_email:         isAdult ? undefined : parentEmail,
      parent_phone:         isAdult ? undefined : parentPhone,
      player_email:         isAdult ? playerEmail : undefined,
      player_phone:         isAdult ? playerPhone : undefined,
      previous_coaching:    previousCoaching,
      injuries:             injuries || undefined,
      player_strengths:     playerStrengths || undefined,
      areas_to_improve:     areasToImprove || undefined,
      long_term_goal:       longTermGoal,
      goals:                goals || undefined,
      referral:             referral || undefined,
    };

    const { error } = await supabase.from("player_evaluations").insert(payload);

    if (error) {
      console.error("[submit-evaluation] Supabase error:", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(null, { status: 303, headers: { Location: "/success/" } });

  } catch (e) {
    console.error("[submit-evaluation] Unexpected error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
