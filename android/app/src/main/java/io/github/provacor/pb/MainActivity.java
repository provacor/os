package io.github.provacor.pb;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.util.Locale;

/**
 * pb: one full-screen WebView showing https://provacor.github.io/p-b/.
 * The site's own service worker keeps every page and study file for offline use, so after the
 * first launch with internet the app opens offline too. No Chrome and no libraries are needed,
 * which keeps the APK tiny. A small JS bridge ("PbAndroid") gives the page what a WebView lacks:
 * read-aloud (Android text-to-speech) and saving backup files.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://provacor.github.io/p-b/";
    static final String HOST = "provacor.github.io";
    static final String PATH = "/p-b";
    private static final int PICK_FILES = 1;
    private static final int SAVE_FILE = 2;

    private WebView web;
    private ValueCallback<Uri[]> pendingPick;
    private byte[] pendingSave;
    private TextToSpeech tts;
    private boolean ttsReady;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#0A0C11"));
        w.setNavigationBarColor(Color.parseColor("#0A0C11"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0A0C11"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // progress, bookmarks, notes live in localStorage
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMediaPlaybackRequiresUserGesture(false); // alarm and game sounds
        s.setTextZoom(100);                     // the app has its own font-size setting
        s.setAllowFileAccess(false);
        s.setSupportMultipleWindows(false);     // target=_blank opens in place (or outside, below)
        s.setUserAgentString(s.getUserAgentString() + " pbAndroid/1");

        web.addJavascriptInterface(new Bridge(), "PbAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());
        web.setDownloadListener((url, ua, cd, mime, len) -> openOutside(Uri.parse(url)));

        tts = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (ttsReady) tts.setOnUtteranceProgressListener(new Spoken());
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl(startUrl(getIntent()));
    }

    private String startUrl(Intent i) {
        Uri u = i != null ? i.getData() : null;
        return u != null && isOurs(u) ? u.toString() : HOME;
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        if (i.getData() != null && isOurs(i.getData())) web.loadUrl(i.getData().toString());
    }

    static boolean isOurs(Uri u) {
        return HOST.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith(PATH);
    }

    private void openOutside(Uri u) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, u));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "এই লিংক খোলার মতো অ্যাপ নেই", Toast.LENGTH_SHORT).show();
        }
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
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == PICK_FILES && pendingPick != null) {
            pendingPick.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            pendingPick = null;
        } else if (req == SAVE_FILE && pendingSave != null) {
            if (res == RESULT_OK && data != null && data.getData() != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                    if (os != null) os.write(pendingSave);
                    Toast.makeText(this, "সেভ হয়েছে", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(this, "সেভ করা গেল না", Toast.LENGTH_SHORT).show();
                }
            }
            pendingSave = null;
        }
    }

    private class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            String scheme = u.getScheme();
            if ("https".equals(scheme) && isOurs(u)) return false;   // stay inside the app
            if ("http".equals(scheme) || "https".equals(scheme) || "mailto".equals(scheme) || "tel".equals(scheme)) {
                openOutside(u);                                      // YouTube, GitHub, …
                return true;
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            // Only the very first launch can land here: once the site has been opened with internet,
            // its service worker answers every request offline.
            if (r.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html");
        }
    }

    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
            if (pendingPick != null) pendingPick.onReceiveValue(null);
            pendingPick = cb;
            try {
                startActivityForResult(p.createIntent(), PICK_FILES);
            } catch (ActivityNotFoundException e) {
                pendingPick = null;
                return false;
            }
            return true;
        }
    }

    private class Spoken extends UtteranceProgressListener {
        @Override public void onStart(String id) { }
        @Override public void onDone(String id) { report(id, "end"); }
        @Override public void onError(String id) { report(id, "error"); }
        private void report(String id, String what) {
            runOnUiThread(() -> web.evaluateJavascript("window.__pbTts&&window.__pbTts(" + Long.parseLong(id) + ",'" + what + "')", null));
        }
    }

    /** Called from the page as window.PbAndroid.*  */
    private class Bridge {
        @JavascriptInterface
        public boolean canSpeak() { return ttsReady; }

        @JavascriptInterface
        public void speak(long id, String text, String lang, float rate) {
            if (!ttsReady) { runOnUiThread(() -> web.evaluateJavascript("window.__pbTts&&window.__pbTts(" + id + ",'error')", null)); return; }
            Locale loc = lang != null && lang.startsWith("bn") ? new Locale("bn", "BD") : Locale.US;
            if (tts.isLanguageAvailable(loc) < TextToSpeech.LANG_AVAILABLE && loc.getLanguage().equals("bn")) loc = new Locale("bn", "IN");
            tts.setLanguage(loc);
            tts.setSpeechRate(rate > 0 ? rate : 1f);
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, String.valueOf(id));
        }

        @JavascriptInterface
        public void stopSpeaking() { if (tts != null) tts.stop(); }

        @JavascriptInterface
        public void saveFile(String name, String base64) {
            pendingSave = Base64.decode(base64, Base64.DEFAULT);
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("application/octet-stream")
                .putExtra(Intent.EXTRA_TITLE, name);
            runOnUiThread(() -> {
                try { startActivityForResult(i, SAVE_FILE); }
                catch (ActivityNotFoundException e) { pendingSave = null; }
            });
        }
    }
}
