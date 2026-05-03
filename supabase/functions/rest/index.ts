// REST API for Pulse 23 social feed
// Base path: /functions/v1/rest  (alias: /rest)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function ok(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ status: "success", data }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function err(message: string, status = 400, code?: string) {
  return new Response(
    JSON.stringify({ status: "error", error: { message, code: code ?? null } }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function sha256(input: string) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "p23_" +
    Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authUser(req: Request): Promise<
  { id: string; isMod: boolean; isAdmin: boolean } | null
> {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const hash = await sha256(token);
  const { data: key } = await admin
    .from("api_keys")
    .select("user_id, revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!key || key.revoked_at) return null;
  await admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", hash);
  const { data: prof } = await admin
    .from("profiles")
    .select("username")
    .eq("id", key.user_id)
    .maybeSingle();
  const isAdmin = prof?.username === "senwot";
  const { data: mod } = await admin
    .from("beta_codes_redeemed")
    .select("id")
    .eq("user_id", key.user_id)
    .eq("code", "pulse23moderation")
    .maybeSingle();
  return { id: key.user_id, isMod: !!mod || isAdmin, isAdmin };
}

function parseInt32(v: string | null, def: number, max = 100) {
  if (!v) return def;
  const n = parseInt(v, 10);
  if (Number.isNaN(n) || n < 1) return def;
  return Math.min(n, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Strip the /functions/v1/rest or /rest prefix
    let path = url.pathname.replace(/^\/functions\/v1\/rest/, "")
      .replace(/^\/rest/, "");
    if (!path.startsWith("/")) path = "/" + path;
    const method = req.method;
    const segs = path.split("/").filter(Boolean);

    // ---------- AUTH ----------
    // POST /auth/login  { username, password } -> token
    if (path === "/auth/login" && method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { username, password } = body;
      if (!username || !password) return err("username and password required", 400);
      const { data: prof } = await admin
        .from("profiles")
        .select("id, username")
        .eq("username", username)
        .maybeSingle();
      if (!prof) return err("invalid credentials", 401);
      // Look up email via auth admin
      const { data: userData, error: ue } = await admin.auth.admin.getUserById(prof.id);
      if (ue || !userData?.user?.email) return err("invalid credentials", 401);
      const anon = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false } },
      );
      const { error: signErr } = await anon.auth.signInWithPassword({
        email: userData.user.email,
        password,
      });
      if (signErr) return err("invalid credentials", 401);
      const token = genToken();
      const hash = await sha256(token);
      const { data: keyRow, error: kErr } = await admin
        .from("api_keys")
        .insert({
          user_id: prof.id,
          token_hash: hash,
          name: body.name ?? "rest-api",
        })
        .select("id, created_at")
        .single();
      if (kErr) return err(kErr.message, 500);
      return ok({
        token,
        key_id: keyRow.id,
        user: { id: prof.id, username: prof.username },
        message: "Store this token securely — it is shown only once.",
      });
    }

    // GET /auth/me
    if (path === "/auth/me" && method === "GET") {
      const u = await authUser(req);
      if (!u) return err("unauthorized", 401);
      const { data: prof } = await admin
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();
      return ok({ ...prof, is_moderator: u.isMod, is_admin: u.isAdmin });
    }

    // GET /auth/keys — list own keys (no tokens shown)
    if (path === "/auth/keys" && method === "GET") {
      const u = await authUser(req);
      if (!u) return err("unauthorized", 401);
      const { data } = await admin
        .from("api_keys")
        .select("id, name, created_at, last_used_at, revoked_at")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });
      return ok(data ?? []);
    }

    // DELETE /auth/keys/:id — revoke
    if (segs[0] === "auth" && segs[1] === "keys" && segs[2] && method === "DELETE") {
      const u = await authUser(req);
      if (!u) return err("unauthorized", 401);
      const { error } = await admin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", segs[2])
        .eq("user_id", u.id);
      if (error) return err(error.message, 500);
      return ok({ revoked: true });
    }

    // ---------- POSTS ----------
    // GET /posts
    if (path === "/posts" && method === "GET") {
      const limit = parseInt32(url.searchParams.get("limit"), 20);
      const offset = parseInt32(url.searchParams.get("offset"), 0, 100000);
      const userId = url.searchParams.get("user_id");
      let q = admin
        .from("posts")
        .select(
          "id, user_id, content, image_url, likes_count, comments_count, shares_count, flagged, created_at",
        )
        .eq("flagged", false)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok(data);
    }

    // POST /posts
    if (path === "/posts" && method === "POST") {
      const u = await authUser(req);
      if (!u) return err("unauthorized", 401);
      const body = await req.json().catch(() => ({}));
      if (!body.content || typeof body.content !== "string")
        return err("content required", 400);
      if (body.content.length > 5000) return err("content too long", 400);
      const { data, error } = await admin
        .from("posts")
        .insert({
          user_id: u.id,
          content: body.content,
          image_url: body.image_url ?? null,
        })
        .select()
        .single();
      if (error) return err(error.message, 500);
      return ok(data, 201);
    }

    // /posts/:id ...
    if (segs[0] === "posts" && segs[1]) {
      const postId = segs[1];
      const sub = segs[2];

      // GET /posts/:id
      if (!sub && method === "GET") {
        const { data, error } = await admin
          .from("posts")
          .select("*")
          .eq("id", postId)
          .maybeSingle();
        if (error) return err(error.message, 500);
        if (!data) return err("not found", 404);
        return ok(data);
      }

      // PATCH /posts/:id
      if (!sub && (method === "PATCH" || method === "PUT")) {
        const u = await authUser(req);
        if (!u) return err("unauthorized", 401);
        const body = await req.json().catch(() => ({}));
        const { data: existing } = await admin
          .from("posts")
          .select("user_id")
          .eq("id", postId)
          .maybeSingle();
        if (!existing) return err("not found", 404);
        if (existing.user_id !== u.id && !u.isMod)
          return err("forbidden", 403);
        const patch: Record<string, unknown> = {};
        if (typeof body.content === "string") patch.content = body.content;
        if (body.image_url !== undefined) patch.image_url = body.image_url;
        const { data, error } = await admin
          .from("posts")
          .update(patch)
          .eq("id", postId)
          .select()
          .single();
        if (error) return err(error.message, 500);
        return ok(data);
      }

      // DELETE /posts/:id
      if (!sub && method === "DELETE") {
        const u = await authUser(req);
        if (!u) return err("unauthorized", 401);
        const { data: existing } = await admin
          .from("posts")
          .select("user_id")
          .eq("id", postId)
          .maybeSingle();
        if (!existing) return err("not found", 404);
        if (existing.user_id !== u.id && !u.isMod)
          return err("forbidden", 403);
        const { error } = await admin.from("posts").delete().eq("id", postId);
        if (error) return err(error.message, 500);
        return ok({ deleted: true });
      }

      // GET /posts/:id/stats
      if (sub === "stats" && method === "GET") {
        const { data: post } = await admin
          .from("posts")
          .select("likes_count, comments_count, shares_count")
          .eq("id", postId)
          .maybeSingle();
        if (!post) return err("not found", 404);
        return ok(post);
      }

      // ---- LIKES ----
      if (sub === "likes") {
        if (method === "GET") {
          const { data, error } = await admin
            .from("likes")
            .select("user_id, created_at")
            .eq("post_id", postId)
            .order("created_at", { ascending: false });
          if (error) return err(error.message, 500);
          return ok(data);
        }
        if (method === "POST") {
          const u = await authUser(req);
          if (!u) return err("unauthorized", 401);
          const { error } = await admin
            .from("likes")
            .insert({ post_id: postId, user_id: u.id });
          if (error && !error.message.includes("duplicate"))
            return err(error.message, 500);
          await admin.rpc; // no-op placeholder
          // increment count
          const { data: cur } = await admin
            .from("posts")
            .select("likes_count")
            .eq("id", postId)
            .maybeSingle();
          if (cur) {
            await admin
              .from("posts")
              .update({ likes_count: (cur.likes_count ?? 0) + 1 })
              .eq("id", postId);
          }
          return ok({ liked: true }, 201);
        }
        if (method === "DELETE") {
          const u = await authUser(req);
          if (!u) return err("unauthorized", 401);
          const { error, count } = await admin
            .from("likes")
            .delete({ count: "exact" })
            .eq("post_id", postId)
            .eq("user_id", u.id);
          if (error) return err(error.message, 500);
          if ((count ?? 0) > 0) {
            const { data: cur } = await admin
              .from("posts")
              .select("likes_count")
              .eq("id", postId)
              .maybeSingle();
            if (cur) {
              await admin
                .from("posts")
                .update({ likes_count: Math.max(0, (cur.likes_count ?? 0) - 1) })
                .eq("id", postId);
            }
          }
          return ok({ liked: false });
        }
      }

      // ---- COMMENTS ----
      if (sub === "comments") {
        if (method === "GET") {
          const { data, error } = await admin
            .from("comments")
            .select("id, user_id, content, flagged, created_at")
            .eq("post_id", postId)
            .eq("flagged", false)
            .order("created_at", { ascending: true });
          if (error) return err(error.message, 500);
          return ok(data);
        }
        if (method === "POST") {
          const u = await authUser(req);
          if (!u) return err("unauthorized", 401);
          const body = await req.json().catch(() => ({}));
          if (!body.content || typeof body.content !== "string")
            return err("content required", 400);
          if (body.content.length > 2000) return err("content too long", 400);
          const { data, error } = await admin
            .from("comments")
            .insert({ post_id: postId, user_id: u.id, content: body.content })
            .select()
            .single();
          if (error) return err(error.message, 500);
          const { data: cur } = await admin
            .from("posts")
            .select("comments_count")
            .eq("id", postId)
            .maybeSingle();
          if (cur) {
            await admin
              .from("posts")
              .update({ comments_count: (cur.comments_count ?? 0) + 1 })
              .eq("id", postId);
          }
          return ok(data, 201);
        }
      }

      // ---- SHARES ----
      if (sub === "shares") {
        if (method === "GET") {
          const { data, error } = await admin
            .from("shares")
            .select("user_id, created_at")
            .eq("post_id", postId)
            .order("created_at", { ascending: false });
          if (error) return err(error.message, 500);
          return ok(data);
        }
        if (method === "POST") {
          const u = await authUser(req);
          if (!u) return err("unauthorized", 401);
          const { data, error } = await admin
            .from("shares")
            .insert({ post_id: postId, user_id: u.id })
            .select()
            .single();
          if (error) return err(error.message, 500);
          const { data: cur } = await admin
            .from("posts")
            .select("shares_count")
            .eq("id", postId)
            .maybeSingle();
          if (cur) {
            await admin
              .from("posts")
              .update({ shares_count: (cur.shares_count ?? 0) + 1 })
              .eq("id", postId);
          }
          return ok(data, 201);
        }
      }
    }

    // ---------- COMMENTS direct ----------
    if (segs[0] === "comments" && segs[1]) {
      const cid = segs[1];
      if (method === "DELETE") {
        const u = await authUser(req);
        if (!u) return err("unauthorized", 401);
        const { data: existing } = await admin
          .from("comments")
          .select("user_id, post_id")
          .eq("id", cid)
          .maybeSingle();
        if (!existing) return err("not found", 404);
        if (existing.user_id !== u.id && !u.isMod)
          return err("forbidden", 403);
        const { error } = await admin.from("comments").delete().eq("id", cid);
        if (error) return err(error.message, 500);
        const { data: cur } = await admin
          .from("posts")
          .select("comments_count")
          .eq("id", existing.post_id)
          .maybeSingle();
        if (cur) {
          await admin
            .from("posts")
            .update({ comments_count: Math.max(0, (cur.comments_count ?? 0) - 1) })
            .eq("id", existing.post_id);
        }
        return ok({ deleted: true });
      }
      if (method === "PATCH" || method === "PUT") {
        const u = await authUser(req);
        if (!u) return err("unauthorized", 401);
        const body = await req.json().catch(() => ({}));
        const { data: existing } = await admin
          .from("comments")
          .select("user_id")
          .eq("id", cid)
          .maybeSingle();
        if (!existing) return err("not found", 404);
        if (existing.user_id !== u.id && !u.isMod)
          return err("forbidden", 403);
        const { data, error } = await admin
          .from("comments")
          .update({ content: body.content })
          .eq("id", cid)
          .select()
          .single();
        if (error) return err(error.message, 500);
        return ok(data);
      }
    }

    // ---------- USERS ----------
    if (path === "/users" && method === "GET") {
      const limit = parseInt32(url.searchParams.get("limit"), 20);
      const { data, error } = await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, pulse_count, created_at")
        .limit(limit);
      if (error) return err(error.message, 500);
      return ok(data);
    }
    if (segs[0] === "users" && segs[1] && method === "GET") {
      const { data } = await admin
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, pulse_count, created_at")
        .or(`id.eq.${segs[1]},username.eq.${segs[1]}`)
        .maybeSingle();
      if (!data) return err("not found", 404);
      return ok(data);
    }

    // ---------- MODERATION ----------
    if (segs[0] === "moderation") {
      const u = await authUser(req);
      if (!u) return err("unauthorized", 401);
      if (!u.isMod) return err("forbidden", 403);

      // POST /moderation/flag/post/:id
      if (segs[1] === "flag" && segs[2] === "post" && segs[3] && method === "POST") {
        const { error } = await admin
          .from("posts")
          .update({ flagged: true })
          .eq("id", segs[3]);
        if (error) return err(error.message, 500);
        return ok({ flagged: true });
      }
      if (segs[1] === "unflag" && segs[2] === "post" && segs[3] && method === "POST") {
        const { error } = await admin
          .from("posts")
          .update({ flagged: false })
          .eq("id", segs[3]);
        if (error) return err(error.message, 500);
        return ok({ flagged: false });
      }
      if (segs[1] === "flag" && segs[2] === "comment" && segs[3] && method === "POST") {
        const { error } = await admin
          .from("comments")
          .update({ flagged: true })
          .eq("id", segs[3]);
        if (error) return err(error.message, 500);
        return ok({ flagged: true });
      }
      if (segs[1] === "remove" && segs[2] === "post" && segs[3] && method === "DELETE") {
        const { error } = await admin.from("posts").delete().eq("id", segs[3]);
        if (error) return err(error.message, 500);
        return ok({ removed: true });
      }
      if (segs[1] === "ban" && method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (!body.user_id || !body.reason)
          return err("user_id and reason required", 400);
        const { error } = await admin.from("bans").insert({
          user_id: body.user_id,
          reason: body.reason,
          banned_by: u.id,
        });
        if (error) return err(error.message, 500);
        return ok({ banned: true });
      }
      if (segs[1] === "reports" && method === "GET") {
        const { data } = await admin
          .from("user_reports")
          .select("*")
          .order("created_at", { ascending: false });
        return ok(data ?? []);
      }
    }

    // ---------- INDEX ----------
    if (path === "/" || path === "") {
      return ok({
        name: "Pulse 23 REST API",
        version: "1.0.0",
        docs: "/guide.md",
        endpoints: [
          "POST /auth/login",
          "GET /auth/me",
          "GET /auth/keys",
          "DELETE /auth/keys/:id",
          "GET /posts",
          "POST /posts",
          "GET /posts/:id",
          "PATCH /posts/:id",
          "DELETE /posts/:id",
          "GET /posts/:id/stats",
          "GET|POST|DELETE /posts/:id/likes",
          "GET|POST /posts/:id/comments",
          "PATCH|DELETE /comments/:id",
          "GET|POST /posts/:id/shares",
          "GET /users",
          "GET /users/:idOrUsername",
          "POST /moderation/flag/post/:id",
          "POST /moderation/unflag/post/:id",
          "POST /moderation/flag/comment/:id",
          "DELETE /moderation/remove/post/:id",
          "POST /moderation/ban",
          "GET /moderation/reports",
        ],
      });
    }

    return err(`route not found: ${method} ${path}`, 404, "not_found");
  } catch (e) {
    return err((e as Error).message ?? "internal error", 500, "internal");
  }
});
