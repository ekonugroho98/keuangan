package com.keluargaberkembang.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileExportPlugin.class);
        super.onCreate(savedInstanceState);

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
            insetsController.setAppearanceLightNavigationBars(true);
        }

        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new AndroidDownloadBridge(), "AndroidBridge");
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() == null || getBridge().getWebView() == null) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    return;
                }
                WebView webView = getBridge().getWebView();
                webView.evaluateJavascript(
                    "(window.__handleAndroidBack ? window.__handleAndroidBack() : 'exit')",
                    result -> {
                        if (result != null && result.contains("handled")) {
                            return;
                        }
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            moveTaskToBack(true);
                        }
                    }
                );
            }
        });
    }

    private void writeToDownloads(String base64Data, String filename, String mimeType) throws Exception {
        byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
        String safeMime = (mimeType != null && !mimeType.isEmpty())
            ? mimeType
            : "application/octet-stream";

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, safeMime);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri != null) {
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                    }
                }
            }
        } else {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (!dir.exists()) dir.mkdirs();
            File outFile = new File(dir, filename);
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(bytes);
                fos.flush();
            }
        }
        Toast.makeText(
            MainActivity.this,
            "Tersimpan di folder Download: " + filename,
            Toast.LENGTH_LONG
        ).show();
    }

    @CapacitorPlugin(name = "FileExport")
    public static class FileExportPlugin extends Plugin {
        @PluginMethod
        public void saveBase64File(PluginCall call) {
            String base64Data = call.getString("base64", "");
            String filename = call.getString("filename", "export.xlsx");
            String mimeType = call.getString("mimeType", "application/octet-stream");
            getActivity().runOnUiThread(() -> {
                try {
                    if (getActivity() instanceof MainActivity) {
                        ((MainActivity) getActivity()).writeToDownloads(base64Data, filename, mimeType);
                    }
                    JSObject ret = new JSObject();
                    ret.put("saved", true);
                    ret.put("filename", filename);
                    call.resolve(ret);
                } catch (Exception e) {
                    Toast.makeText(
                        getActivity(),
                        "Gagal menyimpan file: " + e.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                    call.reject(e.getMessage(), e);
                }
            });
        }
    }

    public class AndroidDownloadBridge {
        @JavascriptInterface
        public void saveBase64File(String base64Data, String filename, String mimeType) {
            runOnUiThread(() -> {
                try {
                    writeToDownloads(base64Data, filename, mimeType);
                } catch (Exception e) {
                    Toast.makeText(
                        MainActivity.this,
                        "Gagal menyimpan file: " + e.getMessage(),
                        Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }
}
