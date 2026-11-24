// ============================================================================
//  Edge Function: gemini-key
//  Chỉ quản trị viên được đọc / ghi / xoá Gemini API key.
//  Key được lưu ở schema `private` — KHÔNG có policy RLS nào cho trình duyệt,
//  nên kể cả người dùng đã đăng nhập cũng không đọc được.
//
//  Deploy:
//    supabase functions deploy gemini-key
//  (function này CẦN JWT, không dùng --no-verify-jwt)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** Che key khi hiển thị lại: chỉ để admin biết "đã có key rồi". */
function mask(key: string): string {
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 4)}••••••••••••${key.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // --- Xác thực người gọi bằng chính JWT của họ ---
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Cần đăng nhập" }, 401);

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: access, error: accErr } = await asUser.rpc("access_state");
  if (accErr) return json({ error: "Không kiểm tra được quyền" }, 500);
  if (!access?.is_admin) return json({ error: "Chỉ quản trị viên" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: { action?: string; apiKey?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* body rỗng cũng hợp lệ với action=status */
  }

  const action = body.action ?? "status";

  // --- Đọc trạng thái: chỉ trả về key đã che, không trả key thật ---
  if (action === "status") {
    const { data } = await admin
      .schema("private")
      .from("secrets")
      .select("value, updated_at")
      .eq("key", "gemini_api_key")
      .maybeSingle();

    const envKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
    const source = envKey ? "env" : data?.value ? "database" : "none";
    const value = envKey || data?.value || "";

    return json({
      configured: value.length > 0,
      source, // "env" = đặt qua supabase secrets, không sửa được từ web
      masked: value ? mask(value) : "",
      updatedAt: data?.updated_at ?? null,
    });
  }

  // --- Ghi key ---
  if (action === "set") {
    const clean = (body.apiKey ?? "").trim();
    if (clean.length < 10) return json({ error: "API key quá ngắn" }, 400);
    if (!/^[A-Za-z0-9_\-]+$/.test(clean)) return json({ error: "API key chứa ký tự lạ" }, 400);

    const { error } = await admin
      .schema("private")
      .from("secrets")
      .upsert(
        { key: "gemini_api_key", value: clean, updated_at: new Date().toISOString(), updated_by: access.userId ?? null },
        { onConflict: "key" }
      );
    if (error) return json({ error: error.message }, 500);

    // Bật lại cờ gemini nếu đang tắt
    await admin.from("site_config").update({ gemini_enabled: true }).eq("id", 1);
    return json({ ok: true, masked: mask(clean), source: "database" });
  }

  // --- Xoá key ---
  if (action === "clear") {
    const { error } = await admin.schema("private").from("secrets").delete().eq("key", "gemini_api_key");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, configured: false, source: "none" });
  }

  return json({ error: "Action không hợp lệ" }, 400);
});
