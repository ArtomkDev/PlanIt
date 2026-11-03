package __PACKAGE__.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;

import com.reactnativeandroidwidget.RNWidgetUtil;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.text.SimpleDateFormat;

import __PACKAGE__.R;
import __PACKAGE__.BuildConfig;

public final class ScheduleWidgetRenderer {
    private static final String PREFS = "schedule_widget_presentation";
    private static final String LAST_MODEL = "last_model";
    private static final String DAY_MODELS = "day_models";
    private static final String DATE_OFFSET = "date_offset";
    private static final String CACHE_GENERATION = "cache_generation";
    private static String cachedDaysJson;
    private static JSONObject cachedDayModels;

    private ScheduleWidgetRenderer() {}

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static synchronized int getDateOffset(Context context, int legacyOffset) {
        SharedPreferences prefs = preferences(context);
        if (!prefs.contains(DATE_OFFSET)) prefs.edit().putInt(DATE_OFFSET, legacyOffset).apply();
        return prefs.getInt(DATE_OFFSET, 0);
    }

    public static int getCacheGeneration(Context context) {
        return preferences(context).getInt(CACHE_GENERATION, 0);
    }

    public static synchronized int updateDateOffset(Context context, String action) {
        int current = getDateOffset(context, 0);
        int next = "TODAY".equals(action) ? 0
            : "PREV_DAY".equals(action) ? current - 1
            : "NEXT_DAY".equals(action) ? current + 1 : current;
        preferences(context).edit().putInt(DATE_OFFSET, next).apply();
        return next;
    }

    public static synchronized void update(Context context, int widgetId, String serialized) throws JSONException {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager.getAppWidgetInfo(widgetId) == null) return;

        JSONObject model = new JSONObject(serialized);
        if (model.has("cacheGeneration") && model.optInt("cacheGeneration") != getCacheGeneration(context)) return;
        JSONObject days = model.optJSONObject("dayModels");
        if (days != null) {
            cachedDayModels = days;
            cachedDaysJson = days.toString();
            preferences(context).edit()
                .putString(DAY_MODELS, cachedDaysJson)
                .putString("base_date", model.optString("baseDate"))
                .putInt("utc_offset_minutes", model.optInt("utcOffsetMinutes"))
                .putLong("cache_expires_at", model.optLong("cacheExpiresAt"))
                .apply();
            int offset = getDateOffset(context, model.optInt("dateOffset"));
            JSONObject selected = readCachedDay(context, offset);
            if (selected != null) model = selected;
            else if (offset != model.optInt("dateOffset")) return;
        }
        model.remove("dayModels");
        storeAndRender(context, manager, widgetId, model);
    }

    private static void storeAndRender(Context context, AppWidgetManager manager, int widgetId, JSONObject model) {
        String serialized = model.toString();
        preferences(context).edit()
            .putString(String.valueOf(widgetId), serialized)
            .putString(LAST_MODEL, serialized)
            .apply();
        render(context, manager, widgetId, model);
    }

    private static JSONObject readCachedDay(Context context, int offset) {
        SharedPreferences prefs = preferences(context);
        long now = System.currentTimeMillis();
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
        if (now >= prefs.getLong("cache_expires_at", 0)
            || !today.equals(prefs.getString("base_date", ""))
            || TimeZone.getDefault().getOffset(now) / 60_000 != prefs.getInt("utc_offset_minutes", 0)) return null;
        String serialized = prefs.getString(DAY_MODELS, null);
        if (serialized == null) return null;
        if (!serialized.equals(cachedDaysJson) || cachedDayModels == null) {
            try {
                cachedDayModels = new JSONObject(serialized);
                cachedDaysJson = serialized;
            } catch (JSONException error) {
                prefs.edit().remove(DAY_MODELS).apply();
                return null;
            }
        }
        return cachedDayModels.optJSONObject(String.valueOf(offset));
    }

    public static synchronized boolean navigate(Context context, String action) {
        int offset = updateDateOffset(context, action);
        JSONObject model = readCachedDay(context, offset);
        if (model == null) return false;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (int id : RNWidgetUtil.getWidgetIds(context, "ScheduleWidget")) {
            storeAndRender(context, manager, id, model);
        }
        // Refill before the user reaches the edge; the current tap is already rendered.
        return cachedDayModels.has(String.valueOf(offset - 3))
            && cachedDayModels.has(String.valueOf(offset + 3));
    }

    public static JSONObject readModel(Context context, int widgetId) {
        SharedPreferences prefs = preferences(context);
        String serialized = prefs.getString(String.valueOf(widgetId), null);
        if (serialized == null) serialized = prefs.getString(LAST_MODEL, null);
        if (serialized == null) return null;
        try {
            return new JSONObject(serialized);
        } catch (JSONException error) {
            prefs.edit().remove(String.valueOf(widgetId)).remove(LAST_MODEL).apply();
            return null;
        }
    }

    public static void renderCached(Context context, AppWidgetManager manager, int widgetId) {
        JSONObject model = readModel(context, widgetId);
        if (model != null) render(context, manager, widgetId, model);
    }

    public static void resizeIfNeeded(Context context, AppWidgetManager manager, int widgetId) {
        String key = widgetId + "_compact";
        SharedPreferences prefs = preferences(context);
        if (prefs.contains(key) && prefs.getBoolean(key, false) == isCompact(context, widgetId)) return;
        renderCached(context, manager, widgetId);
    }

    public static void remove(Context context, int[] widgetIds) {
        SharedPreferences.Editor editor = preferences(context).edit();
        for (int widgetId : widgetIds) {
            editor.remove(String.valueOf(widgetId)).remove(widgetId + "_compact");
        }
        editor.apply();
    }

    public static synchronized void clearCache(Context context) {
        int generation = getCacheGeneration(context) + 1;
        preferences(context).edit().clear().putInt(CACHE_GENERATION, generation).apply();
        cachedDaysJson = null;
        cachedDayModels = null;
    }

    private static void render(Context context, AppWidgetManager manager, int widgetId, JSONObject model) {
        RemoteViews views;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // The launcher chooses and lays out these views without waking JS during a resize.
            Map<SizeF, RemoteViews> sizes = new LinkedHashMap<>();
            sizes.put(new SizeF(150, 110), buildViews(context, widgetId, model, true));
            sizes.put(new SizeF(220, 200), buildViews(context, widgetId, model, false));
            views = new RemoteViews(sizes);
        } else {
            boolean compact = isCompact(context, widgetId);
            views = buildViews(context, widgetId, model, compact);
            preferences(context).edit().putBoolean(widgetId + "_compact", compact).apply();
        }
        manager.updateAppWidget(widgetId, views);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            manager.notifyAppWidgetViewDataChanged(widgetId, R.id.planit_widget_list);
        }
    }

    private static boolean isCompact(Context context, int widgetId) {
        return RNWidgetUtil.getWidgetWidth(context, widgetId) < 220
            || RNWidgetUtil.getWidgetHeight(context, widgetId) < 200;
    }

    private static RemoteViews buildViews(Context context, int widgetId, JSONObject model, boolean compact) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.planit_schedule_widget);
        JSONObject labels = model.optJSONObject("labels");
        boolean hasSchedule = model.optBoolean("hasSchedule");
        JSONArray items = model.optJSONArray("items");
        int count = items == null ? 0 : items.length();
        int padding = dp(context, compact ? 4 : 16);
        views.setViewPadding(R.id.planit_widget_root, padding, padding, padding, padding);
        views.setViewPadding(R.id.planit_widget_header, 0, 0, 0, dp(context, compact ? 0 : 12));
        views.setViewPadding(R.id.planit_widget_navigation, 0, dp(context, compact ? 0 : 8), 0, 0);
        views.setViewVisibility(R.id.planit_widget_loading, View.GONE);
        views.setViewVisibility(R.id.planit_widget_header, hasSchedule ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.planit_widget_navigation, hasSchedule ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.planit_widget_list, hasSchedule && count > 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.planit_widget_empty, !hasSchedule || count == 0 ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.planit_widget_choose, hasSchedule ? View.GONE : View.VISIBLE);
        views.setTextViewText(R.id.planit_widget_empty_text, label(labels, hasSchedule ? "noClasses" : "chooseSchedule"));
        views.setTextViewText(R.id.planit_widget_choose, label(labels, "openSettings"));
        views.setOnClickPendingIntent(R.id.planit_widget_choose, click(context, widgetId, "OPEN_SCHEDULE_SELECTOR"));
        views.setTextViewText(R.id.planit_widget_title, model.optString("headerText"));
        views.setTextViewTextSize(R.id.planit_widget_title, TypedValue.COMPLEX_UNIT_SP, compact ? 16 : 20);
        views.setTextViewText(R.id.planit_widget_date, model.optString("dateInfo"));
        views.setViewVisibility(R.id.planit_widget_date, compact ? View.GONE : View.VISIBLE);
        views.setContentDescription(R.id.planit_widget_title,
            model.optString("headerText") + ", " + model.optString("dateInfo"));
        views.setContentDescription(R.id.planit_widget_selector, label(labels, "openSettings"));
        views.setOnClickPendingIntent(R.id.planit_widget_selector, click(context, widgetId, "OPEN_SCHEDULE_SELECTOR"));
        views.setTextViewText(R.id.planit_widget_today, label(labels, "today"));
        views.setTextColor(R.id.planit_widget_today, Color.parseColor(model.optBoolean("isTodayActive") ? "#8E8E93" : "#FFFFFF"));
        views.setOnClickPendingIntent(R.id.planit_widget_previous, click(context, widgetId, "PREV_DAY"));
        views.setOnClickPendingIntent(R.id.planit_widget_next, click(context, widgetId, "NEXT_DAY"));
        views.setOnClickPendingIntent(R.id.planit_widget_today,
            model.optBoolean("isTodayActive") ? null : click(context, widgetId, "TODAY"));
        views.setContentDescription(R.id.planit_widget_previous, label(labels, "previous"));
        views.setContentDescription(R.id.planit_widget_next, label(labels, "next"));
        views.setTextViewTextSize(R.id.planit_widget_previous, TypedValue.COMPLEX_UNIT_SP, compact ? 18 : 24);
        views.setTextViewTextSize(R.id.planit_widget_next, TypedValue.COMPLEX_UNIT_SP, compact ? 18 : 24);
        views.setInt(R.id.planit_widget_selector, "setMinimumHeight", dp(context, compact ? 32 : 44));

        views.setPendingIntentTemplate(R.id.planit_widget_list, collectionClick(context, widgetId));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            RemoteViews.RemoteCollectionItems.Builder collection = new RemoteViews.RemoteCollectionItems.Builder()
                .setHasStableIds(true).setViewTypeCount(1);
            for (int index = 0; index < count; index++) {
                JSONObject item = items.optJSONObject(index);
                if (item != null) collection.addItem(index, buildRow(context, model, item, compact));
            }
            views.setRemoteAdapter(R.id.planit_widget_list, collection.build());
        } else {
            Intent adapter = new Intent(context, ScheduleWidgetListService.class)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)
                .putExtra("compact", compact);
            adapter.setData(Uri.parse("planit-widget://list/" + widgetId + "/" + compact));
            views.setRemoteAdapter(R.id.planit_widget_list, adapter);
        }
        return views;
    }

    static RemoteViews buildRow(Context context, JSONObject model, JSONObject item, boolean compact) {
        RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.planit_schedule_widget_row);
        boolean lesson = "lesson".equals(item.optString("type"));
        boolean current = item.optBoolean("isCurrent");
        int color = parseColor(item.optString("color"));
        row.setInt(R.id.planit_widget_row, "setBackgroundColor",
            Color.parseColor(current ? "#2C2C2E" : lesson ? "#1C1C1E" : "#121214"));
        row.setInt(R.id.planit_widget_strip, "setBackgroundColor", lesson || current ? color : Color.parseColor("#48484A"));
        row.setViewPadding(R.id.planit_widget_row_content, dp(context, 12), dp(context, compact ? 2 : 12), dp(context, 12), dp(context, compact ? 2 : 12));
        row.setTextViewText(R.id.planit_widget_row_title, item.optString("title"));
        row.setTextViewTextSize(R.id.planit_widget_row_title, TypedValue.COMPLEX_UNIT_SP, compact ? 12 : 15);
        row.setTextColor(R.id.planit_widget_row_title, Color.parseColor(lesson || current ? "#FFFFFF" : "#8E8E93"));
        row.setTextViewText(R.id.planit_widget_row_subtitle, item.optString("subtitle"));
        row.setTextViewTextSize(R.id.planit_widget_row_subtitle, TypedValue.COMPLEX_UNIT_SP, compact ? 10 : 12);
        row.setViewVisibility(R.id.planit_widget_now, current && lesson && !compact ? View.VISIBLE : View.GONE);
        row.setTextViewText(R.id.planit_widget_now, label(model.optJSONObject("labels"), "now"));
        row.setContentDescription(R.id.planit_widget_row, item.optString("title") + ", "
            + item.optString("subtitle") + (current ? ", " + label(model.optJSONObject("labels"), "now") : ""));
        if (lesson) {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("scheduleId", model.optString("scheduleId"));
            data.put("targetDateStr", model.optString("targetDateIso"));
            data.put("lessonIndex", item.optInt("lessonIndex"));
            Uri uri = new Uri.Builder().scheme("planit").authority("widget").path("/lesson")
                .appendQueryParameter("lessonViewIntent", new JSONObject(data).toString()).build();
            row.setOnClickFillInIntent(R.id.planit_widget_row,
                new Intent().setData(uri));
        } else {
            // Recycled list rows must not retain a lesson's click intent.
            row.setOnClickFillInIntent(R.id.planit_widget_row, null);
        }
        return row;
    }

    private static PendingIntent click(Context context, int widgetId, String action) {
        Intent intent = clickIntent(context, widgetId)
            .setData(Uri.parse("planit-widget://click/" + widgetId + "/" + action))
            .putExtra("clickAction", action)
            .putExtra("clickActionData", new Bundle());
        return PendingIntent.getBroadcast(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent collectionClick(Context context, int widgetId) {
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setComponent(new ComponentName(context.getPackageName(), context.getPackageName()
                + (BuildConfig.DEBUG ? ".widget.WidgetLaunchActivity" : ".MainActivity")))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getActivity(context, widgetId, intent, flags);
    }

    private static Intent clickIntent(Context context, int widgetId) {
        return new Intent(context.getPackageName() + ".WIDGET_CLICK")
            .setComponent(new ComponentName(context, ScheduleWidget.class))
            .putExtra("widgetId", widgetId);
    }

    private static String label(JSONObject labels, String key) {
        return labels == null ? "" : labels.optString(key);
    }

    private static int parseColor(String color) {
        try {
            return Color.parseColor(color);
        } catch (IllegalArgumentException error) {
            return Color.parseColor("#0A84FF");
        }
    }

    private static int dp(Context context, int value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }
}
