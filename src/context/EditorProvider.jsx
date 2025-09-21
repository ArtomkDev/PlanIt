import React, { createContext, useContext, useState, useCallback } from "react";

const EditorContext = createContext(null);

export const EditorProvider = ({ children }) => {
  const [isEditing, setIsEditing] = useState(false);

  const toggleEditing = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const value = {
    isEditing,
    toggleEditing,
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
