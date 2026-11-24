import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { lowEnd } from "./utils/perf";

// Bật chế độ hiệu năng thấp trước khi React render để CSS áp dụng ngay từ frame đầu.
if (lowEnd) document.documentElement.classList.add("perf-lite");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
