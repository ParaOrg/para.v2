import React from "react";
import { startSyncEngine } from "./utils/syncEngine";
import { startBackgroundTracking } from "./utils/backgroundTracker";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";

startSyncEngine();
startBackgroundTracking();

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
