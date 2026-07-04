import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Colors / panels aligned with the Angular client (`active-game-page`, `game-info`, etc.).
abstract final class GameViewTheme {
  static const Color background = Color(0xFF000000);
  /// `rgba(0,0,0,0.6)` — background of the Angular side cards.
  static const Color panelBg = Color(0x99000000);
  static const Color border = Colors.white;
  static const Color titleGold = Color(0xFFFFA500);
  static const Color bodyText = Colors.white;
  static const Color labelMuted = Color(0xFFAAB0BC);
  static const Color abandonRed = Color(0xFFFF0000);

  static TextStyle panelTitle(double size) => GoogleFonts.pressStart2p(
        fontSize: size,
        color: titleGold,
        height: 1.4,
      );

  static TextStyle body(double size) => GoogleFonts.pressStart2p(
        fontSize: size,
        color: bodyText,
        height: 1.5,
      );

  /// Thick white border (legacy mobile panels).
  static BoxDecoration panelDecoration({double radius = 12}) {
    return BoxDecoration(
      color: panelBg,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: border, width: 2),
    );
  }

  /// Carte type Angular : bordure fine `--app-primary`, fond semi-transparent.
  static BoxDecoration angularCard({double radius = 8, Color? borderColor}) {
    return BoxDecoration(
      color: panelBg,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor ?? const Color(0xFF0056B3), width: 1.5),
    );
  }

  static BoxDecoration angularChatContainer({double radius = 8, Color? borderColor}) {
    return BoxDecoration(
      color: const Color(0xE6000000),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor ?? const Color(0xFF0056B3), width: 2.5),
    );
  }

  /// Dynamic accent (blue / red theme) for the active player's name, etc.
  static TextStyle turnHighlightColored(double size, Color color) =>
      GoogleFonts.pressStart2p(
        fontSize: size,
        color: color,
        height: 1.5,
        shadows: [
          Shadow(
            color: color.withValues(alpha: 0.45),
            blurRadius: 6,
          ),
        ],
      );
}
