import React, { useId } from "react";
import { useEditorAssets } from "../EditorAssetsContext.jsx";

// Free-text texture-key input with a datalist of known keys plus a live
// thumbnail -- not a rigid dropdown, since maps may use new asset keys.
export default function TextureField({ value, onChange }) {
  const { assets } = useEditorAssets();
  const listId = useId();
  const previewUrl = value && assets[value];

  return (
    <label className="field inline texture-field">
      Texture
      <input
        list={listId}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="textureKey"
      />
      <datalist id={listId}>
        {Object.keys(assets).map((key) => (
          <option key={key} value={key} />
        ))}
      </datalist>
      {previewUrl ? (
        <img className="texture-preview" src={previewUrl} alt={value} />
      ) : (
        <span className="texture-preview empty" />
      )}
    </label>
  );
}
