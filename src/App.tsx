import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BootSequence from "./components/BootSequence";
import Hero from "./components/Hero";
import AuthGate from "./components/AuthGate";
import type { DevTarget } from "./components/DevJump";
import {
  OPEN_ACCESS,
  currentSession,
  fetchAccess,
  getSupabase,
  hasBackend,
  onAuthChange,
  signOut,
  type AccessState,
} from "./lib/supabase";

// Chương II & Thế giới sinh nhật nặng (nhiều canvas/ảnh) => tách chunk riêng,
// chỉ tải khi người chơi thực sự bước vào. Lần đầu mở trang nhanh hơn rất nhiều.
const Chapter2 = lazy(() => import("./components/chapter2/Chapter2"));
const BirthdayWorld = lazy(() => import("./components/birthday/BirthdayWorld"));
// Bảng dev/Gemini chỉ là công cụ: nạp sau khi trang đã rảnh (không chặn first paint).
const DevJump = lazy(() => import("./components/DevJump"));

const KEY_FLAG = "sl_birthday_key";

function loadSavedKey(): boolean {
  try {
    return localStorage.getItem(KEY_FLAG) === "1";
  } catch {
    return false;
  }
}

function saveKey(v: boolean) {
  try {
    if (v) localStorage.setItem(KEY_FLAG, "1");
    else localStorage.removeItem(KEY_FLAG);
  } catch {
    // ignore storage errors
  }
}

function getInitialFromUrl(): {
  booted: boolean;
  chapter: 1 | 2 | "birthday";
  hasKey: boolean;
  birthdayStage?: "celebrate" | "ending";
  c2Init?: Extract<DevTarget, { chapter: 2 }>;
} {
  const s = new URLSearchParams(location.search).get("stage");
  const savedKey = loadSavedKey();
  if (s === "hero") return { booted: true, chapter: 1, hasKey: savedKey };
  if (s === "gate") return { booted: true, chapter: 1, hasKey: true };
  if (s === "birthday") return { booted: true, chapter: "birthday", hasKey: true, birthdayStage: "celebrate" };
  if (s === "ending") return { booted: true, chapter: "birthday", hasKey: true, birthdayStage: "ending" };
  if (s === "quest") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "quest" } };
  if (s === "pray") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "pray" } };
  if (s === "dodge") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "dodge", wave: 0 } };
  if (s === "boss") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 360 } };
  if (s === "boss2") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 240 } };
  if (s === "boss3") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "boss", bossHp: 120 } };
  if (s === "clear") return { booted: true, chapter: 2, hasKey: savedKey, c2Init: { chapter: 2, phase: "clear" } };
  return { booted: false, chapter: 1, hasKey: savedKey };
}

/** Màn hình chờ nhẹ khi đang tải chunk (thường chỉ vài trăm ms). */
function LoadingVeil() {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#02030a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="font-sys text-[10px] tracking-[0.4em] text-sky-300/80">ĐANG MỞ CỔNG…</div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-sky-950">
        <div className="frame-sweep h-full w-full" />
      </div>
    </motion.div>
  );
}

export default function App() {
  const [init] = useState(getInitialFromUrl);
  const [booted, setBooted] = useState(init.booted);
  const [chapter, setChapter] = useState<1 | 2 | "birthday">(init.chapter);
  const [hasKey, setHasKey] = useState<boolean>(init.hasKey);
  const [c2Key, setC2Key] = useState(0);
  const [bdKey, setBdKey] = useState(0);
  const [birthdayStage, setBirthdayStage] = useState<"celebrate" | "ending">(init.birthdayStage ?? "celebrate");
  const [c2Config, setC2Config] = useState<Extract<DevTarget, { chapter: 2 }> | undefined>(init.c2Init);
  const [showDev, setShowDev] = useState(false);

  // ---- Cổng truy cập (đăng nhập Google + chặn người dùng + công tắc web) ----
  // null = đang kiểm tra. Khi chưa cấu hình Supabase thì mở luôn như cũ.
  const [access, setAccess] = useState<AccessState | null>(hasBackend ? null : OPEN_ACCESS);
  const [gateVariant, setGateVariant] = useState<"signin" | "blocked" | "closed">("signin");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!hasBackend) {
      setAccess(OPEN_ACCESS);
      return;
    }
    const a = await fetchAccess();
    /*
     * FAIL-OPEN: nếu không gọi được backend (Supabase sập, mất mạng, chưa deploy
     * function) thì vẫn cho vào. Thà web mở còn hơn khoá oan tất cả khách mời
     * trong ngày sinh nhật. Dữ liệu thật vẫn được RLS bảo vệ ở server.
     */
    setAccess(a ?? { ...OPEN_ACCESS, signed_in: true });
    const sb = a?.signed_in ? await getSupabase() : null;
    if (sb && a?.signed_in) {
      const { data } = await sb.auth.getUser();
      setUserEmail(data.user?.email ?? null);
      void sb.rpc("touch_last_seen");
    } else {
      setUserEmail(null);
    }
  }, []);

  useEffect(() => {
    if (!hasBackend) return;
    void currentSession().then(() => refreshAccess());
    const off = onAuthChange(() => void refreshAccess());
    // Đổi tab quay lại thì kiểm tra lại — admin vừa chặn là có hiệu lực ngay.
    const onFocus = () => void refreshAccess();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      off();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshAccess]);

  // Quyết định cổng nào đang chặn (nếu có).
  const gate: "signin" | "blocked" | "closed" | null = (() => {
    if (!access) return null; // đang kiểm tra
    if (access.signed_in && access.blocked) return "blocked";
    if (!access.site_open) return "closed";
    if (hasBackend && !access.signed_in) return "signin";
    return null;
  })();

  useEffect(() => {
    if (gate) setGateVariant(gate);
  }, [gate]);

  // Chỉ admin thấy bảng dev/Gemini. Người thường không tải chunk này.
  const isAdmin = Boolean(access?.is_admin);

  // Chỉ gắn bảng dev sau khi trang đã vẽ xong (tránh tranh CPU lúc khởi động).
  useEffect(() => {
    if (!isAdmin) {
      setShowDev(false);
      return;
    }
    const t = window.setTimeout(() => setShowDev(true), 1800);
    return () => window.clearTimeout(t);
  }, [isAdmin]);

  // Nạp trước chunk chương II khi trình duyệt rảnh => chuyển cảnh không bị khựng.
  useEffect(() => {
    if (chapter === 1) {
      const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      const t = idle
        ? idle(() => void import("./components/chapter2/Chapter2"), { timeout: 4000 })
        : window.setTimeout(() => void import("./components/chapter2/Chapter2"), 2500);
      return () => {
        if (typeof t === "number") window.clearTimeout(t);
      };
    }
  }, [chapter]);

  const finish = useCallback(() => setBooted(true), []);

  const handleCollectKey = useCallback(() => {
    setHasKey(true);
    saveKey(true);
    setC2Config(undefined);
    setChapter(1);
  }, []);

  const handleDevJump = useCallback((target: DevTarget) => {
    if (target.chapter === 1) {
      setBooted(!target.boot);
      if (target.hasKey !== undefined) {
        setHasKey(target.hasKey);
        saveKey(target.hasKey);
      }
      setChapter(1);
      setC2Config(undefined);
    } else if (target.chapter === "birthday") {
      setBooted(true);
      setHasKey(true);
      saveKey(true);
      setBirthdayStage(target.stage ?? "celebrate");
      setChapter("birthday");
      setBdKey((k) => k + 1);
    } else {
      setBooted(true);
      setChapter(2);
      setC2Config(target);
      setC2Key((k) => k + 1);
    }
  }, []);

  // Đang kiểm tra quyền => giữ màn hình trống tối, không nháy nội dung.
  if (!access) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#02030a]">
        <div className="font-sys text-[9px] tracking-[0.4em] text-sky-300/50">ĐANG KIỂM TRA…</div>
      </div>
    );
  }

  // Bị chặn / web đóng / chưa đăng nhập => chỉ hiện cổng, không render nội dung.
  if (gate) {
    return (
      <div className="relative h-full w-full bg-[#02030a]">
        <AuthGate
          variant={gateVariant}
          message={access.message}
          email={userEmail}
          onRetry={() => void refreshAccess()}
        />
        {gate === "blocked" && (
          <button
            onClick={() => void signOut()}
            className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 font-sys text-[9px] tracking-[0.2em] text-sky-300/50 underline-offset-4 hover:text-sky-200 hover:underline"
          >
            ĐĂNG XUẤT TÀI KHOẢN KHÁC
          </button>
        )}
        {gate === "closed" && access.is_admin && (
          <a
            href="./admin.html"
            className="fixed bottom-6 left-1/2 z-[130] -translate-x-1/2 font-sys text-[9px] tracking-[0.2em] text-amber-300/60 underline-offset-4 hover:text-amber-200 hover:underline"
          >
            VÀO TRANG QUẢN TRỊ ĐỂ MỞ LẠI
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#02030a]">
      {booted && chapter === 1 && (
        <Hero
          key="c1"
          hasKey={hasKey}
          onNext={() => {
            setC2Config(undefined);
            setChapter(2);
          }}
          onOpenGate={() => {
            setBirthdayStage("celebrate");
            setChapter("birthday");
            setBdKey((k) => k + 1);
          }}
        />
      )}
      <Suspense fallback={<LoadingVeil />}>
        {booted && chapter === 2 && (
          <Chapter2
            key={`c2-${c2Key}`}
            initialPhase={c2Config?.phase}
            initialWave={c2Config?.wave}
            initialBossHp={c2Config?.bossHp}
            onCollectKey={handleCollectKey}
            onExit={() => setChapter(1)}
          />
        )}
        {booted && chapter === "birthday" && (
          <BirthdayWorld key={`bd-${bdKey}`} initialStage={birthdayStage} onBackLobby={() => setChapter(1)} />
        )}
      </Suspense>
      <AnimatePresence>{!booted && <BootSequence key="boot" onFinish={finish} />}</AnimatePresence>
      {showDev && (
        <Suspense fallback={null}>
          <DevJump onJump={handleDevJump} />
        </Suspense>
      )}
      {/* Lối vào trang quản trị — chỉ hiện với admin. */}
      {isAdmin && (
        <a
          href="./admin.html"
          title="Trang quản trị"
          className="fixed right-3 top-3 z-[95] flex items-center gap-1.5 border border-amber-400/40 bg-[#0a0710]/85 px-2.5 py-1.5 font-sys text-[8px] tracking-[0.2em] text-amber-200/85 backdrop-blur-md transition hover:border-amber-300 hover:text-amber-100"
        >
          ⚙ QUẢN TRỊ
        </a>
      )}
    </div>
  );
}
