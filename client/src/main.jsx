import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { registerModelCacheServiceWorker } from "./lib/serviceWorker.js";
import "./styles.css";
import "./saas.css";

registerModelCacheServiceWorker();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
