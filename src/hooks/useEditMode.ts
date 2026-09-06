import { useState, useCallback } from "react";

const EDIT_MODE_KEY = "shopier-edit-mode";

export function useEditMode() {
  const [editMode, setEditMode] = useState(() => localStorage.getItem(EDIT_MODE_KEY) === "true");

  const toggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      localStorage.setItem(EDIT_MODE_KEY, String(next));
      return next;
    });
  }, []);

  return { editMode, toggleEditMode };
}
