import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // GET /community/threads
    if (req.method === "GET" && path === "threads") {
      const { data, error } = await supabase
        .from("community_threads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify({ status: "success", threads: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /community/threads
    if (req.method === "POST" && path === "threads") {
      const body = await req.json();
      const { data, error } = await supabase
        .from("community_threads")
        .insert({
          thread_uuid: crypto.randomUUID(),
          user_email: body.user_email || "anonymous",
          author_name: body.author_name || body.user_email || "Anonymous",
          content: body.content,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ status: "success", thread: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /community/threads/delete
    if (req.method === "POST" && path === "delete") {
      const body = await req.json();
      const { error } = await supabase
        .from("community_threads")
        .delete()
        .eq("thread_uuid", body.thread_uuid);

      if (error) throw error;
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /community/comments?thread_uuid=X
    if (req.method === "GET" && path === "comments") {
      const threadUuid = url.searchParams.get("thread_uuid");
      if (!threadUuid) {
        return new Response(JSON.stringify({ status: "error", message: "thread_uuid required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data, error } = await supabase
        .from("community_comments")
        .select("*")
        .eq("thread_uuid", threadUuid)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify({ status: "success", comments: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // POST /community/comments
    if (req.method === "POST" && path === "comments") {
      const body = await req.json();
      const { data, error } = await supabase
        .from("community_comments")
        .insert({
          thread_uuid: body.thread_uuid,
          user_email: body.user_email || "anonymous",
          content: body.content,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ status: "success", comment: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ status: "error", message: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ status: "error", message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
