package dk.meploy.fitnessapp;

import android.content.res.Configuration;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.util.WebColor;

/**
 * Colours the window behind the WebView in the app's own theme.
 *
 * On WebViews without edge-to-edge safe-area support, Capacitor insets the WebView from the
 * status and navigation bars, so the bars sit on the window background instead of the page.
 * The app theme is chosen in the app (not by the OS), so the window must follow it from JS.
 */
@CapacitorPlugin(name = "AppWindow")
public class AppWindowPlugin extends Plugin {

    private Integer backgroundColor;

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        String color = call.getString("color");
        if (color == null || color.isEmpty()) {
            call.reject("Missing color");
            return;
        }
        try {
            backgroundColor = WebColor.parseColor(color);
        } catch (IllegalArgumentException | StringIndexOutOfBoundsException e) {
            call.reject("Invalid color: " + color);
            return;
        }
        getActivity().runOnUiThread(() -> {
            applyBackground();
            call.resolve();
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        // Capacitor's SystemBars resets the background on configuration changes; restore it after.
        getActivity().getWindow().getDecorView().post(this::applyBackground);
    }

    private void applyBackground() {
        if (backgroundColor == null) {
            return;
        }
        View decorView = getActivity().getWindow().getDecorView();
        decorView.setBackgroundColor(backgroundColor);
    }
}
