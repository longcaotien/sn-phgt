import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  fetchAccess,
  geminiKeyApi,
  getSupabase,
  hasBackend,
  signInWithGoogle,
  signOut,
  type AccessState,
} from "../lib/supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  blocked: boolean;
  created_at: string;
  last_seen: string;
};

type Tab = "overview" | "users" | "gemini";

function ago(iso: string | null | undefined) {
  if (!iso) return "chưa vào";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "chưa vào";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "vừa xong";
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
}

export default function AdminPanel() {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [siteOpen, setSiteOpen] = useState(true);
  const [maintenanceMsg, setMaintenanceMsg] = useState("");
  const [geminiEnabled, setGeminiEnabled] = useState(true);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgNote, setCfgNote] = useState<string | null>(null);

  const [keyStatus, setKeyStatus] = useState<{ configured: boolean; masked: string; source: string } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyNote, setKeyNote] = useState<string | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);

  const refresh = useCallback(async () => {
    const a = await fetchAccess();
    setAccess(a);
    setLoading(false);
    if (a) {
      setSiteOpen(a.site_open);
      setMaintenanceMsg(a.message ?? "");
      setGeminiEnabled(a.gemini_enabled);
    }
    return a;
  }, []);

  // Nạp trạng thái + cấu hình site
  useEffect(() => {
    void (async () => {
      const a = await refresh();
      if (!a?.is_admin) return;
      const sb = await getSupabase();
      if (!sb) return;
      const { data } = await sb.from("site_config").select("*").eq("id", 1).single();
      if (data) {
        setSiteOpen(Boolean(data.site_open));
        setMaintenanceMsg(String(data.maintenance_message ?? ""));
        setGeminiEnabled(Boolean(data.gemini_enabled));
      }
      const k = await geminiKeyApi({ action: "status" });
      if (!k.error) {
        setKeyStatus({
          configured: Boolean(k.configured),
          masked: String(k.masked ?? ""),
          source: String(k.source ?? "none"),
        });
      }
    })();
  }, [refresh]);

  // Nạp danh sách người dùng
  const loadUsers = useCallback(async () => {
    const sb = await getSupabase();
    if (!sb) return;
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .order("last_seen", { ascending: false })
      .limit(500);
    if (!error && data) setUsers(data as Profile[]);
  }, []);

  useEffect(() => {
    if (access?.is_admin && tab === "users") void loadUsers();
  }, [access?.is_admin, tab, loadUsers]);

  const toggleBlock = useCallback(
    async (p: Profile) => {
      const sb = await getSupabase();
      if (!sb) return;
      setBusyId(p.id);
      const next = !p.blocked;
      const { error } = await sb.from("profiles").update({ blocked: next }).eq("id", p.id);
      setBusyId(null);
      if (error) {
        setCfgNote(`Không đổi được trạng thái: ${error.message}`);
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === p.id ? { ...u, blocked: next } : u)));
    },
    []
  );

  const saveConfig = useCallback(
    async (patch: Record<string, unknown>, note: string) => {
      const sb = await getSupabase();
      if (!sb) return;
      setSavingCfg(true);
      const { error } = await sb
        .from("site_config")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", 1);
      setSavingCfg(false);
      setCfgNote(error ? `Lỗi: ${error.message}` : note);
      if (!error) setTimeout(() => setCfgNote(null), 2600);
    },
    []
  );

  const saveKey = useCallback(async () => {
    const clean = keyInput.trim();
    if (clean.length < 10) {
      setKeyNote("API key quá ngắn.");
      return;
    }
    setKeyBusy(true);
    const r = await geminiKeyApi({ action: "set", apiKey: clean });
    setKeyBusy(false);
    if (r.error) {
      setKeyNote(`Lỗi: ${String(r.error)}`);
      return;
    }
    setKeyInput("");
    setKeyStatus({ configured: true, masked: String(r.masked ?? ""), source: "database" });
    setKeyNote("Đã lưu key vào server. Người dùng không đọc được key này.");
    setTimeout(() => setKeyNote(null), 4000);
  }, [keyInput]);

  const clearKey = useCallback(async () => {
    setKeyBusy(true);
    const r = await geminiKeyApi({ action: "clear" });
    setKeyBusy(false);
    if (r.error) {
      setKeyNote(`Lỗi: ${String(r.error)}`);
      return;
    }
    setKeyStatus({ configured: false, masked: "", source: "none" });
    setKeyNote("Đã xoá key khỏi server.");
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q)
    );
  }, [users, search]);

  const blockedCount = users.filter((u) => u.blocked).length;

  // ---------- Chưa cấu hình backend ----------
  if (!hasBackend) {
    return (
      <Shell>
        <Card title="CHƯA KẾT NỐI BACKEND">
          <p className="text-[13px] leading-relaxed text-sky-100/70">
            Trang quản trị cần Supabase. Hãy tạo file <code className="text-cyan-300">.env</code> ở thư mục gốc với:
          </p>
          <pre className="mt-3 overflow-x-auto border border-sky-400/20 bg-[#02060f] p-3 font-mono text-[11px] leading-relaxed text-sky-200/85">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
          </pre>
          <p className="mt-3 text-[12px] leading-relaxed text-sky-200/50">
            Xem hướng dẫn đầy đủ trong <code className="text-cyan-300">README.md</code> → mục “Đăng nhập &amp; quản trị”.
          </p>
        </Card>
      </Shell>
    );
  }

  // ---------- Đang tải ----------
  if (loading) {
    return (
      <Shell>
        <div className="py-16 text-center font-sys text-[10px] tracking-[0.35em] text-sky-300/60">
          ĐANG TẢI…
        </div>
      </Shell>
    );
  }

  // ---------- Chưa đăng nhập ----------
  if (!access?.signed_in) {
    return (
      <Shell>
        <Card title="ĐĂNG NHẬP QUẢN TRỊ">
          <p className="mb-4 text-[13px] leading-relaxed text-sky-100/70">
            Chỉ email quản trị viên mới vào được trang này.
          </p>
          <button
            onClick={() => void signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2.5 bg-white px-4 py-3 text-[13px] font-semibold text-[#1f1f1f] transition hover:bg-[#f2f2f2]"
          >
            Đăng nhập bằng Google
          </button>
        </Card>
      </Shell>
    );
  }

  // ---------- Đăng nhập nhưng không phải admin ----------
  if (!access.is_admin) {
    return (
      <Shell>
        <Card title="KHÔNG CÓ QUYỀN">
          <p className="text-[13px] leading-relaxed text-sky-100/70">
            Tài khoản này không phải quản trị viên. Nếu bạn nên có quyền, hãy thêm email của bạn vào danh sách
            <code className="mx-1 text-cyan-300">admin_emails()</code>trong Supabase.
          </p>
          <button
            onClick={() => void signOut()}
            className="mt-4 w-full border border-sky-400/35 bg-sky-500/15 py-2.5 font-sys text-[10px] tracking-[0.2em] text-sky-100"
          >
            ĐĂNG XUẤT
          </button>
        </Card>
      </Shell>
    );
  }

  // ---------- Bảng quản trị ----------
  return (
    <Shell>
      {/* Thanh trên */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-sys text-[9px] tracking-[0.42em] text-sky-300/60">QUẢN TRỊ</div>
          <h1 className="font-sys text-[17px] font-bold tracking-[0.1em] text-sky-50">BẢNG ĐIỀU KHIỂN</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="./"
            className="border border-sky-400/30 bg-sky-500/10 px-3 py-2 font-sys text-[9px] tracking-[0.18em] text-sky-100 transition hover:bg-sky-500/20"
          >
            ← VỀ WEB
          </a>
          <button
            onClick={() => void signOut()}
            className="border border-white/15 px-3 py-2 font-sys text-[9px] tracking-[0.18em] text-sky-200/70 transition hover:text-white"
          >
            ĐĂNG XUẤT
          </button>
        </div>
      </div>

      {/* Thẻ tab */}
      <div className="mb-4 flex gap-1 border-b border-sky-400/20">
        {(
          [
            ["overview", "TỔNG QUAN"],
            ["users", "NGƯỜI DÙNG"],
            ["gemini", "GEMINI AI"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 font-sys text-[10px] tracking-[0.16em] transition ${
              tab === id
                ? "border-sky-400 text-sky-100"
                : "border-transparent text-sky-300/50 hover:text-sky-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ===== TỔNG QUAN ===== */}
      {tab === "overview" && (
        <div className="space-y-3">
          <Card title="CÔNG TẮC WEBSITE">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-sky-50">
                  {siteOpen ? "Web đang MỞ" : "Web đang ĐÓNG"}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-sky-200/55">
                  {siteOpen
                    ? "Ai đăng nhập cũng vào được."
                    : "Mọi người thấy màn hình bảo trì, kể cả khi đã đăng nhập."}
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !siteOpen;
                  setSiteOpen(next);
                  void saveConfig({ site_open: next }, next ? "Đã mở web." : "Đã đóng web.");
                }}
                disabled={savingCfg}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition ${
                  siteOpen ? "border-emerald-400/60 bg-emerald-500/30" : "border-red-400/50 bg-red-900/40"
                }`}
                aria-label={siteOpen ? "Đóng web" : "Mở web"}
              >
                <span
                  className={`absolute top-1 h-5.5 w-5.5 rounded-full bg-white transition-all ${
                    siteOpen ? "left-7.5" : "left-1"
                  }`}
                  style={{ height: 22, width: 22, top: 3, left: siteOpen ? 30 : 3 }}
                />
              </button>
            </div>

            <div className="mt-4">
              <label className="mb-1 block font-sys text-[9px] tracking-[0.18em] text-sky-300/60">
                LỜI NHẮN KHI ĐÓNG WEB
              </label>
              <textarea
                value={maintenanceMsg}
                onChange={(e) => setMaintenanceMsg(e.target.value)}
                rows={2}
                maxLength={200}
                className="w-full resize-none border border-sky-400/25 bg-[#02060f] px-3 py-2 text-[12.5px] text-sky-50 placeholder:text-sky-300/25 focus:border-sky-300 focus:outline-none"
                placeholder="Khu vườn đang được chăm sóc, quay lại sau nhé!"
              />
              <button
                onClick={() =>
                  void saveConfig({ maintenance_message: maintenanceMsg.slice(0, 200) }, "Đã lưu lời nhắn.")
                }
                disabled={savingCfg}
                className="mt-2 border border-sky-400/40 bg-sky-500/15 px-4 py-2 font-sys text-[9px] tracking-[0.18em] text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-50"
              >
                LƯU LỜI NHẮN
              </button>
            </div>
          </Card>

          <Card title="TÌNH HÌNH">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="TỔNG NGƯỜI DÙNG" value={users.length ? String(users.length) : "—"} />
              <Stat label="ĐANG BỊ KHOÁ" value={users.length ? String(blockedCount) : "—"} danger={blockedCount > 0} />
            </div>
            <button
              onClick={() => setTab("users")}
              className="mt-3 w-full border border-sky-400/25 py-2 font-sys text-[9px] tracking-[0.18em] text-sky-200/70 transition hover:bg-sky-500/10"
            >
              XEM DANH SÁCH NGƯỜI DÙNG
            </button>
          </Card>

          <Card title="TÀI KHOẢN CỦA BẠN">
            <div className="flex items-center gap-3">
              {access.avatar && (
                <img src={access.avatar} alt="" className="h-9 w-9 rounded-full border border-sky-400/30" />
              )}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-sky-50">{access.name ?? "Quản trị viên"}</div>
                <div className="font-sys text-[9px] tracking-[0.18em] text-emerald-300/80">● QUẢN TRỊ VIÊN</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== NGƯỜI DÙNG ===== */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo email hoặc tên…"
              className="min-w-0 flex-1 border border-sky-400/25 bg-[#02060f] px-3 py-2 text-[12.5px] text-sky-50 placeholder:text-sky-300/25 focus:border-sky-300 focus:outline-none"
            />
            <button
              onClick={() => void loadUsers()}
              className="shrink-0 border border-sky-400/30 px-3 py-2 font-sys text-[9px] tracking-[0.16em] text-sky-200/80 transition hover:bg-sky-500/10"
            >
              TẢI LẠI
            </button>
          </div>

          {filtered.length === 0 && (
            <div className="border border-sky-400/15 bg-[#04080f] py-10 text-center text-[12.5px] text-sky-200/45">
              {users.length === 0 ? "Chưa có ai đăng nhập." : "Không tìm thấy ai khớp."}
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((u) => (
              <div
                key={u.id}
                className={`flex items-center gap-3 border px-3 py-2.5 ${
                  u.blocked ? "border-red-400/30 bg-red-950/15" : "border-sky-400/15 bg-[#04080f]"
                }`}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/10" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-sky-500/10 text-[12px] text-sky-200/70">
                    {(u.full_name ?? u.email ?? "?").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-sky-50">
                    {u.full_name || u.email.split("@")[0]}
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-sky-300/55">{u.email}</div>
                  <div className="font-sys text-[8.5px] tracking-[0.12em] text-sky-200/35">
                    VÀO {ago(u.last_seen)}
                  </div>
                </div>
                <button
                  onClick={() => void toggleBlock(u)}
                  disabled={busyId === u.id}
                  className={`shrink-0 border px-2.5 py-1.5 font-sys text-[8.5px] tracking-[0.14em] transition disabled:opacity-40 ${
                    u.blocked
                      ? "border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                      : "border-red-400/40 bg-red-950/40 text-red-200 hover:bg-red-900/50"
                  }`}
                >
                  {busyId === u.id ? "…" : u.blocked ? "MỞ LẠI" : "CHẶN"}
                </button>
              </div>
            ))}
          </div>

          <p className="pt-1 text-[10.5px] leading-relaxed text-sky-200/35">
            Chặn có hiệu lực ngay ở lần tải trang tiếp theo của người đó — lớp kiểm tra chạy trên server (RLS),
            không phải chỉ ẩn nút trên giao diện.
          </p>
        </div>
      )}

      {/* ===== GEMINI ===== */}
      {tab === "gemini" && (
        <div className="space-y-3">
          <Card title="GEMINI API KEY">
            <div
              className={`mb-3 border px-3 py-2 text-[12px] leading-relaxed ${
                keyStatus?.configured
                  ? "border-emerald-400/40 bg-emerald-950/25 text-emerald-200"
                  : "border-amber-400/35 bg-amber-950/25 text-amber-200"
              }`}
            >
              {keyStatus?.configured ? (
                <>
                  ✔ Đã cấu hình · <span className="font-mono">{keyStatus.masked}</span>
                  <div className="mt-1 text-[10.5px] opacity-70">
                    Nguồn:{" "}
                    {keyStatus.source === "env"
                      ? "biến môi trường Supabase (không sửa được từ web)"
                      : "bảng private.secrets (sửa được ở đây)"}
                  </div>
                </>
              ) : (
                "⚠ Chưa có API key — AI sẽ dùng ML cục bộ."
              )}
            </div>

            {keyStatus?.source === "env" ? (
              <p className="text-[11.5px] leading-relaxed text-sky-200/55">
                Key đang đặt qua <code className="text-cyan-300">supabase secrets set GEMINI_API_KEY=…</code>.
                Muốn đổi bằng giao diện này thì xoá biến môi trường đó trước.
              </p>
            ) : (
              <>
                <label className="mb-1 block font-sys text-[9px] tracking-[0.18em] text-sky-300/60">
                  DÁN KEY MỚI (AIza…)
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy…"
                  spellCheck={false}
                  autoComplete="off"
                  className="w-full border border-sky-400/25 bg-[#02060f] px-3 py-2 font-mono text-[12px] text-sky-50 placeholder:text-sky-300/25 focus:border-sky-300 focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => void saveKey()}
                    disabled={keyBusy || keyInput.trim().length < 10}
                    className="flex-1 border border-cyan-400/50 bg-cyan-500/15 py-2 font-sys text-[9px] tracking-[0.18em] text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40"
                  >
                    {keyBusy ? "ĐANG LƯU…" : "LƯU KEY"}
                  </button>
                  {keyStatus?.configured && (
                    <button
                      onClick={() => void clearKey()}
                      disabled={keyBusy}
                      className="border border-red-400/40 bg-red-950/40 px-3 py-2 font-sys text-[9px] tracking-[0.16em] text-red-200 transition hover:bg-red-900/50 disabled:opacity-40"
                    >
                      XOÁ
                    </button>
                  )}
                </div>
              </>
            )}

            {keyNote && (
              <div className="mt-2 border border-sky-400/30 bg-sky-950/40 px-2.5 py-2 text-[11.5px] text-sky-100">
                {keyNote}
              </div>
            )}
          </Card>

          <Card title="TRỢ LÝ AI">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-sky-50">
                  {geminiEnabled ? "AI đang BẬT" : "AI đang TẮT"}
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-sky-200/55">
                  Tắt để tiết kiệm quota. Người chơi vẫn đấu với AI cục bộ.
                </p>
              </div>
              <button
                onClick={() => {
                  const next = !geminiEnabled;
                  setGeminiEnabled(next);
                  void saveConfig({ gemini_enabled: next }, next ? "Đã bật AI." : "Đã tắt AI.");
                }}
                disabled={savingCfg}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition ${
                  geminiEnabled ? "border-emerald-400/60 bg-emerald-500/30" : "border-white/20 bg-white/5"
                }`}
              >
                <span
                  className="absolute rounded-full bg-white transition-all"
                  style={{ height: 22, width: 22, top: 3, left: geminiEnabled ? 30 : 3 }}
                />
              </button>
            </div>
          </Card>

          <p className="text-[10.5px] leading-relaxed text-sky-200/35">
            Key được lưu ở schema <code className="text-cyan-300/70">private</code> — không có policy RLS nào cho
            trình duyệt. Người dùng chỉ gửi prompt qua edge function, không bao giờ nhận lại key.
          </p>
        </div>
      )}

      {cfgNote && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border border-sky-400/40 bg-[#061024]/95 px-4 py-2 font-sys text-[10px] tracking-[0.12em] text-sky-100 shadow-lg"
        >
          {cfgNote}
        </motion.div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full w-full bg-[#04060f] px-4 py-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,132,255,0.13),transparent_55%)]" />
      <div className="relative mx-auto w-full max-w-lg">{children}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-sky-400/20 bg-[#060b18]/85 p-4">
      <div className="mb-3 font-sys text-[9px] tracking-[0.26em] text-sky-300/65">{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="border border-sky-400/15 bg-[#02060f] px-3 py-2.5">
      <div className="font-sys text-[8px] tracking-[0.16em] text-sky-300/55">{label}</div>
      <div className={`mt-1 font-sys text-[19px] font-bold ${danger ? "text-red-300" : "text-sky-50"}`}>{value}</div>
    </div>
  );
}
