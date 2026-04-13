package com.productsearch.app

import android.app.Application
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.react.shell.MainReactPackage
import com.facebook.soloader.SoLoader

// Third-party native packages
import com.reactnativecommunity.asyncstorage.AsyncStoragePackage
import com.reactnativecommunity.netinfo.RNCNetInfoPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> = listOf(
                // Core RN modules: AppState, WebSocket, Appearance, DeviceInfo, etc.
                MainReactPackage(),
                // AsyncStorage — required by authStore (token persistence)
                AsyncStoragePackage(),
                // NetInfo — required by networkStore (online/offline detection)
                RNCNetInfoPackage(),
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
