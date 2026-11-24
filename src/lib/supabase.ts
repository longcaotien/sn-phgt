import type { Session, SupabaseClient } from "@supabase/supabase-js";

/**
 * Kết nối Supabase.
 *
 * Hai biến này là CÔNG KHAI (nằm trong bundle) và điều đó bình thường:
 * anon key chỉ cho phép những gì RLS đã mở. API key Gemini thì KHÔNG nằm ở đây —
 * nó ở server, xem supabase/functions/gemini.
 */
const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

/** true khi đã cấu hình Supabase — dùng để quyết định có bật cổng đăng nhập không. */
export const hasBackend = URL.length > 0 && ANON.length > 0;

/**
 * Client được tạo BẤT ĐỒNG BỘ: gói @supabase/supabase-js nặng ~227 kB, nên
 * chỉ tải khi thật sự cần (có cấu hình backend). Nhờ vậy người chơi bình
 * thường — và cả bundle chính — không phải trả giá cho nó.
 */
let client: SupabaseClient | null = null;
let loading: Promise<SupabaseClient | null> | null = null;

/** Lỗi cấu hình gần nhất — hiển thị được cho admin biết hỏng ở đâu. */
let initError: string | null = null;

export function getInitError(): string | null {
  return initError;
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!hasBackend) return null;
  if (client) return client;
  if (!loading) {
    loading = (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        client = createClient(URL, ANON, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            // Nhận session ngay trong URL sau khi Google chuyển hướng về.
            detectSessionInUrl: true,
            flowType: "pkce",
          },
        });
        return client;
      } catch (e) {
        /*
         * createClient ném lỗi khi anon key sai định dạng. Nếu để lỗi này
         * nổi lên thì mọi màn hình chờ sẽ treo vĩnh viễn — đã từng xảy ra.
         * Bắt lại, ghi nhận, trả null để giao diện hiện thông báo rõ ràng.
         */
        initError =
          e instanceof Error
            ? `Không tạo được kết nối Supabase: ${e.message}`
            : "Không tạo được kết nối Supabase.";
        loading = null;
        return null;
      }
    })();
  }
  return loading;
}

/** Gọi RPC kèm giới hạn thời gian, để màn hình chờ không treo vô hạn. */
export async function fetchAccess(): Promise<AccessState | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  try {
    const res = await Promise.race([
      sb.rpc("access_state"),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Hết thời gian chờ server (8 giây).")), 8000)),
    ]);
    if (res.error || !res.data) {
      initError = res.error?.message ?? "Server trả về dữ liệu rỗng.";
      return null;
    }
    initError = null;
    return res.data as AccessState;
  } catch (e) {
    initError = e instanceof Error ? e.message : "Không gọi được server.";
    return null;
  }
}

/** Đã tạo client chưa (dùng cho các hàm được gọi sau khi trang đã nạp). */
export function supabaseSync(): SupabaseClient | null {
  return client;
}

export type AccessState = {
  signed_in: boolean;
  is_admin: boolean;
  blocked: boolean;
  site_open: boolean;
  message: string;
  gemini_enabled: boolean;
  name: string | null;
  avatar: string | null;
};

/** Trạng thái mặc định: nếu backend chưa cấu hình thì web mở bình thường. */
export const OPEN_ACCESS: AccessState = {
  signed_in: false,
  is_admin: false,
  blocked: false,
  site_open: true,
  message: "",
  gemini_enabled: true,
  name: null,
  avatar: null,
};

export async function signInWithGoogle() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
      queryParams: { prompt: "select_account" },
    },
  });
}

export async function signOut() {
  const sb = await getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}

export function onAuthChange(cb: (s: Session | null) => void): () => void {
  let unsub: (() => void) | null = null;
  void getSupabase().then((sb) => {
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((_evt, session) => cb(session));
    unsub = () => data.subscription.unsubscribe();
  });
  return () => unsub?.();
}

export async function currentSession(): Promise<Session | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session ?? null;
}

/**
 * Dịch lỗi thô của supabase-js thành câu dễ hiểu.
 *
 * "Failed to send a request to the Edge Function" là lỗi hay gặp nhất và rất
 * khó đoán: nó xuất hiện khi function CHƯA DEPLOY (gateway trả 404 không kèm
 * CORS header => trình duyệt coi như lỗi mạng), hoặc khi function chết lúc
 * khởi động. Người dùng không thể tự đoán ra từ câu tiếng Anh đó.
 */
export function explainFunctionError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("failed to send a request")) {
    return "Không gọi được Edge Function. Thường là do function chưa được deploy — vào Supabase → Edge Functions kiểm tra đã có function này chưa.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror")) {
    return "Lỗi mạng hoặc chặn CORS khi gọi Edge Function.";
  }
  if (m.includes("non-2xx") || m.includes("401")) {
    return "Edge Function từ chối: phiên đăng nhập không hợp lệ hoặc bạn không phải quản trị viên.";
  }
  return raw;
}

/** Gọi edge function `gemini-key` (chỉ admin dùng được). */
export async function geminiKeyApi(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sb = await getSupabase();
  if (!sb) return { error: "Chưa cấu hình Supabase" };
  const { data, error } = await sb.functions.invoke("gemini-key", { body });
  if (error) return { error: explainFunctionError(error.message), raw: error.message };
  return (data ?? {}) as Record<string, unknown>;
}
