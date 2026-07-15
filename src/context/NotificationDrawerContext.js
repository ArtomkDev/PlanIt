import React, { createContext, useContext } from "react";

const NotificationDrawerContext = createContext({
  isNotificationsOpen: false,
  openNotifications: () => {},
  closeNotifications: () => {},
  drawerProgress: null,
  drawerContentInset: 0,
});

export function NotificationDrawerProvider({ value, children }) {
  return (
    <NotificationDrawerContext.Provider value={value}>
      {children}
    </NotificationDrawerContext.Provider>
  );
}

export const useNotificationDrawer = () => useContext(NotificationDrawerContext);
