export type SkillKind = "gaze" | "laugh" | "fist" | "judgment";

export type PredictionSnapshot = {
  predictedLane: number;
  confidence: number; // 0..1
  reason: string;
  adaptRate: number;
};

const LANE_NAMES = ["TRÁI", "GIỮA", "PHẢI"];

export class PlayerBehaviorTracker {
  private laneCounts: [number, number, number] = [0, 1, 0];
  private transitions: number[][] = [
    [0.2, 0.5, 0.3],
    [0.45, 0.1, 0.45],
    [0.3, 0.5, 0.2],
  ];
  private leftMoves = 0;
  private rightMoves = 0;
  private moveHistory: number[] = [1];
  private skillFails: Record<SkillKind, number> = { gaze: 0, laugh: 0, fist: 0, judgment: 0 };
  private skillAttempts: Record<SkillKind, number> = { gaze: 0, laugh: 0, fist: 0, judgment: 0 };
  private reactionSamples: number[] = [];
  private fistTimingOffsets: number[] = [];
  private totalMoves = 0;

  recordMove(fromLane: number, toLane: number, reactionMs?: number) {
    if (fromLane === toLane) return;
    this.totalMoves += 1;
    this.laneCounts[toLane] += 1;
    // Cập nhật ma trận chuyển làn Markov với decay nhẹ để thích nghi nhanh khi người chơi đổi thói quen
    const row = this.transitions[fromLane];
    for (let i = 0; i < 3; i++) row[i] *= 0.82;
    row[toLane] += 1.0;

    if (toLane < fromLane) this.leftMoves += 1;
    else this.rightMoves += 1;

    this.moveHistory.push(toLane);
    if (this.moveHistory.length > 14) this.moveHistory.shift();

    if (reactionMs !== undefined && reactionMs > 60 && reactionMs < 2500) {
      this.reactionSamples.push(reactionMs);
      if (this.reactionSamples.length > 10) this.reactionSamples.shift();
    }
  }

  recordStay(lane: number) {
    this.laneCounts[lane] += 0.6;
  }

  recordSkill(kind: SkillKind, ok: boolean, timingOffset?: number) {
    this.skillAttempts[kind] += 1;
    if (!ok) this.skillFails[kind] += 1;
    if (kind === "fist" && timingOffset !== undefined) {
      this.fistTimingOffsets.push(timingOffset);
      if (this.fistTimingOffsets.length > 8) this.fistTimingOffsets.shift();
    }
  }

  avgReactionMs(): number {
    if (this.reactionSamples.length === 0) return 450;
    return this.reactionSamples.reduce((a, b) => a + b, 0) / this.reactionSamples.length;
  }

  /** Dự đoán làn người chơi có khả năng cao nhất sẽ đứng / né tới */
  predict(currentLane: number): PredictionSnapshot {
    const row = this.transitions[currentLane];
    const rowSum = row[0] + row[1] + row[2] || 1;
    const totalCount = this.laneCounts[0] + this.laneCounts[1] + this.laneCounts[2] || 1;
    const dirTotal = this.leftMoves + this.rightMoves || 1;
    const leftBias = this.leftMoves / dirTotal;
    const rightBias = this.rightMoves / dirTotal;

    const scores = [0, 1, 2].map((l) => {
      const markov = row[l] / rowSum;
      const freq = this.laneCounts[l] / totalCount;
      let dirScore = 0.2;
      if (l < currentLane) dirScore = leftBias;
      else if (l > currentLane) dirScore = rightBias;
      return markov * 0.56 + freq * 0.24 + dirScore * 0.2;
    });

    // Kiểm tra mẫu lặp xen kẽ (ví dụ: 1 -> 0 -> 1 -> 0)
    let alternatingBonus = -1;
    const h = this.moveHistory;
    if (h.length >= 4 && h[h.length - 1] === h[h.length - 3] && h[h.length - 2] === h[h.length - 4]) {
      alternatingBonus = h[h.length - 2];
      scores[alternatingBonus] += 0.35;
    }

    let best = 0;
    let second = 1;
    for (let i = 0; i < 3; i++) {
      if (scores[i] > scores[best]) {
        second = best;
        best = i;
      } else if (i !== best && scores[i] > scores[second]) {
        second = i;
      }
    }

    const totalScore = scores[0] + scores[1] + scores[2] || 1;
    const margin = (scores[best] - scores[second]) / totalScore;
    const dataFactor = Math.min(1, this.totalMoves / 8);
    const confidence = Math.min(0.95, Math.max(0.32, 0.36 + margin * 1.15 * dataFactor + dataFactor * 0.22));

    let reason = `ƯU TIÊN LÀN ${LANE_NAMES[best]}`;
    if (this.totalMoves < 2) {
      reason = "ĐANG QUÉT MẪU DI CHUYỂN…";
    } else if (alternatingBonus === best) {
      reason = "BẮT BÀI ĐẢO LÀN LẶP";
    } else if (best < currentLane && leftBias > 0.62) {
      reason = "THÓI QUEN DẠT TRÁI";
    } else if (best > currentLane && rightBias > 0.62) {
      reason = "THÓI QUEN DẠT PHẢI";
    } else if (best === currentLane) {
      reason = "CÓ XU HƯỚNG TRỤ LÀN";
    }

    return {
      predictedLane: best,
      confidence,
      reason,
      adaptRate: Math.round(confidence * 100),
    };
  }

  /**
   * Chọn làn nguy hiểm dựa trên dự đoán hành vi người chơi.
   * Nếu bật adaptive: khóa cả làn hiện tại và làn dự đoán người chơi sắp né sang,
   * buộc người chơi phải đọc tín hiệu thay vì spam một hướng cố định.
   */
  pickTargetedLanes(currentLane: number, dangerCount: 1 | 2, adaptiveChance = 0.78): { lanes: number[]; predicted: PredictionSnapshot } {
    const snap = this.predict(currentLane);
    const useAI = Math.random() < adaptiveChance;

    if (dangerCount === 1) {
      if (useAI) {
        const target = snap.confidence > 0.55 ? snap.predictedLane : currentLane;
        return { lanes: [target], predicted: snap };
      }
      return { lanes: [Math.floor(Math.random() * 3)], predicted: snap };
    }

    // 2 làn nguy hiểm -> chỉ chừa 1 làn an toàn
    if (useAI) {
      const dangerSet = new Set<number>([currentLane]);
      if (snap.predictedLane !== currentLane) {
        dangerSet.add(snap.predictedLane);
      } else {
        // Người chơi hay đứng yên -> khóa làn hiện tại + làn phụ hay đến nhất
        const others = [0, 1, 2].filter((l) => l !== currentLane);
        others.sort((a, b) => this.laneCounts[b] - this.laneCounts[a]);
        dangerSet.add(others[0]);
      }
      if (dangerSet.size === 2) {
        return { lanes: Array.from(dangerSet).sort((a, b) => a - b), predicted: snap };
      }
    }

    const safe = Math.floor(Math.random() * 3);
    return { lanes: [0, 1, 2].filter((l) => l !== safe), predicted: snap };
  }

  /** Chọn kỹ năng boss thông minh theo giai đoạn và điểm yếu của người chơi */
  pickBossSkill(lastKind: SkillKind | null, stage: 1 | 2 | 3): SkillKind {
    const basePool: SkillKind[] = stage >= 2 ? ["gaze", "laugh", "fist", "judgment"] : ["gaze", "laugh", "fist"];
    const candidates = basePool.filter((k) => k !== lastKind);

    const weights = candidates.map((k) => {
      const attempts = this.skillAttempts[k];
      const failRatio = attempts > 0 ? this.skillFails[k] / attempts : 0.35;
      const novelty = attempts === 0 ? 0.45 : 0;
      const stageBoost = k === "judgment" && stage >= 2 ? 0.35 : 0;
      return 1 + failRatio * 1.15 + novelty + stageBoost;
    });

    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      r -= weights[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[0];
  }

  /** Điều chỉnh hệ số tốc độ nhẹ dựa trên phản xạ người chơi (nhưng vẫn trong ngưỡng chơi được) */
  getSpeedMultiplier(stage: 1 | 2 | 3): number {
    const base = stage === 1 ? 1.0 : stage === 2 ? 0.86 : 0.75;
    const avg = this.avgReactionMs();
    // Nếu người chơi phản xạ cực nhanh (< 280ms), tăng nhịp lên chút ít để boss vẫn áp lực
    const adapt = avg < 280 ? 0.92 : avg > 650 ? 1.05 : 1.0;
    return base * adapt;
  }
}
