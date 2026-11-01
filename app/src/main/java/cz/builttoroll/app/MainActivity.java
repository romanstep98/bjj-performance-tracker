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
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int EXPORT = 100, IMPORT = 101;
    private static final String HOME = "file:///android_asset/index.html";
    private WebView web;
    private boolean webReady;
    private boolean fileOperation;

    private File exportFile() { return new File(getFilesDir(), "backup-export.pending"); }
    private File importFile() { return new File(getFilesDir(), "backup-import.pending"); }

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
            @Override public void onPageFinished(WebView view, String url) {
                if (HOME.equals(url)) {
                    webReady = true;
                    deliverFileEvents();
                }
            }
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

    private void fileError(String message) {
        runOnUiThread(() -> {
            if (!isDestroyed()) new AlertDialog.Builder(this).setTitle("Záloha")
                .setMessage(message).setPositiveButton("OK", null).show();
        });
    }

    private void deliverFileEvents() {
        if (!webReady || isDestroyed()) return;
        if (importFile().isFile())
            web.evaluateJavascript("window.receiveAndroidBackup && window.receiveAndroidBackup()", null);
        String date = getPreferences(MODE_PRIVATE).getString("backupSaved", null);
        if (date != null) web.evaluateJavascript(
            "window.onAndroidBackupSaved && window.onAndroidBackupSaved(" + JSONObject.quote(date) + ")",
            result -> {
                if ("true".equals(result)) getPreferences(MODE_PRIVATE).edit().remove("backupSaved").apply();
            });
    }

    public class FileBridge {
        @JavascriptInterface public void importBackup() {
            runOnUiThread(() -> {
                if (fileOperation) { fileError("Nejdřív dokonči předchozí práci se souborem."); return; }
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // Some Android file managers label JSON as text/plain or octet-stream.
                intent.setType("*/*");
                fileOperation = true;
                try { startActivityForResult(intent, IMPORT); }
                catch (RuntimeException e) { fileOperation = false; fileError("Nelze otevřít výběr zálohy."); }
            });
        }

        @JavascriptInterface public String readImportedBackup() {
            try (InputStream in = new FileInputStream(importFile())) {
                return new String(BackupFiles.read(in, BackupFiles.MAX_BACKUP_BYTES), StandardCharsets.UTF_8);
            } catch (Exception e) { return ""; }
        }

        @JavascriptInterface public void finishImport() { importFile().delete(); }

        @JavascriptInterface public void exportBackup(String name, String content) {
            queueExport(name, content, "application/json", true);
        }

        @JavascriptInterface public void exportFile(String name, String content, String mime) {
            queueExport(name, content, mime, false);
        }
    }

    private void queueExport(String name, String text, String mime, boolean backup) {
        if (text == null || text.trim().isEmpty() || text.length() > BackupFiles.MAX_EXPORT_BYTES) {
            fileError("Prázdný nebo příliš velký soubor nelze exportovat."); return;
        }
        runOnUiThread(() -> {
            if (fileOperation) { fileError("Nejdřív dokonči předchozí práci se souborem."); return; }
            fileOperation = true;
            new Thread(() -> {
                try {
                    BackupFiles.stage(exportFile(), text.getBytes(StandardCharsets.UTF_8),
                        backup ? BackupFiles.MAX_BACKUP_BYTES : BackupFiles.MAX_EXPORT_BYTES);
                    // Persist the metadata along with the bytes before launching another activity.
                    boolean stored = getPreferences(MODE_PRIVATE).edit().putBoolean("exportIsBackup", backup).commit();
                    if (!stored) throw new java.io.IOException("Nelze připravit zálohu.");
                    runOnUiThread(() -> {
                        if (isDestroyed()) return;
                        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        intent.addCategory(Intent.CATEGORY_OPENABLE);
                        intent.setType(mime != null && mime.startsWith("text/csv") ? "text/csv" : "application/json");
                        intent.putExtra(Intent.EXTRA_TITLE, name == null ? "bjj-zaloha.json" : name.replaceAll("[^a-zA-Z0-9._-]", "_"));
                        try { startActivityForResult(intent, EXPORT); }
                        catch (RuntimeException e) { fileOperation = false; fileError("Nelze otevřít ukládání souborů."); }
                    });
                } catch (Exception e) { runOnUiThread(() -> fileOperation = false); fileError("Export se nezdařil: " + e.getMessage()); }
            }).start();
        });
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == IMPORT) {
            if (result != RESULT_OK || data == null || data.getData() == null) { fileOperation = false; return; }
            Uri source = data.getData();
            new Thread(() -> {
                try (InputStream in = getContentResolver().openInputStream(source)) {
                    byte[] bytes = BackupFiles.read(in, BackupFiles.MAX_BACKUP_BYTES);
                    BackupFiles.stage(importFile(), bytes, BackupFiles.MAX_BACKUP_BYTES);
                    runOnUiThread(this::deliverFileEvents);
                } catch (Exception e) { fileError("Načtení zálohy se nezdařilo: " + e.getMessage()); }
                finally { runOnUiThread(() -> fileOperation = false); }
            }).start();
        }
        if (request == EXPORT) {
            if (result != RESULT_OK || data == null || data.getData() == null) {
                fileOperation = false; exportFile().delete(); return;
            }
            Uri destination = data.getData();
            new Thread(() -> {
                try {
                    byte[] bytes;
                    try (InputStream in = new FileInputStream(exportFile())) {
                        bytes = BackupFiles.read(in, BackupFiles.MAX_EXPORT_BYTES);
                    }
                    // Close the stream successfully before declaring the backup saved.
                    try (OutputStream out = getContentResolver().openOutputStream(destination, "wt")) {
                        if (out == null) throw new java.io.IOException("Soubor nelze otevřít pro zápis.");
                        out.write(bytes);
                        out.flush();
                    }
                    if (getPreferences(MODE_PRIVATE).getBoolean("exportIsBackup", false))
                        getPreferences(MODE_PRIVATE).edit().putString("backupSaved", java.time.LocalDate.now().toString()).commit();
                    exportFile().delete();
                    runOnUiThread(() -> {
                        if (!isDestroyed()) Toast.makeText(this, "Soubor byl uložen (" + bytes.length + " B).", Toast.LENGTH_LONG).show();
                        deliverFileEvents();
                    });
                } catch (Exception e) {
                    fileError("Uložení se nezdařilo. Export zopakuj. " + e.getMessage());
                } finally { runOnUiThread(() -> fileOperation = false); }
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
        webReady = false;
        web.removeJavascriptInterface("AndroidFiles");
        web.destroy();
        super.onDestroy();
    }
}
