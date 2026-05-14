package com.centralcommand.app

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.JSObject

/**
 * Catches the Android App Link intent that Google fires after OAuth authorization
 * and forwards the redirect URL back into the JavaScript layer via a Capacitor event.
 *
 * The JavaScript side (google-oauth.ts) listens for the "oauthCallback" event via
 * App.addListener('appUrlOpen', ...) — Capacitor's built-in App plugin already handles
 * this for us, so this Kotlin plugin is a placeholder for any future custom native work
 * (e.g. handling edge cases where the App plugin doesn't fire, or pre-processing the URL).
 *
 * Setup required in AndroidManifest.xml — add inside the main <activity> tag:
 *
 *   <intent-filter android:autoVerify="true">
 *     <action android:name="android.intent.action.VIEW" />
 *     <category android:name="android.intent.category.DEFAULT" />
 *     <category android:name="android.intent.category.BROWSABLE" />
 *     <!-- Replace YOUR_ANDROID_CLIENT_ID with your Google Cloud Android client ID prefix -->
 *     <data android:scheme="com.googleusercontent.apps.YOUR_ANDROID_CLIENT_ID"
 *           android:host="oauth2redirect" />
 *   </intent-filter>
 *
 * The android client ID is created in Google Cloud Console → Credentials →
 * "Create credentials" → "OAuth client ID" → Application type: Android.
 * The resulting client ID looks like: 123456789-abc123.apps.googleusercontent.com
 * The scheme prefix is everything before ".apps.googleusercontent.com" reversed:
 * com.googleusercontent.apps.123456789-abc123
 */
@CapacitorPlugin(name = "OAuthCallback")
class OAuthCallbackPlugin : Plugin() {

    override fun handleOnNewIntent(intent: Intent?) {
        super.handleOnNewIntent(intent)
        val uri = intent?.data ?: return
        if (uri.host != "oauth2redirect") return

        val result = JSObject()
        result.put("url", uri.toString())
        notifyListeners("oauthCallback", result)
    }
}
