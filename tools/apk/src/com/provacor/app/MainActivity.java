package com.provacor.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Provacor as an Android app: the web app runs in a WebView at a private origin.
 * Every file is fetched from the live website first (so updates arrive without a new APK)
 * and saved on the phone; offline, the saved copy is used, and before anything was saved
 * the copy bundled inside the APK. So the app works offline from the very first launch.
 */
public class MainActivity extends Activity {
    static final String ORIGIN_HOST = "appassets.androidplatform.net";
    static final String START = "https://" + ORIGIN_HOST + "/";
    static final int CONNECT_MS = 3500, READ_MS = 8000;
    static final int FILE_CHOOSER = 7;
    static final String NOTIFY_PERMISSION = "android.permission.POST_NOTIFICATIONS"; // API 33

    WebView web;
    File store;
    TextToSpeech tts;
    boolean ttsReady;
    ValueCallback<Uri[]> chooser;
    final Handler ui = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        store = new File(getFilesDir(), "web");
        getWindow().setStatusBarColor(Color.parseColor("#0a0c11"));
        getWindow().setNavigationBarColor(Color.parseColor("#0a0c11"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0a0c11"));
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "ProvacorAndroid");

        // The page's own service worker is not needed here: this class does its job.
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest r) {
                return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return intercept(r);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (ORIGIN_HOST.equals(u.getHost())) {
                    String path = u.getPath() == null ? "" : u.getPath().toLowerCase(Locale.ROOT);
                    if (path.endsWith(".pdf")) {
                        openPdf(u);
                        return true;
                    }
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException e) {
                    toast("এই লিংক খোলার অ্যাপ নেই");
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript(asset("app-bridge.js"), null);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (chooser != null) chooser.onReceiveValue(null);
                chooser = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = p.getAcceptTypes();
                i.setType(types != null && types.length == 1 && types[0].contains("/") ? types[0] : "*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "ফাইল বেছে নাও"), FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    chooser = null;
                    return false;
                }
                return true;
            }
        });

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            @Override
            public void onInit(int status) {
                ttsReady = status == TextToSpeech.SUCCESS;
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { }
            @Override public void onDone(String id) { ttsDone(id, true); }
            @Override public void onError(String id) { ttsDone(id, false); }
            @Override public void onStop(String id, boolean interrupted) { ttsDone(id, false); }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(START);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == FILE_CHOOSER && chooser != null) {
            chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            chooser = null;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    // ---------- serving the app ----------

    // index.html: website first (fresh app). Files with ?v=…: never change, so the saved copy is
    // used as is. Data (JSON, labs): the saved copy at once, refreshed in the background for the
    // next launch. PDFs and images: saved once. Nothing saved yet: website, else the APK's copy.
    WebResourceResponse intercept(WebResourceRequest r) {
        if (!"GET".equals(r.getMethod())) return null;
        Uri u = r.getUrl();
        String host = u.getHost();
        if ("fonts.googleapis.com".equals(host) || "fonts.gstatic.com".equals(host)) return fonts(u);
        if (!ORIGIN_HOST.equals(host)) return null;
        String path = u.getPath() == null ? "" : u.getPath().replaceFirst("^/+", "");
        if (path.isEmpty() || path.endsWith("/")) path += "index.html";
        if (path.contains("..")) return notFound();
        String q = u.getEncodedQuery();
        boolean versioned = q != null && q.startsWith("v=");
        final String mime = mime(path);
        final File saved = new File(store, versioned ? path + "@" + q.replaceAll("[^\\w=.-]", "_") : path);
        final String remote = BuildConfig.SITE + Uri.encode(path, "/") + (q == null ? "" : "?" + q);
        boolean shell = path.equals("index.html");

        if (!shell && saved.isFile()) {
            if (mime.equals("application/json") || (mime.equals("text/html") && !versioned)) refreshLater(remote, saved);
            try {
                return response(mime, 200, new FileInputStream(saved));
            } catch (IOException e) { /* fetch it again */ }
        }
        try {
            HttpURLConnection c = open(remote);
            int code = c.getResponseCode();
            if (code == 200) return response(mime, 200, new SaveStream(c.getInputStream(), saved));
            c.disconnect();
            if (code == 404 && !saved.isFile() && !bundled(path)) return notFound();
        } catch (IOException e) {
            // offline, or the network hung: use what the phone has
        }
        try {
            if (saved.isFile()) return response(mime, 200, new FileInputStream(saved));
            File plain = new File(store, path); // an older version of a ?v= file
            if (plain.isFile()) return response(mime, 200, new FileInputStream(plain));
        } catch (IOException e) { /* try the bundled copy */ }
        try {
            return response(mime, 200, getAssets().open("www/" + path));
        } catch (IOException e) {
            return notFound();
        }
    }

    static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(CONNECT_MS);
        c.setReadTimeout(READ_MS);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache");
        return c;
    }

    final java.util.concurrent.ExecutorService background = java.util.concurrent.Executors.newSingleThreadExecutor();
    final java.util.Set<String> refreshed = java.util.Collections.synchronizedSet(new java.util.HashSet<String>());

    void refreshLater(final String remote, final File saved) {
        if (!refreshed.add(saved.getPath())) return; // once per launch
        background.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    HttpURLConnection c = open(remote);
                    if (c.getResponseCode() != 200) { c.disconnect(); return; }
                    InputStream in = new SaveStream(c.getInputStream(), saved);
                    byte[] buf = new byte[16384];
                    while (in.read(buf) >= 0) { /* SaveStream writes the file */ }
                    in.close();
                } catch (IOException e) { /* offline: keep the saved copy */ }
            }
        });
    }

    boolean bundled(String path) {
        try {
            getAssets().open("www/" + path).close();
            return true;
        } catch (IOException e) {
            return false;
        }
    }

    // Web fonts: saved once, then always served from the phone.
    WebResourceResponse fonts(Uri u) {
        File f = new File(new File(getFilesDir(), "fonts"), Integer.toHexString(u.toString().hashCode()) + (u.getHost().startsWith("fonts.g") && u.toString().contains("css") ? ".css" : ".font"));
        String mime = f.getName().endsWith(".css") ? "text/css" : "font/woff2";
        try {
            if (f.isFile()) return response(mime, 200, new FileInputStream(f));
            HttpURLConnection c = (HttpURLConnection) new URL(u.toString()).openConnection();
            c.setConnectTimeout(CONNECT_MS);
            c.setReadTimeout(READ_MS);
            c.setRequestProperty("User-Agent", web.getSettings().getUserAgentString());
            if (c.getResponseCode() != 200) return null;
            return response(mime, 200, new SaveStream(c.getInputStream(), f));
        } catch (IOException e) {
            return null;
        }
    }

    static WebResourceResponse response(String mime, int code, InputStream body) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        String enc = mime.startsWith("text/") || mime.contains("json") || mime.contains("javascript") || mime.contains("svg") ? "utf-8" : null;
        return new WebResourceResponse(mime, enc, code, "OK", h, body);
    }

    static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        String ext = p.substring(p.lastIndexOf('.') + 1);
        switch (ext) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "pdf": return "application/pdf";
            case "woff2": return "font/woff2";
            case "txt": case "md": return "text/plain";
            default: return "application/octet-stream";
        }
    }

    /** Passes a download through to the WebView and keeps a copy once it has been read to the end. */
    static class SaveStream extends FilterInputStream {
        final File target, tmp;
        OutputStream out;
        boolean failed;

        SaveStream(InputStream in, File target) {
            super(in);
            this.target = target;
            this.tmp = new File(target.getPath() + ".part");
            try {
                File dir = target.getParentFile();
                if (dir != null) dir.mkdirs();
                out = new FileOutputStream(tmp);
            } catch (IOException e) {
                failed = true;
            }
        }

        @Override
        public int read() throws IOException {
            int b = super.read();
            if (b >= 0) write(new byte[]{(byte) b}, 0, 1);
            else finish();
            return b;
        }

        @Override
        public int read(byte[] buf, int off, int len) throws IOException {
            int n = super.read(buf, off, len);
            if (n > 0) write(buf, off, n);
            else if (n < 0) finish();
            return n;
        }

        void write(byte[] buf, int off, int n) {
            if (failed || out == null) return;
            try {
                out.write(buf, off, n);
            } catch (IOException e) {
                failed = true;
            }
        }

        void finish() {
            if (out == null) return;
            try {
                out.close();
                if (!failed) tmp.renameTo(target);
            } catch (IOException e) { /* keep the old copy */ }
            out = null;
            tmp.delete();
        }

        @Override
        public void close() throws IOException {
            if (out != null) { // closed before the end: don't keep a half file
                try { out.close(); } catch (IOException e) { /* ignore */ }
                out = null;
                tmp.delete();
            }
            super.close();
        }
    }

    // ---------- PDFs open in the phone's PDF viewer ----------

    void openPdf(final Uri u) {
        final String path = u.getPath().replaceFirst("^/+", "");
        final File saved = new File(store, path);
        if (!saved.isFile()) toast("PDF নামানো হচ্ছে…");
        new Thread(new Runnable() {
            @Override
            public void run() {
                if (!saved.isFile()) {
                    try {
                        HttpURLConnection c = (HttpURLConnection) new URL(BuildConfig.SITE + Uri.encode(path, "/")).openConnection();
                        c.setConnectTimeout(CONNECT_MS);
                        c.setReadTimeout(30000);
                        if (c.getResponseCode() == 200) {
                            InputStream in = new SaveStream(c.getInputStream(), saved);
                            byte[] buf = new byte[65536];
                            while (in.read(buf) >= 0) { /* SaveStream writes the file */ }
                            in.close();
                        }
                    } catch (IOException e) { /* handled below */ }
                }
                if (!saved.isFile()) {
                    toast("এই PDF এখনো ফোনে নেই — নেট চালু করে একবার খোলো, অথবা অধ্যায়ে \"অফলাইনে রাখো\" চাপো।");
                    return;
                }
                final Uri content = Uri.parse("content://com.provacor.app.files/" + Uri.encode(path, "/"));
                ui.post(new Runnable() {
                    @Override
                    public void run() {
                        Intent i = new Intent(Intent.ACTION_VIEW);
                        i.setDataAndType(content, "application/pdf");
                        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        try {
                            startActivity(i);
                        } catch (ActivityNotFoundException e) {
                            toast("PDF খোলার কোনো অ্যাপ নেই — Play Store থেকে একটা PDF reader নাও।");
                        }
                    }
                });
            }
        }).start();
    }

    // ---------- helpers ----------

    String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } catch (IOException e) {
            return "";
        }
    }

    void toast(final String t) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, t, Toast.LENGTH_LONG).show();
            }
        });
    }

    void ttsDone(final String id, final boolean ok) {
        ui.post(new Runnable() {
            @Override
            public void run() {
                web.evaluateJavascript("window.__ttsDone&&window.__ttsDone(" + Integer.parseInt(id) + "," + ok + ")", null);
            }
        });
    }

    /** What the web app can ask of Android (used by app-bridge.js). */
    class Bridge {
        @JavascriptInterface
        public void speak(int id, String text, String lang, float rate) {
            if (!ttsReady) {
                ttsDone(String.valueOf(id), false);
                return;
            }
            Locale l = lang != null && lang.toLowerCase(Locale.ROOT).startsWith("bn") ? new Locale("bn", "BD") : Locale.US;
            if (tts.isLanguageAvailable(l) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(l);
            else if (l.getLanguage().equals("bn") && tts.isLanguageAvailable(new Locale("bn", "IN")) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(new Locale("bn", "IN"));
            tts.setSpeechRate(rate > 0 ? rate : 1f);
            Bundle p = new Bundle();
            tts.speak(text, TextToSpeech.QUEUE_ADD, p, String.valueOf(id));
        }

        @JavascriptInterface
        public void stopSpeaking() {
            if (tts != null) tts.stop();
        }

        @JavascriptInterface
        public boolean canSpeakBengali() {
            return ttsReady && (tts.isLanguageAvailable(new Locale("bn", "BD")) >= TextToSpeech.LANG_AVAILABLE || tts.isLanguageAvailable(new Locale("bn", "IN")) >= TextToSpeech.LANG_AVAILABLE);
        }

        /** Saves a file the page "downloads" (backup, calendar reminder) to the Downloads folder. */
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            String safe = name == null || name.isEmpty() ? "provacor-file" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            try {
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new IOException("no uri");
                    try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                        if (o == null) throw new IOException("no stream");
                        o.write(data);
                    }
                    toast("Downloads ফোল্ডারে সেভ হয়েছে: " + safe);
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    dir.mkdirs();
                    File f = new File(dir, safe);
                    try (OutputStream o = new FileOutputStream(f)) {
                        o.write(data);
                    }
                    toast("সেভ হয়েছে: " + f.getPath());
                }
            } catch (IOException e) {
                toast("ফাইল সেভ করা গেল না");
            }
        }

        @JavascriptInterface
        public String notifyPermission() {
            if (Build.VERSION.SDK_INT < 33) return "granted";
            return checkSelfPermission(NOTIFY_PERMISSION) == PackageManager.PERMISSION_GRANTED ? "granted" : "default";
        }

        @JavascriptInterface
        public void requestNotify() {
            if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{NOTIFY_PERMISSION}, 9);
        }

        @JavascriptInterface
        public void notify(String title, String body) {
            NotificationManager m = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (m == null) return;
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                m.createNotificationChannel(new NotificationChannel("study", "পড়ার রিমাইন্ডার", NotificationManager.IMPORTANCE_HIGH));
                b = new Notification.Builder(MainActivity.this, "study");
            } else {
                b = new Notification.Builder(MainActivity.this);
            }
            b.setSmallIcon(getApplicationInfo().icon).setContentTitle(title).setContentText(body).setAutoCancel(true);
            m.notify((int) (System.currentTimeMillis() % 100000), b.build());
        }
    }
}
