import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/models/game_avatar.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/active_game_service.dart';
import 'package:provider/provider.dart';

const _kCombatPanelHeart = 'assets/player_pannel_icons/heart.png';
const _kCombatPanelSword = 'assets/player_pannel_icons/sword.png';
const _kCombatPanelShield = 'assets/player_pannel_icons/shield.png';
const _kIceDebuffGif = 'assets/ice-debuff.gif';

/// Combat GIF only (`avatar_combat/`), like Angular `getAvatarIdleAnimation` /
/// `getAvatarAttackAnimation` — not the card GIF (`avatar_gif/`) which hid the proper idle.
List<String> _combatAvatarAssetPaths(
  String? avatarName, {
  required bool attack,
}) {
  void addUnique(List<String> list, String path) {
    if (!list.contains(path)) list.add(path);
  }

  final paths = <String>[];
  // 1. Name resolution → `assets/avatar_combat/avatar_{idle|attack}/…`
  final primary = attack
      ? vsPopUpAttackImgSrc(avatarName)
      : vsPopUpIdleImgSrc(avatarName);
  addUnique(paths, primary);

  // 2. Absolute path provided by the server: only if it already points to the combat folder.
  final t = avatarName?.trim();
  if (t != null &&
      t.startsWith('assets/') &&
      t.toLowerCase().endsWith('.gif')) {
    final tl = t.toLowerCase();
    if (tl.contains('avatar_combat')) {
      addUnique(paths, t);
    }
  }

  // 3. Repli Archer combat.
  addUnique(
    paths,
    attack
        ? 'assets/avatar_combat/avatar_attack/archer.gif'
        : 'assets/avatar_combat/avatar_idle/archer.gif',
  );
  // 4. Last fallbacks if a combat file is missing (same bundle / typo).
  final resolved = lookupSelectableGameAvatar(avatarName);
  final animFallback = resolved?.animationAsset;
  if (animFallback != null) {
    addUnique(paths, animFallback);
  }
  addUnique(paths, 'assets/avatar_gif/archer.gif');
  return paths;
}

Widget _assetImageChain(List<String> paths, int index, double size) {
  if (index >= paths.length) {
    return Icon(Icons.person, size: size * 0.55, color: Colors.white38);
  }
  return SizedBox(
    width: size,
    height: size,
    child: FittedBox(
      fit: BoxFit.contain,
      child: Image.asset(
        paths[index],
        filterQuality: FilterQuality.none,
        errorBuilder: (_, __, ___) => _assetImageChain(paths, index + 1, size),
      ),
    ),
  );
}

Widget _combatAvatarAsset(
  String? avatarName,
  double size, {
  bool attack = false,
}) {
  final paths = _combatAvatarAssetPaths(avatarName, attack: attack);
  final primary = paths.isNotEmpty ? paths.first : '';
  return SizedBox(
    key: ValueKey<String>('combat_av_${avatarName ?? ''}_${attack ? 'atk' : 'idl'}_$primary'),
    width: size,
    height: size,
    child: _assetImageChain(paths, 0, size),
  );
}

/// Combat rendered in the **grid area** only (replaces [GameBoardView]), like the Angular `vs-pop-up`.
class CombatBoardArea extends StatelessWidget {
  const CombatBoardArea({super.key});

  @override
  Widget build(BuildContext context) {
    final game = context.watch<ActiveGameService>();
    if (!game.inCombat) return const SizedBox.shrink();

    final spectatorOnly =
        game.isLocalPlayerCombatSpectator && !game.isLocalPlayerEliminated;

    return Stack(
      fit: StackFit.expand,
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {
              // Prevents taps from reaching the grid below the overlay.
            },
            child: const ColoredBox(color: Colors.transparent),
          ),
        ),
        if (spectatorOnly)
          _CombatSpectatorView(game: game)
        else ...[
          _CombatSceneHost(game: game),
          if (game.combatChoicePending &&
              game.isLocalPlayerCombatParticipant &&
              !game.isLocalPlayerEliminated)
            _ChoiceOverlay(game: game),
          // Above the arena and the attack/escape choice (centered modal).
          if (game.showTargetSelectionAfterChoice &&
              game.availableTargets.isNotEmpty &&
              game.isLocalPlayerCombatParticipant &&
              !game.isLocalPlayerEliminated)
            _TargetSelectionOverlay(game: game),
        ],
      ],
    );
  }
}

// ── Spectateur (combat-spectator-card) ─────────────────────────────────────

class _CombatSpectatorView extends StatelessWidget {
  const _CombatSpectatorView({required this.game});
  final ActiveGameService game;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final padOuter = math.max(8.0, 2 * vmin);
    final padInnerH = math.max(20.0, 3 * vmin);
    final padInnerV = math.max(16.0, 2.5 * vmin);
    final radius = math.max(12.0, 1.5 * vmin);
    final borderW = math.max(2.0, 0.3 * vmin);

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: padOuter),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(
              color: const Color(0xB3FF3C3C),
              width: borderW,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0x66FF0000),
                blurRadius: math.max(24.0, 2 * vmin),
                spreadRadius: math.max(2.0, 0.2 * vmin),
              ),
            ],
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: padInnerH,
              vertical: padInnerV,
            ),
            child: game.isTeamCombat
                ? _spectatorTeamMode(i18n, vmin)
                : _spectatorDuelMode(i18n, vmin),
          ),
        ),
      ),
    );
  }

  Widget _spectatorDuelMode(I18n i18n, double vmin) {
    final left = game.playerOnCombatGrid(game.combatInitiatorId);
    final right = game.playerOnCombatGrid(game.combatTargetId);
    final mag = (1.15 + vmin * 0.02).clamp(1.15, 1.38);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _spectatorFighterSide(left, mirror: false, vmin: vmin),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: math.max(12.0, 2 * vmin)),
          child: _SwordsClashCenter(
            label: i18n.translate('combat.spectator_ongoing'),
            magnification: mag,
          ),
        ),
        _spectatorFighterSide(right, mirror: true, vmin: vmin),
      ],
    );
  }

  Widget _spectatorTeamMode(I18n i18n, double vmin) {
    final teamA = game.teamACombatPlayersOrdered;
    final teamB = game.teamBCombatPlayersOrdered;
    final tA = _lobbyTeamForFirst(game, teamA);
    final tB = _lobbyTeamForFirst(game, teamB);
    final cA = _parseHexColor(tA?.color ?? '#ffffff');
    final cB = _parseHexColor(tB?.color ?? '#ffffff');

    final mag = (1.12 + vmin * 0.018).clamp(1.12, 1.32);
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        _spectatorTeamColumn(
          i18n: i18n,
          team: tA,
          color: cA,
          players: teamA,
          mirrorAvatars: false,
          vmin: vmin,
        ),
        Padding(
          padding: EdgeInsets.symmetric(horizontal: math.max(10.0, 2 * vmin)),
          child: _SwordsClashCenter(
            label: i18n.translate('combat.spectator_ongoing'),
            magnification: mag,
          ),
        ),
        _spectatorTeamColumn(
          i18n: i18n,
          team: tB,
          color: cB,
          players: teamB,
          mirrorAvatars: true,
          vmin: vmin,
        ),
      ],
    );
  }

  Widget _spectatorFighterSide(
    GamePlayerState? p, {
    required bool mirror,
    required double vmin,
  }) {
    final w = math.max(100.0, 14 * vmin);
    final av = (16 * vmin).clamp(72.0, 118.0);
    final nameFs = (1.4 * vmin).clamp(7.0, 11.0);
    if (p == null) return SizedBox(width: w * 0.85);
    return SizedBox(
      width: w,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            p.name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.pressStart2p(
              fontSize: nameFs,
              color: Colors.white,
            ),
          ),
          SizedBox(height: math.max(6.0, 1 * vmin)),
          Transform(
            alignment: Alignment.center,
            transform: mirror
                ? Matrix4.diagonal3Values(-1.0, 1.0, 1.0)
                : Matrix4.identity(),
            child: _combatAvatarAsset(p.avatar, av),
          ),
        ],
      ),
    );
  }

  Widget _spectatorTeamColumn({
    required I18n i18n,
    required LobbyTeam? team,
    required Color color,
    required List<GamePlayerState> players,
    required bool mirrorAvatars,
    required double vmin,
  }) {
    final maxW = math.max(220.0, 18 * vmin);
    final avS = (11 * vmin).clamp(52.0, 92.0);
    final headerFs = math.max(5.5, 1.2 * vmin);
    final nameFs = math.max(5.0, 1.05 * vmin);
    return Container(
      constraints: BoxConstraints(maxWidth: maxW),
      padding: EdgeInsets.all(math.max(8.0, 1 * vmin)),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(color: color, width: 3),
          right: BorderSide(color: color, width: 3),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                team?.icon ?? '⚑',
                style: TextStyle(fontSize: math.max(16.0, 2.2 * vmin)),
              ),
              SizedBox(width: math.max(6.0, 0.6 * vmin)),
              Flexible(
                child: Text(
                  '${i18n.translate('combat.spectator_team')} ${team?.id ?? ''}',
                  style: GoogleFonts.pressStart2p(
                    fontSize: headerFs,
                    color: color,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          SizedBox(height: math.max(8.0, 0.8 * vmin)),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: math.max(8.0, 1.5 * vmin),
            runSpacing: math.max(8.0, 1.5 * vmin),
            children: players.map((p) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Transform(
                    alignment: Alignment.center,
                    transform: mirrorAvatars
                        ? Matrix4.diagonal3Values(-1.0, 1.0, 1.0)
                        : Matrix4.identity(),
                    child: _combatAvatarAsset(p.avatar, avS),
                  ),
                  SizedBox(height: math.max(4.0, 0.5 * vmin)),
                  SizedBox(
                    width: math.max(64.0, 8 * vmin),
                    child: Text(
                      p.name,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.pressStart2p(
                        fontSize: nameFs,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

LobbyTeam? _lobbyTeamForFirst(
  ActiveGameService game,
  List<GamePlayerState> ps,
) {
  if (ps.isEmpty) return null;
  return _lobbyTeamForPlayer(game, ps.first.id);
}

LobbyTeam? _lobbyTeamForPlayer(ActiveGameService game, String playerId) {
  for (final t in game.gameTeams) {
    if (t.players.any((p) => p.id == playerId)) return t;
  }
  return null;
}

Color _parseHexColor(String hex) {
  var h = hex.replaceFirst('#', '');
  if (h.length == 6) h = 'FF$h';
  try {
    return Color(int.parse(h, radix: 16));
  } catch (_) {
    return Colors.white;
  }
}

class _SwordsClashCenter extends StatelessWidget {
  const _SwordsClashCenter({
    required this.label,
    this.magnification = 1.0,
  });

  final String label;
  final double magnification;

  @override
  Widget build(BuildContext context) {
    final m = magnification.clamp(0.85, 1.6);
    return Transform.scale(
      scale: m,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _SwordSwing(left: true),
              SizedBox(width: 4),
              _SwordSwing(left: false),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  Colors.amber.withValues(alpha: 0.95),
                  Colors.deepOrange.withValues(alpha: 0.5),
                  Colors.transparent,
                ],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.orange.withValues(alpha: 0.6),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 6,
              color: const Color(0xFFFFCC00),
              shadows: const [Shadow(color: Colors.orange, blurRadius: 4)],
            ),
          ),
        ],
      ),
    );
  }
}

class _SwordSwing extends StatefulWidget {
  const _SwordSwing({required this.left});
  final bool left;

  @override
  State<_SwordSwing> createState() => _SwordSwingState();
}

class _SwordSwingState extends State<_SwordSwing>
    with SingleTickerProviderStateMixin {
  late AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = _c.value;
        double angle;
        if (widget.left) {
          angle = -0.7 + t * 1.1;
        } else {
          angle = 0.7 - t * 1.1;
        }
        return Transform.rotate(
          angle: angle,
          alignment: Alignment.bottomCenter,
          child: Transform(
            alignment: Alignment.center,
            transform: widget.left
                ? Matrix4.identity()
                : Matrix4.diagonal3Values(-1.0, 1.0, 1.0),
            child: CustomPaint(
              size: const Size(22, 36),
              painter: _SwordPainter(color: const Color(0xFFFF6B6B)),
            ),
          ),
        );
      },
    );
  }
}

class _SwordPainter extends CustomPainter {
  _SwordPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round;
    final cx = size.width / 2;
    canvas.drawLine(Offset(cx, 4), Offset(cx, size.height * 0.72), p);
    canvas.drawLine(
      Offset(cx - 5, size.height * 0.72),
      Offset(cx + 5, size.height * 0.72),
      p,
    );
    canvas.drawLine(
      Offset(cx - 3, size.height * 0.88),
      Offset(cx + 3, size.height * 0.88),
      p,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ── Participant scene (1v1 or team arena) ──────────────────────────────────

class _CombatSceneHost extends StatefulWidget {
  const _CombatSceneHost({required this.game});
  final ActiveGameService game;

  @override
  State<_CombatSceneHost> createState() => _CombatSceneHostState();
}

class _CombatSceneHostState extends State<_CombatSceneHost> {
  String? _attackAnimPlayerId;
  Timer? _attackAnimTimer;
  int _lastCombatAttackAnimToken = -1;

  void _onGameServiceChanged() {
    if (!mounted) return;
    _syncAttackAnimationFromService();
  }

  @override
  void initState() {
    super.initState();
    widget.game.addListener(_onGameServiceChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _syncAttackAnimationFromService();
    });
  }

  /// Aligned with `startAttackAnimation`: triggered when `combatAttackAnimationToken` increases.
  void _syncAttackAnimationFromService() {
    if (widget.game.combatAttackAnimationToken == 0) {
      _lastCombatAttackAnimToken = -1;
    }
    final token = widget.game.combatAttackAnimationToken;
    if (token <= _lastCombatAttackAnimToken) return;
    final atkId = widget.game.combatAttackAnimationPlayerId;
    if (atkId == null || atkId.isEmpty) return;
    _lastCombatAttackAnimToken = token;
    final ms = widget.game.combatAttackAnimationDurationMs;
    _attackAnimTimer?.cancel();
    _attackAnimPlayerId = atkId;
    _attackAnimTimer = Timer(Duration(milliseconds: ms), () {
      if (mounted) setState(() => _attackAnimPlayerId = null);
    });
    setState(() {});
  }

  @override
  void didUpdateWidget(covariant _CombatSceneHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.game != widget.game) {
      oldWidget.game.removeListener(_onGameServiceChanged);
      widget.game.addListener(_onGameServiceChanged);
    }
    _syncAttackAnimationFromService();
  }

  @override
  void dispose() {
    widget.game.removeListener(_onGameServiceChanged);
    _attackAnimTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _CombatScene(
      game: widget.game,
      attackAnimPlayerId: _attackAnimPlayerId,
    );
  }
}

class _CombatScene extends StatelessWidget {
  const _CombatScene({required this.game, required this.attackAnimPlayerId});

  final ActiveGameService game;
  final String? attackAnimPlayerId;

  @override
  Widget build(BuildContext context) {
    final screenW = MediaQuery.of(context).size.width;
    final compact = screenW < 700;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.black,
        boxShadow: [
          BoxShadow(color: Color(0xCCFF0000), blurRadius: 28, spreadRadius: 2),
        ],
      ),
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.hardEdge,
        children: [
          Image.asset(
            'assets/fire-background.gif',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => const SizedBox.shrink(),
          ),
          Container(color: Colors.black.withValues(alpha: 0.45)),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 100,
            child: IgnorePointer(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Color(0xFFFF4500),
                      Color(0xBBFF6600),
                      Color(0x66FF8C00),
                      Color(0x22FF4500),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return game.isTeamCombat
                      ? _TeamArena(
                          game: game,
                          attackAnimPlayerId: attackAnimPlayerId,
                          compact: compact,
                          maxHeight: constraints.maxHeight,
                        )
                      : _DuelArena(
                          game: game,
                          attackAnimPlayerId: attackAnimPlayerId,
                          compact: compact,
                          maxHeight: constraints.maxHeight,
                        );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DuelArena extends StatelessWidget {
  const _DuelArena({
    required this.game,
    required this.attackAnimPlayerId,
    required this.compact,
    required this.maxHeight,
  });

  final ActiveGameService game;
  final String? attackAnimPlayerId;
  final bool compact;
  final double maxHeight;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final ini = game.combatInitiatorId;
    final tgt = game.combatTargetId;

    return SizedBox(
      height: maxHeight,
      width: double.infinity,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final statsPanelWidth = (constraints.maxWidth * 0.38).clamp(
            128.0,
            300.0,
          );
          final statsInsetV = math.max(10.0, constraints.maxHeight * 0.022);
          final statsInsetH = math.max(12.0, constraints.maxWidth * 0.024);
          final shortSide = math.min(
            constraints.maxWidth,
            constraints.maxHeight,
          );
          // ~10vmin on the Angular side (`.vs-animation`)
          final vsFontSize = compact
              ? (shortSide * 0.09).clamp(32.0, 52.0)
              : (shortSide * 0.11).clamp(40.0, 68.0);
          final avatarSide = math
              .min(constraints.maxWidth * 0.44, constraints.maxHeight * 0.62)
              .clamp(88.0, 280.0);

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Positioned(
                      top: statsInsetV,
                      left: statsInsetH,
                      width: statsPanelWidth,
                      child: _DuelCornerStats(
                        rolePrefix: _roleLabel(i18n, game, ini),
                        playerName: game.combatInitiatorName,
                        stats: game.combatInitiatorCurrentStats,
                        diceRoll: game.initiatorDiceRoll,
                        escapeAttempts: game.getPlayerEscapeAttempts(ini),
                        isAttacker: game.combatAttackerId == ini,
                        compact: compact,
                      ),
                    ),
                    Positioned(
                      top: statsInsetV,
                      right: statsInsetH,
                      width: statsPanelWidth,
                      child: _DuelCornerStats(
                        rolePrefix: _roleLabel(i18n, game, tgt),
                        playerName: game.combatTargetName,
                        stats: game.combatTargetCurrentStats,
                        diceRoll: game.targetDiceRoll,
                        escapeAttempts: game.getPlayerEscapeAttempts(tgt),
                        isAttacker: game.combatAttackerId == tgt,
                        compact: compact,
                      ),
                    ),
                    Align(
                      alignment: Alignment.bottomCenter,
                      child: Padding(
                        padding: EdgeInsets.only(
                          bottom: math.max(10, constraints.maxHeight * 0.05),
                          left: 4,
                          right: 4,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _VsPulse(compact: compact, fontSize: vsFontSize),
                            SizedBox(
                              height: math.max(
                                6,
                                constraints.maxHeight * 0.018,
                              ),
                            ),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Expanded(
                                  child: Align(
                                    alignment: Alignment.bottomCenter,
                                    child: _combatAvatarAsset(
                                      game.combatInitiatorAvatar,
                                      avatarSide,
                                      attack: attackAnimPlayerId == ini,
                                    ),
                                  ),
                                ),
                                SizedBox(width: shortSide * 0.03),
                                Expanded(
                                  child: Align(
                                    alignment: Alignment.bottomCenter,
                                    child: Transform(
                                      alignment: Alignment.center,
                                      transform: Matrix4.diagonal3Values(
                                        -1.0,
                                        1.0,
                                        1.0,
                                      ),
                                      child: _combatAvatarAsset(
                                        game.combatTargetAvatar,
                                        avatarSide,
                                        attack: attackAnimPlayerId == tgt,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (game.isPlayerOnIceTile(ini) || game.isPlayerOnIceTile(tgt))
                _IceMalusBar(game: game, ids: [ini, tgt]),
            ],
          );
        },
      ),
    );
  }
}

class _TeamArena extends StatelessWidget {
  const _TeamArena({
    required this.game,
    required this.attackAnimPlayerId,
    required this.compact,
    required this.maxHeight,
  });

  final ActiveGameService game;
  final String? attackAnimPlayerId;
  final bool compact;
  final double maxHeight;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final teamA = game.teamACombatPlayersOrdered;
    final teamB = game.teamBCombatPlayersOrdered;
    final showArrow =
        game.combatAttackerId != null &&
        game.combatDefenderId != null &&
        !game.needsTargetSelection;

    return SizedBox(
      height: maxHeight,
      width: double.infinity,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final short = math.min(w, constraints.maxHeight);
          // Central banner above the cards (avoids VS / text behind the avatars).
          final centerBandW = (w * 0.26).clamp(104.0, 160.0);
          final vsFont = math.min(
            (short * 0.088).clamp(22.0, 48.0),
            centerBandW * 0.42,
          );
          final arrowLabelFs = (short * 0.019).clamp(4.0, 7.0);
          final arrowIconFs = (short * 0.046).clamp(14.0, 36.0);
          final choosingFs = (short * 0.021).clamp(4.0, 7.5);

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
            child: Stack(
              clipBehavior: Clip.none,
              fit: StackFit.expand,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: ClipRect(
                        clipBehavior: Clip.hardEdge,
                        child: _teamColumn(players: teamA, mirror: false),
                      ),
                    ),
                    Expanded(
                      child: ClipRect(
                        clipBehavior: Clip.hardEdge,
                        child: _teamColumn(players: teamB, mirror: true),
                      ),
                    ),
                  ],
                ),
                Positioned.fill(
                  child: IgnorePointer(
                    child: Row(
                      children: [
                        Expanded(child: SizedBox.expand()),
                        SizedBox(
                          width: centerBandW,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.centerLeft,
                                end: Alignment.centerRight,
                                colors: [
                                  Colors.black.withValues(alpha: 0.01),
                                  Colors.black.withValues(alpha: 0.55),
                                  Colors.black.withValues(alpha: 0.55),
                                  Colors.black.withValues(alpha: 0.01),
                                ],
                                stops: const [0.0, 0.12, 0.88, 1.0],
                              ),
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                _VsPulse(compact: compact, fontSize: vsFont),
                                if (showArrow) ...[
                                  SizedBox(height: short * 0.014),
                                  Text(
                                    i18n.translate('vs_popup.attack_arrow'),
                                    textAlign: TextAlign.center,
                                    maxLines: 4,
                                    style: GoogleFonts.pressStart2p(
                                      fontSize: arrowLabelFs,
                                      color: const Color(0xFFFF6B6B),
                                      height: 1.2,
                                      shadows: const [
                                        Shadow(
                                          color: Color(0xAA8B0000),
                                          blurRadius: 6,
                                        ),
                                      ],
                                    ),
                                  ),
                                  SizedBox(height: short * 0.008),
                                  Text(
                                    _attackArrow(game),
                                    textAlign: TextAlign.center,
                                    maxLines: 1,
                                    style: GoogleFonts.pressStart2p(
                                      fontSize: arrowIconFs,
                                      height: 1,
                                      color: const Color(0xFFFF6B6B),
                                      shadows: const [
                                        Shadow(
                                          color: Color(0xCC5C0000),
                                          blurRadius: 8,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                                if (game.combatShowsRemoteChoosingPhase) ...[
                                  SizedBox(height: short * 0.016),
                                  FittedBox(
                                    fit: BoxFit.scaleDown,
                                    alignment: Alignment.center,
                                    child: Text(
                                      '${i18n.translate('vs_popup.choosing_line1')}\n${i18n.translate('vs_popup.choosing_line2')}',
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: choosingFs,
                                        color: const Color(0xFFFFFF00),
                                        height: 1.3,
                                        shadows: const [
                                          Shadow(
                                            color: Color(0xAA804000),
                                            blurRadius: 6,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        Expanded(child: SizedBox.expand()),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  /// Team column: cards with `flex: 1` like the Angular `.team-card { flex: 1 }`.
  Widget _teamColumn({
    required List<GamePlayerState> players,
    required bool mirror,
  }) {
    if (players.isEmpty) {
      return const ColoredBox(color: Color(0x22000000));
    }
    final gap = 5.0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < players.length; i++)
            Expanded(
              child: Padding(
                padding: EdgeInsets.only(
                  bottom: i < players.length - 1 ? gap : 0,
                ),
                child: _TeamCombatCard(
                  game: game,
                  player: players[i],
                  mirrorAvatar: mirror,
                  compact: compact,
                  showAttackAnim: attackAnimPlayerId == players[i].id,
                  expandVertically: true,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

String _attackArrow(ActiveGameService g) {
  final aid = g.combatAttackerId;
  if (aid == null) return '⟶';
  final inA = g.teamACombatIds.contains(aid);
  return inA ? '⟶' : '⟵';
}

class _TeamCombatCard extends StatelessWidget {
  const _TeamCombatCard({
    required this.game,
    required this.player,
    required this.mirrorAvatar,
    required this.compact,
    required this.showAttackAnim,
    this.expandVertically = false,
  });

  final ActiveGameService game;
  final GamePlayerState player;
  final bool mirrorAvatar;
  final bool compact;
  final bool showAttackAnim;

  /// Fills the column height (`flex: 1` + avatar `flex: 1` on the Angular side).
  final bool expandVertically;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final isAtk = game.combatAttackerId == player.id;
    final isDef = game.combatDefenderId == player.id;
    final s = player.stats;
    final dice = game.combatDiceRollForPlayer(player.id);
    final showDice = dice is int || (dice is String && dice != '-');

    Border border = Border.all(
      color: Colors.white.withValues(alpha: 0.35),
      width: 1.5,
    );
    List<BoxShadow> shadows = const [];
    if (isAtk) {
      border = Border.all(color: const Color(0xFFFF6B6B), width: 2);
      shadows = const [
        BoxShadow(color: Color(0xD0FF3C3C), blurRadius: 14, spreadRadius: 0),
      ];
    } else if (isDef) {
      border = Border.all(color: const Color(0xFF6CBAFF), width: 2);
      shadows = const [
        BoxShadow(color: Color(0xD06CBAFF), blurRadius: 14, spreadRadius: 0),
      ];
    }

    final nameFs = compact ? 5.0 : 5.8;
    final badgeFs = compact ? 4.0 : 4.5;
    final bottomFs = compact ? 5.0 : 5.8;

    final inner = Container(
      padding: EdgeInsets.symmetric(
        horizontal: expandVertically ? 5 : 6,
        vertical: expandVertically ? 5 : 6,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(10),
        border: border,
        boxShadow: shadows,
      ),
      child: Column(
        mainAxisSize: expandVertically ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  player.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.pressStart2p(
                    fontSize: nameFs,
                    color: Colors.white,
                    height: 1.2,
                  ),
                ),
              ),
              if (isAtk) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xD9FF3C3C),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    i18n.translate('vs_popup.badge_atq'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: badgeFs,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
              if (isDef) ...[
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xD93C78FF),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    i18n.translate('vs_popup.badge_target'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: badgeFs,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          if (expandVertically)
            Expanded(
              child: Center(
                child: LayoutBuilder(
                  builder: (context, c) {
                    // Narrower/shorter: gives the central VS banner room to breathe.
                    final side = math.min(
                      c.maxWidth * 0.82,
                      c.maxHeight * 0.82,
                    );
                    final base = math.max(72.0, side);
                    return SizedBox(
                      width: side,
                      height: side,
                      child: FittedBox(
                        fit: BoxFit.contain,
                        child: SizedBox(
                          width: base,
                          height: base,
                          child: Transform(
                            alignment: Alignment.center,
                            transform: mirrorAvatar
                                ? Matrix4.diagonal3Values(-1.0, 1.0, 1.0)
                                : Matrix4.identity(),
                            child: _combatAvatarAsset(
                              player.avatar,
                              base,
                              attack: showAttackAnim,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            )
          else
            SizedBox(
              height: compact ? 56 : 72,
              child: Transform(
                alignment: Alignment.center,
                transform: mirrorAvatar
                    ? Matrix4.diagonal3Values(-1.0, 1.0, 1.0)
                    : Matrix4.identity(),
                child: _combatAvatarAsset(
                  player.avatar,
                  compact ? 56 : 72,
                  attack: showAttackAnim,
                ),
              ),
            ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _CombatIconStat(
                pngAsset: _kCombatPanelHeart,
                value: '${s?.life ?? 0}',
                valueColor: const Color(0xFF5AFF5A),
                compact: compact,
              ),
              if (isAtk) ...[
                const SizedBox(width: 8),
                _CombatIconStat(
                  pngAsset: _kCombatPanelSword,
                  value: '+${s?.attack ?? 0}',
                  valueColor: const Color(0xFFFF6B6B),
                  compact: compact,
                ),
              ],
              if (isDef) ...[
                const SizedBox(width: 8),
                _CombatIconStat(
                  pngAsset: _kCombatPanelShield,
                  value: '+${s?.defense ?? 0}',
                  valueColor: const Color(0xFF6CBAFF),
                  compact: compact,
                ),
              ],
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (showDice)
                Text(
                  '🎲 $dice',
                  style: GoogleFonts.pressStart2p(
                    fontSize: bottomFs,
                    color: const Color(0xFFCCCCCC),
                  ),
                ),
              if (showDice) SizedBox(width: compact ? 8 : 10),
              Text(
                '🏃 ${game.getPlayerEscapeAttempts(player.id)}',
                style: GoogleFonts.pressStart2p(
                  fontSize: bottomFs,
                  color: const Color(0xFFCCCCCC),
                ),
              ),
            ],
          ),
          if (game.isPlayerOnIceTile(player.id))
            Align(
              alignment: Alignment.center,
              child: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: _VsCardMalusChip(
                  label: i18n.translate('vs_popup.malus_ice'),
                  compact: compact,
                ),
              ),
            ),
        ],
      ),
    );

    if (expandVertically) {
      return SizedBox.expand(child: inner);
    }
    return inner;
  }
}

/// Equivalent of `.card-malus` (Angular vs-pop-up): ❄ chip + text, cyan border.
class _VsCardMalusChip extends StatelessWidget {
  const _VsCardMalusChip({required this.label, required this.compact});

  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.sizeOf(context);
    final vmin = math.min(mq.width, mq.height) * 0.01;
    final padH = math.max(4.0, 0.6 * vmin);
    final padV = math.max(2.0, 0.2 * vmin);
    final radius = math.max(3.0, 0.4 * vmin);
    final borderW = math.max(1.0, 0.15 * vmin);
    final textFs = compact
        ? (0.85 * vmin).clamp(3.8, 6.5)
        : (0.9 * vmin).clamp(4.2, 7.5);
    final flakeFs = (1.1 * vmin).clamp(4.5, 9.0);

    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: const Color(0x2600B4FF),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: const Color(0xFF00B4FF),
          width: borderW,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('❄', style: TextStyle(fontSize: flakeFs, height: 1.1)),
          SizedBox(width: math.max(3.0, 0.3 * vmin)),
          Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: textFs,
              color: const Color(0xFF00D4FF),
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

/// Equivalent of `.ice-malus-bar` + `.ice-malus-entry` (Angular 1v1 combat).
class _IceMalusBar extends StatelessWidget {
  const _IceMalusBar({required this.game, required this.ids});
  final ActiveGameService game;
  final List<String?> ids;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final mq = MediaQuery.sizeOf(context);
    final vmin = math.min(mq.width, mq.height) * 0.01;
    final gap = 4 * vmin;
    final iconSize = (3 * vmin).clamp(16.0, 28.0);
    final entryPadH = math.max(6.0, 0.8 * vmin + 2);
    final entryPadV = math.max(3.0, 0.3 * vmin + 1);
    final entryRadius = math.max(4.0, 0.5 * vmin);
    final borderW = math.max(1.0, 0.15 * vmin);
    final textFs = (1 * vmin).clamp(4.0, 7.0);
    final textMaxW = mq.width * 0.42;

    final entries = <Widget>[];
    for (final id in ids) {
      if (id == null) continue;
      if (!game.isPlayerOnIceTile(id)) continue;
      final name = game.playerOnCombatGrid(id)?.name ?? '';
      entries.add(
        Container(
          padding: EdgeInsets.symmetric(
            horizontal: entryPadH,
            vertical: entryPadV,
          ),
          decoration: BoxDecoration(
            color: const Color(0xD9001428),
            borderRadius: BorderRadius.circular(entryRadius),
            border: Border.all(
              color: const Color(0xFF00B4FF),
              width: borderW,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Image.asset(
                _kIceDebuffGif,
                width: iconSize,
                height: iconSize,
                filterQuality: FilterQuality.none,
                errorBuilder: (_, __, ___) => Text(
                  '❄',
                  style: TextStyle(fontSize: iconSize * 0.85, height: 1),
                ),
              ),
              SizedBox(width: math.max(4.0, 0.6 * vmin)),
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: textMaxW),
                child: Text(
                  '$name : ${i18n.translate('vs_popup.malus_ice')}',
                  style: GoogleFonts.pressStart2p(
                    fontSize: textFs,
                    color: const Color(0xFF00D4FF),
                    height: 1.25,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    if (entries.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.only(top: math.max(8.0, 0.6 * vmin)),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: gap,
        runSpacing: math.max(6.0, 0.5 * vmin),
        children: entries,
      ),
    );
  }
}

String _roleLabel(I18n i18n, ActiveGameService game, String? playerId) {
  if (playerId == null) return '';
  final isAtk = game.combatAttackerId == playerId;
  return '${i18n.translate(isAtk ? 'combat.attacker' : 'combat.defender')} :';
}

/// Corner stats banner (equivalent of the Angular `.player-info`), without avatar.
class _DuelCornerStats extends StatelessWidget {
  const _DuelCornerStats({
    required this.rolePrefix,
    required this.playerName,
    required this.stats,
    required this.diceRoll,
    required this.escapeAttempts,
    required this.isAttacker,
    required this.compact,
  });

  final String rolePrefix;
  final String playerName;
  final GameCombatStats? stats;
  final Object diceRoll;
  final int escapeAttempts;
  final bool isAttacker;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final s = stats;

    final padH = compact ? 10.0 : 12.0;
    final padV = compact ? 10.0 : 12.0;
    final roleFs = compact ? 6.0 : 7.0;
    final nameFs = compact ? 8.5 : 11.0;
    final metaFs = compact ? 6.5 : 8.0;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.75),
        border: Border.all(color: Colors.white, width: 2),
        borderRadius: BorderRadius.circular(10),
        boxShadow: const [
          BoxShadow(color: Color(0x80FFFFFF), blurRadius: 10, spreadRadius: 0),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            rolePrefix,
            style: GoogleFonts.pressStart2p(
              fontSize: roleFs,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            playerName,
            style: GoogleFonts.pressStart2p(
              fontSize: nameFs,
              color: Colors.white,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 2,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            '${i18n.translate('vs_popup.player_stats.last_roll')}: $diceRoll',
            style: GoogleFonts.pressStart2p(
              fontSize: metaFs,
              color: Colors.white,
            ),
            textAlign: TextAlign.center,
          ),
          Text(
            '${i18n.translate('vs_popup.player_stats.remaining_escapes')}: $escapeAttempts',
            style: GoogleFonts.pressStart2p(
              fontSize: metaFs,
              color: Colors.white70,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _CombatIconStat(
                pngAsset: _kCombatPanelHeart,
                value: '${s?.life ?? 0}',
                valueColor: const Color(0xFF5AFF5A),
                compact: compact,
              ),
              SizedBox(width: compact ? 8 : 10),
              if (isAttacker)
                _CombatIconStat(
                  pngAsset: _kCombatPanelSword,
                  value: '+${s?.attack ?? 0}',
                  valueColor: const Color(0xFFFF6B6B),
                  compact: compact,
                )
              else
                _CombatIconStat(
                  pngAsset: _kCombatPanelShield,
                  value: '+${s?.defense ?? 0}',
                  valueColor: const Color(0xFF6CBAFF),
                  compact: compact,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _VsPulse extends StatefulWidget {
  const _VsPulse({required this.compact, this.fontSize});
  final bool compact;

  /// If set (e.g. 1v1 duel), overrides the default size to match the web client (~10vmin).
  final double? fontSize;

  @override
  State<_VsPulse> createState() => _VsPulseState();
}

class _VsPulseState extends State<_VsPulse>
    with SingleTickerProviderStateMixin {
  late AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final scale = 0.92 + _c.value * 0.12;
        return Transform.scale(
          scale: scale,
          child: Text(
            'VS',
            maxLines: 1,
            softWrap: false,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: widget.fontSize ?? (widget.compact ? 22 : 30),
              color: const Color(0xFFFF2200),
              height: 1,
              shadows: const [
                Shadow(
                  offset: Offset(3, 3),
                  color: Colors.black,
                  blurRadius: 0,
                ),
                Shadow(
                  offset: Offset(-1, -1),
                  color: Color(0xFFFF6600),
                  blurRadius: 8,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _CombatIconStat extends StatelessWidget {
  const _CombatIconStat({
    required this.pngAsset,
    required this.value,
    required this.valueColor,
    this.compact = false,
  });

  final String pngAsset;
  final String value;
  final Color valueColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final h = compact ? 16.0 : 20.0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Image.asset(
          pngAsset,
          height: h,
          filterQuality: FilterQuality.none,
          errorBuilder: (_, __, ___) => SizedBox(width: h, height: h),
        ),
        const SizedBox(width: 5),
        Text(
          value,
          style: GoogleFonts.pressStart2p(
            fontSize: compact ? 8.5 : 11.0,
            color: valueColor,
            shadows: [
              Shadow(color: valueColor.withValues(alpha: 0.5), blurRadius: 4),
            ],
          ),
        ),
      ],
    );
  }
}

// ── Choix attaque / fuite (combat-choice) ───────────────────────────────────

class _ChoiceOverlay extends StatefulWidget {
  const _ChoiceOverlay({required this.game});
  final ActiveGameService game;

  @override
  State<_ChoiceOverlay> createState() => _ChoiceOverlayState();
}

class _ChoiceOverlayState extends State<_ChoiceOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _choiceBar;

  @override
  void initState() {
    super.initState();
    final seconds = widget.game.combatEscapeDisabled
        ? GameConstants.combatChoiceReducedSeconds
        : GameConstants.combatChoiceSeconds;
    _choiceBar = AnimationController(
      vsync: this,
      duration: Duration(seconds: seconds),
    )..forward();
  }

  @override
  void dispose() {
    _choiceBar.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final game = widget.game;
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: Container(color: Colors.black.withValues(alpha: 0.2)),
          ),
        ),
        Center(
          child: Container(
            width: 320,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xF32B2B2B),
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: const [
                BoxShadow(
                  offset: Offset(0, 4),
                  color: Colors.black54,
                  blurRadius: 16,
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  i18n.translate('vs_popup.title'),
                  style: GoogleFonts.pressStart2p(
                    fontSize: 9,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 14),
                AnimatedBuilder(
                  animation: _choiceBar,
                  builder: (_, __) => _CombatChoiceTimerBar(
                    fraction: 1.0 - _choiceBar.value,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _ActionButton(
                        label: i18n.translate('vs_popup.attack'),
                        color: const Color(0xFFFFCC00),
                        onPressed: () =>
                            game.sendCombatAction(GameActions.attack),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ActionButton(
                        label: i18n.translate('vs_popup.flee'),
                        color: game.combatEscapeDisabled
                            ? const Color(0xFF555555)
                            : const Color(0xFFFFCC00),
                        onPressed: game.combatEscapeDisabled
                            ? null
                            : () => game.sendCombatAction(GameActions.escape),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CombatChoiceTimerBar extends StatelessWidget {
  const _CombatChoiceTimerBar({required this.fraction});
  final double fraction;

  @override
  Widget build(BuildContext context) {
    final pct = fraction.clamp(0.0, 1.0);
    return Container(
      height: 18,
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFF555555),
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Align(
        alignment: Alignment.centerLeft,
        child: FractionallySizedBox(
          widthFactor: pct,
          child: Container(color: const Color(0xFF00FF00)),
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.color,
    this.onPressed,
  });

  final String label;
  final Color color;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: enabled ? color : const Color(0xFF555555),
          border: Border.all(color: Colors.black, width: 2),
          boxShadow: enabled
              ? const [BoxShadow(offset: Offset(3, 3), color: Colors.black)]
              : null,
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: GoogleFonts.pressStart2p(
            fontSize: 8,
            color: enabled ? Colors.black : Colors.white38,
          ),
        ),
      ),
    );
  }
}

// ── Target selection (team) ────────────────────────────────────────────────

class _TargetSelectionOverlay extends StatelessWidget {
  const _TargetSelectionOverlay({required this.game});
  final ActiveGameService game;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final urgent = game.targetTimerSecondsLeft <= 2;
    final mq = MediaQuery.sizeOf(context);
    final maxW = math.min(mq.width - 24, 420.0);
    final maxH = mq.height * 0.75;

    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          // Background: blocks interactions with the arena (no close on tap).
        },
        child: ColoredBox(
          color: Colors.black.withValues(alpha: 0.52),
          child: SafeArea(
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxW, maxHeight: maxH),
                child: Material(
                  color: Colors.transparent,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.94),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.red, width: 2),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0xB3FF0000),
                          blurRadius: 20,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            '${game.targetTimerSecondsLeft}',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.pressStart2p(
                              fontSize: 22,
                              color: urgent ? Colors.red : Colors.white,
                              shadows: [
                                Shadow(
                                  color: urgent ? Colors.red : Colors.white,
                                  blurRadius: urgent ? 6 : 4,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            i18n.translate('vs_popup.choose_target'),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.pressStart2p(
                              fontSize: 7,
                              color: Colors.red,
                              shadows: const [
                                Shadow(
                                  color: Colors.redAccent,
                                  blurRadius: 4,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          ...game.availableTargets.map(
                            (target) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: GestureDetector(
                                onTap: () =>
                                    game.sendTargetSelection(target.id),
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 10,
                                    horizontal: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(
                                      alpha: 0.06,
                                    ),
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(
                                      color: Colors.white,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      SizedBox(
                                        width: 40,
                                        height: 40,
                                        child: ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(4),
                                          child: FittedBox(
                                            fit: BoxFit.cover,
                                            child: SizedBox(
                                              width: 80,
                                              height: 80,
                                              child: _combatAvatarAsset(
                                                target.avatar,
                                                80,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              target.name,
                                              style:
                                                  GoogleFonts.pressStart2p(
                                                fontSize: 7,
                                                color: Colors.white,
                                              ),
                                            ),
                                            if (target.stats != null) ...[
                                              const SizedBox(height: 4),
                                              Row(
                                                mainAxisSize:
                                                    MainAxisSize.min,
                                                children: [
                                                  Image.asset(
                                                    _kCombatPanelHeart,
                                                    height: 12,
                                                    filterQuality:
                                                        FilterQuality.none,
                                                    errorBuilder:
                                                        (_, __, ___) =>
                                                            const Icon(
                                                      Icons.favorite,
                                                      color: Colors.redAccent,
                                                      size: 12,
                                                    ),
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    '${target.stats!.life}',
                                                    style: GoogleFonts
                                                        .pressStart2p(
                                                      fontSize: 6,
                                                      color: const Color(
                                                        0xFF5AFF5A,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
