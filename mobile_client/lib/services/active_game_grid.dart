part of 'active_game_service.dart';

/// Grid operations: cell manipulation, item/door/spawn events,
/// informations d'actions adjacentes.
mixin _GridMixin on _ActiveGameBase {
  bool _inBounds(GameGrid g, GamePosition p) {
    return p.x >= 0 &&
        p.y >= 0 &&
        p.x < g.gridSize &&
        p.y < g.gridSize &&
        p.x < g.board.length &&
        p.y < (g.board.isNotEmpty ? g.board[0].length : 0);
  }

  GameGrid _cloneGridReplaceCell(int x, int y, BoardCellState cell, GameGrid g) {
    final newBoard = <List<BoardCellState>>[];
    for (var i = 0; i < g.board.length; i++) {
      final row = <BoardCellState>[];
      for (var j = 0; j < g.board[i].length; j++) {
        row.add((i == x && j == y) ? cell : g.board[i][j]);
      }
      newBoard.add(row);
    }
    return GameGrid(gridSize: g.gridSize, board: newBoard, name: g.name, nbActions: g.nbActions);
  }

  GameGrid _cloneGridReplaceTwoCells(
    GamePosition a,
    BoardCellState cellA,
    GamePosition b,
    BoardCellState cellB,
    GameGrid g,
  ) {
    final newBoard = <List<BoardCellState>>[];
    for (var i = 0; i < g.board.length; i++) {
      final row = <BoardCellState>[];
      for (var j = 0; j < g.board[i].length; j++) {
        if (i == a.x && j == a.y) {
          row.add(cellA);
        } else if (i == b.x && j == b.y) {
          row.add(cellB);
        } else {
          row.add(g.board[i][j]);
        }
      }
      newBoard.add(row);
    }
    return GameGrid(gridSize: g.gridSize, board: newBoard, name: g.name, nbActions: g.nbActions);
  }

  GamePlayerState? _findPlayerOnGrid(String id) {
    final g = grid;
    if (g == null) return null;
    for (final row in g.board) {
      for (final c in row) {
        if (c.player?.id == id) return c.player;
      }
    }
    return null;
  }

  GamePlayerState _mergePlayerPreserveDisplayFields(
    GamePlayerState? existing,
    GamePlayerState incoming,
  ) {
    if (existing == null) return incoming;
    final mergedAvatar = incoming.avatar != null && incoming.avatar!.trim().isNotEmpty
        ? incoming.avatar
        : existing.avatar;
    final mergedName =
        incoming.name.trim().isNotEmpty ? incoming.name : existing.name;
    final mergedDirection =
        incoming.lastDirection != null && incoming.lastDirection!.trim().isNotEmpty
            ? incoming.lastDirection
            : existing.lastDirection;
    return GamePlayerState(
      id: incoming.id,
      name: mergedName,
      avatar: mergedAvatar,
      isHost: incoming.isHost,
      stats: incoming.stats ?? existing.stats,
      inventory: incoming.inventory ?? existing.inventory,
      victories: incoming.victories,
      type: incoming.type,
      seekResult: incoming.seekResult ?? existing.seekResult,
      position: incoming.position ?? existing.position,
      startingPoint: incoming.startingPoint ?? existing.startingPoint,
      lastDirection: mergedDirection,
      state: incoming.state,
      isSpectator: incoming.isSpectator,
      isIceApplied: incoming.isIceApplied,
    );
  }

  void _updatePlayerOnGrid(GamePlayerState p) {
    final g = grid;
    if (g == null) return;
    for (var x = 0; x < g.board.length; x++) {
      for (var y = 0; y < g.board[x].length; y++) {
        final c = g.board[x][y];
        if (c.player?.id == p.id) {
          // Eliminated player (position {-1,-1}): remove from grid entirely.
          final isEliminated = p.state == 'eliminated' || p.isSpectator;
          if (isEliminated && _isLocalPlayerId(p.id)) {
            _localPlayerEliminated = true;
          }
          final updatedPlayer = isEliminated
              ? null
              : _mergePlayerPreserveDisplayFields(c.player, p);
          final updated = BoardCellState(tile: c.tile, item: c.item, player: updatedPlayer);
          grid = _cloneGridReplaceCell(x, y, updated, g);
          return;
        }
      }
    }
  }

  /// Removes a disconnected player from the grid and marks their starting point
  /// as unused. Angular equivalent: `removeStartingPoint(playerId)`.
  void _removePlayerFromGrid(String playerId) {
    final g = grid;
    if (g == null) return;
    GameGrid updated = g;
    bool changed = false;
    for (var x = 0; x < g.board.length; x++) {
      for (var y = 0; y < g.board[x].length; y++) {
        final cell = updated.board[x][y];
        if (cell.player != null && cell.player!.id == playerId) {
          // Mark the starting point as unused and remove the player
          final sp = cell.player!.startingPoint;
          final newItem = ItemCellState(
            name: GameItemTypes.unusedStartingPoint,
            description: '',
          );
          final cleared = BoardCellState(
            tile: cell.tile,
            item: sp != null && sp.x == x && sp.y == y ? newItem : cell.item,
            player: null,
          );
          updated = _cloneGridReplaceCell(x, y, cleared, updated);
          changed = true;
        }
      }
    }
    if (changed) {
      grid = updated;
    }
  }

  // ── Grid events (doors, items, spawn) ──

  void _onDoorUpdated(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final posRaw = map['position'];
    if (posRaw is! Map) return;
    final pos = GamePosition.fromJson(Map<String, dynamic>.from(posRaw));
    final isOpened = map['isOpened'] == true;
    final tile = isOpened ? GameTileTypes.openedDoor : GameTileTypes.door;
    final g = grid;
    if (g == null || !_inBounds(g, pos)) return;
    final cell = g.board[pos.x][pos.y];
    final updated = BoardCellState(tile: tile, item: cell.item, player: cell.player);
    grid = _cloneGridReplaceCell(pos.x, pos.y, updated, g);

    // One log entry per server event (like `LogService` + `DoorUpdate`).
    String doorPlayerName = '?';
    String? doorPlayerId;
    final playerRaw = map['player'];
    if (playerRaw is Map) {
      final pm = Map<String, dynamic>.from(playerRaw);
      doorPlayerId = pm['id']?.toString();
      doorPlayerName = (pm['name'] ?? '?').toString();
    } else {
      doorPlayerId = map['playerId']?.toString();
      if (doorPlayerId != null) {
        doorPlayerName = _playerName(doorPlayerId);
      }
    }
    final doorKey = isOpened ? 'log.door_opened' : 'log.door_closed';
    _logJournalKey(doorKey, {'name': doorPlayerName}, p1: doorPlayerId);

    notifyListeners();
  }

  void _onItemPickedUp(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final itemPosition = map['itemPosition'];
    if (itemPosition is! Map) return;
    final pos = GamePosition.fromJson(Map<String, dynamic>.from(itemPosition));
    final g = grid;
    if (g == null || !_inBounds(g, pos)) return;
    final cell = g.board[pos.x][pos.y];

    final playerId = map['playerId']?.toString();
    final tileName = cell.item.name;
    final tileDesc = cell.item.description;
    final pName = _playerName(playerId);
    final itemPayload = map['item'];
    var skipItemLogForFlag = tileName.toLowerCase().contains('flag') ||
        tileName.toLowerCase().contains('drapeau');
    if (itemPayload is Map) {
      final itemId = Map<String, dynamic>.from(itemPayload)['id']?.toString() ?? '';
      if (itemId.toLowerCase().contains('flag')) {
        skipItemLogForFlag = true;
      }
    }
    if (!skipItemLogForFlag) {
      _logJournalKey('log.item_picked_up', {'name': pName}, p1: playerId);
    }

    // If this is the local player, manage inventory
    if (_isLocalPlayerId(playerId) && tileName.isNotEmpty &&
        !tileName.contains(GameItemTypes.startingPoint) &&
        !tileName.contains(GameItemTypes.unusedStartingPoint)) {
      final item = createGameItem(tileName, tileDesc);
      final willOverflow = !canAddToInventory;
      addItemToLocalInventory(item);
      if (willOverflow) {
        showInventorySwapPopup = true;
      }
      if (skipItemLogForFlag) {
        final roomId = _lobby.roomId;
        if (roomId != null) {
          _socket.emit(CTFSocketEvents.flagTaken, <String, dynamic>{
            'roomId': roomId,
            'flagHolderId': myPlayerId,
          });
        }
      }
    }

    final clearedItem = ItemCellState(name: '', description: '');
    final updated = BoardCellState(tile: cell.tile, item: clearedItem, player: cell.player);
    grid = _cloneGridReplaceCell(pos.x, pos.y, updated, g);
    notifyListeners();
  }

  void _onItemUpdate(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final itemRaw = map['item'];
    final playerId = map['playerId']?.toString();
    if (itemRaw is! Map || playerId == null || playerId.isEmpty) return;
    final itemMap = Map<String, dynamic>.from(itemRaw);
    final id = itemMap['id']?.toString() ?? '';
    final tooltip = itemMap['tooltip']?.toString() ?? '';
    final g = grid;
    if (g == null) return;
    for (var x = 0; x < g.board.length; x++) {
      final row = g.board[x];
      for (var y = 0; y < row.length; y++) {
        final c = row[y];
        if (c.player?.id == playerId) {
          final newItem = ItemCellState(name: id, description: tooltip);
          final updated = BoardCellState(tile: c.tile, item: newItem, player: c.player);
          grid = _cloneGridReplaceCell(x, y, updated, g);
          notifyListeners();
          return;
        }
      }
    }
  }

  void _onItemsDropped(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final inv = map['inventory'];
    final posList = map['positions'];
    if (inv is! List || posList is! List) return;
    final g = grid;
    if (g == null) return;
    final maxItems = inv.length < posList.length ? inv.length : posList.length;
    final dropCount = maxItems < 2 ? maxItems : 2;
    var current = g;
    for (var i = 0; i < dropCount; i++) {
      final pRaw = posList[i];
      final itemRaw = inv[i];
      if (pRaw is! Map || itemRaw is! Map) continue;
      final pos = GamePosition.fromJson(Map<String, dynamic>.from(pRaw));
      final itemMap = Map<String, dynamic>.from(itemRaw);
      final name = itemMap['id']?.toString() ?? '';
      final desc = itemMap['tooltip']?.toString() ?? '';
      if (!_inBounds(current, pos)) continue;
      final cell = current.board[pos.x][pos.y];
      final newItem = ItemCellState(name: name, description: desc);
      final updated = BoardCellState(tile: cell.tile, item: newItem, player: cell.player);
      current = _cloneGridReplaceCell(pos.x, pos.y, updated, current);
    }
    grid = current;
    notifyListeners();
  }

  /// Same idea as Angular `fetchPlayersOnDropIn`: the server sends the full state
  /// of players and disconnected players with [ActiveGameEvents.SpawnPlayer].
  void _syncRosterAndDisconnectedFromSpawnPayload(Map<String, dynamic> map) {
    final pList = map['players'];
    if (pList is List && pList.isNotEmpty) {
      final next = <GamePlayerState>[];
      for (final e in pList) {
        if (e is! Map) continue;
        next.add(GamePlayerState.fromJson(Map<String, dynamic>.from(e)));
      }
      if (next.isNotEmpty) {
        rosterPlayers = next;
      }
    }
    final dList = map['disconnectedPlayers'];
    if (dList is List) {
      disconnectedPlayerIds.clear();
      for (final e in dList) {
        if (e is! Map) continue;
        final id = e['id']?.toString();
        if (id != null && id.isNotEmpty) {
          disconnectedPlayerIds.add(id);
        }
      }
    }
  }

  void _upsertSpawnPlayerInRoster(GamePlayerState player) {
    final i = rosterPlayers.indexWhere((p) => p.id == player.id);
    if (i < 0) {
      rosterPlayers = List<GamePlayerState>.from(rosterPlayers)..add(player);
    } else {
      rosterPlayers = List<GamePlayerState>.from(rosterPlayers);
      rosterPlayers[i] = player;
    }
    disconnectedPlayerIds.remove(player.id);
  }

  void _onSpawnPlayer(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final pRaw = map['player'];
    if (pRaw is! Map) return;
    final player = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
    final sp = player.startingPoint;
    if (sp == null) return;
    final g0 = grid;

    // Eliminated spectator rejoining: update roster but don't place on grid.
    if (g0 == null || !_inBounds(g0, sp)) {
      _syncRosterAndDisconnectedFromSpawnPayload(map);
      _upsertSpawnPlayerInRoster(player);
      notifyListeners();
      return;
    }
    GameGrid g = g0;
    for (var x = 0; x < g.board.length; x++) {
      for (var y = 0; y < g.board[x].length; y++) {
        if (g.board[x][y].player?.id == player.id) {
          final old = g.board[x][y];
          final cleared = BoardCellState(tile: old.tile, item: old.item, player: null);
          g = _cloneGridReplaceCell(x, y, cleared, g);
          break;
        }
      }
    }
    final cell = g.board[sp.x][sp.y];
    final startItem = ItemCellState(name: GameItemTypes.startingPoint, description: cell.item.description);
    final updated = BoardCellState(tile: cell.tile, item: startItem, player: player);
    grid = _cloneGridReplaceCell(sp.x, sp.y, updated, g);

    _syncRosterAndDisconnectedFromSpawnPayload(map);
    _upsertSpawnPlayerInRoster(player);
    notifyListeners();
  }

  // ── Infos d'actions adjacentes ──

  bool _isAdjacentToLocal(int lx, int ly) {
    final myCell = localPlayerCellPosition;
    if (myCell == null) return false;
    final dx = (lx - myCell.x).abs();
    final dy = (ly - myCell.y).abs();
    return (dx + dy) == 1;
  }

  AdjacentActionInfo getAdjacentActionInfo() {
    final g = grid;
    final myCell = localPlayerCellPosition;
    if (g == null || myCell == null) return AdjacentActionInfo.empty;
    final doors = <GamePosition>[];
    final combatTargets = <AdjacentEnemy>[];
    final tradeTargets = <AdjacentEnemy>[];
    final teamMode = lobbyGameMode == LobbyGameMode.teams;
    final currentHasItem = localInventory.isNotEmpty;
    for (final off in kAdjacentOffsets) {
      final nx = myCell.x + off[0];
      final ny = myCell.y + off[1];
      if (nx < 0 || ny < 0 || nx >= g.board.length || ny >= g.board[0].length) continue;
      final cell = g.board[nx][ny];
      if ((cell.tile == GameTileTypes.door || cell.tile == GameTileTypes.openedDoor) && cell.player == null) {
        doors.add(GamePosition(x: nx, y: ny));
      }
      if (cell.player != null && !_isLocalPlayerId(cell.player!.id)) {
        final other = cell.player!;
        if (teamMode && isTeammate(other.id)) {
          final otherHasItem = (other.inventory?.isNotEmpty ?? false);
          if (currentHasItem || otherHasItem) {
            tradeTargets.add(AdjacentEnemy(position: GamePosition(x: nx, y: ny), player: other));
          }
        } else {
          combatTargets.add(AdjacentEnemy(position: GamePosition(x: nx, y: ny), player: other));
        }
      }
    }
    return AdjacentActionInfo(doors: doors, combatTargets: combatTargets, tradeTargets: tradeTargets);
  }
}

// ─── Helpers for adjacent action info ─────────────────────────────────────

class AdjacentEnemy {
  AdjacentEnemy({required this.position, required this.player});
  final GamePosition position;
  final GamePlayerState player;
}

class AdjacentActionInfo {
  AdjacentActionInfo({
    required this.doors,
    required this.combatTargets,
    required this.tradeTargets,
  });
  final List<GamePosition> doors;
  /// Tiles of adjacent enemies (combat) — in team mode, teammates excluded.
  final List<AdjacentEnemy> combatTargets;
  /// Tiles of adjacent teammates for trading (Angular `can-trade`).
  final List<AdjacentEnemy> tradeTargets;

  static final empty = AdjacentActionInfo(
    doors: <GamePosition>[],
    combatTargets: <AdjacentEnemy>[],
    tradeTargets: <AdjacentEnemy>[],
  );

  bool get hasDoor => doors.isNotEmpty;
  bool get hasCombatTarget => combatTargets.isNotEmpty;
  bool get hasTradeTarget => tradeTargets.isNotEmpty;
  bool get hasAny => hasDoor || hasCombatTarget || hasTradeTarget;
}
