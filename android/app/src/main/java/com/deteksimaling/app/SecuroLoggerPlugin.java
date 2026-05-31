package com.deteksimaling.app;

import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "SecuroLogger")
public class SecuroLoggerPlugin extends Plugin {

    @PluginMethod
    public void log(PluginCall call) {
        String message = call.getString("message", "");
        String level = call.getString("level", "d");

        switch (level) {
            case "e":
                Log.e("Securo", message);
                break;
            case "w":
                Log.w("Securo", message);
                break;
            case "i":
                Log.i("Securo", message);
                break;
            default:
                Log.d("Securo", message);
                break;
        }

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }
}
