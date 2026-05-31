package com.deteksimaling.app;

import android.util.Base64;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "FileWriter")
public class FileWriterPlugin extends Plugin {

    @PluginMethod
    public void writeBase64(PluginCall call) {
        String fileName = call.getString("fileName", "custom_ringtone.mp3");
        String base64Data = call.getString("data", "");

        try {
            // Hapus prefix data URL kalau ada
            // contoh: "data:audio/mp3;base64,XXXXXX"
            if (base64Data.contains(",")) {
                base64Data = base64Data.split(",")[1];
            }

            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            File file = new File(getContext().getFilesDir(), fileName);

            FileOutputStream fos = new FileOutputStream(file);
            fos.write(bytes);
            fos.close();

            Log.d("Securo", "FileWriter wrote: " + file.getAbsolutePath());

            JSObject result = new JSObject();
            result.put("path", file.getAbsolutePath());
            call.resolve(result);
        } catch (Exception e) {
            Log.e("Securo", "FileWriter failed: " + e.getMessage());
            call.reject("Failed to write file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPath(PluginCall call) {
        String fileName = call.getString("fileName", "custom_ringtone.mp3");
        File file = new File(getContext().getFilesDir(), fileName);

        JSObject result = new JSObject();
        result.put("path", file.exists() ? file.getAbsolutePath() : null);
        result.put("exists", file.exists());
        call.resolve(result);
    }
}