const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withFinalizedMod,
  withMainApplication,
} = require('@expo/config-plugins');

const PERMISSIONS = [
  { name: 'android.permission.RECEIVE_BOOT_COMPLETED' },
  { name: 'android.permission.SCHEDULE_EXACT_ALARM', maxSdkVersion: '32' },
  { name: 'android.permission.USE_EXACT_ALARM' },
];

const SYSTEM_REFRESH_ACTIONS = [
  'android.intent.action.BOOT_COMPLETED',
  'android.intent.action.DATE_CHANGED',
  'android.intent.action.MY_PACKAGE_REPLACED',
  'android.intent.action.TIME_SET',
  'android.intent.action.TIMEZONE_CHANGED',
];

const coreProviderSource = (packageName) => `package ${packageName}.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import com.reactnativeandroidwidget.RNWidgetJsCommunication;
import com.reactnativeandroidwidget.RNWidgetProvider;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class CoreWidgetProvider extends RNWidgetProvider {
    private static final Set<String> CLOCK_ACTIONS = new HashSet<>(Arrays.asList(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_DATE_CHANGED,
        Intent.ACTION_MY_PACKAGE_REPLACED,
        Intent.ACTION_TIME_CHANGED,
        Intent.ACTION_TIMEZONE_CHANGED
    ));

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String widgetName = getClass().getSimpleName();

        if (WidgetUpdateScheduler.ACTION_REFRESH.equals(action)) {
            WidgetUpdateScheduler.markTriggered(context, widgetName);
            RNWidgetJsCommunication.requestWidgetUpdate(context, widgetName);
            return;
        }

        super.onReceive(context, intent);
        if (CLOCK_ACTIONS.contains(action)) {
            RNWidgetJsCommunication.requestWidgetUpdate(context, widgetName);
        }
    }

    @Override
    public void onDeleted(Context context, int[] appWidgetIds) {
        super.onDeleted(context, appWidgetIds);
        int[] remainingIds = AppWidgetManager.getInstance(context).getAppWidgetIds(
            new ComponentName(context, getClass())
        );
        if (remainingIds.length == 0) {
            WidgetUpdateScheduler.cancel(context, getClass().getSimpleName());
        }
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        WidgetUpdateScheduler.cancel(context, getClass().getSimpleName());
    }
}
`;

const schedulerSource = (packageName) => `package ${packageName}.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public final class WidgetUpdateScheduler {
    public static final String ACTION_REFRESH = "${packageName}.SCHEDULE_WIDGET_REFRESH";
    private static final String PREFS = "widget_update_scheduler";
    private static final String KEY_PREFIX = "scheduled_at_";

    private WidgetUpdateScheduler() {}

    private static PendingIntent pendingIntent(Context context, String widgetName) {
        try {
            Class<?> providerClass = Class.forName(
                context.getPackageName() + ".widget." + widgetName
            );
            Intent intent = new Intent(context, providerClass)
                .setAction(ACTION_REFRESH)
                .putExtra("widgetName", widgetName);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            return PendingIntent.getBroadcast(context, widgetName.hashCode(), intent, flags);
        } catch (ClassNotFoundException error) {
            return null;
        }
    }

    public static synchronized void schedule(
        Context context,
        String widgetName,
        long requestedAtMillis
    ) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pendingIntent = pendingIntent(context, widgetName);
        if (alarmManager == null || pendingIntent == null) return;

        long triggerAtMillis = Math.max(requestedAtMillis, System.currentTimeMillis() + 1_000L);
        alarmManager.cancel(pendingIntent);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                );
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                );
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (SecurityException error) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                );
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_PREFIX + widgetName, triggerAtMillis)
            .apply();
    }

    public static synchronized void cancel(Context context, String widgetName) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pendingIntent = pendingIntent(context, widgetName);
        if (alarmManager != null && pendingIntent != null) {
            alarmManager.cancel(pendingIntent);
            pendingIntent.cancel();
        }
        markTriggered(context, widgetName);
    }

    public static void markTriggered(Context context, String widgetName) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        preferences.edit().remove(KEY_PREFIX + widgetName).apply();
    }
}
`;

const moduleSource = (packageName) => `package ${packageName}.widget;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class WidgetUpdateSchedulerModule extends ReactContextBaseJavaModule {
    public WidgetUpdateSchedulerModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "WidgetUpdateScheduler";
    }

    @ReactMethod
    public void schedule(String widgetName, double triggerAtMillis) {
        WidgetUpdateScheduler.schedule(
            getReactApplicationContext(),
            widgetName,
            (long) triggerAtMillis
        );
    }

    @ReactMethod
    public void cancel(String widgetName) {
        WidgetUpdateScheduler.cancel(getReactApplicationContext(), widgetName);
    }
}
`;

const packageSource = (packageName) => `package ${packageName}.widget;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

public class WidgetUpdateSchedulerPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        return Collections.singletonList(new WidgetUpdateSchedulerModule(context));
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        return Collections.emptyList();
    }
}
`;

const addUnique = (list, value, selector) => {
  if (!list.some((item) => selector(item) === value)) list.push(value);
};

const withWidgetUpdateScheduler = (config) => {
  const packageName = config.android?.package;
  if (!packageName) throw new Error('android.package is required for the widget scheduler');

  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    PERMISSIONS.forEach(({ name, maxSdkVersion }) => {
      const existing = manifest['uses-permission'].find(
        (entry) => entry.$?.['android:name'] === name,
      );
      const permission = existing || { $: { 'android:name': name } };
      if (maxSdkVersion) {
        permission.$['android:maxSdkVersion'] = maxSdkVersion;
      }
      if (!existing) manifest['uses-permission'].push(permission);
    });

    const application = manifest.application?.[0];
    const receiver = application?.receiver?.find(
      (entry) => entry.$?.['android:name']?.endsWith('.widget.ScheduleWidget'),
    );
    if (receiver) {
      receiver['intent-filter'] = receiver['intent-filter'] || [{ action: [] }];
      const intentFilter = receiver['intent-filter'][0];
      intentFilter.action = intentFilter.action || [];
      [...SYSTEM_REFRESH_ACTIONS, `${packageName}.SCHEDULE_WIDGET_REFRESH`].forEach((action) => {
        addUnique(intentFilter.action, action, (entry) => entry.$?.['android:name']);
      });
    }
    return manifestConfig;
  });

  config = withMainApplication(config, (mainApplicationConfig) => {
    let source = mainApplicationConfig.modResults.contents;
    const importLine = `import ${packageName}.widget.WidgetUpdateSchedulerPackage`;
    if (!source.includes(importLine)) {
      source = source.replace(/(package\s+[^\r\n]+\r?\n)/, `$1\n${importLine}\n`);
    }
    if (!source.includes('add(WidgetUpdateSchedulerPackage())')) {
      source = source.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        '$1\n              add(WidgetUpdateSchedulerPackage())',
      );
    }
    mainApplicationConfig.modResults.contents = source;
    return mainApplicationConfig;
  });

  config = withFinalizedMod(config, ['android', (finalizedConfig) => {
    const projectRoot = finalizedConfig.modRequest.platformProjectRoot;
    const sourceDir = path.join(
      projectRoot,
      'app',
      'src',
      'main',
      'java',
      ...packageName.split('.'),
      'widget',
    );
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'CoreWidgetProvider.java'), coreProviderSource(packageName));
    fs.writeFileSync(path.join(sourceDir, 'WidgetUpdateScheduler.java'), schedulerSource(packageName));
    fs.writeFileSync(path.join(sourceDir, 'WidgetUpdateSchedulerModule.java'), moduleSource(packageName));
    fs.writeFileSync(path.join(sourceDir, 'WidgetUpdateSchedulerPackage.java'), packageSource(packageName));

    const providerPath = path.join(sourceDir, 'ScheduleWidget.java');
    if (!fs.existsSync(providerPath)) {
      throw new Error('ScheduleWidget.java was not generated before the scheduler plugin ran');
    }
    const provider = fs.readFileSync(providerPath, 'utf8')
      .replace(/import com\.reactnativeandroidwidget\.RNWidgetProvider;\r?\n\r?\n/, '')
      .replace('extends RNWidgetProvider', 'extends CoreWidgetProvider');
    fs.writeFileSync(providerPath, provider);

    return finalizedConfig;
  }]);

  return config;
};

module.exports = withWidgetUpdateScheduler;
