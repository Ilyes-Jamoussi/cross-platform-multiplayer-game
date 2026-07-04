import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/app/stats_route_args.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/game_service.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/game_card.dart';
import 'package:mobile_client/widget/game_creation_page_loading.dart';
import 'package:mobile_client/widget/profile_background.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Game list for creating a match — aligned with `game-creation-page` + `game-creation-cards` (Angular).
class CreateGamePage extends StatefulWidget {
  const CreateGamePage({super.key});

  @override
  State<CreateGamePage> createState() => _CreateGamePageState();
}

class _CreateGamePageState extends State<CreateGamePage> {
  String? _overlayGameId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<GameService>().fetchPublicGames();
    });
  }

  @override
  Widget build(BuildContext context) {
    final currency = context.watch<AuthService>().currentUser?.virtualCurrency ?? 0;
    final topInset = MediaQuery.paddingOf(context).top;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(
            child: ProfileBackground(),
          ),
          Column(
            children: [
              WebGameFlowHeader(
                onMenuPressed: () => Navigator.pop(context),
              ),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: _GameListBody(
                    userCurrency: currency,
                    overlayGameId: _overlayGameId,
                    onOverlayGameIdChanged: (id) {
                      setState(() => _overlayGameId = id);
                    },
                    onShowNoMapsHelp: () {
                      Navigator.pushNamed(context, AppRoutes.gameCreationNoMapsHelp);
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
}

class _GameListBody extends StatelessWidget {
  const _GameListBody({
    required this.userCurrency,
    required this.overlayGameId,
    required this.onOverlayGameIdChanged,
    required this.onShowNoMapsHelp,
  });

  final int userCurrency;
  final String? overlayGameId;
  final ValueChanged<String?> onOverlayGameIdChanged;
  final VoidCallback onShowNoMapsHelp;

  static const Color _noGamesBg = Colors.transparent;

  @override
  Widget build(BuildContext context) {
    final themePrimary = context.watch<ThemeService>().primaryColor;
    return Consumer<GameService>(
      builder: (context, gameService, _) {
        if (gameService.isLoading && gameService.games.isEmpty) {
          return const GameCreationPageLoading(messageKey: 'game_creation.loading_games');
        }

        if (gameService.error != null && gameService.games.isEmpty) {
          return ColoredBox(
            color: _noGamesBg,
            child: _NoGamesPanel(
              title: I18n().translate('game_creation.load_error'),
              child: _WebStyleButton(
                label: I18n().translate('game_creation.retry'),
                onPressed: () => gameService.fetchPublicGames(),
              ),
            ),
          );
        }

        if (gameService.games.isEmpty) {
          return ColoredBox(
            color: _noGamesBg,
            child: _NoGamesPanel(
              title: I18n().translate('game_creation.aucun_jeu'),
              child: Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Text(
                      I18n().translate('game_creation.revenez_plus_tard'),
                      textAlign: TextAlign.center,
                      style: _noGamesTextStyle(context),
                    ),
                  ),
                  _WebStyleButton(
                    label: I18n().translate('game_creation.no_maps_action'),
                    onPressed: onShowNoMapsHelp,
                  ),
                ],
              ),
            ),
          );
        }

        return ColoredBox(
          color: Colors.transparent,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final media = MediaQuery.sizeOf(context);
              final vMin = media.shortestSide / 100;
              final maxGridWidth = math.min(constraints.maxWidth, 120 * vMin);
              // Usable width after the padding around the grid (2.5 vmin on each side).
              final innerW = maxGridWidth - 5 * vMin;
              // Goal: 3 cards per row when there is room, otherwise 2 then 1.
              int crossAxisCount = 3;
              if (innerW < 260) {
                crossAxisCount = 1;
              } else if (innerW < 380) {
                crossAxisCount = 2;
              }

              return RefreshIndicator(
                color: themePrimary,
                onRefresh: () => gameService.fetchPublicGames(),
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(4 * vMin, 2 * vMin, 4 * vMin, 2 * vMin),
                      sliver: SliverToBoxAdapter(
                        child: Center(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(maxWidth: maxGridWidth),
                            child: Padding(
                              padding: EdgeInsets.all(2.5 * vMin),
                              child: GridView.builder(
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: crossAxisCount,
                                  crossAxisSpacing: 5 * vMin,
                                  mainAxisSpacing: 5 * vMin,
                                  childAspectRatio: 0.75,
                                ),
                                itemCount: gameService.games.length,
                                itemBuilder: (context, index) {
                                  final game = gameService.games[index];
                                  return GameCard(
                                    game: game,
                                    userCurrency: userCurrency,
                                    onRefreshList: () {
                                      gameService.fetchPublicGames(silent: true);
                                    },
                                    validateGame: gameService.verifyGameExists,
                                    activeOverlayGameId: overlayGameId,
                                    onOverlayGameIdChanged: onOverlayGameIdChanged,
                                    onConfirmCreate: (gameId, entryFee) async {
                                      final lobby = context.read<LobbyRoomService>();
                                      final err = await lobby.createRoomAndJoin(
                                        gameId: gameId,
                                        entryFee: entryFee,
                                      );
                                      if (!context.mounted) return;
                                      if (err != null) {
                                        showGamePageSnackBar(context, err, kind: GamePageSnackKind.error);
                                        return;
                                      }
                                      final rid = lobby.roomId;
                                      if (rid == null) {
                                        showGamePageSnackBar(context, 'roomId invalide', kind: GamePageSnackKind.error);
                                        return;
                                      }
                                      await Navigator.pushNamed(
                                        context,
                                        AppRoutes.stats,
                                        arguments: StatsRouteArgs(
                                          roomId: rid,
                                          gameId: gameId,
                                          entryFee: entryFee,
                                        ),
                                      );
                                    },
                                  );
                                },
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  static TextStyle _noGamesTextStyle(BuildContext context) {
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;
    return GoogleFonts.pressStart2p(
      fontSize: (1.2 * vMin).clamp(8.0, 12.0),
      height: 1.5,
      color: Colors.white,
    );
  }
}

class _NoGamesPanel extends StatelessWidget {
  const _NoGamesPanel({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;
    final chipPad = EdgeInsets.symmetric(horizontal: 1.5 * vMin, vertical: 1 * vMin);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: chipPad,
              margin: EdgeInsets.symmetric(vertical: 1 * vMin),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(1 * vMin),
              ),
              child: Text(
                title,
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: (1.4 * vMin).clamp(9.0, 14.0),
                  height: 1.5,
                  color: Colors.white,
                ),
              ),
            ),
            Container(
              padding: chipPad,
              margin: EdgeInsets.symmetric(vertical: 1 * vMin),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(1 * vMin),
              ),
              child: child,
            ),
          ],
        ),
      ),
    );
  }
}

class _WebStyleButton extends StatelessWidget {
  const _WebStyleButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final primary = theme.primaryColor;
    final surface = theme.primarySurfaceColor;
    final onSurface = theme.onPrimarySurfaceColor;
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;
    return Padding(
      padding: EdgeInsets.only(top: 2 * vMin, bottom: 1 * vMin),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          minWidth: math.min(60 * vMin, MediaQuery.sizeOf(context).width * 0.85),
          minHeight: (10 * vMin).clamp(40.0, 72.0),
        ),
        child: Material(
          color: surface,
          borderRadius: BorderRadius.circular(5 * vMin),
          child: InkWell(
            borderRadius: BorderRadius.circular(5 * vMin),
            onTap: onPressed,
            child: Container(
              alignment: Alignment.center,
              padding: EdgeInsets.symmetric(horizontal: 3 * vMin, vertical: 3 * vMin),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(5 * vMin),
                border: Border.all(color: primary, width: math.max(2, 0.5 * vMin)),
              ),
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: (1.2 * vMin).clamp(8.0, 11.0),
                  height: 1.2,
                  color: onSurface,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
