package dk.meploy.fitnessapp;

import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppWindowPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // fontScale is in the manifest's configChanges, so a system font-size change keeps the page
        // (route, open sheet, unsaved input) instead of recreating the activity and reloading it.
        // The WebView reads the font scale only when it's created; pass the new one on the same way.
        if (bridge != null) {
            bridge.getWebView().getSettings().setTextZoom((int) (100 * newConfig.fontScale));
        }
    }
}
