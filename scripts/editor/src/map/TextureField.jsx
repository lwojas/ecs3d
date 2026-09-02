import React, { useId } from "react";
import { editorAssets } from "../data/editorAssets.js";

// Free-text texture-key input with a datalist of known keys (from
// editorAssets.js) plus a live thumbnail -- not a rigid dropdown, since
// new textures will show up before the editor's lookup knows about them.
export default function TextureField({ value, onChange }) {
  const listId = useId();
  const previewUrl = value && editorAssets[value];

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
        {Object.keys(editorAssets).map((key) => (
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
