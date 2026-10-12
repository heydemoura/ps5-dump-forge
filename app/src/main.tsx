import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { initLang } from "./i18n";
import "./styles.css";

// The UI's language loads first (its own chunk); every screen reads it synchronously.
void initLang().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
