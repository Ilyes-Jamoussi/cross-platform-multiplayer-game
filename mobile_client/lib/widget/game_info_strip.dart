import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:provider/provider.dart';

/// Same structure as `app-game-info` (blue header + label / value rows).
class GameInfoStrip extends StatelessWidget {
  const GameInfoStrip({
    super.key,
    required this.gridSize,
    required this.playerCount,
    required this.activeName,
    required this.isDebug,
    this.modeDescription,
  });

  final int gridSize;
  final int playerCount;
  final String activeName;
  final bool isDebug;
  final String? modeDescription;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final turnName = activeName.isEmpty ? '—' : activeName;

    return Container(
      decoration: GameViewTheme.angularCard(borderColor: theme.primaryColor),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: theme.primaryColor),
            child: Text(
              i18n.translate('game_page.game_infos.title'),
              textAlign: TextAlign.center,
              style: GameViewTheme.body(6.5).copyWith(
                color: theme.onPrimaryButtonText,
                letterSpacing: 0.6,
              ),
            ),
          ),
          _InfoRow(
            label: i18n.translate('game_page.game_infos.grid_size'),
            value: '$gridSize×$gridSize',
            highlight: false,
            primaryColor: theme.primaryColor,
            tertiaryColor: theme.tertiaryColor,
          ),
          _rowDivider(),
          if (modeDescription != null && modeDescription!.isNotEmpty) ...[
            _InfoRow(
              label: i18n.translate('game_page.game_infos.game_mode'),
              value: modeDescription!,
              highlight: false,
              primaryColor: theme.primaryColor,
              tertiaryColor: theme.tertiaryColor,
            ),
            _rowDivider(),
          ],
          _InfoRow(
            label: i18n.translate('game_page.game_infos.connected_players'),
            value: '$playerCount',
            highlight: false,
            primaryColor: theme.primaryColor,
            tertiaryColor: theme.tertiaryColor,
          ),
          _rowDivider(),
          _InfoRow(
            label: i18n.translate('game_page.game_infos.turn'),
            value: turnName,
            highlight: true,
            valueIsTurn: true,
            primaryColor: theme.primaryColor,
            tertiaryColor: theme.tertiaryColor,
          ),
          _rowDivider(),
          _DebugInfoRow(
            isDebug: isDebug,
            statusText: i18n.translate(
              isDebug ? 'debug.activated' : 'debug.desactivated',
            ),
            accent: theme.tertiaryColor,
          ),
        ],
      ),
    );
  }
}

Widget _rowDivider() {
  return Divider(
    height: 1,
    thickness: 1,
    color: Colors.white.withValues(alpha: 0.06),
  );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    required this.highlight,
    required this.primaryColor,
    required this.tertiaryColor,
    this.valueIsTurn = false,
  });

  final String label;
  final String value;
  final bool highlight;
  final bool valueIsTurn;
  final Color primaryColor;
  final Color tertiaryColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: highlight
            ? primaryColor.withValues(alpha: 0.08)
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            flex: 5,
            child: Text(
              label,
              style: GameViewTheme.body(5.5).copyWith(
                color: GameViewTheme.labelMuted,
              ),
            ),
          ),
          Expanded(
            flex: 5,
            child: Text(
              value,
              textAlign: TextAlign.right,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: valueIsTurn
                  ? GameViewTheme.turnHighlightColored(5.5, tertiaryColor)
                  : GameViewTheme.body(5.8).copyWith(
                      color: tertiaryColor,
                      fontWeight: FontWeight.w700,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DebugInfoRow extends StatelessWidget {
  const _DebugInfoRow({
    required this.isDebug,
    required this.statusText,
    required this.accent,
  });

  final bool isDebug;
  final String statusText;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final color = isDebug ? accent : const Color(0xFF666666);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'DEBUG',
            style: GameViewTheme.body(5.1).copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            statusText,
            style: GameViewTheme.body(4.9).copyWith(color: color),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(3),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.15),
                width: 1,
              ),
            ),
            child: Text(
              'HOLD',
              style: GameViewTheme.body(4.3).copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
