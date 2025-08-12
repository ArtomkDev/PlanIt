// AppContext.js
import React, { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [schedule, setSchedule] = useState(null);
  const [authUser, setAuthUser] = useState(null);

  const onDataChange = (data) => {
    console.log("Data updated", data);
    setSchedule(data);
  };

  return (
    <AppContext.Provider value={{ schedule, setSchedule, authUser, setAuthUser, onDataChange }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
