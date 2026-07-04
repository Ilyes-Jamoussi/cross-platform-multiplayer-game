part of 'active_game_service.dart';

/// Aligned with horizontal `Directions` (Angular only shows left / right on the grid).
String _facingFromGridStep(GamePosition prev, GamePosition next) {
  final dx = next.x - prev.x;
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  return 'right';
}

/// Movement, pathfinding, path preview, debug mode.
mixin _MovementMixin on _ActiveGameBase, _GridMixin {
  void _clearPathPreviewInternal() {
    pathPreviewPositions = <GamePosition>[];
    pathPreviewTarget = null;
    _previewPathCost = 0;
    _previewPathTurns = 0;
  }

  void clearPathPreview() {
    _clearPathPreviewInternal();
    notifyListeners();
  }

  void _refreshMovementHints() {
    reachableTileKeys.clear();
    final g = grid;
    if (g == null ||
        !isMyTurn ||
        blockPlaying ||
        isBoardPlayLockedForCombat ||
        isMoving ||
        isActionMode) {
      notifyListeners();
      return;
    }
    final me = localPlayerOnGrid;
    final cell = localPlayerCellPosition;
    if (me?.stats == null || cell == null) {
      notifyListeners();
      return;
    }

    final virtual = me!.copyWith(position: cell);
    final res = MovementPathfinding.findPaths(grid: g, player: virtual);
    for (final p in res.reachableTiles) {
      reachableTileKeys.add(MovementPathfinding.posKey(p));
    }
    reachableTileKeys.add(MovementPathfinding.posKey(cell));
    notifyListeners();
  }

  /// "Movement" portion of the tap (outside action mode).
  void _handleMovementTap(int lx, int ly) {
    final g = grid;
    if (g == null) return;
    final myCell = localPlayerCellPosition;
    final me = localPlayerOnGrid;
    if (myCell == null || me?.stats == null) return;

    final key = MovementPathfinding.posKey(GamePosition(x: lx, y: ly));
    if (!reachableTileKeys.contains(key)) {
      _clearPathPreviewInternal();
      notifyListeners();
      return;
    }

    if (pathPreviewTarget != null &&
        pathPreviewTarget!.x == lx &&
        pathPreviewTarget!.y == ly &&
        pathPreviewPositions.isNotEmpty) {
      sendMovePlayer(
        List<GamePosition>.from(pathPreviewPositions),
        pathCost: _previewPathCost,
        pathTurns: _previewPathTurns,
      );
      _clearPathPreviewInternal();
      notifyListeners();
      return;
    }

    final virtual = me!.copyWith(position: myCell);
    final res = MovementPathfinding.findPaths(
      grid: g,
      player: virtual,
      target: GamePosition(x: lx, y: ly),
    );
    if (res.pathPositions.isEmpty) {
      _clearPathPreviewInternal();
      notifyListeners();
      return;
    }
    pathPreviewTarget = GamePosition(x: lx, y: ly);
    pathPreviewPositions = res.pathPositions;
    _previewPathCost = res.pathCost;
    _previewPathTurns = res.pathTurns;
    notifyListeners();
  }

  /// Mobile parity with desktop right-click teleport:
  /// long-press on a tile teleports only when debug mode is enabled.
  void tryDebugTeleportFromHold(int lx, int ly) {
    if (!isDebug ||
        !isMyTurn ||
        blockPlaying ||
        isBoardPlayLockedForCombat ||
        isMoving ||
        isActionMode ||
        isLocalPlayerEliminated) {
      return;
    }
    _tryDebugTeleport(lx, ly);
    notifyListeners();
  }

  void sendMovePlayer(
    List<GamePosition> positions, {
    required int pathCost,
    required int pathTurns,
    bool isRightClick = false,
  }) {
    final roomId = _lobby.roomId;
    final g = grid;
    if (roomId == null || g == null || positions.isEmpty) return;
    final myCell = localPlayerCellPosition;
    final me = localPlayerOnGrid;
    if (myCell == null || me == null) return;

    final playerPayload = me.copyWith(position: myCell);
    final payload = <String, dynamic>{
      'roomId': roomId,
      'grid': g.cloneDeep().toMovePlayerGridJson(),
      'player': playerPayload.toJson(),
      'path': <String, dynamic>{
        'positions': positions.map((e) => e.toJson()).toList(),
        'cost': pathCost,
        'turns': pathTurns,
      },
    };
    if (isRightClick) payload['isRightClick'] = true;
    _socket.emit(ActiveGameSocketEvents.movePlayer, payload);
  }

  void _tryDebugTeleport(int lx, int ly) {
    final g = grid;
    final myCell = localPlayerCellPosition;
    if (g == null || myCell == null) return;
    final dest = GamePosition(x: lx, y: ly);
    if (!MovementPathfinding.isFreeTerrainCell(g, dest)) return;
    if (myCell.x == dest.x && myCell.y == dest.y) return;
    // Mark the next local PlayerNextPosition as a teleport so the
    // client-side deduction is skipped, including when the destination is an
    // adjacent tile (short hold on a neighbor).
    _pendingLocalTeleport = true;
    sendMovePlayer(
      <GamePosition>[dest],
      pathCost: 0,
      pathTurns: 0,
      isRightClick: true,
    );
    _clearPathPreviewInternal();
  }

  void _applyPlayerMove(
    GamePlayerState movingPlayer,
    GamePosition nextPosition, {
    bool skipSpeedDeduction = false,
  }) {
    final g = grid;
    if (g == null) return;
    final prev = movingPlayer.position;
    if (prev == null) return;

    // Eliminated player: position {-1, -1} means off-board — remove avatar.
    if (!_inBounds(g, nextPosition)) {
      if (_inBounds(g, prev)) {
        final cell = g.board[prev.x][prev.y];
        final cleared = BoardCellState(tile: cell.tile, item: cell.item, player: null);
        grid = _cloneGridReplaceCell(prev.x, prev.y, cleared, g);
        notifyListeners();
      }
      return;
    }
    if (!_inBounds(g, prev)) return;

    final cleared = BoardCellState(
      tile: g.board[prev.x][prev.y].tile,
      item: g.board[prev.x][prev.y].item,
      player: null,
    );

    final destCell = g.board[nextPosition.x][nextPosition.y];
    final tileCost = GameTileCost.forTile(destCell.tile);
    GamePlayerState placedPlayer;
    final s = movingPlayer.stats;
    final facing = movingPlayer.lastDirection != null &&
            movingPlayer.lastDirection!.trim().isNotEmpty
        ? movingPlayer.lastDirection
        : _facingFromGridStep(prev, nextPosition);
    // The server skips the speed deduction only for a teleport
    // (hold / isRightClick), regardless of distance. The flag passed
    // by the caller reflects that case for the local player.
    if (s != null && tileCost > 0 && !skipSpeedDeduction) {
      final newSpeed = s.speed - tileCost;
      final adjusted = GameCombatStats(
        life: s.life,
        speed: newSpeed < 0 ? 0 : newSpeed,
        attack: s.attack,
        defense: s.defense,
        maxLife: s.maxLife,
        maxSpeed: s.maxSpeed,
      );
      placedPlayer = movingPlayer.copyWith(
        position: nextPosition,
        stats: adjusted,
        lastDirection: facing,
      );
    } else {
      placedPlayer = movingPlayer.copyWith(
        position: nextPosition,
        lastDirection: facing,
      );
    }

    final placed = BoardCellState(tile: destCell.tile, item: destCell.item, player: placedPlayer);

    if (prev.x == nextPosition.x && prev.y == nextPosition.y) {
      grid = _cloneGridReplaceCell(nextPosition.x, nextPosition.y, placed, g);
    } else {
      grid = _cloneGridReplaceTwoCells(prev, cleared, nextPosition, placed, g);
    }
    _clearPathPreviewInternal();
    _refreshMovementHints();
  }

  // ── Socket handlers mouvement ──

  void _onPlayerNextPosition(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final pRaw = map['player'];
    final npRaw = map['nextPosition'];
    if (pRaw is! Map || npRaw is! Map) return;
    final moving = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
    final next = GamePosition.fromJson(Map<String, dynamic>.from(npRaw));
    // Consumes the local teleport flag: true only for the single
    // PlayerNextPosition that follows a hold in debug mode.
    bool skipSpeed = false;
    if (_pendingLocalTeleport && moving.id == myPlayerId) {
      skipSpeed = true;
      _pendingLocalTeleport = false;
    }
    _applyPlayerMove(moving, next, skipSpeedDeduction: skipSpeed);
  }

  void _onPlayerStartedMoving(dynamic _) {
    isMoving = true;
    _clearPathPreviewInternal();
    notifyListeners();
  }

  void _onToggleDebug(dynamic raw) {
    if (raw is! Map) return;
    final v = raw['isDebug'];
    if (v is bool) {
      isDebug = v;
      _logJournalKey(v ? 'log.debug_enabled' : 'log.debug_disabled', {});
      _clearPathPreviewInternal();
      _refreshMovementHints();
      notifyListeners();
    }
  }

  /// Host only: the debug toggle request comes from the mobile UI.
  void requestToggleDebugAsHost() {
    final roomId = _lobby.roomId;
    if (roomId == null || !_lobby.isHost) return;
    _socket.emit(DebugSocketEvents.toggleDebug, <String, String>{'roomId': roomId});
  }
}
