import 'dart:convert';

import 'package:flutter/services.dart';

class I18n {
  Map<String, dynamic> _localizedStrings = {};
  String _currentLang = 'fr';

  static final I18n _instance = I18n._internal();
  factory I18n() => _instance;
  I18n._internal();

  Future<void> load(String lang) async {
    _currentLang = lang;
    final jsonString = await rootBundle.loadString('assets/i18n/$lang.json');
    _localizedStrings = json.decode(jsonString);
  }

  /// Replaces `{{param}}` in the translated string (like ngx-translate).
  String translateWithParams(String key, Map<String, String> params) {
    var s = translate(key);
    params.forEach((k, v) {
      s = s.replaceAll('{{$k}}', v);
    });
    return s;
  }

  String translate(String key) {
    // Dot-free keys: text at the JSON root (e.g. joining a game)
    if (!key.contains('.')) {
      final direct = _localizedStrings[key];
      if (direct != null && direct is! Map) {
        return direct.toString();
      }
      return key;
    }
    final keys = key.split('.');
    dynamic value = _localizedStrings;
    for (var k in keys) {
      if (value[k] != null) {
        value = value[k];
      } else {
        return key;
      }
    }
    return value.toString();
  }

  /// i18n key (e.g. `shop_page.background.background_1`) or raw label (avatars).
  String cosmeticLabel(String raw) {
    if (raw.contains('.')) return translate(raw);
    return raw;
  }

  String get currentLang => _currentLang;
}
