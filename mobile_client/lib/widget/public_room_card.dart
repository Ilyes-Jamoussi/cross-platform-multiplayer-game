import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/public_room_info.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/coin_icon.dart';
import 'package:provider/provider.dart';

/// Card for a public game (equivalent of the Angular `public-room-card`).
class PublicRoomCard extends StatelessWidget {
  const PublicRoomCard({
    super.key,
    required this.room,
    required this.onJoin,
  });

  final PublicRoomInfo room;
  final VoidCallback onJoin;

  @override
  Widget build(BuildContext context) {
    final canJoin = room.isOpenToMorePlayers;
    final theme = context.watch<ThemeService>();
    final i18n = I18n();
    final primary = theme.primaryColor;
    final secondary = theme.secondaryColor;
    final tertiary = theme.tertiaryColor;
    final onSurface = theme.onPrimarySurfaceColor;
    final isBlue = theme.theme == AppThemeMode.blue;
    // Card background: white (blue theme) / black (red theme) — explicit like the web.
    final cardBackground = isBlue ? Colors.white : Colors.black;

    final statusKey = room.hasGameStarted
        ? 'public_room.in_progress'
        : 'public_room.waiting';
    final accessKey = canJoin ? 'public_room.open' : 'public_room.closed';

    // Fond zone mini-carte : lisible sur blanc (bleu) ou noir (rouge).
    final mapSlotColor = isBlue
        ? Colors.black.withValues(alpha: 0.07)
        : Colors.white.withValues(alpha: 0.1);
    final mapPlaceholder = isBlue
        ? const Color(0xFFE0E0E0)
        : const Color(0xFF2C2C2C);

    // Identique au lourd (`public-room-card.component.scss` .card) :
    // 1vmin = 1% of the view's smallest side, like in CSS.
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final radiusCard = 2 * vmin;
    // box-shadow: 0 0 0 0.5vmin primary, 0 0 0 1vmin secondary, 0 0 0 1.5vmin tertiary
    final spreadPrimary = 0.5 * vmin;
    final spreadSecondary = 1.0 * vmin;
    final spreadTertiary = 1.5 * vmin;
    final padCard = 1.5 * vmin;
    final radiusImage = 1.0 * vmin;

    return Material(
      color: Colors.transparent,
      clipBehavior: Clip.none,
      child: InkWell(
        onTap: canJoin ? onJoin : null,
        borderRadius: BorderRadius.circular(radiusCard),
        splashColor: primary.withValues(alpha: 0.18),
        highlightColor: primary.withValues(alpha: 0.1),
        child: Container(
          decoration: BoxDecoration(
            color: cardBackground,
            borderRadius: BorderRadius.circular(radiusCard),
            // Same order and same spreads as in SCSS (blur 0, offset 0).
            boxShadow: [
              BoxShadow(
                color: primary,
                offset: Offset.zero,
                blurRadius: 0,
                spreadRadius: spreadPrimary,
              ),
              BoxShadow(
                color: secondary,
                offset: Offset.zero,
                blurRadius: 0,
                spreadRadius: spreadSecondary,
              ),
              BoxShadow(
                color: tertiary,
                offset: Offset.zero,
                blurRadius: 0,
                spreadRadius: spreadTertiary,
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(radiusCard),
            child: Padding(
              padding: EdgeInsets.all(padCard),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        i18n.translateWithParams('public_room.code', {
                          'id': room.roomId,
                        }),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.pressStart2p(
                          fontSize: 7,
                          height: 1.3,
                          color: primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${room.players}/${room.playerMax}',
                          style: GoogleFonts.pressStart2p(
                            fontSize: 7,
                            height: 1.3,
                            color: onSurface,
                          ),
                        ),
                        const SizedBox(width: 3),
                        Image.asset(
                          'assets/game_creation/players.png',
                          height: 16,
                          errorBuilder: (context, error, stackTrace) =>
                              const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  i18n.translateWithParams('public_room.map', {
                    'size': '${room.gridSize}',
                  }),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 8,
                    height: 1.25,
                    color: onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(radiusImage),
                    child: ColoredBox(
                      color: mapSlotColor,
                      child: _MapThumb(
                        payload: room.gridImagePayload,
                        fit: BoxFit.contain,
                        placeholderColor: mapPlaceholder,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${i18n.translate('public_room.status')} : ${i18n.translate(statusKey)}',
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 6,
                    height: 1.35,
                    color: onSurface,
                  ),
                ),
                Text(
                  '${i18n.translate('public_room.access')} : ${i18n.translate(accessKey)}',
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 6,
                    height: 1.35,
                    color: canJoin
                        ? const Color(0xFF4CAF50)
                        : const Color(0xFFFF6B6B),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        '${i18n.translate('public_room.price')} : ',
                        style: GoogleFonts.pressStart2p(
                          fontSize: 6,
                          height: 1.35,
                          color: onSurface,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Text(
                      '${room.entryFee} ',
                      style: GoogleFonts.pressStart2p(
                        fontSize: 6,
                        height: 1.35,
                        color: const Color(0xFFFFB700),
                      ),
                    ),
                    const CoinIcon(color: Color(0xFFFFB700), size: 12),
                  ],
                ),
              ],
            ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MapThumb extends StatelessWidget {
  const _MapThumb({
    required this.payload,
    required this.fit,
    required this.placeholderColor,
  });

  final String payload;
  final BoxFit fit;
  final Color placeholderColor;

  @override
  Widget build(BuildContext context) {
    if (payload.isEmpty) {
      return ColoredBox(color: placeholderColor);
    }
    try {
      final bytes = base64Decode(payload);
      return Image.memory(
        bytes,
        fit: fit,
        width: double.infinity,
        height: double.infinity,
        gaplessPlayback: true,
        errorBuilder: (context, error, stackTrace) =>
            ColoredBox(color: placeholderColor),
      );
    } catch (_) {
      return ColoredBox(color: placeholderColor);
    }
  }
}
