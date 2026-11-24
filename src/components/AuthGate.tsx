import { motion } from "framer-motion";
import { signInWithGoogle } from "../lib/supabase";

type Props = {
  /** Lý do hiện cổng: chưa đăng nhập / bị chặn / web đang đóng. */
  variant: "signin" | "blocked" | "closed";
  message?: string;
  email?: string | null;
  onRetry?: () => void;
};

const TITLES: Record<Props["variant"], string> = {
  signin: "CỔNG VÀO KHU VƯỜN",
  blocked: "TÀI KHOẢN ĐÃ BỊ TẠM KHOÁ",
  closed: "KHU VƯỜN ĐANG ĐÓNG",
};

export default function AuthGate({ variant, message, email, onRetry }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-[#04060f] px-5"
    >
      {/* Ánh sáng nền rất nhẹ — giữ đúng tinh thần Solo Leveling */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(56,132,255,0.16),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />

      <div className="relative w-full max-w-sm">
        <div className="border border-sky-400/25 bg-[#060b18]/92 px-6 py-7 shadow-[0_0_60px_rgba(30,90,200,0.25)] backdrop-blur-md">
          <div className="mb-1 text-center font-sys text-[9px] tracking-[0.42em] text-sky-300/70">
            SOLO LEVELING · BIRTHDAY
          </div>
          <h1 className="mb-5 text-center font-sys text-[15px] font-bold tracking-[0.16em] text-sky-100">
            {TITLES[variant]}
          </h1>

          {variant === "signin" && (
            <>
              <p className="mb-5 text-center text-[12.5px] leading-relaxed text-sky-100/65">
                Đăng nhập bằng Google để mở khu vườn sinh nhật.
              </p>

              <button
                onClick={() => void signInWithGoogle()}
                className="group flex w-full items-center justify-center gap-2.5 border border-white/15 bg-white px-4 py-3 font-semibold text-[13px] text-[#1f1f1f] transition hover:bg-[#f2f2f2] active:scale-[0.985]"
              >
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.1 17.6 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.1 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.3z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.8-6.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.7-3.6-13.6-8.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
                  />
                </svg>
                Đăng nhập bằng Google
              </button>

              <p className="mt-4 text-center text-[10.5px] leading-relaxed text-sky-200/35">
                Chỉ dùng email để nhận diện tài khoản. Không đăng bài, không đọc Gmail.
              </p>
            </>
          )}

          {variant === "blocked" && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-400/40 bg-red-950/40 text-2xl">
                  🔒
                </div>
              </div>
              <p className="mb-1 text-center text-[12.5px] leading-relaxed text-sky-100/70">
                Quản trị viên đã tạm khoá quyền truy cập của tài khoản này.
              </p>
              {email && (
                <p className="mb-4 break-all text-center font-mono text-[11px] text-sky-300/60">{email}</p>
              )}
              <p className="text-center text-[11px] leading-relaxed text-sky-200/40">
                Nếu đây là nhầm lẫn, hãy liên hệ quản trị viên để được mở lại.
              </p>
            </>
          )}

          {variant === "closed" && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/35 bg-amber-950/35 text-2xl">
                  🌙
                </div>
              </div>
              <p className="mb-4 text-center text-[12.5px] leading-relaxed text-sky-100/70">
                {message || "Khu vườn đang được chăm sóc, quay lại sau nhé!"}
              </p>
            </>
          )}

          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-5 w-full border border-sky-400/35 bg-sky-500/15 py-2.5 font-sys text-[10px] tracking-[0.2em] text-sky-100 transition hover:bg-sky-500/25"
            >
              THỬ LẠI
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
