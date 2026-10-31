package cz.builttoroll.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int EXPORT = 100, IMPORT = 101;
    private static final String HOME = "file:///android_asset/index.html";
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingExport;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xff101216);
        setContentView(web);
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new FileBridge(), "AndroidFiles");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !HOME.equals(req.getUrl().toString());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsAlert(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("Potvrdit", (d, w) -> result.confirm())
                    .setNegativeButton("Zrušit", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams p) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try { startActivityForResult(intent, IMPORT); }
                catch (RuntimeException e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        web.loadUrl(HOME);
    }

    private class FileBridge {
        @JavascriptInterface public void exportFile(String name, String content, String mime) {
            if (content == null || content.length() > 20_000_000) return;
            runOnUiThread(() -> {
                if (pendingExport != null) {
                    Toast.makeText(MainActivity.this, "Nejdřív dokonči předchozí export.", Toast.LENGTH_SHORT).show();
                    return;
                }
                pendingExport = content.getBytes(StandardCharsets.UTF_8);
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType(mime != null && mime.startsWith("text/csv") ? "text/csv" : "application/json");
                intent.putExtra(Intent.EXTRA_TITLE, name == null ? "bjj-zaloha.json" : name.replaceAll("[^a-zA-Z0-9._-]", "_"));
                try { startActivityForResult(intent, EXPORT); }
                catch (RuntimeException e) { pendingExport = null; Toast.makeText(MainActivity.this, "Nelze otevřít ukládání souborů.", Toast.LENGTH_LONG).show(); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == IMPORT && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        }
        if (request == EXPORT) {
            byte[] bytes = pendingExport;
            pendingExport = null;
            if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            Uri destination = data.getData();
            new Thread(() -> {
                try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                    if (out == null) throw new java.io.IOException("No output stream");
                    out.write(bytes);
                    runOnUiThread(() -> Toast.makeText(this, "Soubor byl uložen.", Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this, "Uložení se nezdařilo. Export zopakuj.", Toast.LENGTH_LONG).show());
                }
            }).start();
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(function(){if(typeof editing!=='undefined'&&editing){closeEditor();return false;}if(typeof route!=='undefined'&&route!=='home'){navigate('home');return false;}return true;})()", value -> {
            if ("true".equals(value)) new AlertDialog.Builder(this).setMessage("Zavřít BUILT TO ROLL?")
                .setPositiveButton("Zavřít", (d, w) -> finish()).setNegativeButton("Zůstat", null).show();
        });
    }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.removeJavascriptInterface("AndroidFiles");
        web.destroy();
        super.onDestroy();
    }
}
