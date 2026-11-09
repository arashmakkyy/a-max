import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App, { readSurface } from "./App";

// Surface-aware CSS hooks: the popup is a fixed 400x600 card, the tabbed
// surfaces fill the whole viewport.
document.documentElement.dataset.surface = readSurface();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
