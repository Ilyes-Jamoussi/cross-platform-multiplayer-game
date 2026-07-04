import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app/i18n.dart';

class LanguageService extends ChangeNotifier {
  static const String prefsKey = 'app.lang';

  /// Default language (web client: French).
  static const String defaultLang = 'fr';

  LanguageService({required String initialLang}) : _lang = _normalizeLang(initialLang);

  String _lang;

  String get lang => _lang;

  static String _normalizeLang(String lang) {
    if (lang == 'en') return 'en';
    if (lang == 'fr') return 'fr';
    return 'fr';
  }

  /// Changes the language:
  /// 1) loads the i18n JSON files
  /// 2) persists the preference locally
  /// 3) notifies the rest of the app (to rebuild the text)
  Future<void> setLang(String lang) async {
    final next = _normalizeLang(lang);
    if (next == _lang) return;

    // Load first to avoid a "language changed but i18n not ready" state.
    try {
      await I18n().load(next);
    } catch (e) {
      // Fallback robuste.
      if (kDebugMode) {
        debugPrint('Failed to load i18n for "$next": $e');
      }
      await I18n().load('fr');
    }

    _lang = next;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(prefsKey, _lang);
    notifyListeners();
  }
}

