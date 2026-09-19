import React from "react";
import { createRoot } from "react-dom/client";
import { AppUiProvider } from "@canva/app-ui-kit";
import "@canva/app-ui-kit/styles.css";
import { KevinStory } from "./KevinStory.jsx";

const el = document.getElementById("kevin-storybook-root");
if (el) {
  createRoot(el).render(
    <AppUiProvider>
      <KevinStory />
    </AppUiProvider>
  );
}
