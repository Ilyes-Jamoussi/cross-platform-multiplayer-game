import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_client/app/router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/game/item_tooltips.dart';
import 'package:mobile_client/game/pathfinding.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/active_game_service.dart';
import 'package:mobile_client/services/shake_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/room_chat_service.dart';
import 'package:mobile_client/services/game_team_chat_service.dart';
import 'package:mobile_client/widget/game_board_view.dart';
import 'package:mobile_client/widget/game_chat_journal_panel.dart';
import 'package:mobile_client/widget/game_info_strip.dart';
import 'package:mobile_client/widget/inventory_swap_dialog.dart';
import 'package:mobile_client/widget/game_roster_list.dart';
import 'package:mobile_client/widget/trade_popup.dart';
import 'package:mobile_client/widget/combat_overlay.dart';
import 'package:mobile_client/widget/game_timer_bar.dart';
import 'package:mobile_client/widget/player_game_status_panel.dart';
import 'package:mobile_client/widget/game_session_header.dart';
import 'package:mobile_client/widget/poly_arena_confirm_popup.dart'
    show PolyArenaConfirmVariant, showPolyArenaConfirmDialog;
import 'package:mobile_client/widget/poly_arena_message_popup.dart';
import 'package:provider/provider.dart';
import 'package:mobile_client/app/i18n.dart';

Color? _parseTeamColorHex(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  final h = hex.replaceFirst('#', '');
  if (h.length != 6) return null;
  try {
    return Color(int.parse('FF$h', radix: 16));
  } catch (_) {
    return null;
  }
}

LobbyTeam? _localPlayerLobbyTeam(ActiveGameService game) {
  final myId = game.myPlayerId;
  if (myId.isEmpty) return null;
  for (final t in game.gameTeams) {
    if (t.players.any((p) => p.id == myId)) return t;
  }
  return null;
}

String _actionModeTooltip(ActiveGameService game, I18n i18n) {
  final base = game.isActionMode
      ? '${i18n.translate('game_page.tile_tooltip.default')}\n\n${i18n.translate('game_page.tile_tooltip.reclick')}'
      : i18n.translate('game_page.tile_tooltip.default');
  if (game.lobbyGameMode == LobbyGameMode.teams) {
    return '$base\n\n${i18n.translate('game_page.tile_tooltip.team_hint')}';
  }
  return base;
}

/// Grille de conversion RVB → niveaux de gris (filtre type Angular spectateur).
const List<double> _kSpectatorGrayMatrix = <double>[
  0.2126,
  0.7152,
  0.0722,
  0,
  0,
  0.2126,
  0.7152,
  0.0722,
  0,
  0,
  0.2126,
  0.7152,
  0.0722,
  0,
  0,
  0,
  0,
  0,
  1,
  0,
];

// ── Boutons droite partie : `active-game-page.component.scss` (#action, #finish, .pressed,
//    `button:disabled`, `.is-spectator-mode .button.active-game:not(#quit)`).
const double _kActiveGameBtnPillRadius = 999;
const double _kActiveGameBtnBorder = 2.5; // ~0.3vmin
const double _kActiveGameBtnBorderDisabled = 3; // ~0.4vmin
const Color _kAngularSpectatorGameBtnFg = Color(0xFF666666);
const Color _kAngularSpectatorGameBtnBorder = Color(0xFF444444);

RoundedRectangleBorder _activeGameButtonOutline({
  required ThemeService theme,
  required bool spectator,
  required bool enabled,
}) {
  final Color borderColor;
  final double width;
  if (spectator) {
    borderColor = _kAngularSpectatorGameBtnBorder;
    width = _kActiveGameBtnBorder;
  } else if (!enabled) {
    borderColor = theme.primaryColor;
    width = _kActiveGameBtnBorderDisabled;
  } else {
    borderColor = theme.primaryColor;
    width = _kActiveGameBtnBorder;
  }
  return RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(_kActiveGameBtnPillRadius),
    side: BorderSide(color: borderColor, width: width),
  );
}

/// `#action` + hover `--app-secondary-hover` + `.pressed` (`--app-secondary`).
ButtonStyle activeGameActionButtonStyle({
  required ThemeService theme,
  required bool spectator,
  required bool actionMode,
  required bool enabled,
}) {
  return ButtonStyle(
    elevation: const WidgetStatePropertyAll(0),
    shadowColor: const WidgetStatePropertyAll(Colors.transparent),
    surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
    minimumSize: const WidgetStatePropertyAll(Size(double.infinity, 44)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 10, vertical: 12),
    ),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    shape: WidgetStatePropertyAll(
      _activeGameButtonOutline(
        theme: theme,
        spectator: spectator,
        enabled: enabled,
      ),
    ),
    backgroundColor: WidgetStateProperty.resolveWith((states) {
      if (spectator) return theme.primarySurfaceColor;
      if (!enabled) return theme.primarySurfaceColor;
      if (actionMode) return theme.secondaryColor;
      if (states.contains(WidgetState.hovered) ||
          states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.focused)) {
        return theme.secondaryHoverColor;
      }
      return theme.primaryColor;
    }),
    foregroundColor: WidgetStateProperty.resolveWith((states) {
      if (spectator) return _kAngularSpectatorGameBtnFg;
      if (!enabled) return Colors.grey;
      return theme.onPrimaryButtonText;
    }),
    overlayColor: const WidgetStatePropertyAll(Colors.transparent),
  );
}

/// `#finish` (fond `--app-primary-background`, survol → `--app-primary`).
ButtonStyle activeGameFinishTurnButtonStyle({
  required ThemeService theme,
  required bool spectator,
  required bool enabled,
}) {
  return ButtonStyle(
    elevation: const WidgetStatePropertyAll(0),
    shadowColor: const WidgetStatePropertyAll(Colors.transparent),
    surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
    minimumSize: const WidgetStatePropertyAll(Size(double.infinity, 44)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 10, vertical: 12),
    ),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    shape: WidgetStatePropertyAll(
      _activeGameButtonOutline(
        theme: theme,
        spectator: spectator,
        enabled: enabled,
      ),
    ),
    backgroundColor: WidgetStateProperty.resolveWith((states) {
      if (spectator) return theme.primarySurfaceColor;
      if (!enabled) return theme.primarySurfaceColor;
      if (states.contains(WidgetState.hovered) ||
          states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.focused)) {
        return theme.primaryColor;
      }
      return theme.primarySurfaceColor;
    }),
    foregroundColor: WidgetStateProperty.resolveWith((states) {
      if (spectator) return _kAngularSpectatorGameBtnFg;
      if (!enabled) return Colors.grey;
      if (states.contains(WidgetState.hovered) ||
          states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.focused)) {
        return theme.onPrimaryButtonText;
      }
      return theme.onPrimarySurfaceColor;
    }),
    overlayColor: const WidgetStatePropertyAll(Colors.transparent),
  );
}

/// `#quit`: identical to `#finish` in the web client (`--app-primary` border, filled on hover).
ButtonStyle activeGameAbandonButtonStyle(ThemeService theme) {
  return ButtonStyle(
    elevation: const WidgetStatePropertyAll(0),
    shadowColor: const WidgetStatePropertyAll(Colors.transparent),
    surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
    minimumSize: const WidgetStatePropertyAll(Size(double.infinity, 44)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 10, vertical: 12),
    ),
    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(_kActiveGameBtnPillRadius),
        side: BorderSide(
          color: theme.primaryColor,
          width: _kActiveGameBtnBorder,
        ),
      ),
    ),
    backgroundColor: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.hovered) ||
          states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.focused)) {
        return theme.primaryColor;
      }
      return theme.primarySurfaceColor;
    }),
    foregroundColor: WidgetStateProperty.resolveWith((states) {
      if (states.contains(WidgetState.hovered) ||
          states.contains(WidgetState.pressed) ||
          states.contains(WidgetState.focused)) {
        return theme.onPrimaryButtonText;
      }
      return theme.onPrimarySurfaceColor;
    }),
    overlayColor: const WidgetStatePropertyAll(Colors.transparent),
  );
}

/// Game view: movement (double tap), turns, chat, etc.
class GamePage extends StatefulWidget {
  const GamePage({super.key});

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> {
  final _chatInput = TextEditingController();
  final _chatFocus = FocusNode();
  ActiveGameService? _gameRef;
  bool _listenerAttached = false;
  bool _bootstrapped = false;
  late final ShakeService _shakeService;
  Timer? _gameStartTimer;
  bool _showGameStartObjective = false;
  /// Tracks the `inCombat` transition to automatically close the keyboard
  /// (and release the chat TextField focus) when entering or leaving a
  /// combat — otherwise the keyboard reopens on its own after combat because the
  /// champ reste focus.
  bool _wasInCombat = false;

  @override
  void initState() {
    super.initState();
    _shakeService = ShakeService();
    _shakeService.onVerticalShake = _onVerticalShakeToggleDebug;
    _shakeService.start();
  }

  void _onVerticalShakeToggleDebug() {
    if (!mounted) return;
    final lobby = context.read<LobbyRoomService>();
    final game = context.read<ActiveGameService>();
    final inActiveGame = !game.isLoading && game.grid != null;
    if (!lobby.isHost || !inActiveGame) return;
    game.requestToggleDebugAsHost();
    showGamePageSnackBar(
      context,
      '${I18n().translate('game_page.debug')} (${I18n().translate('game_page.host')})',
      kind: GamePageSnackKind.info,
      duration: const Duration(seconds: 2),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_listenerAttached) {
      _listenerAttached = true;
      _gameRef = context.read<ActiveGameService>();
      _gameRef!.addListener(_onGameTick);
    }
    if (!_bootstrapped) {
      _bootstrapped = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
    }
  }

  bool _swapDialogShown = false;
  bool _tradeDialogShown = false;

  void _onGameTick() {
    final game = _gameRef;
    if (game == null || !mounted) return;

    _syncTeamChatIfNeeded(game);

    // Combat entry/exit: releases the chat focus to prevent the keyboard
    // from staying open during combat, or reopening on its own at the end
    // du combat (rebuild + TextField encore focus = keyboard re-pop).
    if (game.inCombat != _wasInCombat) {
      _wasInCombat = game.inCombat;
      if (_chatFocus.hasFocus) {
        _chatFocus.unfocus();
      }
    }

    if (game.currentTurnPlayer != null && _showGameStartObjective) {
      _gameStartTimer?.cancel();
      setState(() => _showGameStartObjective = false);
    }

    // No more players in the room → leave immediately
    if (game.shouldLeaveGame) {
      game.shouldLeaveGame = false;
      _leaveToHome();
      return;
    }

    // Annonce vainqueur de combat (client lourd : `WinnerAnnouncementComponent`)
    final combatWinMsg = game.combatWinnerAnnouncement;
    if (combatWinMsg != null) {
      final msg = combatWinMsg;
      game.clearCombatWinnerAnnouncement();
      _showCombatWinnerAnnouncement(msg);
    }

    // Inventory swap popup
    if (game.showInventorySwapPopup && !_swapDialogShown) {
      _swapDialogShown = true;
      _showInventorySwapDialog(game);
    }

    // Trade popup
    if (game.showTradePopup && !_tradeDialogShown) {
      _tradeDialogShown = true;
      _showTradeDialog(game);
    }

    // Winner announcement → show dialog then navigate to end page
    final winMsg = game.winnerAnnouncementMessage;
    if (winMsg != null && !_winnerDialogShown) {
      _winnerDialogShown = true;
      game.clearWinnerAnnouncement();
      _showWinnerAndNavigate(winMsg);
    }

    // If gameEnded data arrived (either after winner dialog or directly)
    if (game.endGameStats != null && !_navigatingToEnd) {
      if (_winnerDialogShown) {
        _navigateToEndGame();
      } else {
        _winnerDialogShown = true;
        _navigateToEndGame();
      }
    }
  }

  void _showInventorySwapDialog(ActiveGameService game) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: GamePageOverlays.dialogBarrier,
      builder: (ctx) => InventorySwapDialog(
        items: List<GameItem>.from(game.localInventory),
        onItemChosen: (discarded) {
          game.confirmItemSwap(discarded);
          _swapDialogShown = false;
          Navigator.of(ctx).pop();
        },
      ),
    ).then((_) {
      // If dialog closed without choosing (e.g. turn ended), auto-swap
      if (_swapDialogShown && game.showInventorySwapPopup) {
        game.autoSwapRandomItem();
        _swapDialogShown = false;
      }
    });
  }

  void _showTradeDialog(ActiveGameService game) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: GamePageOverlays.dialogBarrier,
      builder: (ctx) => TradePopup(game: game),
    ).then((_) {
      if (_tradeDialogShown && game.showTradePopup) {
        game.cancelTrade();
      }
      _tradeDialogShown = false;
    });
  }

  bool _winnerDialogShown = false;
  bool _navigatingToEnd = false;

  void _showWinnerAndNavigate(String message) {
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierColor: GamePageOverlays.dialogBarrier,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
          decoration: GamePageOverlays.winnerShellDecoration(),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 11,
              color: const Color(0xFFFFD700),
              height: 1.35,
            ),
          ),
        ),
      ),
    );

    // Auto-close after 3 seconds, then wait for gameEnded data
    Future<void>.delayed(
      const Duration(milliseconds: GameConstants.endGameDelayMs),
      () {
        if (mounted && Navigator.of(context).canPop()) {
          Navigator.of(context).pop(); // close dialog
        }
        _waitForEndGameStats();
      },
    );
  }

  void _showCombatWinnerAnnouncement(String message) {
    showDialog<void>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: false,
      barrierColor: Colors.transparent,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 28),
          decoration: GamePageOverlays.winnerShellDecoration(),
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 12,
              color: const Color(0xFFFFD700),
              height: 1.35,
            ),
          ),
        ),
      ),
    );
    Future<void>.delayed(
      const Duration(milliseconds: GameConstants.combatWinnerPopupMs),
      () {
        if (!mounted) return;
        final nav = Navigator.of(context, rootNavigator: true);
        if (nav.canPop()) {
          nav.pop();
        }
      },
    );
  }

  void _waitForEndGameStats() {
    if (!mounted) return;
    final game = context.read<ActiveGameService>();
    if (game.endGameStats != null) {
      _navigateToEndGame();
      return;
    }
    // Poll briefly in case the gameEnded event arrives a bit later
    Future<void>.delayed(const Duration(milliseconds: 500), () {
      if (!mounted) return;
      final g = context.read<ActiveGameService>();
      if (g.endGameStats != null) {
        _navigateToEndGame();
      } else {
        // Listen for it via the existing notifyListeners mechanism
        _navigatingToEnd = false; // allow _onGameTick to catch it
      }
    });
  }

  void _navigateToEndGame() {
    if (!mounted) return;
    _navigatingToEnd = true;
    final game = context.read<ActiveGameService>();
    game.detachSocketListeners();
    Navigator.of(
      context,
    ).pushNamedAndRemoveUntil(AppRoutes.endGame, (r) => false);
  }

  Future<void> _bootstrap() async {
    final lobby = context.read<LobbyRoomService>();
    final game = context.read<ActiveGameService>();
    final chat = context.read<RoomChatService>();
    final id = lobby.roomId;
    if (id == null || lobby.currentPlayer == null) {
      if (mounted) {
        Navigator.of(
          context,
        ).pushNamedAndRemoveUntil(AppRoutes.home, (r) => false);
      }
      return;
    }
    lobby.prepareForActiveGame();
    chat.attach(id);
    await game.startSession(id);
    if (mounted && game.loadError != null) {
      final i18n = I18n();
      showGamePageSnackBar(
        context,
        i18n.translateWithParams('game_page.load_error', {
          'detail': game.loadError!,
        }),
        kind: GamePageSnackKind.error,
      );
      _leaveToHome();
      return;
    }
    if (!mounted) return;
    _syncTeamChatIfNeeded(game);
    setState(() => _showGameStartObjective = true);
    _gameStartTimer?.cancel();
    _gameStartTimer = Timer(
      const Duration(milliseconds: GameConstants.gameStartObjectivePopupMs),
      () {
        if (mounted) setState(() => _showGameStartObjective = false);
      },
    );
  }

  void _syncTeamChatIfNeeded(ActiveGameService game) {
    final teamChat = context.read<GameTeamChatService>();
    final baseId = context.read<LobbyRoomService>().roomId;
    if (baseId == null) return;
    if (game.lobbyGameMode != LobbyGameMode.teams) {
      teamChat.detach();
      return;
    }
    final tid = game.getTeamIdForPlayer(game.myPlayerId);
    if (tid.isEmpty) return;
    teamChat.attach('$baseId-$tid');
  }

  Future<void> _confirmLeaveToHome() async {
    if (!mounted) return;
    final ok = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'popup.leave_game_confirm_title',
      messageKey: 'popup.leave_game_confirm_message',
      variant: PolyArenaConfirmVariant.heavyQuit,
    );
    if (!ok || !mounted) return;
    _leaveToHome();
  }

  void _leaveToHome() {
    final lobby = context.read<LobbyRoomService>();
    final chat = context.read<RoomChatService>();
    final teamChat = context.read<GameTeamChatService>();
    final game = context.read<ActiveGameService>();
    final rootNav = Navigator.of(context, rootNavigator: true);
    lobby.leaveGameSocket();
    game.reset();
    lobby.resetAfterLeave();
    chat.detach();
    teamChat.detach();
    _gameStartTimer?.cancel();
    if (mounted) {
      rootNav.pushNamedAndRemoveUntil(AppRoutes.home, (r) => false);
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
  }

  void _showTileInfoDialog(BoardCellState cell) {
    final i18n = I18n();
    final theme = context.read<ThemeService>();
    final descKey = _tileDescriptionI18nKey(cell.tile);
    final lines = <String>[
      '${i18n.translate('game_page.tile_info.tile')}: ${_humanTileName(cell.tile)}',
      if (descKey != null) i18n.translate(descKey),
      if (cell.item.name.isNotEmpty &&
          !cell.item.name.contains('UnusedSpawnPoint'))
        '${i18n.translate('right_click.item')}: ${translatedCellItemDescription(i18n, cell.item)}',
      if (cell.player != null)
        '${i18n.translate('right_click.player')}: ${cell.player!.name}',
    ];
    showDialog<void>(
      context: context,
      barrierColor: GamePageOverlays.dialogBarrier,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 320),
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
          decoration: GamePageOverlays.tileInfoDecoration(
            borderColor: theme.primaryColor,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                i18n.translate('game_page.tile_info.title'),
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: 9,
                  color: Colors.white,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 220),
                child: SingleChildScrollView(
                  child: Text(
                    lines.join('\n\n'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 6.5,
                      color: Colors.white.withValues(alpha: 0.88),
                      height: 1.5,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              TextButton(
                style: GamePageOverlays.tileInfoOkButtonStyle(
                  primaryColor: theme.primaryColor,
                  secondaryColor: theme.secondaryColor,
                ),
                onPressed: () => Navigator.pop(ctx),
                child: Text(
                  i18n.translate('common.ok'),
                  style: GoogleFonts.pressStart2p(
                    fontSize: 7,
                    color: theme.onPrimaryButtonText,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _humanTileName(String tile) {
    final i18n = I18n();
    switch (tile) {
      case 'TuileDeBase':
        return i18n.translate('game_page.tile_info.types.base');
      case 'Eau':
        return i18n.translate('game_page.tile_info.types.water');
      case 'Glace':
        return i18n.translate('game_page.tile_info.types.ice');
      case 'Mur':
        return i18n.translate('game_page.tile_info.types.wall');
      case 'Porte':
        return i18n.translate('game_page.tile_info.types.door_closed');
      case 'PorteOuverte':
        return i18n.translate('game_page.tile_info.types.door_open');
      default:
        return i18n.translateWithParams('game_page.tile_info.types.unknown', {
          'code': tile,
        });
    }
  }

  /// Descriptions aligned with the web client's `tile_info.*_desc` (`tile-info-const.ts`).
  String? _tileDescriptionI18nKey(String tile) {
    switch (tile) {
      case 'TuileDeBase':
        return 'tile_info.default_desc';
      case 'Eau':
        return 'tile_info.water_desc';
      case 'Glace':
        return 'tile_info.ice_desc';
      case 'Mur':
        return 'tile_info.wall_desc';
      case 'Porte':
        return 'tile_info.door_closed_desc';
      case 'PorteOuverte':
        return 'tile_info.door_open_desc';
      default:
        return null;
    }
  }

  String _matchModeDescription(ActiveGameService g) {
    final i18n = I18n();
    if (g.lobbyGameMode == LobbyGameMode.fastElimination) {
      return i18n.translate('loading_page.modes.fast_elimination');
    }
    if (g.lobbyGameMode == LobbyGameMode.teams) {
      return i18n.translate('loading_page.modes.teams');
    }
    if (g.isCtfSession) {
      return i18n.translate('loading_page.modes.ctf_standard');
    }
    return i18n.translate('loading_page.modes.classic_standard');
  }

  String? _gameStartObjectiveKey(ActiveGameService g) {
    if (g.lobbyGameMode == LobbyGameMode.fastElimination) {
      return 'game_page.game_info_popup.fast_elimination';
    }
    if (g.isCtfSession) {
      return 'game_page.game_info_popup.ctf_objective';
    }
    return 'game_page.game_info_popup.win_3_battles';
  }

  @override
  void dispose() {
    _shakeService.stop();
    _gameStartTimer?.cancel();
    _gameRef?.removeListener(_onGameTick);
    _chatInput.dispose();
    _chatFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.watch<ActiveGameService>();
    final chat = context.watch<RoomChatService>();
    context.watch<GameTeamChatService>();
    final lobbyRoom = context.watch<LobbyRoomService>();
    final themeService = context.watch<ThemeService>();
    final i18n = I18n();
    final gameBackgroundAsset = themeService.theme == AppThemeMode.red
        ? 'assets/dark_theme_background.gif'
        : 'assets/gif_stats.gif';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(_confirmLeaveToHome());
      },
      child: Theme(
        data: Theme.of(
          context,
        ).copyWith(tooltipTheme: GamePageOverlays.gameTooltipTheme),
        child: Scaffold(
          backgroundColor: GameViewTheme.background,
          resizeToAvoidBottomInset: false,
          body: Stack(
            fit: StackFit.expand,
            children: [
              Positioned.fill(
                child: ColoredBox(
                  color: Colors.black,
                  child: Image.asset(
                    gameBackgroundAsset,
                    fit: BoxFit.cover,
                    width: double.infinity,
                    height: double.infinity,
                    alignment: Alignment.center,
                  ),
                ),
              ),
              SafeArea(
                child: game.isLoading || game.grid == null
                    ? Center(
                        child: CircularProgressIndicator(
                          color: themeService.secondaryColor,
                        ),
                      )
                    : Column(
                        children: [
                          const GameSessionHeader(),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(8),
                              child: Builder(
                                builder: (context) {
                                  final spectator =
                                      game.isLocalPlayerEliminated;
                                  final modeChips =
                                      (game.isFogOfWar && !game.isDebug) ||
                                      game.isDropInSessionEnabled;
                                  final localTeam =
                                      game.lobbyGameMode == LobbyGameMode.teams
                                      ? _localPlayerLobbyTeam(game)
                                      : null;

                                  Widget leftPanel = Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      GameInfoStrip(
                                        gridSize: game.grid!.gridSize,
                                        playerCount: game.activePlayerCount,
                                        activeName:
                                            game.currentTurnPlayer?.name ?? '',
                                        isDebug: game.isDebug,
                                        modeDescription: _matchModeDescription(
                                          game,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      PlayerGameStatusPanel(
                                        player: game.localPlayerOnGrid,
                                        buffedAttack: game.buffedAttack,
                                        buffedDefense: game.buffedDefense,
                                        potionLifeBonus: game.potionLifeBonus,
                                        actionsLeft: game.actionsLeft,
                                        maxActions: game.maxActions,
                                        inventory: game.localInventory,
                                        teamBadgeId: localTeam?.id,
                                        teamBadgeColor: _parseTeamColorHex(
                                          localTeam?.color,
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Expanded(
                                        child: GameRosterList(
                                          players: game.rosterPlayers,
                                          currentTurnId:
                                              game.currentTurnPlayer?.id,
                                          disconnectedIds: game
                                              .disconnectedPlayerIds
                                              .toSet(),
                                          isFastElimination:
                                              game.lobbyGameMode ==
                                              LobbyGameMode.fastElimination,
                                          teams: game.gameTeams,
                                          isTeamMode:
                                              game.lobbyGameMode ==
                                              LobbyGameMode.teams,
                                        ),
                                      ),
                                    ],
                                  );

                                  if (spectator) {
                                    leftPanel = ColorFiltered(
                                      colorFilter: const ColorFilter.matrix(
                                        _kSpectatorGrayMatrix,
                                      ),
                                      child: Opacity(
                                        opacity: 0.7,
                                        child: IgnorePointer(child: leftPanel),
                                      ),
                                    );
                                  }

                                  Widget boardStack = Stack(
                                    clipBehavior: Clip.none,
                                    fit: StackFit.expand,
                                    children: [
                                      Padding(
                                        padding: EdgeInsets.only(
                                          bottom: modeChips ? 40 : 12,
                                        ),
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            4,
                                          ),
                                          child: Stack(
                                            fit: StackFit.expand,
                                            children: [
                                              Builder(
                                                builder: (context) {
                                                  final actionInfo =
                                                      (game.isActionMode &&
                                                          game.actionsLeft >
                                                              0 &&
                                                          game.isMyTurn &&
                                                          !game.blockPlaying &&
                                                          !game
                                                              .isBoardPlayLockedForCombat)
                                                      ? game.getAdjacentActionInfo()
                                                      : null;
                                                  return GameBoardView(
                                                    grid: game.grid!,
                                                    fogOfWar:
                                                        game.isFogOfWar &&
                                                        !game.isDebug,
                                                    viewerCell: game
                                                        .localPlayerCellPosition,
                                                    reachableTileKeys:
                                                        game.reachableTileKeys,
                                                    pathPreviewKeys: game
                                                        .pathPreviewPositions
                                                        .map(
                                                          MovementPathfinding
                                                              .posKey,
                                                        )
                                                        .toSet(),
                                                    pathConfirmKey:
                                                        game.pathPreviewTarget ==
                                                            null
                                                        ? null
                                                        : MovementPathfinding.posKey(
                                                            game.pathPreviewTarget!,
                                                          ),
                                                    actionTargetKeys:
                                                        actionInfo == null
                                                        ? const <String>{}
                                                        : actionInfo
                                                              .combatTargets
                                                              .map(
                                                                (e) =>
                                                                    MovementPathfinding.posKey(
                                                                      e.position,
                                                                    ),
                                                              )
                                                              .toSet(),
                                                    actionTradeKeys:
                                                        actionInfo == null
                                                        ? const <String>{}
                                                        : actionInfo
                                                              .tradeTargets
                                                              .map(
                                                                (e) =>
                                                                    MovementPathfinding.posKey(
                                                                      e.position,
                                                                    ),
                                                              )
                                                              .toSet(),
                                                    actionDoorKeys:
                                                        actionInfo == null
                                                        ? const <String>{}
                                                        : actionInfo.doors
                                                              .map(
                                                                MovementPathfinding
                                                                    .posKey,
                                                              )
                                                              .toSet(),
                                                    isTeamMode:
                                                        game.lobbyGameMode ==
                                                        LobbyGameMode.teams,
                                                    localPlayerId:
                                                        game.myPlayerId,
                                                    isTeammateOfLocal: (id) =>
                                                        game.isTeammate(id),
                                                    teamColorForPlayer: (id) =>
                                                        _parseTeamColorHex(
                                                          game.getTeamColorForPlayer(
                                                            id,
                                                          ),
                                                        ),
                                                    onLogicalCellTap:
                                                        game.isMyTurn &&
                                                            !game
                                                                .blockPlaying &&
                                                            !game
                                                                .isBoardPlayLockedForCombat &&
                                                            !game.isMoving &&
                                                            !game
                                                                .isLocalPlayerEliminated
                                                        ? (lx, ly) => game
                                                              .onLogicalCellTap(
                                                                lx,
                                                                ly,
                                                              )
                                                        : null,
                                                    onLogicalCellLongPress: (lx, ly) {
                                                      final fogHidden =
                                                          game.isFogOfWar &&
                                                          !game.isDebug &&
                                                          game.localPlayerCellPosition !=
                                                              null &&
                                                          ((lx -
                                                                          game
                                                                              .localPlayerCellPosition!
                                                                              .x)
                                                                      .abs() >
                                                                  GameFogConstants
                                                                      .radius ||
                                                              (ly -
                                                                          game
                                                                              .localPlayerCellPosition!
                                                                              .y)
                                                                      .abs() >
                                                                  GameFogConstants
                                                                      .radius);
                                                      if (fogHidden) {
                                                        return;
                                                      }
                                                      if (game.isDebug) {
                                                        game.tryDebugTeleportFromHold(
                                                          lx,
                                                          ly,
                                                        );
                                                      } else {
                                                        final c = game
                                                            .grid!
                                                            .board[lx][ly];
                                                        _showTileInfoDialog(c);
                                                      }
                                                    },
                                                  );
                                                },
                                              ),
                                              if (game.shouldShowCombatOverlay)
                                                const Positioned.fill(
                                                  child: CombatBoardArea(),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      if (modeChips)
                                        Positioned(
                                          bottom: 4,
                                          left: 0,
                                          right: 0,
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              if (game.isFogOfWar &&
                                                  !game.isDebug)
                                                _GameModeIndicatorChip(
                                                  label: i18n.translate(
                                                    'loading_page.fog_of_war_enabled',
                                                  ),
                                                  fillColor: Color.lerp(
                                                    const Color(0xFF5C4D9A),
                                                    themeService.primaryColor,
                                                    0.42,
                                                  )!,
                                                ),
                                              if (game.isFogOfWar &&
                                                  !game.isDebug &&
                                                  game.isDropInSessionEnabled)
                                                const SizedBox(width: 10),
                                              if (game.isDropInSessionEnabled)
                                                _GameModeIndicatorChip(
                                                  label: i18n.translate(
                                                    'loading_page.drop_in_enabled',
                                                  ),
                                                  fillColor: Color.lerp(
                                                    const Color(0xFF4CAF50),
                                                    themeService.secondaryColor,
                                                    0.38,
                                                  )!,
                                                ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  );

                                  if (spectator) {
                                    boardStack = ColorFiltered(
                                      colorFilter: const ColorFilter.matrix(
                                        <double>[
                                          0.7,
                                          0,
                                          0,
                                          0,
                                          0,
                                          0,
                                          0.7,
                                          0,
                                          0,
                                          0,
                                          0,
                                          0,
                                          0.7,
                                          0,
                                          0,
                                          0,
                                          0,
                                          0,
                                          1,
                                          0,
                                        ],
                                      ),
                                      child: IgnorePointer(child: boardStack),
                                    );
                                  }

                                  final Widget centerColumn = Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      if (!spectator) ...[
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            top: 2,
                                            bottom: 8,
                                          ),
                                          child: Center(
                                            child: GameTimerBar(
                                              display: game.timerDisplay,
                                              inCombat: game
                                                  .isMainTurnTimerFrozenForCombat,
                                              dimmed: !game.isMyTurn,
                                            ),
                                          ),
                                        ),
                                      ],
                                      Expanded(child: boardStack),
                                    ],
                                  );

                                  return Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Expanded(flex: 28, child: leftPanel),
                                      const SizedBox(width: 8),
                                      Expanded(flex: 44, child: centerColumn),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        flex: 28,
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            Expanded(
                                              child: GameChatJournalPanel(
                                                roomChat: chat,
                                                teamChat: context
                                                    .read<
                                                      GameTeamChatService
                                                    >(),
                                                isTeamGame:
                                                    game.lobbyGameMode ==
                                                    LobbyGameMode.teams,
                                                localPlayerId:
                                                    lobbyRoom.currentPlayer?.id,
                                                journal: game.filteredJournal,
                                                journalFilterMineOnly:
                                                    game.journalFilterMineOnly,
                                                onToggleJournalFilter:
                                                    game.toggleJournalFilter,
                                                chatInputController: _chatInput,
                                                chatInputFocusNode: _chatFocus,
                                                onSubmitMessage: (teamChannel) {
                                                  final lobby = context
                                                      .read<LobbyRoomService>();
                                                  final p = lobby.currentPlayer;
                                                  if (p == null) return;
                                                  final text = _chatInput.text
                                                      .trim();
                                                  if (text.isEmpty) return;
                                                  if (teamChannel) {
                                                    context
                                                        .read<
                                                          GameTeamChatService
                                                        >()
                                                        .send(text, p);
                                                  } else {
                                                    chat.send(text, p);
                                                  }
                                                  _chatInput.clear();
                                                },
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Tooltip(
                                              waitDuration: const Duration(
                                                milliseconds: 400,
                                              ),
                                              message: _actionModeTooltip(
                                                game,
                                                i18n,
                                              ),
                                              child: ElevatedButton(
                                                onPressed:
                                                    game.isMyTurn &&
                                                        !game.blockPlaying &&
                                                        !game.isMoving &&
                                                        !game
                                                            .isBoardPlayLockedForCombat &&
                                                        !game
                                                            .isLocalPlayerEliminated &&
                                                        game.actionsLeft > 0
                                                    ? game.toggleActionMode
                                                    : null,
                                                style: activeGameActionButtonStyle(
                                                  theme: themeService,
                                                  spectator: spectator,
                                                  actionMode: game.isActionMode,
                                                  enabled:
                                                      game.isMyTurn &&
                                                      !game.blockPlaying &&
                                                      !game.isMoving &&
                                                      !game
                                                          .isBoardPlayLockedForCombat &&
                                                      !game
                                                          .isLocalPlayerEliminated &&
                                                      game.actionsLeft > 0,
                                                ),
                                                child: Text(
                                                  i18n.translate(
                                                    'game_page.action',
                                                  ),
                                                  style:
                                                      GoogleFonts.pressStart2p(
                                                        fontSize: 7.5,
                                                      ),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            ElevatedButton(
                                              onPressed:
                                                  game.isMyTurn &&
                                                      !game.blockPlaying &&
                                                      !game.isMoving &&
                                                      !game
                                                          .isBoardPlayLockedForCombat &&
                                                      !game
                                                          .isLocalPlayerEliminated
                                                  ? game.requestNextTurn
                                                  : null,
                                              style: activeGameFinishTurnButtonStyle(
                                                theme: themeService,
                                                spectator: spectator,
                                                enabled:
                                                    game.isMyTurn &&
                                                    !game.blockPlaying &&
                                                    !game.isMoving &&
                                                    !game
                                                        .isBoardPlayLockedForCombat &&
                                                    !game
                                                        .isLocalPlayerEliminated,
                                              ),
                                              child: Text(
                                                i18n.translate(
                                                  'game_page.end_turn',
                                                ),
                                                style: GoogleFonts.pressStart2p(
                                                  fontSize: 7.5,
                                                ),
                                              ),
                                            ),
                                            const SizedBox(height: 6),
                                            ElevatedButton(
                                              onPressed: () => unawaited(
                                                _confirmLeaveToHome(),
                                              ),
                                              style:
                                                  activeGameAbandonButtonStyle(
                                                    themeService,
                                                  ),
                                              child: Text(
                                                i18n.translate(
                                                  'game_page.abandon',
                                                ),
                                                style: GoogleFonts.pressStart2p(
                                                  fontSize: 7,
                                                ),
                                                textAlign: TextAlign.center,
                                              ),
                                            ),
                                          ],
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
              ),
              if (!game.isLoading &&
                  game.grid != null &&
                  game.isLocalPlayerEliminated)
                Positioned(
                  top: MediaQuery.paddingOf(context).top + 52,
                  left: 12,
                  right: 12,
                  child: IgnorePointer(
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: themeService.secondaryColor,
                            width: 1.5,
                          ),
                        ),
                        child: Text(
                          i18n.translate('game_page.spectator'),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.pressStart2p(
                            fontSize: 9,
                            color: themeService.tertiaryColor,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (!game.isLoading &&
                  game.grid != null &&
                  game.showTurnFlashBanner &&
                  game.turnFlashPlayerName != null)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: IgnorePointer(
                    child: SafeArea(
                      bottom: false,
                      child: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Center(
                          child: GameTurnNotifySnackBar(
                            message: i18n.translateWithParams(
                              'game_page.turn_notification',
                              {'name': game.turnFlashPlayerName!},
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              if (!game.isLoading &&
                  game.grid != null &&
                  game.showYourTurnBanner &&
                  !game.isLocalPlayerEliminated)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Align(
                      alignment: const Alignment(0, -0.2),
                      child: GameInfoPopupBanner(
                        text: i18n.translate(
                          'game_page.game_info_popup.your_turn',
                        ),
                      ),
                    ),
                  ),
                ),
              if (_showGameStartObjective &&
                  !game.isLoading &&
                  game.grid != null)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Align(
                      alignment: const Alignment(0, -0.2),
                      child: GameInfoPopupBanner(
                        text: i18n.translate(_gameStartObjectiveKey(game)!),
                        duration: const Duration(
                          milliseconds: GameConstants.gameStartObjectivePopupMs,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GameModeIndicatorChip extends StatelessWidget {
  const _GameModeIndicatorChip({required this.label, required this.fillColor});

  final String label;
  final Color fillColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: fillColor,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: GoogleFonts.pressStart2p(fontSize: 6, color: Colors.white),
      ),
    );
  }
}
