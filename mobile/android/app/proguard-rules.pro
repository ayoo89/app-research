# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.**

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# OkHttp (used by React Native networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Retrofit / Axios (JS-side, but keep OkHttp intact)
-keepattributes Signature
-keepattributes *Annotation*

# Vision Camera / ML Kit barcode scanning
-keep class com.mrousavy.camera.** { *; }
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# AsyncStorage
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# NetInfo
-keep class com.reactnativecommunity.netinfo.** { *; }

# Image Picker / Resizer
-keep class com.imagepicker.** { *; }
-keep class fr.bamlab.rnimageresizer.** { *; }

# Fast Image (Glide)
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { <init>(...); }
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
    **[] $VALUES;
    public *;
}

# Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }

# Keep BuildConfig
-keep class com.productsearch.app.BuildConfig { *; }

# Remove debug/verbose logs in release
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
}
