import { useCallback, useState } from "react";
import { listDocuments, loadDocument, saveDocument } from "../io/api.js";

// Load/save/dirty-tracking for one editable JSON document (a map or an
// entity list). The document body itself is opaque to this hook -- it
// only owns "what file is this, has it changed, is it saved" so the map
// and entity views don't each reimplement that bookkeeping.
export function useDocument(type, createEmpty) {
  const [fileName, setFileName] = useState(null);
  const [data, setData] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [error, setError] = useState(null);

  const refreshList = useCallback(async () => {
    try {
      setFileList(await listDocuments(type));
    } catch (err) {
      setError(err.message);
    }
  }, [type]);

  const load = useCallback(
    async (name) => {
      try {
        const loaded = await loadDocument(type, name);
        setFileName(name);
        setData(loaded);
        setDirty(false);
        setError(null);
      } catch (err) {
        setError(err.message);
      }
    },
    [type],
  );

  const createNew = useCallback(
    (name) => {
      setFileName(name);
      setData(createEmpty());
      setDirty(true);
      setError(null);
    },
    [createEmpty],
  );

  const save = useCallback(
    async (asName) => {
      const name = asName || fileName;
      if (!name) {
        setError("Enter a file name before saving.");
        return;
      }
      try {
        await saveDocument(type, name, data);
        setFileName(name);
        setDirty(false);
        setError(null);
        refreshList();
      } catch (err) {
        setError(err.message);
      }
    },
    [type, fileName, data, refreshList],
  );

  // updater: (prevData) => nextData -- same shape as React's setState
  // updater, so every panel just calls doc.update(prev => ({ ...prev, ... })).
  const update = useCallback((updater) => {
    setData((prev) => updater(prev));
    setDirty(true);
  }, []);

  return {
    fileName,
    data,
    dirty,
    error,
    fileList,
    refreshList,
    load,
    createNew,
    save,
    update,
  };
}
