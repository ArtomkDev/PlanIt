import { useEffect, useRef, useState } from 'react';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppDialog } from '../context/AppDialogContext';
import { createSharedScheduleLink, deleteSharedSchedule, getSharedScheduleStatus } from '../services/shareService';
import { triggerHaptic } from '../utils/haptics';
import { t } from '../utils/i18n';

export default function useSharedScheduleActions({ userId, shareCode, lang, onDeleted }) {
  const dialog = useAppDialog();
  const [pending, setPending] = useState(null);
  const [copied, setCopied] = useState(null);
  const [error, setError] = useState(null);
  const scope = JSON.stringify([userId, shareCode]);
  const scopeRef = useRef(scope);
  const busyRef = useRef(false);
  const copyTimer = useRef(null);
  scopeRef.current = scope;

  useEffect(() => {
    scopeRef.current = scope;
    busyRef.current = false;
    setPending(null);
    setCopied(null);
    setError(null);
    return () => { scopeRef.current = null; clearTimeout(copyTimer.current); };
  }, [scope]);

  const run = async (item, action) => {
    if (!userId || item.ownerId !== userId || scopeRef.current !== scope || busyRef.current) return;
    busyRef.current = true;
    setPending({ code: item.id, action });
    setError(null);
    const isCurrent = () => scopeRef.current === scope;
    try {
      if (action === 'delete') {
        const active = getSharedScheduleStatus(item) === 'active';
        const confirmed = await dialog.confirm({
          title: t(active ? 'share.deactivate_title' : 'share.manager_remove_title', lang),
          message: t(active ? 'share.deactivate_desc' : 'share.manager_remove_desc', lang),
          confirmLabel: t(active ? 'share.deactivate_btn' : 'share.manager_remove', lang), destructive: true,
        });
        if (!confirmed || !isCurrent()) return;
        await deleteSharedSchedule(item.id);
        if (isCurrent()) { onDeleted(item.id); triggerHaptic('success'); }
      } else {
        if (getSharedScheduleStatus(item) !== 'active') throw new Error('expired');
        const url = createSharedScheduleLink(item.id);
        if (action === 'share') {
          await Share.share({ message: `${item.scheduleName || t('share.open_title', lang)}: ${url}`, url });
        } else {
          const copied = await Clipboard.setStringAsync(action === 'code' ? item.id : url);
          if (copied === false) throw new Error('clipboard_unavailable');
          if (isCurrent()) {
            setCopied({ code: item.id, action });
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => { if (isCurrent()) setCopied(null); }, 2500);
            triggerHaptic('success');
          }
        }
      }
    } catch (failure) {
      if (action === 'share' && failure?.name === 'AbortError') return;
      if (isCurrent()) setError({ code: item.id, key: failure?.message === 'expired' ? 'share.error_expired'
        : action === 'delete' ? 'share.manager_revoke_failed' : action === 'share' ? 'share.manager_share_failed' : 'share.manager_copy_failed' });
    } finally {
      if (isCurrent()) { busyRef.current = false; setPending(null); }
    }
  };

  return {
    pending, copied, error,
    canShare: Platform.OS !== 'web' || (typeof navigator !== 'undefined' && typeof navigator.share === 'function'),
    copyLink: item => run(item, 'link'), copyCode: item => run(item, 'code'),
    shareLink: item => run(item, 'share'), remove: item => run(item, 'delete'),
  };
}
