package __PACKAGE__.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

public class ScheduleWidgetListService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Factory(getApplicationContext(), intent);
    }

    private static class Factory implements RemoteViewsFactory {
        private final Context context;
        private final int widgetId;
        private final boolean compact;
        private JSONObject model;
        private JSONArray items = new JSONArray();

        Factory(Context context, Intent intent) {
            this.context = context;
            widgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
            compact = intent.getBooleanExtra("compact", false);
        }

        @Override
        public void onCreate() { onDataSetChanged(); }

        @Override
        public void onDataSetChanged() {
            model = ScheduleWidgetRenderer.readModel(context, widgetId);
            JSONArray next = model == null ? null : model.optJSONArray("items");
            items = next == null ? new JSONArray() : next;
        }

        @Override
        public RemoteViews getViewAt(int position) {
            JSONObject item = items.optJSONObject(position);
            return item == null ? null : ScheduleWidgetRenderer.buildRow(context, model, item, compact);
        }

        @Override
        public int getCount() { return items.length(); }

        @Override
        public long getItemId(int position) { return position; }

        @Override
        public int getViewTypeCount() { return 1; }

        @Override
        public boolean hasStableIds() { return true; }

        @Override
        public RemoteViews getLoadingView() { return null; }

        @Override
        public void onDestroy() {}
    }
}
