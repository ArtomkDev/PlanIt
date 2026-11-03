package __PACKAGE__.widget;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;

import expo.modules.devlauncher.DevLauncherController;

import kotlin.Unit;

public final class WidgetLaunchActivity extends Activity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent lesson = new Intent(getIntent())
            .setComponent(new ComponentName(this, __PACKAGE__.MainActivity.class));
        DevLauncherController controller = DevLauncherController.getInstance();
        if (controller.getMode() == DevLauncherController.Mode.APP) {
            startActivity(lesson);
            finish();
            return;
        }

        // Queue the deep link before asking Expo to load the last connected project.
        controller.handleIntent(lesson, null);
        Intent launch = new Intent(this, __PACKAGE__.MainActivity.class)
            .setAction(Intent.ACTION_MAIN).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Runnable openProject = () -> {
            if (isFinishing() || isDestroyed()) return;
            startActivity(launch);
            finish();
        };
        if (controller.getAppHost().getCurrentReactContext() == null) {
            openProject.run();
        } else {
            // Headless widgets may have started React before Expo's activity loader.
            controller.getAppHost().destroy("Opening widget lesson in development client", null, success -> {
                runOnUiThread(openProject);
                return Unit.INSTANCE;
            });
        }
    }
}
