import 'dart:convert';

import 'package:uuid/uuid.dart';

/// Aligned with `common/types` / `Position` in the interfaces.
class GamePosition {
  const GamePosition({required this.x, required this.y});

  final int x;
  final int y;

  factory GamePosition.fromJson(Map<String, dynamic> m) {
    return GamePosition(
      x: (m['x'] as num?)?.toInt() ?? 0,
      y: (m['y'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => <String, int>{'x': x, 'y': y};
}

/// Aligned with `common/interfaces.ts` `Item`.
class GameItem {
  GameItem({
    required this.id,
    required this.image,
    required this.tooltip,
    this.selected = false,
    String? uniqueId,
  }) : uniqueId = uniqueId ?? const Uuid().v4();

  final String id;
  final String image;
  final String tooltip;
  bool selected;
  final String uniqueId;

  factory GameItem.fromJson(Map<String, dynamic> m) {
    return GameItem(
      id: m['id']?.toString() ?? '',
      image: m['image']?.toString() ?? '',
      tooltip: m['tooltip']?.toString() ?? '',
      selected: m['selected'] == true,
      uniqueId: m['uniqueId']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'image': image,
        'tooltip': tooltip,
        'selected': selected,
        'uniqueId': uniqueId,
      };

  String get displayName {
    if (id.contains('Flag') || id.contains('flag')) return 'Drapeau';
    final regex = RegExp(r'^item-\d+-');
    return id.replaceAll(regex, '');
  }

  bool get isFlag =>
      id.toLowerCase().contains('flag') ||
      id.toLowerCase().contains('drapeau');
}

/// Player data aligned with `common/interfaces` (fields used in the game view).
class SeekResultState {
  SeekResultState({required this.hasActionsLeft});

  final bool hasActionsLeft;

  factory SeekResultState.fromJson(Map<String, dynamic> m) {
    return SeekResultState(hasActionsLeft: m['hasActionsLeft'] == true);
  }
}

class GamePlayerState {
  GamePlayerState({
    required this.id,
    required this.name,
    this.avatar,
    this.isHost = false,
    this.stats,
    this.inventory,
    this.victories = 0,
    this.type,
    this.seekResult,
    this.position,
    this.startingPoint,
    this.lastDirection,
    this.state,
    this.isSpectator = false,
    this.isIceApplied = false,
  });

  final String id;
  final String name;
  final String? avatar;
  final bool isHost;
  final GameCombatStats? stats;
  final List<GameItem>? inventory;
  final int victories;
  final String? type;
  final SeekResultState? seekResult;
  final GamePosition? position;
  final GamePosition? startingPoint;
  /// `Directions.left` | `Directions.right` (voir `common/interfaces` Player).
  final String? lastDirection;
  final String? state;
  final bool isSpectator;
  /// Speed malus (ice), aligned with `common/interfaces` / server.
  final bool isIceApplied;

  factory GamePlayerState.fromJson(Map<String, dynamic> m) {
    final statsRaw = m['stats'];
    final seekRaw = m['seekResult'];
    final posRaw = m['position'];
    final startRaw = m['startingPoint'];
    final invRaw = m['inventory'];
    List<GameItem>? parsedInventory;
    if (invRaw is List) {
      parsedInventory = invRaw.map((e) {
        if (e is Map) {
          return GameItem.fromJson(Map<String, dynamic>.from(e));
        }
        return GameItem(id: e.toString(), image: '', tooltip: '');
      }).toList();
    }
    return GamePlayerState(
      id: m['id']?.toString() ?? '',
      name: m['name']?.toString() ?? '',
      avatar: m['avatar']?.toString(),
      isHost: m['isHost'] == true,
      stats: statsRaw is Map<String, dynamic>
          ? GameCombatStats.fromJson(statsRaw)
          : null,
      inventory: parsedInventory,
      victories: (m['victories'] as num?)?.toInt() ?? 0,
      type: m['type']?.toString(),
      seekResult: seekRaw is Map<String, dynamic>
          ? SeekResultState.fromJson(seekRaw)
          : null,
      position: posRaw is Map<String, dynamic>
          ? GamePosition.fromJson(posRaw)
          : posRaw is Map
              ? GamePosition.fromJson(Map<String, dynamic>.from(posRaw))
              : null,
      startingPoint: startRaw is Map<String, dynamic>
          ? GamePosition.fromJson(startRaw)
          : startRaw is Map
              ? GamePosition.fromJson(Map<String, dynamic>.from(startRaw))
              : null,
      lastDirection: m['lastDirection']?.toString(),
      state: m['state']?.toString(),
      isSpectator: m['isSpectator'] == true,
      isIceApplied: m['isIceApplied'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      if (name.isNotEmpty) 'name': name,
      if (avatar != null) 'avatar': avatar,
      'isHost': isHost,
      if (stats != null) 'stats': stats!.toJson(),
      if (inventory != null)
        'inventory': inventory!.map((e) => e.toJson()).toList(),
      if (victories != 0) 'victories': victories,
      if (type != null) 'type': type,
      if (seekResult != null)
        'seekResult': <String, bool>{
          'hasActionsLeft': seekResult!.hasActionsLeft,
        },
      if (position != null) 'position': position!.toJson(),
      if (startingPoint != null) 'startingPoint': startingPoint!.toJson(),
      if (lastDirection != null) 'lastDirection': lastDirection,
      if (state != null) 'state': state,
      if (isSpectator) 'isSpectator': isSpectator,
      if (isIceApplied) 'isIceApplied': isIceApplied,
    };
  }

  GamePlayerState copyWith({
    GameCombatStats? stats,
    GamePosition? position,
    GamePosition? startingPoint,
    List<GameItem>? inventory,
    int? victories,
    String? lastDirection,
    String? state,
    bool? isSpectator,
    bool? isIceApplied,
  }) {
    return GamePlayerState(
      id: id,
      name: name,
      avatar: avatar,
      isHost: isHost,
      stats: stats ?? this.stats,
      inventory: inventory ?? this.inventory,
      victories: victories ?? this.victories,
      type: type,
      seekResult: seekResult,
      position: position ?? this.position,
      startingPoint: startingPoint ?? this.startingPoint,
      lastDirection: lastDirection ?? this.lastDirection,
      state: state ?? this.state,
      isSpectator: isSpectator ?? this.isSpectator,
      isIceApplied: isIceApplied ?? this.isIceApplied,
    );
  }
}

class GameCombatStats {
  GameCombatStats({
    required this.life,
    required this.speed,
    required this.attack,
    required this.defense,
    this.maxLife,
    this.maxSpeed,
  });

  final int life;
  final int speed;
  final int attack;
  final int defense;
  final int? maxLife;
  final int? maxSpeed;

  factory GameCombatStats.fromJson(Map<String, dynamic> m) {
    return GameCombatStats(
      life: (m['life'] as num?)?.toInt() ?? 0,
      speed: (m['speed'] as num?)?.toInt() ?? 0,
      attack: (m['attack'] as num?)?.toInt() ?? 0,
      defense: (m['defense'] as num?)?.toInt() ?? 0,
      maxLife: (m['maxLife'] as num?)?.toInt(),
      maxSpeed: (m['maxSpeed'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'life': life,
        'speed': speed,
        'attack': attack,
        'defense': defense,
        if (maxLife != null) 'maxLife': maxLife,
        if (maxSpeed != null) 'maxSpeed': maxSpeed,
      };
}

class ItemCellState {
  ItemCellState({required this.name, required this.description});

  final String name;
  final String description;

  factory ItemCellState.fromJson(Map<String, dynamic> m) {
    return ItemCellState(
      name: m['name']?.toString() ?? '',
      description: m['description']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => <String, String>{
        'name': name,
        'description': description,
      };
}

class BoardCellState {
  BoardCellState({
    required this.tile,
    required this.item,
    this.player,
  });

  final String tile;
  final ItemCellState item;
  final GamePlayerState? player;

  factory BoardCellState.fromJson(Map<String, dynamic> m) {
    final itemRaw = m['item'];
    return BoardCellState(
      tile: m['tile']?.toString() ?? '',
      item: itemRaw is Map<String, dynamic>
          ? ItemCellState.fromJson(itemRaw)
          : ItemCellState(name: '', description: ''),
      player: m['player'] is Map<String, dynamic>
          ? GamePlayerState.fromJson(Map<String, dynamic>.from(m['player'] as Map))
          : null,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'tile': tile,
        'item': item.toJson(),
        if (player != null) 'player': player!.toJson(),
      };
}

class GameGrid {
  GameGrid({
    required this.gridSize,
    required this.board,
    required this.name,
    this.nbActions = 1,
  });

  final int gridSize;
  final List<List<BoardCellState>> board;
  final String name;
  final int nbActions;

  factory GameGrid.fromJson(Map<String, dynamic> m) {
    final size = (m['gridSize'] as num?)?.toInt() ?? 0;
    final rawBoard = m['board'];
    final rows = <List<BoardCellState>>[];
    if (rawBoard is List) {
      for (final row in rawBoard) {
        if (row is! List) continue;
        final cells = <BoardCellState>[];
        for (final c in row) {
          if (c is Map<String, dynamic>) {
            cells.add(BoardCellState.fromJson(c));
          } else if (c is Map) {
            cells.add(BoardCellState.fromJson(Map<String, dynamic>.from(c)));
          }
        }
        rows.add(cells);
      }
    }
    return GameGrid(
      gridSize: size,
      board: rows,
      name: m['name']?.toString() ?? '',
      nbActions: (m['nbActions'] as num?)?.toInt() ?? 1,
    );
  }

  /// Board alone, for `mapRequest` (aligned with `GameModeService.sendMap`).
  List<List<Map<String, dynamic>>> boardToJson() {
    return board
        .map(
          (row) => row.map((c) => c.toJson()).toList(),
        )
        .toList();
  }

  /// Deep copy to emit `MovePlayer` without mutating the displayed grid.
  GameGrid cloneDeep() {
    final copyBoard = <List<BoardCellState>>[];
    for (final row in board) {
      copyBoard.add(
        row
            .map(
              (c) => BoardCellState(
                tile: c.tile,
                item: ItemCellState(name: c.item.name, description: c.item.description),
                player: c.player,
              ),
            )
            .toList(),
      );
    }
    return GameGrid(gridSize: gridSize, board: copyBoard, name: name, nbActions: nbActions);
  }

  /// Minimal `grid` object for `movePlayer` (the server mostly reads `board`).
  Map<String, dynamic> toMovePlayerGridJson() {
    return <String, dynamic>{
      'gridSize': gridSize,
      'name': name,
      'board': boardToJson(),
    };
  }
}

class GameStartPayload {
  GameStartPayload({
    required this.map,
    this.teams,
    this.gameMode,
    this.lobbyGameMode,
    this.isFogOfWar,
    this.isDropInDropOut,
  });

  final GameGrid map;
  final List<dynamic>? teams;
  final String? gameMode;
  final String? lobbyGameMode;
  final bool? isFogOfWar;
  final bool? isDropInDropOut;

  factory GameStartPayload.fromJson(Map<String, dynamic> m) {
    final mapRaw = m['map'];
    return GameStartPayload(
      map: mapRaw is Map<String, dynamic>
          ? GameGrid.fromJson(mapRaw)
          : GameGrid.fromJson(Map<String, dynamic>.from(mapRaw as Map)),
      teams: m['teams'] as List<dynamic>?,
      gameMode: m['gameMode']?.toString(),
      lobbyGameMode: m['lobbyGameMode']?.toString(),
      isFogOfWar: m['isFogOfWar'] as bool?,
      isDropInDropOut: m['isDropInDropOut'] as bool?,
    );
  }

  static GameStartPayload decodeResponseBody(String body) {
    final decoded = jsonDecode(body);
    return GameStartPayload.fromJson(Map<String, dynamic>.from(decoded as Map));
  }
}

class GameJournalEntry {
  GameJournalEntry({
    required this.timeLabel,
    required this.message,
    this.playerId1,
    this.playerId2,
  });

  final String timeLabel;
  final String message;

  /// ID of the first player involved (attacker, turn player, etc.).
  final String? playerId1;

  /// ID of the second player involved (defender).
  final String? playerId2;

  /// Whether this entry involves [playerId] (same idea as LogService « mon journal »).
  bool involvesPlayer(String playerId) {
    return playerId1 == playerId || playerId2 == playerId;
  }
}

/// Aligned with `common/interfaces` `PlayerStats`.
class PlayerStats {
  PlayerStats({
    this.nCombats = 0,
    this.nEvasions = 0,
    this.nVictories = 0,
    this.nDefeats = 0,
    this.hpLost = 0,
    this.hpDealt = 0,
    this.nItemsCollected = 0,
    this.tilesVisitedPercentage = 0,
  });

  final int nCombats;
  final int nEvasions;
  final int nVictories;
  final int nDefeats;
  final int hpLost;
  final int hpDealt;
  final int nItemsCollected;
  final double tilesVisitedPercentage;

  factory PlayerStats.fromJson(Map<String, dynamic> m) {
    return PlayerStats(
      nCombats: (m['nCombats'] as num?)?.toInt() ?? 0,
      nEvasions: (m['nEvasions'] as num?)?.toInt() ?? 0,
      nVictories: (m['nVictories'] as num?)?.toInt() ?? 0,
      nDefeats: (m['nDefeats'] as num?)?.toInt() ?? 0,
      hpLost: (m['hpLost'] as num?)?.toInt() ?? 0,
      hpDealt: (m['hpDealt'] as num?)?.toInt() ?? 0,
      nItemsCollected: (m['nItemsCollected'] as num?)?.toInt() ?? 0,
      tilesVisitedPercentage: (m['tilesVisitedPercentage'] as num?)?.toDouble() ?? 0,
    );
  }
}

/// Aligned with `common/interfaces` `GlobalStats`.
class GlobalStats {
  GlobalStats({
    this.duration = 0,
    this.totalTurns = 0,
    this.tilesVisitedPercentage = 0,
    this.doorsUsedPercent = 0,
    this.flagHolders = const <String>[],
  });

  final int duration;
  final int totalTurns;
  final double tilesVisitedPercentage;
  final double doorsUsedPercent;
  final List<String> flagHolders;

  factory GlobalStats.fromJson(Map<String, dynamic> m) {
    return GlobalStats(
      duration: (m['duration'] as num?)?.toInt() ?? 0,
      totalTurns: (m['totalTurns'] as num?)?.toInt() ?? 0,
      tilesVisitedPercentage: (m['tilesVisitedPercentage'] as num?)?.toDouble() ?? 0,
      doorsUsedPercent: (m['doorsUsedPercent'] as num?)?.toDouble() ?? 0,
      flagHolders: (m['flagHolders'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const <String>[],
    );
  }

  String get formattedDuration {
    final totalSeconds = duration ~/ 1000;
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    return '${minutes}m ${seconds.toString().padLeft(2, '0')}s';
  }
}

/// Aligned with `common/interfaces` `GameReward`.
class GameReward {
  GameReward({
    required this.uid,
    required this.username,
    required this.amount,
    this.isWinner = false,
  });

  final String uid;
  final String username;
  final int amount;
  final bool isWinner;

  factory GameReward.fromJson(Map<String, dynamic> m) {
    return GameReward(
      uid: m['uid']?.toString() ?? '',
      username: m['username']?.toString() ?? '',
      amount: (m['amount'] as num?)?.toInt() ?? 0,
      isWinner: m['isWinner'] == true,
    );
  }
}

/// Full payload received via `gameEnded`.
class EndGamePlayer {
  EndGamePlayer({
    required this.id,
    required this.name,
    this.avatar,
    this.victories = 0,
    this.playerStats,
  });

  final String id;
  final String name;
  final String? avatar;
  final int victories;
  final PlayerStats? playerStats;

  factory EndGamePlayer.fromJson(Map<String, dynamic> m) {
    final statsRaw = m['playerStats'];
    return EndGamePlayer(
      id: m['id']?.toString() ?? '',
      name: m['name']?.toString() ?? '',
      avatar: m['avatar']?.toString(),
      victories: (m['victories'] as num?)?.toInt() ?? 0,
      playerStats: statsRaw is Map<String, dynamic>
          ? PlayerStats.fromJson(statsRaw)
          : statsRaw is Map
              ? PlayerStats.fromJson(Map<String, dynamic>.from(statsRaw))
              : null,
    );
  }
}

/// Aligned with `common/interfaces` `GameStats`.
class GameStatsPayload {
  GameStatsPayload({
    required this.players,
    required this.globalStats,
    this.rewards = const <GameReward>[],
    this.gameMode,
  });

  final List<EndGamePlayer> players;
  final GlobalStats globalStats;
  final List<GameReward> rewards;
  /// E.g. `CTF` | `Classique` — like the web client's `GameStats`.
  final String? gameMode;

  factory GameStatsPayload.fromJson(Map<String, dynamic> m) {
    final playersRaw = m['players'] as List<dynamic>? ?? <dynamic>[];
    final rewardsRaw = m['rewards'] as List<dynamic>? ?? <dynamic>[];
    final gsRaw = m['globalStats'];
    return GameStatsPayload(
      gameMode: m['gameMode']?.toString(),
      players: playersRaw
          .map((e) => EndGamePlayer.fromJson(
              e is Map<String, dynamic> ? e : Map<String, dynamic>.from(e as Map)))
          .toList(),
      globalStats: gsRaw is Map<String, dynamic>
          ? GlobalStats.fromJson(gsRaw)
          : gsRaw is Map
              ? GlobalStats.fromJson(Map<String, dynamic>.from(gsRaw))
              : GlobalStats(),
      rewards: rewardsRaw
          .map((e) => GameReward.fromJson(
              e is Map<String, dynamic> ? e : Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}
