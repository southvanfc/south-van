import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import type { PlayerEvaluationInsert } from "../../types/types";

export const POST: APIRoute = async ({ request }) => {
  try {
    // 4) Parse form data
    const form = await request.formData();

    // ── Honeypot check ──────────────────────────────────────────
    if (String(form.get("company") ?? "").trim()) {
      // Bot detected — silent success redirect
      return new Response(null, { status: 303, headers: { Location: "/success" } });
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

    // ── 03 Parent / Guardian ────────────────────────────────────
    const parentName         = String(form.get("parent_name")         ?? "").trim();
    const parentRelationship = String(form.get("parent_relationship") ?? "").trim();
    const parentEmail        = String(form.get("parent_email")        ?? "").trim();
    const parentPhone        = String(form.get("parent_phone")        ?? "").trim();

    // ── 04 Player Background ────────────────────────────────────
    const previousCoaching    = String(form.get("previous_coaching")    ?? "").trim();
    const injuries            = String(form.get("injuries")             ?? "").trim();
    const playerStrengths     = String(form.get("player_strengths")     ?? "").trim();
    const areasToImprove      = String(form.get("areas_to_improve")     ?? "").trim();
    const responseToFeedback  = String(form.get("response_to_feedback") ?? "").trim();
    const motivationDrive     = String(form.get("motivation_drive")     ?? "").trim();
    const handlesMistakes     = String(form.get("handles_mistakes")     ?? "").trim();

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
    if (!parentName)         missing.push("parent_name");
    if (!parentRelationship) missing.push("parent_relationship");
    if (!parentEmail)        missing.push("parent_email");
    if (!parentPhone)        missing.push("parent_phone");
    if (!previousCoaching)   missing.push("previous_coaching");
    if (!responseToFeedback) missing.push("response_to_feedback");
    if (!motivationDrive)    missing.push("motivation_drive");
    if (!handlesMistakes)    missing.push("handles_mistakes");
    if (!longTermGoal)       missing.push("long_term_goal");

    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ ok: false, error: `Missing required fields: ${missing.join(", ")}.` }),
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
      parent_name:          parentName,
      parent_relationship:  parentRelationship,
      parent_email:         parentEmail,
      parent_phone:         parentPhone,
      previous_coaching:    previousCoaching,
      injuries:             injuries || undefined,
      player_strengths:     playerStrengths || undefined,
      areas_to_improve:     areasToImprove || undefined,
      response_to_feedback: responseToFeedback,
      motivation_drive:     motivationDrive,
      handles_mistakes:     handlesMistakes,
      long_term_goal:       longTermGoal,
      goals:                goals || undefined,
      referral:             referral || undefined,
    };

    const { error } = await supabase.from("player_evaluations").insert(payload);

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
