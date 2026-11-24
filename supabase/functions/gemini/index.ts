// ============================================================================
//  Edge Function: gemini
//  Giữ GEMINI API KEY ở server.
//
//  - Người chơi KHÔNG bao giờ thấy key. Trình duyệt chỉ gửi prompt lên đây,
//    function tự gắn key rồi gọi Google.
//  - Key đọc từ biến môi trường GEMINI_API_KEY (ưu tiên) hoặc từ bảng
//    bảng app_secrets (do admin nhập trong trang quản trị).
//  - Có giới hạn tần suất đơn giản theo user/IP để tránh bị lạm dụng quota.
//
//  Deploy:
//    supabase functions deploy gemini --no-verify-jwt
//    supabase secrets set GEMINI_API_KEY=...        (tuỳ chọn)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Giới hạn: 40 lần / 60 giây cho mỗi danh tính (trong bộ nhớ của instance). */
const WINDOW_MS = 60_000;
const MAX_CALLS = 40;
const hits = new Map<string, number[]>();

function rateLimited(id: string): boolean {
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= MAX_CALLS) {
    hits.set(id, arr);
    return true;
  }
  arr.push(now);
  hits.set(id, arr);
  if (hits.size > 5000) hits.clear(); // chống phình bộ nhớ
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { model?: string; payload?: unknown; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON không hợp lệ" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- 1. Xác định danh tính (nếu có đăng nhập) để chặn người dùng bị khoá ---
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const { data } = await admin.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const identity = userId ?? req.headers.get("x-forwarded-for") ?? "anon";
  if (rateLimited(identity)) {
    return json({ error: "Bạn thao tác hơi nhanh, thử lại sau vài giây nhé." }, 429);
  }

  // --- 2. Người dùng bị chặn hoặc site đang tắt thì không tốn quota ---
  const { data: cfg } = await admin.from("site_config").select("site_open, gemini_enabled").eq("id", 1).single();
  if (cfg && cfg.site_open === false) return json({ error: "Site đang tạm đóng." }, 403);
  if (cfg && cfg.gemini_enabled === false) return json({ error: "Trợ lý AI đang tắt." }, 403);

  if (userId) {
    const { data: prof } = await admin.from("profiles").select("blocked").eq("id", userId).single();
    if (prof?.blocked) return json({ error: "Tài khoản của bạn đã bị tạm khoá." }, 403);
  }

  // --- 3. Lấy key: ưu tiên biến môi trường, sau đó tới bảng app_secrets ---
  let apiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();
  if (!apiKey) {
    const { data: secret } = await admin
      .from("app_secrets")
      .select("value")
      .eq("key", "gemini_api_key")
      .maybeSingle();
    apiKey = (secret?.value ?? "").trim();
  }
  if (!apiKey) return json({ error: "Quản trị viên chưa cấu hình API key.", code: "NO_KEY" }, 200);

  // --- 4. Chuyển tiếp lên Google ---
  const model = (body.model ?? "gemini-2.5-flash").replace(/[^a-z0-9.\-]/gi, "");
  const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  const started = Date.now();

  try {
    const res = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.payload),
      signal: controller.signal,
    });
    const text = await res.text();
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, text, latencyMs: Date.now() - started }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không rõ";
    return json({ ok: false, status: 0, error: msg }, 200);
  } finally {
    clearTimeout(timer);
  }
});
