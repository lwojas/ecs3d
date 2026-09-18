import React, { createContext, useContext, useEffect, useState } from "react";
import { loadEditorAssets } from "../../api/assets/assetClient.js";

const EditorAssetsContext = createContext(null);

export function EditorAssetsProvider({ children }) {
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    loadEditorAssets()
      .then((loadedAssets) => {
        if (!cancelled) setAssets(loadedAssets);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <EditorAssetsContext.Provider value={{ assets, loading, error }}>
      {children}
    </EditorAssetsContext.Provider>
  );
}

export function useEditorAssets() {
  const context = useContext(EditorAssetsContext);
  if (!context) {
    throw new Error("useEditorAssets must be used inside EditorAssetsProvider");
  }
  return context;
}