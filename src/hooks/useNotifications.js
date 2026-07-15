import { useEffect, useMemo, useState } from "react";

import { subscribeToNotifications } from "../services/notificationService";

export default function useNotifications({ userId, enabled = true } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled && userId));

  useEffect(() => {
    if (!enabled || !userId) {
      setNotifications([]);
      setLoading(false);
      return () => {};
    }

    let isMounted = true;
    setLoading(true);

    const unsubscribe = subscribeToNotifications(userId, (items) => {
      if (!isMounted) return;
      setNotifications(items);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [enabled, userId]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt),
    [notifications]
  );

  return {
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    loading,
  };
}
