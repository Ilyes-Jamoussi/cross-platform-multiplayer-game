import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/game/game_item_assets.dart';
import 'package:mobile_client/game/game_tile_assets.dart';
import 'package:mobile_client/game/pathfinding.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/models/game_avatar.dart';
import 'package:mobile_client/models/game_models.dart';

/// Team border / self highlight (equivalent of `highlight-team`, `highlight-other-team`,
/// `highlight-self.team-mode` in `active-grid.component.html`).
class _TeamCellAccent {
  const _TeamCellAccent({
    required this.borderColor,
    required this.selfYellowOverlay,
  });
  final Color borderColor;
  final bool selfYellowOverlay;
}

_TeamCellAccent? _computeTeamAccent({
  required BoardCellState cell,
  required bool fogHidden,
  required bool isTeamMode,
  required String? localPlayerId,
  required bool Function(String playerId)? isTeammateOfLocal,
  required Color? Function(String playerId)? teamColorForPlayer,
}) {
  if (!isTeamMode || fogHidden) return null;
  final p = cell.player;
  if (p == null) return null;
  final me = localPlayerId;
  if (me == null || me.isEmpty) return null;
  final teamFn = teamColorForPlayer;
  final mateFn = isTeammateOfLocal;
  if (teamFn == null || mateFn == null) return null;
  final border = teamFn(p.id) ?? const Color(0xFF888888);
  final isSelf = p.id == me;
  if (isSelf) {
    return _TeamCellAccent(borderColor: border, selfYellowOverlay: true);
  }
  // Teammate or opponent: same team-color border on the player's tile.
  return _TeamCellAccent(borderColor: border, selfYellowOverlay: false);
}

/// Grid using the same textures as the web client (`TILE_IMAGES`, `ITEM_IMAGE_MAP`).
///
/// **Visual alignment with Angular** (`active-grid.component.html` + default styles):
/// each [board] "row" is a CSS column (rows stacked vertically in the strip),
/// then the game columns sit side by side. Result: the tile displayed at
/// `(screenRow, screenColumn)` maps to `board[gameColumn][gameRow]`, not `board[row][column]`.
class GameBoardView extends StatelessWidget {
  const GameBoardView({
    super.key,
    required this.grid,
    this.fogOfWar = false,
    this.viewerCell,
    this.reachableTileKeys = const <String>{},
    this.pathPreviewKeys = const <String>{},
    this.pathConfirmKey,
    this.actionTargetKeys = const <String>{},
    this.actionTradeKeys = const <String>{},
    this.actionDoorKeys = const <String>{},
    this.isTeamMode = false,
    this.localPlayerId,
    this.isTeammateOfLocal,
    this.teamColorForPlayer,
    this.onLogicalCellTap,
    this.onLogicalCellLongPress,
  });

  final GameGrid grid;
  final bool fogOfWar;
  final GamePosition? viewerCell;

  /// `MovementPathfinding.posKey` keys for reachable tiles (incl. player).
  final Set<String> reachableTileKeys;
  final Set<String> pathPreviewKeys;

  /// Tile of the second tap (mobile double selection).
  final String? pathConfirmKey;

  /// Positions of actionable adjacent enemies (Angular `can-combat`).
  final Set<String> actionTargetKeys;

  /// Positions of adjacent teammates for trading (Angular `can-trade`).
  final Set<String> actionTradeKeys;

  /// Positions of actionable adjacent doors (orange).
  final Set<String> actionDoorKeys;

  /// Team mode: team-color borders on players (like the Angular `--team-color`).
  final bool isTeamMode;
  final String? localPlayerId;
  final bool Function(String playerId)? isTeammateOfLocal;
  final Color? Function(String playerId)? teamColorForPlayer;

  final void Function(int logicalX, int logicalY)? onLogicalCellTap;
  final void Function(int logicalX, int logicalY)? onLogicalCellLongPress;

  @override
  Widget build(BuildContext context) {
    final rows = grid.board.length;
    final cols = grid.board.isEmpty ? 0 : grid.board[0].length;
    if (rows <= 0 || cols <= 0) {
      return Center(
        child: Text(
          I18n().translate('game_page.map_unavailable'),
          style: const TextStyle(color: Colors.white),
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        return FittedBox(
          fit: BoxFit.contain,
          alignment: Alignment.center,
          child: SizedBox(
            width: rows * 48,
            height: cols * 48,
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: Column(
                children: [
                  for (var visualRow = 0; visualRow < cols; visualRow++)
                    Expanded(
                      child: Row(
                        children: [
                          for (var visualCol = 0; visualCol < rows; visualCol++)
                            Expanded(
                              child: _Cell(
                                cell: grid.board[visualCol][visualRow],
                                logicalX: visualCol,
                                logicalY: visualRow,
                                fogHidden: _isFogHidden(visualRow, visualCol),
                                teamAccent: _computeTeamAccent(
                                  cell: grid.board[visualCol][visualRow],
                                  fogHidden: _isFogHidden(visualRow, visualCol),
                                  isTeamMode: isTeamMode,
                                  localPlayerId: localPlayerId,
                                  isTeammateOfLocal: isTeammateOfLocal,
                                  teamColorForPlayer: teamColorForPlayer,
                                ),
                                reachable: reachableTileKeys.contains(
                                  MovementPathfinding.posKey(
                                    GamePosition(x: visualCol, y: visualRow),
                                  ),
                                ),
                                onPath: pathPreviewKeys.contains(
                                  MovementPathfinding.posKey(
                                    GamePosition(x: visualCol, y: visualRow),
                                  ),
                                ),
                                confirmTap:
                                    pathConfirmKey ==
                                    MovementPathfinding.posKey(
                                      GamePosition(x: visualCol, y: visualRow),
                                    ),
                                isActionTarget: actionTargetKeys.contains(
                                  MovementPathfinding.posKey(
                                    GamePosition(x: visualCol, y: visualRow),
                                  ),
                                ),
                                isActionTrade: actionTradeKeys.contains(
                                  MovementPathfinding.posKey(
                                    GamePosition(x: visualCol, y: visualRow),
                                  ),
                                ),
                                isActionDoor: actionDoorKeys.contains(
                                  MovementPathfinding.posKey(
                                    GamePosition(x: visualCol, y: visualRow),
                                  ),
                                ),
                                isLocalPlayer:
                                    localPlayerId != null &&
                                    localPlayerId!.isNotEmpty &&
                                    grid
                                            .board[visualCol][visualRow]
                                            .player
                                            ?.id ==
                                        localPlayerId,
                                onTap: onLogicalCellTap == null
                                    ? null
                                    : () => onLogicalCellTap!(
                                        visualCol,
                                        visualRow,
                                      ),
                                onLongPress: onLogicalCellLongPress == null
                                    ? null
                                    : () => onLogicalCellLongPress!(
                                        visualCol,
                                        visualRow,
                                      ),
                              ),
                            ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  bool _isFogHidden(int visualRow, int visualCol) {
    if (!fogOfWar) return false;
    final v = viewerCell;
    if (v == null) return true;
    final lx = visualCol;
    final ly = visualRow;
    return (lx - v.x).abs() > GameFogConstants.radius ||
        (ly - v.y).abs() > GameFogConstants.radius;
  }
}

/// Like Angular `facing-left` / `facing-right` (`active-grid.component.scss`).
bool _mapPlayerFacesLeft(String? lastDirection) {
  final d = lastDirection?.toLowerCase().trim() ?? '';
  return d == 'left';
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.cell,
    required this.logicalX,
    required this.logicalY,
    required this.fogHidden,
    required this.teamAccent,
    required this.reachable,
    required this.onPath,
    required this.confirmTap,
    required this.isActionTarget,
    required this.isActionTrade,
    required this.isActionDoor,
    required this.isLocalPlayer,
    this.onTap,
    this.onLongPress,
  });

  final BoardCellState cell;
  final int logicalX;
  final int logicalY;
  final bool fogHidden;
  final _TeamCellAccent? teamAccent;
  final bool reachable;
  final bool onPath;
  final bool confirmTap;
  final bool isActionTarget;
  final bool isActionTrade;
  final bool isActionDoor;
  final bool isLocalPlayer;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  Widget build(BuildContext context) {
    final tilePath = GameTileAssets.pathForTileType(cell.tile);
    final p = cell.player;
    final itemName = cell.item.name;
    final itemPath = gameItemAssetPath(itemName);
    final showItemLayer =
        itemPath != null && (itemName.contains('StartingPoint') || p == null);

    Widget core = Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: Image.asset(
            tilePath,
            fit: BoxFit.cover,
            color: fogHidden ? Colors.black : null,
            colorBlendMode: fogHidden ? BlendMode.modulate : null,
            errorBuilder: (context, error, stackTrace) =>
                Container(color: const Color(0xFF2E4A3E)),
          ),
        ),
        // Yellow overlay for the local player (all modes, like Angular highlight-self)
        if (isLocalPlayer &&
            teamAccent == null &&
            !fogHidden &&
            cell.player != null)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(color: const Color(0x80FFC400)),
            ),
          ),
        if (teamAccent != null && !fogHidden) ...[
          if (teamAccent!.selfYellowOverlay)
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(color: const Color(0x80FFC400)),
              ),
            ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: teamAccent!.borderColor, width: 2.5),
              ),
            ),
          ),
        ],
        // Like the Angular `.reachable`: green outline only (`#00ff7f`), no fill.
        if (reachable && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFF00FF7F), width: 2.5),
              ),
            ),
          ),
        if (onPath && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFFFCC00), width: 2),
                color: const Color(0x33FFCC00),
              ),
            ),
          ),
        if (confirmTap && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFFF6600), width: 2.5),
              ),
            ),
          ),
        if (isActionTarget && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0x55FF2222),
                border: Border.all(color: const Color(0xFFFF3333), width: 2),
              ),
            ),
          ),
        if (isActionTrade && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0x3300FFFF),
                border: Border.all(color: const Color(0xFF00E5E5), width: 2),
              ),
            ),
          ),
        if (isActionDoor && !fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0x44FFAA00),
                border: Border.all(color: const Color(0xFFFFAA00), width: 2),
              ),
            ),
          ),
        if (showItemLayer)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(2),
              child: Image.asset(
                itemPath,
                fit: BoxFit.contain,
                width: 36,
                height: 36,
                color: fogHidden ? Colors.black : null,
                colorBlendMode: fogHidden ? BlendMode.modulate : null,
                errorBuilder: (context, error, stackTrace) =>
                    const SizedBox.shrink(),
              ),
            ),
          ),
        if (p != null)
          Positioned.fill(
            child: ClipRect(
              child: Padding(
                padding: const EdgeInsets.all(1),
                child: Transform.scale(
                  scale: 1.38,
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.diagonal3Values(
                      _mapPlayerFacesLeft(p.lastDirection) ? -1.0 : 1.0,
                      1.0,
                      1.0,
                    ),
                    child: Image.asset(
                      gameMapAvatarGifAsset(p.avatar),
                      fit: BoxFit.contain,
                      color: fogHidden ? Colors.black : null,
                      colorBlendMode: fogHidden ? BlendMode.modulate : null,
                      errorBuilder: (context, error, stackTrace) =>
                          const Icon(Icons.person, color: Colors.white, size: 28),
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (fogHidden)
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: <Color>[
                    Color.fromRGBO(10, 10, 30, 0.88),
                    Color.fromRGBO(5, 5, 20, 0.95),
                  ],
                ),
              ),
            ),
          ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white24, width: 0.35),
            ),
          ),
        ),
      ],
    );

    if (onTap == null && onLongPress == null) {
      return core;
    }

    // HitTestBehavior.opaque: solid tiles properly receive taps on tablet
    // (avoids "dead" zones on the Stack).
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      onLongPress: onLongPress,
      child: core,
    );
  }
}
