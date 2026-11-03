import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
  'messaging/invalid-argument',
]);

export const syncScheduleWidgets = onDocumentWritten({
  document: 'users/{userId}/schedules/{scheduleId}',
  region: 'europe-west1',
  memory: '256MiB',
  timeoutSeconds: 60,
  retry: true,
}, async (event) => {
  const { userId, scheduleId } = event.params;
  const db = getFirestore();
  if ((await db.doc(`deleted_accounts/${userId}`).get()).exists) return;

  const devices = await db.collection(`users/${userId}/devices`)
    .where('status', '==', 'active').get();
  const targets = devices.docs.filter((snapshot) => {
    const device = snapshot.data();
    return typeof device.platform === 'string' && device.platform.toLowerCase() === 'android'
      && device.widgetScheduleId === scheduleId
      && typeof device.widgetPushToken === 'string' && device.widgetPushToken.length > 0;
  });
  const after = event.data?.after.data();
  const before = event.data?.before.data();
  const version = Number(after?.version) || (Number(before?.version) || 0) + 1;
  for (let offset = 0; offset < targets.length; offset += 500) {
    const batch = targets.slice(offset, offset + 500);
    const result = await getMessaging().sendEach(batch.map((snapshot) => ({
      token: snapshot.data().widgetPushToken,
      data: { type: 'widget_schedule_changed', userId, scheduleId, version: String(version) },
      // Silent cache invalidations use normal priority; high priority is for visible alerts.
      android: { priority: 'normal', collapseKey: 'planit-widget-sync', ttl: 60 * 60 * 1000 },
    })));
    let transientError;
    await Promise.all(result.responses.map(async (response, index) => {
      if (response.success) return;
      if (!INVALID_TOKEN_CODES.has(response.error?.code)) {
        transientError = response.error || new Error('Widget push delivery failed.');
        return;
      }
      const target = batch[index];
      await db.runTransaction(async (transaction) => {
        const current = await transaction.get(target.ref);
        if (current.data()?.widgetPushToken !== target.data().widgetPushToken) return;
        transaction.update(target.ref, { widgetPushToken: FieldValue.delete() });
      });
    }));
    if (transientError) throw transientError;
  }
});
