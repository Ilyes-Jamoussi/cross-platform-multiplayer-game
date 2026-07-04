import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
/// Same idea as the Angular `timer.component`: gray circle, gold border, white text.
class GameTimerBar extends StatelessWidget {
  const GameTimerBar({
    super.key,
    required this.display,
    required this.inCombat,
    required this.dimmed,
  });

  final Object? display;
  final bool inCombat;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    String text;
    if (inCombat) {
      text = i18n.translate('game_page.timer_combat');
    } else if (display is int) {
      text = '${display!}';
    } else {
      text = display?.toString() ?? '--';
    }

    final low = !inCombat && display is int && (display as int) <= 5;

    return Opacity(
      opacity: dimmed ? 0.35 : 1,
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: const Color(0xFF3A3A3A),
          shape: BoxShape.circle,
          border: Border.all(color: const Color(0xFFFFD700), width: 4),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.6),
              blurRadius: 4,
            ),
          ],
        ),
        alignment: Alignment.center,
        child: Text(
          text,
          style: GoogleFonts.pressStart2p(
            fontSize: inCombat ? 8 : 11,
            color: low ? Colors.redAccent : Colors.white,
            shadows: const [
              Shadow(offset: Offset(1, 1), color: Colors.black, blurRadius: 0),
            ],
          ),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}
