import React from "react";
import { startSyncEngine } from "./utils/syncEngine";
import { startBackgroundTracking } from "./utils/backgroundTracker";
import { initPwaTracker } from "./utils/pwaTracker";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

startSyncEngine();
// Only register SW in production
if (import.meta.env.PROD) {
  startBackgroundTracking();
}
initPwaTracker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <>
      <App />
      <Analytics />
    </>
    </BrowserRouter>
  </React.StrictMode>
);
