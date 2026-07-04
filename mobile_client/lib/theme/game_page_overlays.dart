import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Game-page overlays only, aligned with `styles.scss`, `inventory-popup`,
/// `inventory-trade-popup`, `right-click-popup` et `confirm-popup` (client Angular).
abstract final class GamePageOverlays {
  static const Color dialogBarrier = Color(0x80000000); // rgba(0,0,0,0.5)

  // Functional colors (identical in both Angular themes).
  static const Color appTextMuted = Color(0xFFAAB0BC);
  static const Color appSurfaceAlt = Color(0xFF2A2C36);
  static const Color appSuccess = Color(0xFF4CAF50);
  static const Color appSuccessHover = Color(0xFF45A049);
  static const Color appError = Color(0xFFF44336);
  static const Color appErrorHover = Color(0xFFD32F2F);

  /// Blue fallbacks when no ThemeService is available.
  static const Color _fallbackPrimary = Color(0xFF0056B3);
  static const Color _fallbackSecondary = Color(0xFF007BFF);

  static const LinearGradient modalGradient = LinearGradient(
    begin: Alignment(-0.9, -1),
    end: Alignment(0.85, 1),
    colors: [Color(0xFF16171F), Color(0xFF0D0E14), Color(0xFF12131A)],
    stops: [0.0, 0.48, 1.0],
  );

  /// Inventory / trade container (`inventory-popup`, `inventory-trade-popup`).
  static BoxDecoration inventoryTradeShellDecoration({Color? borderColor}) {
    return BoxDecoration(
      gradient: modalGradient,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: borderColor ?? _fallbackSecondary, width: 2),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.4),
          blurRadius: 20,
          spreadRadius: 0,
        ),
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.55),
          offset: const Offset(0, 7),
          blurRadius: 22,
        ),
      ],
    );
  }

  /// `right-click-popup` — infos tuile.
  static BoxDecoration tileInfoDecoration({Color? borderColor}) {
    return BoxDecoration(
      color: const Color(0xF210101E),
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: borderColor ?? _fallbackPrimary, width: 2),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.6),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ],
    );
  }

  static ButtonStyle tileInfoOkButtonStyle({
    Color? primaryColor,
    Color? secondaryColor,
  }) {
    final p = primaryColor ?? _fallbackPrimary;
    final s = secondaryColor ?? _fallbackSecondary;
    return TextButton.styleFrom(
      foregroundColor: Colors.white,
      backgroundColor: p,
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: BorderSide(color: s, width: 2),
      ),
    );
  }

  /// Winner popup / central message: shell + golden border.
  static BoxDecoration winnerShellDecoration() {
    return BoxDecoration(
      gradient: modalGradient,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFFFD700), width: 2),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFFFFD700).withValues(alpha: 0.2),
          blurRadius: 18,
        ),
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.55),
          offset: const Offset(0, 7),
          blurRadius: 22,
        ),
      ],
    );
  }

  /// `.custom-tooltip` (action tuile, etc.).
  static TooltipThemeData get gameTooltipTheme {
    return TooltipThemeData(
      waitDuration: const Duration(milliseconds: 400),
      showDuration: const Duration(seconds: 5),
      verticalOffset: 10,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF272727),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0x4A212121), width: 3),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.2),
            offset: const Offset(4, 4),
            blurRadius: 4,
          ),
        ],
      ),
      textStyle: const TextStyle(
        color: Colors.white,
        fontSize: 12,
        height: 1.35,
        fontFamily: 'Courier',
        fontFamilyFallback: <String>['monospace'],
      ),
    );
  }

  /// Bouton principal inventaire (`inventory-popup` button).
  static ButtonStyle inventoryConfirmButtonStyle({
    bool enabled = true,
    Color? secondaryColor,
    Color? surfaceAltColor,
  }) {
    final sec = secondaryColor ?? _fallbackSecondary;
    final alt = surfaceAltColor ?? appSurfaceAlt;
    return FilledButton.styleFrom(
      backgroundColor: enabled ? sec : alt,
      foregroundColor: Colors.white,
      disabledBackgroundColor: alt,
      disabledForegroundColor: Colors.white54,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
    );
  }

  static TextStyle pressStartTitle() {
    return GoogleFonts.pressStart2p(
      fontSize: 11,
      color: Colors.white,
      height: 1.35,
    );
  }

  static TextStyle pressStartBody() {
    return GoogleFonts.pressStart2p(
      fontSize: 7,
      color: appTextMuted,
      height: 1.55,
    );
  }

  static TextStyle pressStartSmallWhite() {
    return GoogleFonts.pressStart2p(fontSize: 6.5, color: Colors.white);
  }
}

/// Snackbars aligned with `.error-snackbar`, `.info-snackbar`, etc.
enum GamePageSnackKind { error, success, warning, info }

void showGamePageSnackBar(
  BuildContext context,
  String message, {
  GamePageSnackKind kind = GamePageSnackKind.info,
  Duration duration = const Duration(seconds: 3),
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;

  ThemeService? themeSvc;
  try {
    themeSvc = Provider.of<ThemeService>(context, listen: false);
  } catch (_) {
    themeSvc = null;
  }
  final infoAccent = themeSvc?.secondaryColor ?? const Color(0xFF007BFF);

  final (Color bg, Color border) = switch (kind) {
    GamePageSnackKind.error => (
      const Color(0xF2B40000),
      const Color(0xFFFF4444),
    ),
    GamePageSnackKind.success => (
      const Color(0xF200783C),
      const Color(0xFF44FF88),
    ),
    GamePageSnackKind.warning => (
      const Color(0xF2B48200),
      const Color(0xFFFFD700),
    ),
    GamePageSnackKind.info => (
      (themeSvc?.isBlue ?? true)
          ? const Color(0xF2003C8C)
          : const Color(0xF28C0000),
      infoAccent,
    ),
  };

  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      duration: duration,
      behavior: SnackBarBehavior.floating,
      backgroundColor: Colors.transparent,
      elevation: 0,
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      content: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: border, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            fontSize: 9,
            color: Colors.white,
            height: 1.35,
          ),
        ),
      ),
    ),
  );
}

/// `settings-tooltip` snackbar (`alert.service.ts` `notify`) — a player's turn.
/// Voir `styles.scss` `.settings-tooltip` + `game_page.turn_notification`.
class GameTurnNotifySnackBar extends StatelessWidget {
  const GameTurnNotifySnackBar({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final pad = vmin;
    return Material(
      color: Colors.transparent,
      child: Container(
        padding: EdgeInsets.all(pad),
        decoration: BoxDecoration(
          color: const Color(0xFF000000),
          borderRadius: BorderRadius.circular(vmin),
        ),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            fontSize: 1.5 * vmin,
            color: const Color(0xFFFFA500),
            height: 1.35,
          ),
        ),
      ),
    );
  }
}

/// `.gameInfoPopup` banner (`styles.scss`) — `your_turn`, start-of-game objectives.
/// `fadeOut` animation 3s: opacity 1 until 70%, then ease-in-out fade.
class GameInfoPopupBanner extends StatefulWidget {
  const GameInfoPopupBanner({
    super.key,
    required this.text,
    this.duration = const Duration(milliseconds: GameConstants.yourTurnPopupMs),
  });

  final String text;
  final Duration duration;

  @override
  State<GameInfoPopupBanner> createState() => _GameInfoPopupBannerState();
}

class _GameInfoPopupBannerState extends State<GameInfoPopupBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _c;
  late Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: widget.duration);
    _fade = CurvedAnimation(
      parent: _c,
      curve: const Interval(0.7, 1.0, curve: Curves.easeInOut),
    );
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        return Opacity(
          opacity: (1.0 - _fade.value).clamp(0.0, 1.0),
          child: child,
        );
      },
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 2 * vmin),
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: 4 * vmin,
            vertical: 2 * vmin,
          ),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(vmin),
          ),
          child: Text(
            widget.text,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 4 * vmin,
              color: Colors.white,
              height: 1.35,
            ),
          ),
        ),
      ),
    );
  }
}
