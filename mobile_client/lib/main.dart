import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/orientation_lock.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'firebase_options.dart';
import 'services/language_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await lockAppLandscape();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  final prefs = await SharedPreferences.getInstance();
  final savedLang = prefs.getString(LanguageService.prefsKey);
  final initialLang =
      savedLang == 'en' ? 'en' : LanguageService.defaultLang;
  await I18n().load(initialLang);

  runApp(MyApp(initialLang: initialLang));
}
