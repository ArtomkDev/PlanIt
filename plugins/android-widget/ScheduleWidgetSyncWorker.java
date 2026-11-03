package __PACKAGE__.widget;

import android.content.Context;
import androidx.annotation.Keep;
import androidx.work.Data;
import androidx.work.WorkerParameters;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import com.reactnativeandroidwidget.RNWidgetBackgroundTaskWorker;
import com.reactnativeandroidwidget.RNWidgetUtil;

@Keep
public class ScheduleWidgetSyncWorker extends RNWidgetBackgroundTaskWorker {
    public ScheduleWidgetSyncWorker(Context context, WorkerParameters params) {
        super(context, params);
    }

    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Data input) {
        Context context = getApplicationContext();
        int[] ids = RNWidgetUtil.getWidgetIds(context, "ScheduleWidget");
        if (ids.length == 0) {
            WidgetUpdateScheduler.cancelCloudSync(context);
            return null;
        }
        return super.getTaskConfig(new Data.Builder()
            .putString("widgetName", "ScheduleWidget")
            .putInt("widgetId", ids[0])
            .putString("widgetAction", "WIDGET_SYNC")
            .build());
    }
}
