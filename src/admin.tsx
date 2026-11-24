import { createRoot } from "react-dom/client";
import AdminPanel from "./components/AdminPanel";
import "./index.css";

const el = document.getElementById("admin-root");
if (el) {
  createRoot(el).render(<AdminPanel />);
}
