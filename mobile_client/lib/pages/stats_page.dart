import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/app/stats_route_args.dart';
import 'package:mobile_client/models/game_avatar.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/character_stats_service.dart';
import 'package:mobile_client/services/cosmetics_service.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/socket_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mobile_client/widget/character_stats_panel.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:mobile_client/widget/poly_arena_message_popup.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Same screen as the Angular `stats-page` (character creation before the waiting room).
class StatsPage extends StatefulWidget {
  const StatsPage({super.key});

  @override
  State<StatsPage> createState() => _StatsPageState();
}

class _StatsPageState extends State<StatsPage> {
  int _selectedIndex = 0;
  LobbyRoomService? _lobby;
  bool _didAutoSelect = false;
  bool _submitting = false;
  bool _isValidateHovered = false;

  GameAvatarData get _selected => kSelectableGameAvatars[_selectedIndex];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final route = ModalRoute.of(context);
      final args = route?.settings.arguments;
      if (args is! StatsRouteArgs) {
        Navigator.pushReplacementNamed(context, AppRoutes.home);
        return;
      }
      final lobby = context.read<LobbyRoomService>();
      lobby.roomId = args.roomId;
      context.read<CharacterStatsService>().reset();
      lobby.addListener(_onLobbyChanged);

      _autoSelectFirstAvailable(lobby);

      lobby.enterStatsPhase(
        initialAvatarName: kSelectableGameAvatars[_selectedIndex].name,
      );
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _lobby ??= context.read<LobbyRoomService>();
  }

  @override
  void dispose() {
    _lobby?.removeListener(_onLobbyChanged);
    _lobby?.leaveStatsPhase();
    super.dispose();
  }

  void _onLobbyChanged() {
    if (!mounted) return;
    final lobby = _lobby;
    if (lobby == null) return;

    if (lobby.pendingKickMessage != null) {
      final msg = lobby.pendingKickMessage!;
      final titleKey = lobby.pendingKickTitleKey ?? 'popup.connection_error_title';
      lobby.clearPendingMessages();
      unawaited(lobby.leaveStatsPhase());
      lobby.leaveGameSocket();
      lobby.resetAfterLeave();
      final rootNav = Navigator.of(context, rootNavigator: true);
      rootNav.pushNamedAndRemoveUntil(AppRoutes.home, (_) => false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!rootNav.mounted) return;
        showPolyArenaMessageDialog(
          context: rootNav.context,
          kind: PolyArenaMessageKind.info,
          title: titleKey,
          message: msg,
          okLabel: 'common.ok',
        );
      });
      return;
    }

    final taken = lobby.selectedAvatarNames;
    if (taken.isEmpty) return;

    final currentName = kSelectableGameAvatars[_selectedIndex].name;
    final ownedAvatars = context.read<AuthService>().currentUser?.ownedAvatars ?? [];
    final featuredNames = CosmeticsService.featuredAvatars.map((a) => a.name).toSet();

    final takenByOthers = _takenByOthers(
      taken: taken,
      ownReservation: lobby.statsAvatarName,
    );

    final isTaken = takenByOthers.contains(currentName);
    if (!isTaken && _didAutoSelect) return;

    if (isTaken || !_didAutoSelect) {
      final firstAvailable = _findFirstAvailableIndex(takenByOthers, ownedAvatars, featuredNames);
      if (firstAvailable != null && firstAvailable != _selectedIndex) {
        setState(() => _selectedIndex = firstAvailable);
        lobby.emitAvatarReservation(kSelectableGameAvatars[firstAvailable].name);
      }
      _didAutoSelect = true;
    }
  }

  int? _findFirstAvailableIndex(
    List<String> takenNames,
    List<String> ownedAvatars,
    Set<String> featuredNames,
  ) {
    for (var i = 0; i < kSelectableGameAvatars.length; i++) {
      final avatar = kSelectableGameAvatars[i];
      final isLocked = featuredNames.contains(avatar.name) &&
          !ownedAvatars.contains(avatar.name) &&
          !ownedAvatars.contains(avatar.name.toLowerCase());
      if (!isLocked && !takenNames.contains(avatar.name)) {
        return i;
      }
    }
    return null;
  }

  List<String> _takenByOthers({
    required List<String> taken,
    required String? ownReservation,
  }) {
    if (ownReservation == null || ownReservation.isEmpty) {
      return List<String>.from(taken);
    }
    // Remove only one local reservation occurrence; keep duplicates from others.
    final others = List<String>.from(taken);
    final ownIdx = others.indexOf(ownReservation);
    if (ownIdx >= 0) {
      others.removeAt(ownIdx);
    }
    return others;
  }

  void _autoSelectFirstAvailable(LobbyRoomService lobby) {
    final taken = lobby.selectedAvatarNames;
    final ownedAvatars = context.read<AuthService>().currentUser?.ownedAvatars ?? [];
    final featuredNames = CosmeticsService.featuredAvatars.map((a) => a.name).toSet();
    final first = _findFirstAvailableIndex(taken, ownedAvatars, featuredNames);
    if (first != null) {
      setState(() => _selectedIndex = first);
    }
  }

  /// Like shop / profile: back to home clearing the stack.
  void _goHomeReplacingStack(BuildContext context) {
    if (!mounted) return;
    final lobby = context.read<LobbyRoomService>();
    final rootNav = Navigator.of(context, rootNavigator: true);
    lobby.leaveGameSocket();
    lobby.resetAfterLeave();
    rootNav.pushNamedAndRemoveUntil(AppRoutes.home, (_) => false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!rootNav.mounted) return;
      showPolyArenaMessageDialog(
        context: rootNav.context,
        kind: PolyArenaMessageKind.warning,
        title: 'popup.left_game_title',
        message: 'popup.left_game_message',
        okLabel: 'common.ok',
      );
    });
  }

  Future<void> _onValidate(CharacterStatsService stats) async {
    if (!stats.isValid) return;
    if (_submitting) return;
    setState(() => _submitting = true);
    try {
      final lobby = context.read<LobbyRoomService>();
      final socket = context.read<SocketService>();
      final auth = context.read<AuthService>();

      var username = auth.currentUser?.username.trim() ?? '';
      if (username.isEmpty) {
        final picked = await _promptUsernameDesktopStyle(context);
        if (!mounted || picked == null || picked.trim().isEmpty) return;
        username = picked.trim();
      }

      final sid = socket.socketId;
      if (sid == null || sid.isEmpty) {
        showGamePageSnackBar(context, 'Connexion au serveur en cours — réessayez.', kind: GamePageSnackKind.warning);
        return;
      }

      var avatarName = _selected.name;
      if (username.toLowerCase() == 'knuckles') {
        avatarName = 'Knuckles';
      }

      final errVal = await lobby.validateRoom();
      if (!mounted) return;
      if (errVal != null) {
        await showPolyArenaMessageDialog(
          context: context,
          kind: PolyArenaMessageKind.info,
          title: 'join_page.room_not_found_title',
          message: errVal.isNotEmpty ? errVal : 'server_msg.room_not_found',
          okLabel: 'common.ok',
        );
        return;
      }

      final player = LobbyPlayer(
        id: sid,
        name: username,
        avatar: avatarName,
        isHost: lobby.isHost,
      );
      final statsMap = <String, dynamic>{
        'life': stats.life,
        'speed': stats.speed,
        'attack': stats.attack,
        'defense': stats.defense,
      };

      final err = await lobby.selectAvatar(player: player, stats: statsMap);
      if (!mounted) return;
      if (err != null) {
        showGamePageSnackBar(context, err, kind: GamePageSnackKind.error);
        return;
      }

      final dropInResult = lobby.lastSelectAvatarResult;
      if (dropInResult != null && dropInResult.isDropIn) {
        if (!dropInResult.isDropInSuccess) {
          showGamePageSnackBar(context, I18n().translate('common.no_spawn'), kind: GamePageSnackKind.error);
          return;
        }
        lobby.dropInPlayer(player.id);
        if (!mounted) return;
        await Navigator.pushReplacementNamed(context, AppRoutes.game);
        return;
      }

      await Navigator.pushReplacementNamed(context, AppRoutes.loadingRoom);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Same content as the Angular `player-name-selection` (card background + X button).
  Future<String?> _promptUsernameDesktopStyle(BuildContext context) async {
    final controller = TextEditingController();
    final i18n = I18n();
    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.7),
      builder: (ctx) {
        final theme = ctx.read<ThemeService>();
        final p = theme.primaryColor;
        final sCol = theme.secondaryColor;
        final tCol = theme.tertiaryColor;
        final surface = theme.primarySurfaceColor;
        final onSurface = theme.onPrimarySurfaceColor;
        return Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          child: LayoutBuilder(
            builder: (context, c) {
              final s = MediaQuery.sizeOf(context).shortestSide;
              final vmin = s * 0.01;
              final boxW = (40 * vmin).clamp(260.0, 420.0);
              final boxH = (15 * vmin).clamp(140.0, 220.0);
              return Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.center,
                children: [
                  Container(
                    width: boxW,
                    height: boxH,
                    padding: EdgeInsets.all(2 * vmin),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(vmin),
                      border: Border.all(color: onSurface, width: 0.4 * vmin),
                      image: const DecorationImage(
                        image: AssetImage('assets/game_creation/creation_cards_back_ground.png'),
                        fit: BoxFit.cover,
                      ),
                      boxShadow: [
                        BoxShadow(color: p, spreadRadius: 1, blurRadius: 0),
                        BoxShadow(color: sCol, spreadRadius: 3, blurRadius: 0),
                        BoxShadow(color: tCol, spreadRadius: 5, blurRadius: 0),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(height: 2 * vmin),
                        Text(
                          i18n.translate('username_popup.title'),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.pressStart2p(
                            fontSize: (1 * vmin).clamp(8.0, 12.0),
                            color: onSurface,
                            height: 1.3,
                          ),
                        ),
                        SizedBox(height: 2 * vmin),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 2 * vmin),
                          child: TextField(
                            controller: controller,
                            maxLength: 10,
                            buildCounter: (
                              context, {
                              required currentLength,
                              required isFocused,
                              maxLength,
                            }) =>
                                const SizedBox.shrink(),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.pressStart2p(
                              fontSize: (1.6 * vmin).clamp(10.0, 14.0),
                              color: onSurface,
                            ),
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: surface,
                              hintText: i18n.translate('username_popup.placeholder'),
                              hintStyle: GoogleFonts.pressStart2p(
                                fontSize: (1.2 * vmin).clamp(8.0, 11.0),
                                color: onSurface.withValues(alpha: 0.45),
                              ),
                              contentPadding: EdgeInsets.symmetric(
                                vertical: 1.2 * vmin,
                                horizontal: vmin,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(4),
                                borderSide: BorderSide(
                                  color: onSurface,
                                  width: 0.2 * vmin,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(4),
                                borderSide: BorderSide(
                                  color: onSurface,
                                  width: 0.2 * vmin,
                                ),
                              ),
                            ),
                            onSubmitted: (v) {
                              if (v.trim().isNotEmpty) {
                                Navigator.pop(ctx, v.trim());
                              }
                            },
                          ),
                        ),
                        SizedBox(height: 1.5 * vmin),
                        ListenableBuilder(
                          listenable: controller,
                          builder: (context, _) {
                            final ok = controller.text.trim().isNotEmpty;
                            return ElevatedButton(
                              onPressed: ok
                                  ? () => Navigator.pop(ctx, controller.text.trim())
                                  : null,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF22D122),
                                foregroundColor: onSurface,
                                disabledBackgroundColor: const Color(0xFF22D122),
                                disabledForegroundColor: onSurface.withValues(alpha: 0.54),
                                padding: EdgeInsets.symmetric(
                                  horizontal: 2 * vmin,
                                  vertical: vmin,
                                ),
                                minimumSize: Size(16 * vmin, 4.5 * vmin),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(4),
                                  side: BorderSide(
                                    color: onSurface,
                                    width: 0.2 * vmin,
                                  ),
                                ),
                              ),
                              child: Text(
                                i18n.translate('username_popup.validate'),
                                style: GoogleFonts.pressStart2p(
                                  fontSize: (1.5 * vmin).clamp(9.0, 12.0),
                                ),
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    top: -2 * vmin,
                    right: boxW * 0.12,
                    child: Material(
                      color: surface,
                      shape: const CircleBorder(),
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () => Navigator.pop(ctx),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Image.asset(
                            'assets/x_button.png',
                            width: 7 * vmin,
                            height: 6 * vmin,
                            filterQuality: FilterQuality.none,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
    controller.dispose();
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final stats = context.watch<CharacterStatsService>();
    final theme = context.watch<ThemeService>();
    final mq = MediaQuery.of(context);
    final s = mq.size.shortestSide;
    final vmin = s * 0.01;
    final bottomInset = mq.padding.bottom;
    final topInset = mq.padding.top;
    final primary = theme.primaryColor;
    final backgroundAsset = theme.theme == AppThemeMode.red
        ? 'assets/dark_theme_background.gif'
        : 'assets/gif_stats.gif';

    return Scaffold(
      backgroundColor: Colors.black,
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: ColoredBox(
              color: Colors.black,
              child: Image.asset(
                backgroundAsset,
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
                alignment: Alignment.center,
                errorBuilder: (context, error, stackTrace) => ColoredBox(
                  color: theme.theme == AppThemeMode.red
                      ? Colors.black
                      : const Color(0xFF000116),
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WebGameFlowHeader(
                onMenuPressed: () => _goHomeReplacingStack(context),
              ),
              Expanded(
                child: SafeArea(
                  top: false,
                  bottom: false,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      const padH = 12.0;
                      const padT = 8.0;
                      final padB = 64.0 + bottomInset;
                      final innerW = constraints.maxWidth - 2 * padH;
                      final innerH = constraints.maxHeight - padT - padB;
                      return Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Padding(
                            padding: EdgeInsets.fromLTRB(
                              padH,
                              padT,
                              padH,
                              padB,
                            ),
                            child: SizedBox(
                              width: innerW,
                              height: innerH,
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                alignment: Alignment.center,
                                child: _buildStatsLayout(
                                  context: context,
                                  theme: theme,
                                  vmin: vmin,
                                  contentWidth: innerW,
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            right: 12,
                            bottom: 8 + bottomInset,
                            child: Tooltip(
                              message: [
                                '\u2022 ' +
                                    I18n().translate(
                                      'character_stats_page.tooltip.life_speed',
                                    ),
                                '\u2022 ' +
                                    I18n().translate(
                                      'character_stats_page.tooltip.attack_defense',
                                    ),
                              ].join('\n'),
                              preferBelow: false,
                              verticalOffset: 10,
                              textStyle: GoogleFonts.pressStart2p(
                                fontSize: (1.5 * vmin).clamp(9.0, 13.0),
                                color: const Color(0xFFFFA500),
                                height: 1.25,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black,
                                borderRadius: BorderRadius.circular(vmin),
                              ),
                              child: Opacity(
                                opacity: stats.isValid ? 1 : 0.7,
                                child: MouseRegion(
                                  onEnter: (_) {
                                    if (stats.isValid && !_submitting) {
                                      setState(() => _isValidateHovered = true);
                                    }
                                  },
                                  onExit: (_) {
                                    if (_isValidateHovered) {
                                      setState(() => _isValidateHovered = false);
                                    }
                                  },
                                  child: Material(
                                    color: (stats.isValid &&
                                            !_submitting &&
                                            _isValidateHovered)
                                        ? theme.secondaryColor
                                            .withValues(alpha: 0.53)
                                        : primary,
                                    borderRadius:
                                        BorderRadius.circular(2 * vmin),
                                    child: InkWell(
                                      onTap: stats.isValid && !_submitting
                                          ? () => _onValidate(stats)
                                          : null,
                                      borderRadius:
                                          BorderRadius.circular(2 * vmin),
                                      hoverColor: Colors.transparent,
                                      splashColor: Colors.white.withValues(alpha: 0.14),
                                      highlightColor: Colors.white.withValues(alpha: 0.08),
                                      child: Padding(
                                        padding: EdgeInsets.symmetric(
                                          horizontal: 3 * vmin,
                                          vertical: 1.5 * vmin,
                                        ),
                                        child: Text(
                                          I18n().translate(
                                            'character_stats_page.validate',
                                          ),
                                          style: GoogleFonts.pressStart2p(
                                            fontSize: (1.8 * vmin)
                                                .clamp(10.0, 16.0),
                                            color: Colors.white,
                                            height: 1.2,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            top: topInset + 12,
            right: 20,
            child: const WebGameFlowFloatingActions(),
          ),
        ],
      ),
    );
  }

  /// Grid to the left of the character / pedestal; stats right under the pedestal; no scroll
  /// (shrunk via `FittedBox` in the parent if the screen is small).
  Widget _buildStatsLayout({
    required BuildContext context,
    required ThemeService theme,
    required double vmin,
    required double contentWidth,
  }) {
    final preview = _DesktopCharacterPreview(
      avatar: _selected,
      vmin: vmin,
    );

    final grid = Builder(
      builder: (ctx) {
        final lobby = ctx.watch<LobbyRoomService>();
        final takenByOthers = _takenByOthers(
          taken: lobby.selectedAvatarNames,
          ownReservation: lobby.statsAvatarName,
        );
        return _DesktopAvatarGrid(
          selectedIndex: _selectedIndex,
          takenNames: takenByOthers,
          ownedAvatarNames:
              ctx.watch<AuthService>().currentUser?.ownedAvatars ?? [],
          vmin: vmin,
          primary: theme.primaryColor,
          secondary: theme.secondaryColor,
          tertiary: theme.tertiaryColor,
          secondaryDisabled: theme.secondaryDisabledColor,
          secondaryMuted: theme.secondaryColor.withValues(alpha: 0.53),
          onSelect: (i) {
            setState(() => _selectedIndex = i);
            context.read<LobbyRoomService>().emitAvatarReservation(
                  kSelectableGameAvatars[i].name,
                );
          },
        );
      },
    );

    final statsBlock = _QuadRingFrame(
      radius: 1.5 * vmin,
      innerWidth: 0.2 * vmin,
      middleWidth: 0.2 * vmin,
      outerWidth: 0.2 * vmin,
      outerMostWidth: 0.2 * vmin,
      innerColor: theme.primaryColor,
      middleColor: theme.secondaryColor,
      outerColor: theme.tertiaryColor,
      outerMostColor: theme.secondaryDisabledColor,
      child: const CharacterStatsPanel(),
    );

    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: contentWidth),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Padding(
            padding: EdgeInsets.only(top: 2 * vmin),
            child: Text(
              I18n().translate('character_stats_page.title'),
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: (3 * vmin).clamp(10.0, 16.0),
                color: Colors.white,
                height: 1.2,
                letterSpacing: 2,
                shadows: const [
                  Shadow(
                    blurRadius: 8,
                    offset: Offset(2, 2),
                    color: Color(0x80000000),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 8 * vmin),
          _buildCenteredOnPreviewBlock(
            contentWidth: contentWidth,
            vmin: vmin,
            preview: preview,
            grid: grid,
            statsBlock: statsBlock,
          ),
        ],
      ),
    );
  }

  /// Character + pedestal horizontally centered; grid to the left of the character block;
  /// stats centered under the pedestal (same axis as the character).
  Widget _buildCenteredOnPreviewBlock({
    required double contentWidth,
    required double vmin,
    required Widget preview,
    required Widget grid,
    required Widget statsBlock,
  }) {
    final previewSize = _DesktopCharacterPreview.layoutSize(vmin);
    final gridSize = _DesktopAvatarGrid.outerSize(vmin);
    final hGap = vmin.clamp(4.0, 12.0);
    final gridTop =
        ((previewSize.height - gridSize.height) / 2).clamp(0.0, double.infinity);
    final shiftLeft = (3.8 * vmin).clamp(10.0, 28.0);
    final gridLeft = contentWidth * 0.5 -
        previewSize.width * 0.5 -
        hGap -
        gridSize.width -
        shiftLeft;

    return SizedBox(
      width: contentWidth,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Align(
            alignment: Alignment.topCenter,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                preview,
                SizedBox(height: (2.8 * vmin).clamp(10.0, 22.0)),
                statsBlock,
              ],
            ),
          ),
          Positioned(
            left: gridLeft,
            top: gridTop,
            child: grid,
          ),
        ],
      ),
    );
  }
}

/// `image-container` + `character-image` + `pedestal` (stats-page Angular).
class _DesktopCharacterPreview extends StatelessWidget {
  const _DesktopCharacterPreview({
    required this.avatar,
    required this.vmin,
  });

  final GameAvatarData avatar;
  final double vmin;

  /// Same computation as in [build] (grid / Stack positioning).
  static double _pedestalTopVmin(double vmin) => 20.5 * vmin;

  static Size layoutSize(double vmin) {
    final box = 35 * vmin;
    final pedestalTop = _pedestalTopVmin(vmin);
    final pedestalLayoutH = 18 * vmin;
    final layoutH =
        (pedestalTop + pedestalLayoutH).clamp(box, box + 20 * vmin);
    final layoutW = (38 * vmin).clamp(box, box + 6 * vmin);
    return Size(layoutW, layoutH);
  }

  @override
  Widget build(BuildContext context) {
    final layout = layoutSize(vmin);
    final pedestalTop = _pedestalTopVmin(vmin);

    return SizedBox(
      width: layout.width,
      height: layout.height,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          Positioned(
            top: -20 * vmin,
            child: Image.asset(
              avatar.animationAsset,
              width: 50 * vmin,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.none,
              errorBuilder: (context, error, stackTrace) =>
                  Icon(Icons.person, size: 40 * vmin, color: Colors.white),
            ),
          ),
          Positioned(
            top: pedestalTop,
            child: Image.asset(
              'assets/pedestal.png',
              width: 38 * vmin,
              fit: BoxFit.contain,
            ),
          ),
        ],
      ),
    );
  }
}

/// 3×4 grid, filled by columns (`grid-auto-flow: column`), like the desktop.
class _DesktopAvatarGrid extends StatelessWidget {
  const _DesktopAvatarGrid({
    required this.selectedIndex,
    required this.takenNames,
    required this.ownedAvatarNames,
    required this.vmin,
    required this.primary,
    required this.secondary,
    required this.tertiary,
    required this.secondaryDisabled,
    required this.secondaryMuted,
    required this.onSelect,
  });

  final int selectedIndex;
  final List<String> takenNames;
  final List<String> ownedAvatarNames;
  final double vmin;
  final Color primary;
  final Color secondary;
  final Color tertiary;
  final Color secondaryDisabled;
  final Color secondaryMuted;
  final ValueChanged<int> onSelect;

  static final Set<String> _featuredNames =
      CosmeticsService.featuredAvatars.map((a) => a.name).toSet();

  bool _isLocked(GameAvatarData avatar) {
    if (!_featuredNames.contains(avatar.name)) return false;
    return !ownedAvatarNames.contains(avatar.name) &&
        !ownedAvatarNames.contains(avatar.name.toLowerCase());
  }

  /// Index grille k (0..11) → index avatar en ordre colonne-majeur (3 cols × 4 rows).
  static int _avatarIndexForGridCell(int k) {
    final row = k ~/ 3;
    final col = k % 3;
    return col * 4 + row;
  }

  /// Outer size (padding included), aligned with [build].
  static Size outerSize(double vmin) {
    const cols = 3;
    const rows = 4;
    // Smaller cells so all 4 rows fit without being cropped by the FittedBox.
    final gap = (0.82 * vmin).clamp(3.5, 9.0);
    final cell = 7.85 * vmin;
    final gridW = cols * cell + (cols - 1) * gap;
    final gridH = rows * cell + (rows - 1) * gap;
    final pad = (1.55 * vmin).clamp(5.5, 14.0);
    return Size(gridW + 2 * pad, gridH + 2 * pad);
  }

  @override
  Widget build(BuildContext context) {
    const cols = 3;
    const rows = 4;
    final gap = (0.82 * vmin).clamp(3.5, 9.0);
    final cell = 7.85 * vmin;
    final gridW = cols * cell + (cols - 1) * gap;
    final gridH = rows * cell + (rows - 1) * gap;
    final pad = (1.55 * vmin).clamp(5.5, 14.0);

    return _QuadRingFrame(
      radius: vmin,
      innerWidth: 0.3 * vmin,
      middleWidth: 0.2 * vmin,
      outerWidth: 0.2 * vmin,
      outerMostWidth: 0.2 * vmin,
      innerColor: primary,
      middleColor: secondary,
      outerColor: tertiary,
      outerMostColor: secondaryDisabled,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.75),
          borderRadius: BorderRadius.circular(vmin),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(vmin),
          clipBehavior: Clip.hardEdge,
          child: Padding(
            padding: EdgeInsets.all(pad),
            child: SizedBox(
              width: gridW,
              height: gridH,
              child: GridView.builder(
                padding: EdgeInsets.zero,
                primary: false,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  crossAxisSpacing: gap,
                  mainAxisSpacing: gap,
                  childAspectRatio: 1,
                ),
                itemCount: rows * cols,
                itemBuilder: (context, k) {
                  final avatarIndex = _avatarIndexForGridCell(k);
                  if (avatarIndex >= kSelectableGameAvatars.length) {
                    return const SizedBox.shrink();
                  }
                  final a = kSelectableGameAvatars[avatarIndex];
                  final sel = avatarIndex == selectedIndex;
                  final currentName = kSelectableGameAvatars[selectedIndex].name;
                  final locked = _isLocked(a);
                  final available =
                      !locked && (a.name == currentName || !takenNames.contains(a.name));

                  return _AvatarIconTile(
                    avatar: a,
                    selected: sel,
                    available: available,
                    locked: locked,
                    cell: cell,
                    borderW: 0.5 * vmin,
                    secondary: secondary,
                    onTap: available ? () => onSelect(avatarIndex) : null,
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Triple ring drawn stroke-only (no fill).
class _QuadRingFrame extends StatelessWidget {
  const _QuadRingFrame({
    required this.child,
    required this.radius,
    required this.innerWidth,
    required this.middleWidth,
    required this.outerWidth,
    required this.outerMostWidth,
    required this.innerColor,
    required this.middleColor,
    required this.outerColor,
    required this.outerMostColor,
  });

  final Widget child;
  final double radius;
  final double innerWidth;
  final double middleWidth;
  final double outerWidth;
  final double outerMostWidth;
  final Color innerColor;
  final Color middleColor;
  final Color outerColor;
  final Color outerMostColor;

  @override
  Widget build(BuildContext context) {
    final total = innerWidth + middleWidth + outerWidth + outerMostWidth;
    return CustomPaint(
      foregroundPainter: _QuadRingPainter(
        radius: radius,
        innerWidth: innerWidth,
        middleWidth: middleWidth,
        outerWidth: outerWidth,
        outerMostWidth: outerMostWidth,
        innerColor: innerColor,
        middleColor: middleColor,
        outerColor: outerColor,
        outerMostColor: outerMostColor,
      ),
      child: Padding(
        padding: EdgeInsets.all(total),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(radius),
          child: child,
        ),
      ),
    );
  }
}

class _QuadRingPainter extends CustomPainter {
  const _QuadRingPainter({
    required this.radius,
    required this.innerWidth,
    required this.middleWidth,
    required this.outerWidth,
    required this.outerMostWidth,
    required this.innerColor,
    required this.middleColor,
    required this.outerColor,
    required this.outerMostColor,
  });

  final double radius;
  final double innerWidth;
  final double middleWidth;
  final double outerWidth;
  final double outerMostWidth;
  final Color innerColor;
  final Color middleColor;
  final Color outerColor;
  final Color outerMostColor;

  @override
  void paint(Canvas canvas, Size size) {
    final total = innerWidth + middleWidth + outerWidth + outerMostWidth;
    final content = Rect.fromLTWH(
      total,
      total,
      size.width - 2 * total,
      size.height - 2 * total,
    );
    if (content.width <= 0 || content.height <= 0) return;

    final innerRect = content.inflate(innerWidth * 0.5);
    final middleRect = content.inflate(innerWidth + middleWidth * 0.5);
    final outerRect = content.inflate(innerWidth + middleWidth + outerWidth * 0.5);
    final outerMostRect = content.inflate(innerWidth + middleWidth + outerWidth + outerMostWidth * 0.5);

    final innerR = Radius.circular(radius + innerWidth * 0.5);
    final middleR = Radius.circular(radius + innerWidth + middleWidth * 0.5);
    final outerR = Radius.circular(radius + innerWidth + middleWidth + outerWidth * 0.5);
    final outerMostR = Radius.circular(radius + innerWidth + middleWidth + outerWidth + outerMostWidth * 0.5);

    canvas.drawRRect(
      RRect.fromRectAndRadius(outerMostRect, outerMostR),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = outerMostWidth
        ..color = outerMostColor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(outerRect, outerR),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = outerWidth
        ..color = outerColor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(middleRect, middleR),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = middleWidth
        ..color = middleColor,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(innerRect, innerR),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = innerWidth
        ..color = innerColor,
    );
  }

  @override
  bool shouldRepaint(covariant _QuadRingPainter oldDelegate) {
    return radius != oldDelegate.radius ||
        innerWidth != oldDelegate.innerWidth ||
        middleWidth != oldDelegate.middleWidth ||
        outerWidth != oldDelegate.outerWidth ||
        outerMostWidth != oldDelegate.outerMostWidth ||
        innerColor != oldDelegate.innerColor ||
        middleColor != oldDelegate.middleColor ||
        outerColor != oldDelegate.outerColor ||
        outerMostColor != oldDelegate.outerMostColor;
  }
}

class _AvatarIconTile extends StatelessWidget {
  const _AvatarIconTile({
    required this.avatar,
    required this.selected,
    required this.available,
    required this.locked,
    required this.cell,
    required this.borderW,
    required this.secondary,
    required this.onTap,
  });

  final GameAvatarData avatar;
  final bool selected;
  final bool available;
  final bool locked;
  final double cell;
  final double borderW;
  final Color secondary;
  final VoidCallback? onTap;

  static const Color _unavailableBorder = Color(0xFF7F8C8D);

  @override
  Widget build(BuildContext context) {
    final borderColor = locked || selected
        ? secondary
        : (!available ? _unavailableBorder : Colors.white);

    final tileRadius = (0.35 * cell).clamp(3.0, 8.0);
    Widget child = ClipRRect(
      borderRadius: BorderRadius.circular(tileRadius),
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: cell,
        height: cell,
        child: AnimatedScale(
          alignment: Alignment.center,
          scale: selected ? 1.05 : 1.0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeInOut,
          child: Container(
            width: cell,
            height: cell,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.3),
              border: Border.all(color: borderColor, width: borderW),
              borderRadius: BorderRadius.circular(tileRadius),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: secondary.withValues(alpha: 0.85),
                        blurRadius: 1.2 * cell * 0.08,
                        spreadRadius: 0,
                      ),
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.2),
                        offset: Offset(0.5 * borderW, 0.5 * borderW),
                        blurRadius: 1.5 * borderW,
                      ),
                    ],
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Padding(
                  padding: EdgeInsets.all(borderW * 0.4),
                  child: Image.asset(
                    avatar.iconAsset,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) =>
                        const Icon(Icons.face, color: Colors.white54),
                  ),
                ),
                if (locked)
                  ColoredBox(
                    color: Colors.black.withValues(alpha: 0.7),
                    child: Center(
                      child: SvgPicture.asset(
                        'assets/coin_icon.svg',
                        width: cell * 0.45,
                        height: cell * 0.45,
                        colorFilter: ColorFilter.mode(
                          secondary,
                          BlendMode.srcIn,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );

    if (!available && !locked) {
      child = Opacity(opacity: 0.5, child: child);
    } else if (locked) {
      child = Opacity(opacity: 0.7, child: child);
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: child,
      ),
    );
  }
}
