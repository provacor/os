# The page calls these through window.PbAndroid; keep them under their names.
-keepclassmembers class io.github.provacor.pb.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
