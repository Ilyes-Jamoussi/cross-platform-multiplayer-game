import 'dart:math';

import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/game/game_item_assets.dart';
import 'package:mobile_client/models/game_models.dart';

/// Aligned with `common/shared-utils.ts` `createItem`.
GameItem createGameItem(String rawId, String tooltip) {
  String id = rawId;
  for (final knownId in _allItemIds) {
    if (rawId.contains(knownId)) {
      id = knownId;
      break;
    }
  }
  return GameItem(
    id: id,
    image: gameItemAssetPath(id) ?? '',
    tooltip: tooltip,
  );
}

const _allItemIds = <String>[
  GameItemIds.item1Potion,
  GameItemIds.item2Dague,
  GameItemIds.item3Bouclier,
  GameItemIds.item4Poison,
  GameItemIds.item5Revie,
  GameItemIds.item6De,
  GameItemIds.itemFlag,
];

/// Aligned with `common/constants.ts` `ITEM_VALID_TERRAINS`.
const _itemValidTerrains = <String>{
  GameTileTypes.ice,
  GameTileTypes.water,
  GameTileTypes.defaultTile,
  GameTileTypes.openedDoor,
};

/// Aligned with `common/constants.ts` `ADJACENT_POSITIONS`.
const _adjacentPositions = <List<int>>[
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/// Aligned with `common/constants.ts` `EXTENDED_DIRECTIONS`.
const _extendedDirections = <List<int>>[
  [-1, -1], [1, -1], [-1, 1], [1, 1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [1, -2], [-1, -2], [1, 2], [-1, 2],
  [2, -1], [-2, -1], [2, 1], [-2, 1],
  [-2, -2], [2, -2], [-2, 2], [2, 2],
  [3, 0], [-3, 0], [0, 3], [0, -3],
];

bool _isInBounds(int x, int y, int gridSize) {
  return x >= 0 && x < gridSize && y >= 0 && y < gridSize;
}

bool _isValidPositionForItem(int x, int y, List<List<BoardCellState>> board) {
  final size = board.length;
  if (!_isInBounds(x, y, size)) return false;
  if (y >= board[x].length) return false;
  final cell = board[x][y];
  return _itemValidTerrains.contains(cell.tile) &&
      cell.item.name.isEmpty &&
      cell.player == null;
}

/// Aligned with `common/shared-utils.ts` `findAvailableTerrainForItem`.
List<GamePosition> findAvailableTerrainForItem(
  GamePosition position,
  List<List<BoardCellState>> board,
) {
  final available = <GamePosition>[];

  for (final dir in _adjacentPositions) {
    final nx = position.x + dir[0];
    final ny = position.y + dir[1];
    if (_isValidPositionForItem(nx, ny, board)) {
      available.add(GamePosition(x: nx, y: ny));
    }
  }

  for (final dir in _extendedDirections) {
    if (available.length >= 2) break;
    final nx = position.x + dir[0];
    final ny = position.y + dir[1];
    if (_isValidPositionForItem(nx, ny, board)) {
      available.add(GamePosition(x: nx, y: ny));
    }
  }

  available.shuffle(Random());
  return available;
}
