import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { EditorAssetsProvider } from "./EditorAssetsContext.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <EditorAssetsProvider>
    <App />
  </EditorAssetsProvider>,
);
