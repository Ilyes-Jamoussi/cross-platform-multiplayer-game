import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/models/game_models.dart';

/// Result of `findPaths` (equivalent of `PathfindingResult` + `Path` in `common/interfaces`).
class GamePathResult {
  GamePathResult({
    required this.reachableTiles,
    this.pathPositions = const <GamePosition>[],
    this.pathCost = 0,
    this.pathTurns = 0,
  });

  final List<GamePosition> reachableTiles;
  final List<GamePosition> pathPositions;
  final int pathCost;
  final int pathTurns;
}

class _Neighbor {
  _Neighbor(this.position, this.direction);

  final GamePosition position;
  final String direction;
}

class _QueueItem {
  _QueueItem({
    required this.position,
    required this.cost,
    required this.path,
    required this.turns,
    required this.lastDirection,
  });

  final GamePosition position;
  final int cost;
  final List<GamePosition> path;
  final int turns;
  final String lastDirection;
}

class _PathAcc {
  _PathAcc({required this.positions, required this.cost, required this.turns});

  final List<GamePosition> positions;
  final int cost;
  final int turns;
}

abstract final class MovementPathfinding {
  static String posKey(GamePosition p) => '${p.x},${p.y}';

  /// Same algorithm as `PlayerMovementService.findPaths`.
  static GamePathResult findPaths({
    required GameGrid grid,
    required GamePlayerState player,
    GamePosition? target,
  }) {
    final speed = player.stats?.speed;
    final start = player.position;
    if (speed == null || start == null) {
      return GamePathResult(reachableTiles: <GamePosition>[]);
    }

    if (!_isPlayerValid(player)) {
      if (!_iceAdjacent(grid, start)) {
        return GamePathResult(reachableTiles: <GamePosition>[]);
      }
    }

    final queue = <_QueueItem>[
      _QueueItem(
        position: start,
        cost: 0,
        path: <GamePosition>[],
        turns: 0,
        lastDirection: '',
      ),
    ];
    final costs = <String, int>{};
    final visited = <String>{};
    final reachable = <GamePosition>[];
    final allPathsToTarget = <_PathAcc>[];

    while (queue.isNotEmpty) {
      queue.sort((a, b) {
        final c = a.cost.compareTo(b.cost);
        if (c != 0) return c;
        final lp = a.path.length.compareTo(b.path.length);
        if (lp != 0) return lp;
        return a.turns.compareTo(b.turns);
      });
      final current = queue.removeAt(0);
      final pos = current.position;
      final vKey = posKey(pos);
      if (visited.contains(vKey)) continue;
      visited.add(vKey);

      if (!(pos.x == start.x && pos.y == start.y)) {
        reachable.add(pos);
      }

      if (target != null && pos.x == target.x && pos.y == target.y) {
        // `current.path` already ends with `pos` (see `addToQueue` on the Angular side).
        final positions = List<GamePosition>.from(current.path);
        if (positions.isEmpty ||
            positions.last.x != pos.x ||
            positions.last.y != pos.y) {
          positions.add(pos);
        }
        allPathsToTarget.add(
          _PathAcc(positions: positions, cost: current.cost, turns: current.turns),
        );
      }

      for (final n in _neighbors(pos)) {
        if (!_isValidMove(grid, n.position)) continue;

        final tileCost = GameTileCost.forTile(grid.board[n.position.x][n.position.y].tile);
        final newCost = current.cost + tileCost;
        if (newCost > speed) continue;

        final ck = posKey(n.position);
        final prev = costs[ck];
        if (prev != null && newCost >= prev) continue;
        costs[ck] = newCost;

        final newTurns = current.lastDirection.isNotEmpty && current.lastDirection != n.direction
            ? current.turns + 1
            : current.turns;

        queue.add(
          _QueueItem(
            position: n.position,
            cost: newCost,
            path: List<GamePosition>.from(current.path)..add(n.position),
            turns: newTurns,
            lastDirection: n.direction,
          ),
        );
      }
    }

    if (target == null || allPathsToTarget.isEmpty) {
      return GamePathResult(reachableTiles: reachable);
    }

    allPathsToTarget.sort((a, b) {
      final c = a.cost.compareTo(b.cost);
      if (c != 0) return c;
      final lp = a.positions.length.compareTo(b.positions.length);
      if (lp != 0) return lp;
      return a.turns.compareTo(b.turns);
    });
    final best = allPathsToTarget.first;
    return GamePathResult(
      reachableTiles: reachable,
      pathPositions: best.positions,
      pathCost: best.cost,
      pathTurns: best.turns,
    );
  }

  static List<_Neighbor> _neighbors(GamePosition p) {
    return <_Neighbor>[
      _Neighbor(GamePosition(x: p.x + 1, y: p.y), 'right'),
      _Neighbor(GamePosition(x: p.x - 1, y: p.y), 'left'),
      _Neighbor(GamePosition(x: p.x, y: p.y + 1), 'up'),
      _Neighbor(GamePosition(x: p.x, y: p.y - 1), 'down'),
    ];
  }

  static bool _isPlayerValid(GamePlayerState player) {
    final s = player.stats?.speed;
    return s != null && s >= 0;
  }

  /// Aligned with `ActiveGridService.getIsIceAdjacent` (do not auto-end the turn).
  static bool isIceAdjacentToCell(GameGrid? grid, GamePosition? position) {
    if (grid == null || position == null) return false;
    return _iceAdjacent(grid, position);
  }

  static bool _iceAdjacent(GameGrid grid, GamePosition position) {
    const offs = <List<int>>[
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (final o in offs) {
      final p = GamePosition(x: position.x + o[0], y: position.y + o[1]);
      if (_inBounds(grid, p) && grid.board[p.x][p.y].tile == GameTileTypes.ice) {
        return true;
      }
    }
    return false;
  }

  static bool _inBounds(GameGrid grid, GamePosition p) {
    return p.x >= 0 &&
        p.y >= 0 &&
        p.x < grid.board.length &&
        p.y < (grid.board.isEmpty ? 0 : grid.board[0].length);
  }

  static bool _isValidMove(GameGrid grid, GamePosition position) {
    if (!_inBounds(grid, position)) return false;
    final cell = grid.board[position.x][position.y];
    if (cell.tile == GameTileTypes.wall || cell.tile == GameTileTypes.door) {
      return false;
    }
    return cell.player == null;
  }

  static bool isFreeTerrainCell(GameGrid grid, GamePosition position) {
    if (!_inBounds(grid, position)) return false;
    final cell = grid.board[position.x][position.y];
    if (cell.player != null) return false;
    if (cell.tile == GameTileTypes.wall || cell.tile == GameTileTypes.door) {
      return false;
    }
    return true;
  }
}
