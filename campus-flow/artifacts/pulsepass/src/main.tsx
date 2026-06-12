import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress browser-extension noise (MetaMask etc.) — these are not app errors
window.addEventListener("unhandledrejection", (event) => {
  const msg = event?.reason?.message ?? event?.reason ?? "";
  if (
    typeof msg === "string" &&
    (msg.includes("MetaMask") ||
      msg.includes("chrome-extension") ||
      msg.includes("ethereum") ||
      msg.includes("Web3") ||
      msg.includes("wallet"))
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
