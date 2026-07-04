import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppThemeMode {
  blue,
  red,
}

/// Theme service aligned with the Angular client's CSS variables (`styles.scss`).
class ThemeService extends ChangeNotifier {
  static const String _prefsKey = 'app.theme';

  ThemeService({AppThemeMode initialTheme = AppThemeMode.blue})
      : _theme = initialTheme;

  AppThemeMode _theme;

  AppThemeMode get theme => _theme;

  bool get isBlue => _theme == AppThemeMode.blue;

  // ── Couleurs primaires ──────────────────────────────────────────────

  /// `--app-primary`
  Color get primaryColor =>
      isBlue ? const Color(0xFF0056B3) : const Color(0xFFFF0000);

  /// `--app-secondary`
  Color get secondaryColor =>
      isBlue ? const Color(0xFF007BFF) : const Color(0xFFFF4D4D);

  /// `--app-secondary-hover`
  Color get secondaryHoverColor =>
      isBlue ? const Color(0xFF0056B3) : const Color(0xFFFF1A1A);

  /// `--app-secondary-disabled`
  Color get secondaryDisabledColor =>
      isBlue ? const Color(0x88007BFF) : const Color(0x88FF4D4D);

  /// `--app-tertiary`
  Color get tertiaryColor =>
      isBlue ? const Color(0xFF33AFFF) : const Color(0xFFFF9999);

  // ── Surfaces & texte ────────────────────────────────────────────────

  /// `--app-primary-background`
  Color get primarySurfaceColor =>
      isBlue ? Colors.white : Colors.black;

  /// `--app-primary-text`
  Color get onPrimarySurfaceColor =>
      isBlue ? Colors.black : Colors.white;

  /// Texte sur bouton plein `--app-primary` (hover).
  /// White on both themes for mobile readability.
  Color get onPrimaryButtonText => Colors.white;

  /// `--app-primary-hover-text` (Angular: white / black).
  Color get primaryHoverTextColor =>
      isBlue ? Colors.white : Colors.black;

  /// `--app-surface` — fond sombre (plateau de jeu, etc.)
  Color get surfaceColor => const Color(0xFF16171F);

  /// `--app-surface-alt`
  Color get surfaceAltColor => const Color(0xFF2A2C36);

  // ── Couleurs fonctionnelles ─────────────────────────────────────────

  /// `--app-success`
  Color get successColor => const Color(0xFF4CAF50);

  /// `--app-success-hover`
  Color get successHoverColor => const Color(0xFF45A049);

  /// `--app-error`
  Color get errorColor => const Color(0xFFF44336);

  /// `--app-error-hover`
  Color get errorHoverColor => const Color(0xFFD32F2F);

  /// `--app-text-muted`
  Color get textMutedColor => const Color(0xFFAAB0BC);

  // ── Derived colors ──────────────────────────────────────────────────

  /// `--app-panel-inset`
  Color get panelInsetColor =>
      isBlue ? const Color(0x14000000) : const Color(0x1AFFFFFF);

  /// Opaque inset: same rendering as the panel-inset **on** the primary background (white / black by theme).
  /// Avoids a nearly invisible background when the semi-transparent layer is painted alone.
  Color get panelInsetOnPrimaryOpaque =>
      Color.alphaBlend(panelInsetColor, primarySurfaceColor);

  /// `--app-highlight-bg`
  Color get highlightBgColor =>
      isBlue ? const Color(0x26007BFF) : const Color(0x26FF4D4D);

  // ── Chat ────────────────────────────────────────────────────────────

  /// `--app-chat-surface`
  Color get chatSurfaceColor =>
      isBlue ? const Color(0xFFEBEBEB) : const Color(0xFF1A1A1A);

  /// `--app-chat-overlay`
  Color get chatOverlayColor =>
      isBlue ? const Color(0xEBF0F0F0) : const Color(0xE6000000);

  /// `--app-chat-border`
  Color get chatBorderColor =>
      isBlue ? const Color(0xFFD0D0D0) : const Color(0xFF333333);

  // ── Icons / background ──────────────────────────────────────────────

  /// `--app-icon-filter: invert(1)` in the red theme.
  bool get iconsInverted => !isBlue;

  /// Nom de l'asset GIF de fond (`--app-bg-image`).
  String get bgImageAsset =>
      isBlue ? 'assets/gif_stats.gif' : 'assets/dark_theme_background.gif';

  // ── Labels ──────────────────────────────────────────────────────────

  String get themeLabel => isBlue ? 'blue' : 'red';

  // ── Persistance ─────────────────────────────────────────────────────

  static AppThemeMode _fromString(String value) {
    switch (value) {
      case 'red':
        return AppThemeMode.red;
      case 'blue':
      default:
        return AppThemeMode.blue;
    }
  }

  Future<void> loadFromPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_prefsKey);
    if (raw == null) return;
    final next = _fromString(raw);
    if (next == _theme) return;
    _theme = next;
    notifyListeners();
  }

  Future<void> setTheme(AppThemeMode next) async {
    if (next == _theme) return;
    _theme = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _prefsKey,
      next == AppThemeMode.blue ? 'blue' : 'red',
    );
    notifyListeners();
  }
}
