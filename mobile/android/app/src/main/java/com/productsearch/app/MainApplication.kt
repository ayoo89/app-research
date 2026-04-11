package com.productsearch.app

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

// Native module packages
import com.swmansion.gesturehandler.RNGestureHandlerPackage
import com.swmansion.reanimated.ReanimatedPackage
import com.swmansion.rnscreens.RNScreensPackage
import com.th3rdwave.safeareacontext.SafeAreaContextPackage
import com.dylanvann.fastimage.FastImageViewPackage
import com.imagepicker.ImagePickerPackage
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import com.reactnativecommunity.netinfo.RNCNetInfoPackage
import com.rnfs.RNFSPackage
import com.mrousavy.camera.RNVisionCameraPackage
import com.oblador.hapticfeedback.RNHapticFeedbackPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> = listOf(
                RNGestureHandlerPackage(),
                ReanimatedPackage(),
                RNScreensPackage(),
                SafeAreaContextPackage(),
                FastImageViewPackage(),
                ImagePickerPackage(),
                AsyncStoragePackage(),
                RNCNetInfoPackage(),
                RNFSPackage(),
                RNVisionCameraPackage(),
                RNHapticFeedbackPackage(),
            )

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = false
            override val isHermesEnabled: Boolean = true
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
    }
}
