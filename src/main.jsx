import React from "react";
import { startSyncEngine } from "./utils/syncEngine";
import { startBackgroundTracking } from "./utils/backgroundTracker";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

// Guard background initialization so a failure in either module does not
// prevent React from mounting (which would produce a blank white page).
try {
  startSyncEngine();
} catch (e) {
  console.error("[main] startSyncEngine failed:", e);
}

try {
  startBackgroundTracking();
} catch (e) {
  console.error("[main] startBackgroundTracking failed:", e);
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  console.error("[main] #root element not found — cannot mount React");
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
        <Analytics />
      </BrowserRouter>
    </React.StrictMode>
  );
}
