import type { SkillKind } from "./bossAI";

const KEY_STORAGE = "sl_gemini_api_key";
const MODEL_STORAGE = "sl_gemini_model";

export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
] as const;

export type GeminiModelChoice = "auto" | (typeof GEMINI_MODELS)[number];
export type GeminiStatus = "off" | "ready" | "syncing" | "active" | "error";

export type GeminiTactic = {
  predictedNextLane: number; // 0 | 1 | 2
  laneProbs: [number, number, number];
  prioritySkill: SkillKind;
  patternSummary: string;
  taunt: string;
  modelUsed: string;
  latencyMs: number;
  updatedAt: number;
};

export type GeminiDiag = {
  status: GeminiStatus;
  lastError: string | null;
  lastModel: string | null;
  lastLatencyMs: number | null;
  successCount: number;
};

export type TelemetryPayload = {
  currentLane: number;
  lastSkill: SkillKind | null;
  stage: 1 | 2 | 3;
  samples: number;
  accuracy: number;
  moveHistory: number[]; // 0=TRÁI, 1=GIỮA, 2=PHẢI
  laneCounts: [number, number, number];
  mlProbs: [number, number, number];
  avgReactionMs: number;
  skillStats: Record<SkillKind, { attempts: number; fails: number }>;
};

let diagState: GeminiDiag = {
  status: hasGeminiApiKey() ? "ready" : "off",
  lastError: null,
  lastModel: null,
  lastLatencyMs: null,
  successCount: 0,
};

export function getGeminiDiag(): GeminiDiag {
  return { ...diagState };
}

export function setGeminiDiag(patch: Partial<GeminiDiag>) {
  diagState = { ...diagState, ...patch };
  window.dispatchEvent(new Event("sl-gemini-diag-changed"));
}

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
  setGeminiDiag({
    status: clean ? "ready" : "off",
    lastError: null,
  });
}

export function getGeminiModelChoice(): GeminiModelChoice {
  try {
    const saved = localStorage.getItem(MODEL_STORAGE) as GeminiModelChoice | null;
    if (saved === "auto" || (saved && (GEMINI_MODELS as readonly string[]).includes(saved))) {
      return saved;
    }
  } catch {
    // ignore
  }
  return "auto";
}

export function setGeminiModelChoice(m: GeminiModelChoice) {
  try {
    localStorage.setItem(MODEL_STORAGE, m);
  } catch {
    // ignore
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

/** Trích xuất JSON an toàn ngay cả khi model bọc ```json ... ``` hoặc thêm văn bản phụ */
function extractJson(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callGeminiOnce(
  key: string,
  model: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ ok: true; text: string; latencyMs: number } | { ok: false; status: number; error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = performance.now();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify(body),
      }
    );
    const latencyMs = Math.round(performance.now() - t0);

    if (!res.ok) {
      const errData = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: msg };
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? "").join("").trim();
    if (!text) {
      return {
        ok: false,
        status: 500,
        error: `Phản hồi rỗng (${candidate?.finishReason ?? "unknown"})`,
      };
    }
    return { ok: true, text, latencyMs };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? "Hết thời gian chờ phản hồi"
        : e instanceof Error
        ? e.message
        : "Lỗi mạng khi gọi Gemini";
    return { ok: false, status: 0, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

function getCandidateModels(): string[] {
  const choice = getGeminiModelChoice();
  if (choice === "auto") return [...GEMINI_MODELS];
  return [choice, ...GEMINI_MODELS.filter((m) => m !== choice)];
}

export async function testGeminiConnection(
  apiKey?: string
): Promise<{ ok: boolean; message: string; model?: string; latencyMs?: number }> {
  const key = (apiKey ?? getGeminiApiKey()).trim();
  if (!key) return { ok: false, message: "Chưa nhập API Key." };

  const models = getCandidateModels();
  let lastErr = "Không thể kết nối.";

  for (const model of models) {
    const is25 = model.startsWith("gemini-2.5");
    const genConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      maxOutputTokens: 256,
      temperature: 0,
      ...(is25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    };

    const res = await callGeminiOnce(
      key,
      model,
      {
        contents: [{ parts: [{ text: 'Trả về JSON: {"ok":true,"predictedNextLane":1,"laneProbs":[0.3,0.4,0.3]}' }] }],
        generationConfig: genConfig,
      },
      9000
    );

    if (res.ok) {
      const parsed = extractJson(res.text);
      if (parsed) {
        setGeminiDiag({
          status: "ready",
          lastError: null,
          lastModel: model,
          lastLatencyMs: res.latencyMs,
        });
        return {
          ok: true,
          model,
          latencyMs: res.latencyMs,
          message: `Kết nối ${model} thành công (${res.latencyMs}ms)!`,
        };
      }
      lastErr = `${model}: JSON không hợp lệ (${res.text.slice(0, 60)})`;
    } else {
      lastErr = `${model}: ${res.error}`;
      // Nếu lỗi xác thực API Key (400/401/403) không cần thử thêm model khác trừ khi là lỗi thinkingConfig
      if ((res.status === 401 || res.status === 403) && !res.error.toLowerCase().includes("thinking")) {
        break;
      }
    }
  }

  setGeminiDiag({ status: "error", lastError: lastErr });
  return { ok: false, message: lastErr };
}

export async function analyzeWithGemini(
  payload: TelemetryPayload
): Promise<{ tactic: GeminiTactic | null; error?: string; rateLimited?: boolean }> {
  const key = getGeminiApiKey();
  if (!key) return { tactic: null, error: "Chưa có API Key" };

  const laneText = payload.moveHistory
    .slice(-14)
    .map((l) => (l === 0 ? "T" : l === 1 ? "G" : "P"))
    .join("→");

  const prompt = `Bạn là lõi AI chiến thuật "Tượng Thần Mỉm Cười" (Solo Leveling). Phân tích hành vi người chơi để đọc vị bước né tiếp theo.
Dữ liệu:
- Làn hiện tại: ${payload.currentLane} (0=TRÁI/T, 1=GIỮA/G, 2=PHẢI/P) | Pha: ${payload.stage}/3
- Chiêu Boss vừa tung: ${payload.lastSkill ?? "chưa có"} | Số mẫu: ${payload.samples} | Độ chuẩn ML cục bộ: ${payload.accuracy}%
- Chuỗi di chuyển gần nhất: ${laneText || "ít di chuyển"}
- Tần suất 3 làn [T,G,P]: [${payload.laneCounts.map((n) => n.toFixed(1)).join(",")}]
- Xác suất ML cục bộ [0,1,2]: [${payload.mlProbs.map((p) => p.toFixed(2)).join(",")}]
- Phản xạ TB: ${Math.round(payload.avgReactionMs)}ms
- Trúng đòn theo chiêu: gaze=${payload.skillStats.gaze.fails}/${payload.skillStats.gaze.attempts}, laugh=${payload.skillStats.laugh.fails}/${payload.skillStats.laugh.attempts}, fist=${payload.skillStats.fist.fails}/${payload.skillStats.fist.attempts}, judgment=${payload.skillStats.judgment.fails}/${payload.skillStats.judgment.attempts}

Chỉ trả về JSON thuần hợp lệ đúng schema:
{"predictedNextLane":0,"laneProbs":[0.6,0.25,0.15],"prioritySkill":"gaze","patternSummary":"TỐI ĐA 5 TỪ HOA","taunt":"1 câu đọc vị ngầu dưới 12 từ"}`;

  const models = getCandidateModels();
  let lastError = "Không nhận được phản hồi";
  let rateLimited = false;

  for (const model of models) {
    const is25 = model.startsWith("gemini-2.5");
    const genConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      temperature: 0.3,
      maxOutputTokens: 512,
      ...(is25 ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    };

    const res = await callGeminiOnce(
      key,
      model,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: genConfig,
      },
      12000
    );

    if (!res.ok) {
      lastError = `${model}: ${res.error}`;
      if (res.status === 429) {
        rateLimited = true;
        continue; // thử model kế tiếp (vd 2.5-flash-lite / 2.0-flash có quota riêng!)
      }
      if (res.status === 401 || res.status === 403) {
        break;
      }
      continue;
    }

    const parsed = extractJson(res.text);
    if (!parsed) {
      lastError = `${model}: JSON bị lỗi định dạng`;
      continue;
    }

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

    const tactic: GeminiTactic = {
      predictedNextLane,
      laneProbs,
      prioritySkill,
      patternSummary,
      taunt,
      modelUsed: model,
      latencyMs: res.latencyMs,
      updatedAt: Date.now(),
    };

    setGeminiDiag({
      status: "active",
      lastError: null,
      lastModel: model,
      lastLatencyMs: res.latencyMs,
      successCount: diagState.successCount + 1,
    });

    return { tactic };
  }

  setGeminiDiag({
    status: "error",
    lastError,
  });
  return { tactic: null, error: lastError, rateLimited };
}
