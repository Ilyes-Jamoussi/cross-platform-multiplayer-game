import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:provider/provider.dart';
import 'package:mobile_client/util/game_avatar_asset.dart';

/// Player list like `app-player-list` (card + blue header, `player-card-entry`-style rows).
class GameRosterList extends StatelessWidget {
  const GameRosterList({
    super.key,
    required this.players,
    required this.currentTurnId,
    required this.disconnectedIds,
    this.isFastElimination = false,
    this.teams = const <LobbyTeam>[],
    this.isTeamMode = false,
  });

  final List<GamePlayerState> players;
  final String? currentTurnId;
  final Set<String> disconnectedIds;
  final bool isFastElimination;
  final List<LobbyTeam> teams;
  final bool isTeamMode;

  LobbyTeam? _teamForPlayer(String playerId) {
    for (final team in teams) {
      if (team.players.any((p) => p.id == playerId)) return team;
    }
    return null;
  }

  static Color _colorFromHex(String hex) {
    final h = hex.replaceFirst('#', '');
    if (h.length != 6) return Colors.white;
    return Color(int.parse('FF$h', radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    return Container(
      decoration: GameViewTheme.angularCard(borderColor: theme.primaryColor),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(color: theme.primaryColor),
            child: Text(
              i18n.translate('game_page.players'),
              textAlign: TextAlign.center,
              style: GameViewTheme.body(6.5).copyWith(
                color: theme.onPrimaryButtonText,
                letterSpacing: 0.6,
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(6),
              itemCount: players.length,
              separatorBuilder: (_, _) => const SizedBox(height: 4),
              itemBuilder: (context, index) {
                final p = players[index];
                final eliminated = isFastElimination &&
                    (p.state == 'eliminated' || p.isSpectator);
                return _RosterEntry(
                  player: p,
                  turn: p.id == currentTurnId,
                  off: disconnectedIds.contains(p.id),
                  eliminated: eliminated,
                  showSpectatorLabel:
                      isFastElimination && p.isSpectator,
                  isTeamMode: isTeamMode,
                  team: _teamForPlayer(p.id),
                  teamColor: _teamForPlayer(p.id) != null
                      ? _colorFromHex(_teamForPlayer(p.id)!.color)
                      : null,
                  teamLabel: _teamForPlayer(p.id)?.id ?? '',
                  i18n: i18n,
                  primaryColor: theme.primaryColor,
                  secondaryColor: theme.secondaryColor,
                  tertiaryColor: theme.tertiaryColor,
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _RosterEntry extends StatelessWidget {
  const _RosterEntry({
    required this.player,
    required this.turn,
    required this.off,
    required this.eliminated,
    required this.showSpectatorLabel,
    required this.isTeamMode,
    required this.team,
    required this.teamColor,
    required this.teamLabel,
    required this.i18n,
    required this.primaryColor,
    required this.secondaryColor,
    required this.tertiaryColor,
  });

  final GamePlayerState player;
  final bool turn;
  final bool off;
  final bool eliminated;
  final bool showSpectatorLabel;
  final bool isTeamMode;
  final LobbyTeam? team;
  final Color? teamColor;
  final String teamLabel;
  final I18n i18n;
  final Color primaryColor;
  final Color secondaryColor;
  final Color tertiaryColor;

  @override
  Widget build(BuildContext context) {
    final icon = gameAvatarIconAsset(player.avatar);
    final jv = player.id.startsWith('virtual-');
    final vpAggressive = player.type?.toLowerCase().contains('aggressive') ?? false;
    final vpDefensive = player.type?.toLowerCase().contains('defensive') ?? false;

    return Opacity(
      opacity: eliminated ? 0.45 : 1,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
            decoration: BoxDecoration(
              color: eliminated
                  ? Colors.grey.withValues(alpha: 0.1)
                  : turn
                      ? primaryColor.withValues(alpha: 0.15)
                      : Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: turn
                    ? secondaryColor
                    : Colors.white.withValues(alpha: 0.06),
                width: turn ? 1.5 : 1,
              ),
              boxShadow: turn
                  ? [
                      BoxShadow(
                        color: secondaryColor.withValues(alpha: 0.35),
                        blurRadius: 8,
                        spreadRadius: 0,
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: icon != null
                      ? Image.asset(
                          icon,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => Image.asset(
                            'assets/waiting_view/player.png',
                            fit: BoxFit.cover,
                          ),
                        )
                      : Image.asset(
                          'assets/waiting_view/player.png',
                          fit: BoxFit.cover,
                        ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        player.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GameViewTheme.body(5.8).copyWith(
                          fontWeight: FontWeight.w700,
                          decoration: off ? TextDecoration.lineThrough : null,
                          decorationThickness: 2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Wrap(
                        spacing: 4,
                        runSpacing: 2,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (isTeamMode && team != null && teamColor != null)
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: teamColor!, width: 1),
                                color: Colors.black.withValues(alpha: 0.3),
                              ),
                              child: Text(
                                teamLabel,
                                style: GameViewTheme.body(4.5).copyWith(
                                  color: teamColor,
                                  shadows: [
                                    Shadow(
                                      color: teamColor!.withValues(alpha: 0.4),
                                      blurRadius: 4,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          if (jv)
                            Text(
                              i18n.translate('game_page.jv'),
                              style: GameViewTheme.body(4.8),
                            ),
                          if (showSpectatorLabel)
                            Text(
                              i18n.translate('game_page.spectator'),
                              style: GameViewTheme.body(4.5).copyWith(
                                color: const Color(0xFFFFCC00),
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (player.isHost)
                  const Padding(
                    padding: EdgeInsets.only(right: 4),
                    child: Icon(
                      Icons.workspace_premium,
                      size: 20,
                      color: Color(0xFFFFD700),
                    ),
                  ),
                Text(
                  '${player.victories}',
                  style: GameViewTheme.body(6.5).copyWith(
                    color: tertiaryColor,
                    fontWeight: FontWeight.w700,
                    shadows: [
                      Shadow(
                        color: tertiaryColor.withValues(alpha: 0.35),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (jv && (vpAggressive || vpDefensive))
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                decoration: BoxDecoration(
                  color: vpAggressive
                      ? const Color(0xDCDC2626)
                      : const Color(0xD92563EB),
                  borderRadius: const BorderRadius.only(
                    topRight: Radius.circular(6),
                    bottomLeft: Radius.circular(5),
                  ),
                ),
                child: Text(
                  vpAggressive ? 'A' : 'D',
                  style: GameViewTheme.body(3.8).copyWith(color: Colors.white),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
