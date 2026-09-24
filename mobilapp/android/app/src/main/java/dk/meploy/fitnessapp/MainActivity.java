package dk.meploy.fitnessapp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppWindowPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
