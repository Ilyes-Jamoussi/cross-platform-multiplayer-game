import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/game_avatar.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Player card in the waiting room (host highlighted).
class LobbyPlayerCard extends StatelessWidget {
  const LobbyPlayerCard({
    super.key,
    required this.player,
    this.canKick = false,
    this.onKick,
  });

  final LobbyPlayer player;
  final bool canKick;
  final VoidCallback? onKick;

  static const Color _hostBorder = Color(0xFFFFD700);

  Color _nameColor() {
    if (player.isHost) {
      return _hostBorder;
    }
    final t = player.type;
    if (t == 'Aggressif') {
      return Colors.redAccent.shade200;
    }
    if (t == 'Défensif') {
      return Colors.lightBlueAccent;
    }
    return Colors.white;
  }

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final theme = context.watch<ThemeService>();
    GameAvatarData? asset;
    for (final a in kSelectableGameAvatars) {
      if (a.name == player.avatar) {
        asset = a;
        break;
      }
    }

    final cardRadius = 0.8 * vmin;
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: Container(
            padding: EdgeInsets.all(0.9 * vmin),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [theme.primaryColor, theme.secondaryHoverColor],
              ),
              borderRadius: BorderRadius.circular(cardRadius),
              // Rings like the web client, but thinner spreads to avoid
              // visual overlap between cards (shadows extend beyond the layout).
              boxShadow: player.isHost
                  ? [
                      BoxShadow(
                        color: const Color(0xFFF6FF00),
                        blurRadius: 0,
                        spreadRadius: 0.32 * vmin,
                      ),
                      BoxShadow(
                        color: const Color(0xFFFAFF66),
                        blurRadius: 0,
                        spreadRadius: 0.58 * vmin,
                      ),
                      BoxShadow(
                        color: const Color(0xFFFAFF68),
                        blurRadius: 0,
                        spreadRadius: 0.58 * vmin,
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: theme.primaryColor,
                        blurRadius: 0,
                        spreadRadius: 0.28 * vmin,
                      ),
                      BoxShadow(
                        color: theme.secondaryHoverColor,
                        blurRadius: 0,
                        spreadRadius: 0.55 * vmin,
                      ),
                      BoxShadow(
                        color: theme.tertiaryColor,
                        blurRadius: 0,
                        spreadRadius: 0.55 * vmin,
                      ),
                    ],
            ),
            child: Column(
              children: [
                SizedBox(height: 2.8 * vmin),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(horizontal: 0.8 * vmin, vertical: 0.2 * vmin),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(0.5 * vmin),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.center,
                    child: Text(
                      player.avatar ?? '',
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.pressStart2p(
                        color: Colors.white,
                        fontSize: (1.1 * vmin).clamp(7.0, 10.0),
                        height: 1.1,
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 0.6 * vmin),
                Expanded(
                  child: asset != null
                      ? Image.asset(
                          asset.iconAsset,
                          fit: BoxFit.contain,
                          filterQuality: FilterQuality.none,
                          errorBuilder: (context, error, stackTrace) =>
                              Icon(Icons.person, color: Colors.white54, size: 4 * vmin),
                        )
                      : Icon(Icons.person, color: Colors.white54, size: 4 * vmin),
                ),
                Container(
                  width: double.infinity,
                  padding: EdgeInsets.symmetric(vertical: 0.45 * vmin, horizontal: 0.8 * vmin),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(0.5 * vmin),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.center,
                    child: Text(
                      player.name ?? '',
                      maxLines: 1,
                      softWrap: false,
                      textAlign: TextAlign.center,
                      style: GoogleFonts.pressStart2p(
                        color: _nameColor(),
                        fontSize: (1.2 * vmin).clamp(8.0, 11.0),
                        height: 1.15,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        Positioned(
          top: 0.3 * vmin,
          left: 0,
          right: 0,
          child: Center(
            child: _topIcon(vmin),
          ),
        ),
        if (canKick && onKick != null)
          Positioned(
            top: 0.3 * vmin,
            right: 0.3 * vmin,
            child: Tooltip(
              message: I18n().translate('loading_page.kick_player'),
              child: InkWell(
                onTap: onKick,
                child: SizedBox(
                  width: 2.4 * vmin,
                  height: 2.4 * vmin,
                  child: Image.asset(
                    'assets/kick.png',
                    filterQuality: FilterQuality.none,
                    errorBuilder: (context, error, stackTrace) =>
                        Icon(Icons.block, color: Colors.redAccent, size: 2.2 * vmin),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _topIcon(double vmin) {
    if (player.type == 'Aggressif') {
      return Container(
        padding: EdgeInsets.all(0.3 * vmin),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFFFFAA00), width: 0.25 * vmin),
        ),
        child: SizedBox(
          width: 2.2 * vmin,
          height: 2.2 * vmin,
          child: Image.asset(
            'assets/waiting_view/bot.png',
            color: const Color(0xFFFFAA00),
            filterQuality: FilterQuality.none,
            errorBuilder: (context, error, stackTrace) =>
                Icon(Icons.smart_toy, color: const Color(0xFFFFAA00), size: 2.2 * vmin),
          ),
        ),
      );
    }
    if (player.type == 'Défensif') {
      return Container(
        padding: EdgeInsets.all(0.3 * vmin),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: const Color(0xFF00E5FF), width: 0.25 * vmin),
        ),
        child: SizedBox(
          width: 2.2 * vmin,
          height: 2.2 * vmin,
          child: Image.asset(
            'assets/waiting_view/bot.png',
            color: const Color(0xFF00E5FF),
            filterQuality: FilterQuality.none,
            errorBuilder: (context, error, stackTrace) =>
                Icon(Icons.smart_toy, color: const Color(0xFF00E5FF), size: 2.2 * vmin),
          ),
        ),
      );
    }
    if (player.isHost) {
      return SizedBox(
        width: 3.1 * vmin,
        height: 3.1 * vmin,
        child: Image.asset(
          'assets/waiting_view/crown.png',
          filterQuality: FilterQuality.none,
          errorBuilder: (context, error, stackTrace) =>
              Icon(Icons.emoji_events, color: _hostBorder, size: 3.1 * vmin),
        ),
      );
    }
    return SizedBox(
      width: 2.8 * vmin,
      height: 2.8 * vmin,
      child: Image.asset(
        'assets/waiting_view/player.png',
        filterQuality: FilterQuality.none,
        errorBuilder: (context, error, stackTrace) =>
            Icon(Icons.person, color: Colors.white, size: 2.8 * vmin),
      ),
    );
  }
}
