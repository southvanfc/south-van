import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();

    if (String(form.get("company") ?? "").trim()) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const email  = String(form.get("email")  ?? "").trim().toLowerCase();
    const name   = String(form.get("name")   ?? "").trim();
    const source = String(form.get("source") ?? "").trim();

    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/.test(email) || email.includes("..")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const { error } = await supabase.from("email_subscribers").insert({
      email,
      name: name || null,
      source: source || null,
    });

    if (error) {
      // Unique constraint violation — already subscribed
      if (error.code === "23505") {
        return new Response(
          JSON.stringify({ ok: true, already: true }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: "Server error. Please try again." }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
