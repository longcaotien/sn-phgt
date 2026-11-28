import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { getQuality, lowEnd, onQualityChange } from "./utils/perf";

/* ------------------------------------------------------------------
   Áp mức chất lượng lên <html> TRƯỚC khi React render để CSS có hiệu
   lực ngay từ khung hình đầu tiên.
   - `perf-lite` : máy yếu theo dò phần cứng (giữ nguyên hành vi cũ).
   - `q-lite`    : bộ điều tiết đo FPS và hạ cấp khi máy thực tế bị tụt.
   - `q-min`     : mức tối thiểu, chỉ còn hiệu ứng cốt lõi.
   ------------------------------------------------------------------ */

const root = document.documentElement;

function applyQuality(q: 0 | 1 | 2) {
  root.classList.toggle("q-lite", q < 2);
  root.classList.toggle("q-min", q < 1);
}

if (lowEnd) root.classList.add("perf-lite");
applyQuality(getQuality());
onQualityChange(applyQuality);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
