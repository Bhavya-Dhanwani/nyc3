import React from "react";
import { createRoot } from "react-dom/client";
import AppRoot from "./AppRoot.jsx";
import { registerModelCacheServiceWorker } from "./lib/serviceWorker.js";
import "./styles.css";
import "./saas.css";
import "./landing.css";

registerModelCacheServiceWorker();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>,
);
