package __PACKAGE__.widget;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class ScheduleWidgetModule extends ReactContextBaseJavaModule {
    public ScheduleWidgetModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "ScheduleWidget";
    }

    @ReactMethod
    public void getNavigationState(double legacyOffset, Promise promise) {
        WritableMap state = Arguments.createMap();
        state.putInt("dateOffset", ScheduleWidgetRenderer.getDateOffset(getReactApplicationContext(), (int) legacyOffset));
        state.putInt("cacheGeneration", ScheduleWidgetRenderer.getCacheGeneration(getReactApplicationContext()));
        promise.resolve(state);
    }

    @ReactMethod
    public void updateDateOffset(String action, Promise promise) {
        promise.resolve(ScheduleWidgetRenderer.updateDateOffset(getReactApplicationContext(), action));
    }

    @ReactMethod
    public void clearCache(Promise promise) {
        ScheduleWidgetRenderer.clearCache(getReactApplicationContext());
        promise.resolve(null);
    }

    @ReactMethod
    public void render(double widgetId, String model, Promise promise) {
        try {
            ScheduleWidgetRenderer.update(getReactApplicationContext(), (int) widgetId, model);
            promise.resolve(null);
        } catch (Exception error) {
            promise.reject("WIDGET_RENDER_FAILED", error);
        }
    }
}
