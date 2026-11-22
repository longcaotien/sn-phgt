import {
  analyzeWithGemini,
  hasGeminiApiKey,
  type GeminiStatus,
  type GeminiTactic,
} from "./geminiAI";

export type SkillKind = "gaze" | "laugh" | "fist" | "judgment";

export type PredictionSnapshot = {
  predictedLane: number;
  probs: [number, number, number];
  confidence: number; // 0..1
  adaptRate: number; // 0..100
  samples: number;
  accuracy: number; // % đoán đúng thực tế
  reason: string;
  warmedUp: boolean;
  geminiStatus: GeminiStatus;
  geminiTaunt?: string;
  prioritySkill?: SkillKind;
};

const LANE_NAMES = ["TRÁI", "GIỮA", "PHẢI"];
const STORAGE_KEY = "sl_boss_ml_v1";
const FEAT_DIM = 10;

type PersistedML = {
  weights: number[][];
  laneCounts: [number, number, number];
  samples: number;
  evalTotal: number;
  evalCorrect: number;
  leftMoves: number;
  rightMoves: number;
  skillFails: Record<SkillKind, number>;
  skillAttempts: Record<SkillKind, number>;
};

function emptyWeights(): number[][] {
  return [
    Array(FEAT_DIM).fill(0),
    Array(FEAT_DIM).fill(0),
    Array(FEAT_DIM).fill(0),
  ];
}

function softmax(logits: number[]): [number, number, number] {
  const maxL = Math.max(logits[0], logits[1], logits[2]);
  const exps = logits.map((l) => Math.exp(Math.max(-20, Math.min(20, l - maxL))));
  const sum = exps[0] + exps[1] + exps[2] || 1;
  return [exps[0] / sum, exps[1] / sum, exps[2] / sum];
}

export function resetBossML() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export class PlayerBehaviorTracker {
  private weights: number[][] = emptyWeights();
  private laneCounts: [number, number, number] = [1, 1, 1];
  private samples = 0;
  private evalTotal = 0;
  private evalCorrect = 0;
  private leftMoves = 0;
  private rightMoves = 0;
  private prevDir = 0;
  private prevDir2 = 0;
  private moveHistory: number[] = [];
  private skillFails: Record<SkillKind, number> = { gaze: 0, laugh: 0, fist: 0, judgment: 0 };
  private skillAttempts: Record<SkillKind, number> = { gaze: 0, laugh: 0, fist: 0, judgment: 0 };
  private reactionSamples: number[] = [];
  private fistTimingOffsets: number[] = [];
  private lastDangerKey = "";
  private geminiTactic: GeminiTactic | null = null;
  private geminiStatus: GeminiStatus = hasGeminiApiKey() ? "ready" : "off";
  private geminiBusy = false;
  private lastGeminiAt = 0;
  private lastGeminiSamples = 0;

  constructor(persist = false) {
    if (persist) this.load();
  }

  refreshGeminiState() {
    if (!hasGeminiApiKey()) {
      this.geminiStatus = "off";
      this.geminiTactic = null;
    } else if (this.geminiStatus === "off") {
      this.geminiStatus = "ready";
    }
  }

  /** Gọi Gemini 2.5 Flash phân tích chiến thuật ở nền (không bao giờ làm khựng game) */
  maybeSyncGemini(currentLane: number, stage: 1 | 2 | 3, onUpdate?: (snap: PredictionSnapshot) => void) {
    this.refreshGeminiState();
    if (!hasGeminiApiKey()) return;
    if (this.samples < 3 || this.geminiBusy) return;

    const now = Date.now();
    const enoughNewSamples = !this.geminiTactic || this.samples - this.lastGeminiSamples >= 4;
    const cooledDown = now - this.lastGeminiAt >= 7500;
    if (!enoughNewSamples || !cooledDown) return;

    this.geminiBusy = true;
    this.geminiStatus = "syncing";
    this.lastGeminiAt = now;
    this.lastGeminiSamples = this.samples;

    const mlSnap = this.predict(currentLane);
    analyzeWithGemini({
      currentLane,
      stage,
      samples: this.samples,
      accuracy: mlSnap.accuracy,
      moveHistory: [...this.moveHistory],
      laneCounts: [...this.laneCounts] as [number, number, number],
      mlProbs: [...mlSnap.probs] as [number, number, number],
      avgReactionMs: this.avgReactionMs(),
      skillStats: {
        gaze: { attempts: this.skillAttempts.gaze, fails: this.skillFails.gaze },
        laugh: { attempts: this.skillAttempts.laugh, fails: this.skillFails.laugh },
        fist: { attempts: this.skillAttempts.fist, fails: this.skillFails.fist },
        judgment: { attempts: this.skillAttempts.judgment, fails: this.skillFails.judgment },
      },
    })
      .then((tactic) => {
        if (tactic) {
          this.geminiTactic = tactic;
          this.geminiStatus = "active";
          onUpdate?.(this.predict(currentLane));
        } else {
          this.geminiStatus = hasGeminiApiKey() ? "error" : "off";
          onUpdate?.(this.predict(currentLane));
        }
      })
      .catch(() => {
        this.geminiStatus = "error";
        onUpdate?.(this.predict(currentLane));
      })
      .finally(() => {
        this.geminiBusy = false;
      });
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<PersistedML>;
      if (
        Array.isArray(data.weights) &&
        data.weights.length === 3 &&
        data.weights.every((r) => Array.isArray(r) && r.length === FEAT_DIM)
      ) {
        // Decay nhẹ để mô hình vẫn giữ trí nhớ nhưng nhanh chóng thích nghi nếu người chơi đổi chiến thuật
        this.weights = data.weights.map((row) => row.map((w) => w * 0.85));
      }
      if (Array.isArray(data.laneCounts) && data.laneCounts.length === 3) {
        this.laneCounts = [
          Math.max(1, data.laneCounts[0] * 0.7),
          Math.max(1, data.laneCounts[1] * 0.7),
          Math.max(1, data.laneCounts[2] * 0.7),
        ];
      }
      if (typeof data.samples === "number") this.samples = Math.min(200, data.samples);
      if (typeof data.evalTotal === "number") this.evalTotal = Math.min(200, data.evalTotal);
      if (typeof data.evalCorrect === "number") this.evalCorrect = Math.min(this.evalTotal, data.evalCorrect);
      if (typeof data.leftMoves === "number") this.leftMoves = data.leftMoves * 0.7;
      if (typeof data.rightMoves === "number") this.rightMoves = data.rightMoves * 0.7;
      if (data.skillFails) this.skillFails = { ...this.skillFails, ...data.skillFails };
      if (data.skillAttempts) this.skillAttempts = { ...this.skillAttempts, ...data.skillAttempts };
    } catch {
      // ignore corrupted cache
    }
  }

  save() {
    try {
      const payload: PersistedML = {
        weights: this.weights,
        laneCounts: this.laneCounts,
        samples: this.samples,
        evalTotal: this.evalTotal,
        evalCorrect: this.evalCorrect,
        leftMoves: this.leftMoves,
        rightMoves: this.rightMoves,
        skillFails: this.skillFails,
        skillAttempts: this.skillAttempts,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }

  /** Trích xuất vector đặc trưng x ∈ R^10 cho mô hình hồi quy Softmax */
  private extractFeatures(currentLane: number): number[] {
    const total = this.laneCounts[0] + this.laneCounts[1] + this.laneCounts[2] || 3;
    const h = this.moveHistory;
    const alternating =
      h.length >= 4 && h[h.length - 1] === h[h.length - 3] && h[h.length - 2] === h[h.length - 4] ? 1 : 0;

    return [
      1.0, // bias
      currentLane === 0 ? 1 : 0,
      currentLane === 1 ? 1 : 0,
      currentLane === 2 ? 1 : 0,
      this.prevDir,
      this.prevDir2,
      this.laneCounts[0] / total,
      this.laneCounts[1] / total,
      this.laneCounts[2] / total,
      alternating,
    ];
  }

  private forward(features: number[]): [number, number, number] {
    const logits = [0, 1, 2].map((c) => {
      let s = 0;
      const w = this.weights[c];
      for (let j = 0; j < FEAT_DIM; j++) s += w[j] * features[j];
      return s;
    });
    return softmax(logits);
  }

  /** Huấn luyện trực tuyến (Online SGD) mỗi khi người chơi chuyển làn hoặc cố thủ */
  private trainStep(features: number[], targetLane: number, lr = 0.3, l2 = 0.012) {
    const probs = this.forward(features);

    // Đánh giá độ chính xác thực tế trước khi cập nhật trọng số
    let pred = 0;
    if (probs[1] > probs[pred]) pred = 1;
    if (probs[2] > probs[pred]) pred = 2;
    if (this.samples >= 3) {
      this.evalTotal += 1;
      if (pred === targetLane) this.evalCorrect += 1;
    }

    for (let c = 0; c < 3; c++) {
      const target = c === targetLane ? 1 : 0;
      const err = target - probs[c];
      const w = this.weights[c];
      for (let j = 0; j < FEAT_DIM; j++) {
        w[j] = w[j] * (1 - lr * l2) + lr * err * features[j];
      }
    }
    this.samples += 1;
  }

  recordMove(fromLane: number, toLane: number, reactionMs?: number, persist = false) {
    if (fromLane === toLane) return;
    const x = this.extractFeatures(fromLane);
    this.trainStep(x, toLane, 0.34);

    const dir = toLane > fromLane ? 1 : -1;
    this.prevDir2 = this.prevDir;
    this.prevDir = dir;
    if (dir < 0) this.leftMoves += 1;
    else this.rightMoves += 1;

    this.laneCounts[toLane] += 1;
    this.moveHistory.push(toLane);
    if (this.moveHistory.length > 16) this.moveHistory.shift();

    if (reactionMs !== undefined && reactionMs > 50 && reactionMs < 2500) {
      this.reactionSamples.push(reactionMs);
      if (this.reactionSamples.length > 10) this.reactionSamples.shift();
    }
    if (persist) this.save();
  }

  recordStay(lane: number, persist = false) {
    const x = this.extractFeatures(lane);
    this.trainStep(x, lane, 0.2);
    this.prevDir2 = this.prevDir;
    this.prevDir = 0;
    this.laneCounts[lane] += 0.6;
    if (persist) this.save();
  }

  recordSkill(kind: SkillKind, ok: boolean, timingOffset?: number, persist = false) {
    this.skillAttempts[kind] += 1;
    if (!ok) this.skillFails[kind] += 1;
    if (kind === "fist" && timingOffset !== undefined) {
      this.fistTimingOffsets.push(timingOffset);
      if (this.fistTimingOffsets.length > 8) this.fistTimingOffsets.shift();
    }
    if (persist) this.save();
  }

  avgReactionMs(): number {
    if (this.reactionSamples.length === 0) return 460;
    return this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length;
  }

  /** Dự đoán phân bố xác suất 3 làn bằng mô hình Softmax + chiến thuật Gemini (nếu có) */
  predict(currentLane: number): PredictionSnapshot {
    this.refreshGeminiState();
    const warmedUp = this.samples >= 3;
    const x = this.extractFeatures(currentLane);
    const mlProbs = warmedUp ? this.forward(x) : ([0.33, 0.34, 0.33] as [number, number, number]);

    const gemValid =
      warmedUp &&
      this.geminiTactic !== null &&
      hasGeminiApiKey() &&
      Date.now() - this.geminiTactic.updatedAt <= 60_000;

    // Trộn 65% Online ML cục bộ + 35% Gemini Strategic Prior
    const probs: [number, number, number] = gemValid
      ? [
          mlProbs[0] * 0.65 + this.geminiTactic!.laneProbs[0] * 0.35,
          mlProbs[1] * 0.65 + this.geminiTactic!.laneProbs[1] * 0.35,
          mlProbs[2] * 0.65 + this.geminiTactic!.laneProbs[2] * 0.35,
        ]
      : mlProbs;

    // Nếu phát hiện chu kỳ đảo làn rõ ràng, cộng nhẹ tín hiệu suy luận
    const h = this.moveHistory;
    let altTarget = -1;
    if (warmedUp && h.length >= 4 && h[h.length - 1] === h[h.length - 3] && h[h.length - 2] === h[h.length - 4]) {
      altTarget = h[h.length - 2];
    }

    let best = 0;
    if (warmedUp) {
      for (let i = 1; i < 3; i++) {
        if (probs[i] > probs[best]) best = i;
      }
    } else {
      best = currentLane;
    }

    const maxP = Math.max(probs[0], probs[1], probs[2]);
    const dataScale = Math.min(1, this.samples / 8);
    const geminiAgreement = gemValid && this.geminiTactic!.predictedNextLane === best ? 0.06 : 0;
    const confidence = warmedUp
      ? Math.min(0.96, 0.35 + (maxP - 0.33) * 0.9 * dataScale + dataScale * 0.12 + geminiAgreement)
      : 0.25;
    const accuracy = this.evalTotal > 0 ? Math.round((this.evalCorrect / this.evalTotal) * 100) : 0;

    const dirTotal = this.leftMoves + this.rightMoves || 1;
    let reason = `TRỌNG SỐ LÀN ${LANE_NAMES[best]}`;
    if (!warmedUp) {
      reason = "ĐANG THU THẬP MẪU HÀNH VI…";
    } else if (gemValid && this.geminiTactic!.patternSummary) {
      reason = this.geminiTactic!.patternSummary;
    } else if (altTarget === best) {
      reason = "PHÁT HIỆN ĐẢO LÀN LẶP";
    } else if (best < currentLane && this.leftMoves / dirTotal > 0.6) {
      reason = "XU HƯỚNG DẠT TRÁI";
    } else if (best > currentLane && this.rightMoves / dirTotal > 0.6) {
      reason = "XU HƯỚNG DẠT PHẢI";
    } else if (best === currentLane) {
      reason = "CÓ XU HƯỚNG TRỤ LÀN";
    }

    return {
      predictedLane: best,
      probs,
      confidence,
      adaptRate: Math.round(confidence * 100),
      samples: this.samples,
      accuracy,
      reason,
      warmedUp,
      geminiStatus: this.geminiStatus,
      geminiTaunt: gemValid ? this.geminiTactic!.taunt : undefined,
      prioritySkill: gemValid ? this.geminiTactic!.prioritySkill : undefined,
    };
  }

  /**
   * Chọn làn nguy hiểm.
   * - Khi chưa đủ mẫu (warmedUp === false): bốc ngẫu nhiên thực sự và tránh lặp cặp cũ (tránh mở màn luôn bắn 1 cặp cố định).
   * - Khi mô hình đã học (>= 3 mẫu): dùng phân bố xác suất Softmax để khóa làn hiện tại + làn dự đoán cao nhất.
   */
  pickTargetedLanes(
    currentLane: number,
    dangerCount: 1 | 2,
    adaptiveChance = 0.8
  ): { lanes: number[]; predicted: PredictionSnapshot; aiUsed: boolean } {
    const snap = this.predict(currentLane);
    const canAdapt = snap.warmedUp && Math.random() < adaptiveChance;

    if (dangerCount === 1) {
      if (canAdapt) {
        const target = snap.confidence >= 0.48 ? snap.predictedLane : currentLane;
        this.lastDangerKey = String(target);
        return { lanes: [target], predicted: snap, aiUsed: true };
      }
      const candidates = [0, 1, 2].filter((l) => String(l) !== this.lastDangerKey);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      this.lastDangerKey = String(pick);
      return { lanes: [pick], predicted: snap, aiUsed: false };
    }

    if (canAdapt) {
      // Khóa làn hiện tại + làn có xác suất Softmax cao nhất khác làn hiện tại
      const others = [0, 1, 2].filter((l) => l !== currentLane);
      others.sort((a, b) => snap.probs[b] - snap.probs[a]);
      const second = snap.predictedLane !== currentLane ? snap.predictedLane : others[0];
      const lanes = [currentLane, second].sort((a, b) => a - b);
      this.lastDangerKey = lanes.join(",");
      return { lanes, predicted: snap, aiUsed: true };
    }

    // Ngẫu nhiên công bằng và không lặp cặp nguy hiểm liên tiếp ở màn mở đầu
    const pairs = [
      [0, 1],
      [1, 2],
      [0, 2],
    ].filter((p) => p.join(",") !== this.lastDangerKey);
    const chosen = pairs[Math.floor(Math.random() * pairs.length)];
    this.lastDangerKey = chosen.join(",");
    return { lanes: chosen, predicted: snap, aiUsed: false };
  }

  /** Chọn kỹ năng boss theo điểm yếu của người chơi (exploration + failure rate) */
  pickBossSkill(lastKind: SkillKind | null, stage: 1 | 2 | 3): SkillKind {
    const basePool: SkillKind[] = stage >= 2 ? ["gaze", "laugh", "fist", "judgment"] : ["gaze", "laugh", "fist"];
    const candidates = basePool.filter((k) => k !== lastKind);

    const weights = candidates.map((k) => {
      const attempts = this.skillAttempts[k];
      const failRatio = attempts > 0 ? this.skillFails[k] / attempts : 0.35;
      const novelty = attempts === 0 ? 0.55 : 0;
      const stageBoost = k === "judgment" && stage >= 2 ? 0.35 : 0;
      const geminiBoost =
        this.geminiTactic &&
        Date.now() - this.geminiTactic.updatedAt <= 60_000 &&
        this.geminiTactic.prioritySkill === k
          ? 0.9
          : 0;
      return 1 + failRatio * 1.25 + novelty + stageBoost + geminiBoost;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[0];
  }

  getSpeedMultiplier(stage: 1 | 2 | 3): number {
    const base = stage === 1 ? 1.0 : stage === 2 ? 0.86 : 0.75;
    const avg = this.avgReactionMs();
    const adapt = avg < 290 ? 0.92 : avg > 680 ? 1.05 : 1.0;
    return base * adapt;
  }

  /** Điều chỉnh tâm vùng CRIT của Nắm Đấm Thần dựa theo xu hướng nhấn sớm/muộn */
  getFistTimingShift(): number {
    if (this.fistTimingOffsets.length < 3) return 0;
    const mean = this.fistTimingOffsets.reduce((a, b) => a + b, 0) / this.fistTimingOffsets.length;
    // Dịch nhẹ tối đa ±0.04 theo xu hướng người chơi để buộc phải canh chuẩn
    return Math.max(-0.04, Math.min(0.04, (mean - 0.57) * 0.25));
  }
}
