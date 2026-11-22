import type { SkillKind } from "./bossAI";

const KEY_STORAGE = "sl_gemini_api_key";
const MODEL = "gemini-2.5-flash";

export type GeminiStatus = "off" | "ready" | "syncing" | "active" | "error";

export type GeminiTactic = {
  predictedNextLane: number; // 0 | 1 | 2
  laneProbs: [number, number, number];
  prioritySkill: SkillKind;
  patternSummary: string;
  taunt: string;
  updatedAt: number;
};

export type TelemetryPayload = {
  currentLane: number;
  stage: 1 | 2 | 3;
  samples: number;
  accuracy: number;
  moveHistory: number[]; // 0=TRÁI, 1=GIỮA, 2=PHẢI
  laneCounts: [number, number, number];
  mlProbs: [number, number, number];
  avgReactionMs: number;
  skillStats: Record<SkillKind, { attempts: number; fails: number }>;
};

export function getGeminiApiKey(): string {
  try {
    const saved = localStorage.getItem(KEY_STORAGE)?.trim();
    if (saved) return saved;
  } catch {
    // ignore storage errors
  }
  const envKey = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY;
  return envKey?.trim() ?? "";
}

export function setGeminiApiKey(key: string) {
  const clean = key.trim();
  try {
    if (clean) localStorage.setItem(KEY_STORAGE, clean);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    // ignore storage errors
  }
}

export function hasGeminiApiKey(): boolean {
  return getGeminiApiKey().length > 0;
}

function clampLane(v: unknown, fallback: number): number {
  const n = Number(v);
  if (Number.isFinite(n) && (n === 0 || n === 1 || n === 2)) return n;
  return fallback;
}

function normalizeProbs(raw: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(raw) || raw.length !== 3) return fallback;
  const nums = raw.map((x) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(0.05, Math.min(0.95, n)) : 0.33;
  });
  const sum = nums[0] + nums[1] + nums[2] || 1;
  return [nums[0] / sum, nums[1] / sum, nums[2] / sum];
}

function normalizeSkill(raw: unknown): SkillKind {
  if (raw === "gaze" || raw === "laugh" || raw === "fist" || raw === "judgment") return raw;
  return "gaze";
}

export async function testGeminiConnection(apiKey?: string): Promise<{ ok: boolean; message: string }> {
  const key = (apiKey ?? getGeminiApiKey()).trim();
  if (!key) return { ok: false, message: "Chưa nhập API Key." };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Trả về đúng JSON: {"ok":true}' }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 24,
            temperature: 0,
          },
        }),
      }
    );
    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      return { ok: false, message: `Lỗi Gemini: ${msg}` };
    }
    return { ok: true, message: "Kết nối Gemini 2.5 Flash thành công!" };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "Quá thời gian chờ (timeout)." : "Không thể kết nối máy chủ Gemini.";
    return { ok: false, message: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function analyzeWithGemini(payload: TelemetryPayload): Promise<GeminiTactic | null> {
  const key = getGeminiApiKey();
  if (!key) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);

  const laneText = payload.moveHistory.slice(-12).map((l) => (l === 0 ? "TRÁI" : l === 1 ? "GIỮA" : "PHẢI")).join(" -> ");
  const prompt = `Bạn là lõi AI chiến thuật "Tượng Thần Mỉm Cười" (Solo Leveling). Hãy phân tích dữ liệu hành vi người chơi để đọc vị bước né tiếp theo.
Dữ liệu hiện tại:
- Làn đang đứng: ${payload.currentLane} (0=TRÁI, 1=GIỮA, 2=PHẢI)
- Pha Boss: ${payload.stage}/3 | Số mẫu đã học: ${payload.samples} | Độ chính xác ML cục bộ: ${payload.accuracy}%
- Chuỗi di chuyển gần nhất: ${laneText || "chưa di chuyển nhiều"}
- Tần suất ở 3 làn [TRÁI, GIỮA, PHẢI]: [${payload.laneCounts.map((n) => n.toFixed(1)).join(", ")}]
- Xác suất ML cục bộ [0,1,2]: [${payload.mlProbs.map((p) => p.toFixed(2)).join(", ")}]
- Phản xạ trung bình: ${Math.round(payload.avgReactionMs)}ms
- Tỷ lệ dính đòn theo chiêu: gaze=${payload.skillStats.gaze.fails}/${payload.skillStats.gaze.attempts}, laugh=${payload.skillStats.laugh.fails}/${payload.skillStats.laugh.attempts}, fist=${payload.skillStats.fist.fails}/${payload.skillStats.fist.attempts}, judgment=${payload.skillStats.judgment.fails}/${payload.skillStats.judgment.attempts}

Trả về JSON thuần theo đúng schema:
{
  "predictedNextLane": 0 | 1 | 2,
  "laneProbs": [number, number, number],
  "prioritySkill": "gaze" | "laugh" | "fist" | "judgment",
  "patternSummary": "TỐI ĐA 5 TỪ VIẾT HOA TIẾNG VIỆT",
  "taunt": "1 CÂU ĐỌC VỊ NGẮN NGẦU BẰNG TIẾNG VIỆT (DƯỚI 12 TỪ)"
}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.35,
            maxOutputTokens: 220,
          },
        }),
      }
    );

    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const predictedNextLane = clampLane(parsed.predictedNextLane, payload.currentLane);
    const laneProbs = normalizeProbs(parsed.laneProbs, payload.mlProbs);
    const prioritySkill = normalizeSkill(parsed.prioritySkill);
    const patternSummary =
      typeof parsed.patternSummary === "string" && parsed.patternSummary.trim()
        ? parsed.patternSummary.trim().toUpperCase().slice(0, 48)
        : "GEMINI PHÂN TÍCH MẪU NÉ";
    const taunt =
      typeof parsed.taunt === "string" && parsed.taunt.trim()
        ? parsed.taunt.trim().slice(0, 90)
        : "";

    return {
      predictedNextLane,
      laneProbs,
      prioritySkill,
      patternSummary,
      taunt,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
