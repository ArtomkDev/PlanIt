import React, { createContext, useContext, useState, useCallback } from "react";

const EditorContext = createContext(null);

export const EditorProvider = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false);

  // 🔹 ТУТ зберігаємо всі кольори, градієнти і т.п.
  const [scheduleDraft, setScheduleDraft] = useState({
    gradients: [], // тут масив градієнтів
    colors: [],    // можеш додати, якщо треба
  });

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const value = {
    isEditing,
    toggleEditing,

    // 👇 тепер ці значення реально доступні
    scheduleDraft,
    setScheduleDraft,
  };

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditor = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
};
 