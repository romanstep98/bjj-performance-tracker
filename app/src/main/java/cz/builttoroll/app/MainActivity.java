package cz.builttoroll.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
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
        // Apply safe areas to a parent: WebView padding does not reliably
        // constrain fixed-position HTML navigation to the visible viewport.
        FrameLayout content = new FrameLayout(this);
        content.setBackgroundColor(0xff101216);
        content.addView(web, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(content);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
        }
        content.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                // Leave room for the camera cutout and the on-screen keyboard,
                // but not for transient system bars revealed by a swipe.
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return WindowInsets.CONSUMED;
            }
            if (Build.VERSION.SDK_INT >= 28 && insets.getDisplayCutout() != null) {
                android.view.DisplayCutout cutout = insets.getDisplayCutout();
                v.setPadding(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(),
                    cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
            } else {
                v.setPadding(0, 0, 0, 0);
            }
            // On Android 8–10 adjustResize handles the keyboard.
            return insets;
        });
        content.requestApplyInsets();
        hideSystemBars();
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

    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsBehavior(
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override protected void onResume() {
        super.onResume();
        // Re-enter immersive mode after returning from a file picker or another app.
        if (web != null) web.post(this::hideSystemBars);
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
