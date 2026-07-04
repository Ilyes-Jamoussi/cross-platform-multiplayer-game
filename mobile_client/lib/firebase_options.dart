// ignore_for_file: lines_longer_than_80_chars, avoid_classes_with_only_static_members
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Firebase configuration for all platforms.
/// Uses the same Firebase project as the Angular client
/// (client/src/app/services/auth-service/firebase.config.ts).
/// Generate your own values by running the FlutterFire CLI (`flutterfire configure`)
/// against your Firebase project.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'YOUR_FIREBASE_API_KEY',
    appId: 'YOUR_FIREBASE_WEB_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'your-project',
    authDomain: 'your-project.firebaseapp.com',
    storageBucket: 'your-project.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'YOUR_FIREBASE_API_KEY',
    appId: 'YOUR_FIREBASE_ANDROID_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'YOUR_FIREBASE_API_KEY',
    appId: 'YOUR_FIREBASE_IOS_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
    iosBundleId: 'com.example.mobileClient',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'YOUR_FIREBASE_API_KEY',
    appId: 'YOUR_FIREBASE_IOS_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'your-project',
    storageBucket: 'your-project.firebasestorage.app',
    iosBundleId: 'com.example.mobileClient',
  );
}
