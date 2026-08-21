import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, name, phone, contact } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    let finalEmail = (email || "").trim().toLowerCase();
    const finalPhone = (phone || contact || "").trim();
    
    // Phone-only login → pseudo-email
    if (finalPhone && !finalEmail) {
      finalEmail = `${finalPhone}@phone.para.ph`;
    }
    
    if (!finalEmail) {
      return new Response(
        JSON.stringify({ status: "error", message: "Email or phone required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const finalName = name || finalEmail.split("@")[0];
    
    // Check existing
    const existing = await supabase
      .from("waitlist")
      .select("*")
      .eq("email", finalEmail)
      .limit(1);
    
    if (existing.data && existing.data.length > 0) {
      return new Response(
        JSON.stringify({ status: "exists", message: "Welcome back!", user: existing.data[0], uid: finalEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create new
    const insertData = { email: finalEmail, name: finalName, listed_at: new Date().toISOString() };
    if (finalPhone) insertData.contact = finalPhone;
    
    const res = await supabase.from("waitlist").insert(insertData).select();
    
    return new Response(
      JSON.stringify({ status: "success", message: "Welcome to Para PH!", user: res.data?.[0], uid: finalEmail }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
