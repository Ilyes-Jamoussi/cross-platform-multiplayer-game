import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_client/app/active_game_socket_events.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/game/item_utils.dart';
import 'package:mobile_client/game/pathfinding.dart';
import 'package:mobile_client/models/game_avatar.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/socket_service.dart';

part 'active_game_grid.dart';
part 'active_game_movement.dart';
part 'active_game_turn.dart';
part 'active_game_combat.dart';

String get _apiBase => AuthService.serverBaseUrl;

// ═══════════════════════════════════════════════════════════════════════════
//  Shared state (all fields accessible to the mixins)
// ═══════════════════════════════════════════════════════════════════════════

abstract class _ActiveGameBase extends ChangeNotifier {
  _ActiveGameBase({
    required SocketService socketService,
    required LobbyRoomService lobbyRoomService,
    http.Client? httpClient,
  })  : _socket = socketService,
        _lobby = lobbyRoomService,
        _http = httpClient ?? http.Client();

  final SocketService _socket;
  final LobbyRoomService _lobby;
  final http.Client _http;

  GameGrid? grid;
  List<GamePlayerState> rosterPlayers = <GamePlayerState>[];
  final List<String> disconnectedPlayerIds = <String>[];
  List<LobbyTeam> gameTeams = <LobbyTeam>[];

  GamePlayerState? currentTurnPlayer;
  bool blockPlaying = false;
  Object? timerDisplay = '--';
  bool inCombat = false;

  /// Signals that a local teleport (debug mode, hold/isRightClick) was just
  /// sent to the server. Consumed by the next `PlayerNextPosition`
  /// received for the local player in order to skip the client-side speed
  /// deduction — the server does not deduct on a teleport either. Without this
  /// flag, a hold on an adjacent tile would wrongly consume a movement
  /// point on mobile (the old adjacency check failed).
  bool _pendingLocalTeleport = false;

  /// Blocks movement, action mode and end of turn while a combat holds the board
  /// (combat in progress, launch in progress, or locally eliminated while a team combat continues).
  bool get isBoardPlayLockedForCombat =>
      inCombat || _waitingForTeamCombatEnd || _combatPending;

  /// "Combat"-style timer (main turn frozen), including eliminated players waiting for the team combat to end.
  bool get isMainTurnTimerFrozenForCombat =>
      inCombat || _waitingForTeamCombatEnd;

  bool isActionMode = false;
  final List<GameJournalEntry> journalEntries = <GameJournalEntry>[];
  bool journalFilterMineOnly = false;

  String? loadError;
  bool isLoading = true;

  int actionsLeft = 0;
  int get maxActions => grid?.nbActions ?? GameConstants.defaultNbActions;

  String? combatAttackerId;
  String? combatDefenderId;
  String? combatTurnId;
  // Trackers of the last active attacker/defender for the combat log.
  // Updated after writing the logs of a combat event, so that
  // the logs correctly describe who acted even when the server
  // later swaps the roles (1v1) or changes target (team combat).
  String? _activeAttackerId;
  String? _activeDefenderId;
  GameCombatStats? combatInitialAttackerStats;
  GameCombatStats? combatInitialDefenderStats;
  int? lastDiceAttack;
  int? lastDiceDefense;
  int? lastDamage;
  String? combatResultMessage;
  bool combatChoicePending = false;
  String? _pendingTeamAction;
  bool combatEscapeDisabled = false;
  int _escapeAttempts = GameConstants.maxEscapeAttempts;

  // Combat choice timer (client-side countdown)
  Timer? _combatChoiceTimer;
  int _combatTimerTicks = 0;
  int _combatTimerTotalTicks = 0;
  double get combatTimerFraction =>
      _combatTimerTotalTicks > 0 ? _combatTimerTicks / _combatTimerTotalTicks : 0.0;

  // Original combat participants (stable during the entire combat)
  String? combatInitiatorId;
  String? combatTargetId;

  // Per-player escape attempts keyed by player ID
  final Map<String, int> _combatEscapeAttempts = <String, int>{};

  int getPlayerEscapeAttempts(String? playerId) {
    if (playerId == null) return GameConstants.maxEscapeAttempts;
    return _combatEscapeAttempts[playerId] ?? GameConstants.maxEscapeAttempts;
  }

  // Last dice rolls per side (initiator / target)
  Object initiatorDiceRoll = '-';
  Object targetDiceRoll = '-';

  /// Who rolled the attack / defense die on the last resolution (team arena, like Angular).
  String? combatDiceAttackPlayerId;
  String? combatDiceDefensePlayerId;

  /// Same role as `_isAttacking` + `_attacker` in `vs-pop-up.component.ts`.
  int combatAttackAnimationToken = 0;
  String? combatAttackAnimationPlayerId;
  int combatAttackAnimationDurationMs = kAngularSnackbarTimeMs;

  // Delayed combat end
  Timer? _combatEndTimer;

  /// After a local elimination mid team-combat, the server continues the combat:
  /// like Angular `_isWaitingForCombatEnd`, avoids a double `_consumeAction` at the real end.
  bool _waitingForTeamCombatEnd = false;

  /// Message for the big end-of-combat announcement (equivalent of `AlertService.announceWinner`).
  String? combatWinnerAnnouncement;

  bool get combatWindDown => _combatEndTimer != null;

  /// Participant in the ongoing combat: 1v1 (initiator or target) or member of a team in team combat.
  bool get isLocalPlayerCombatParticipant {
    if (!inCombat) return false;
    final myId = myPlayerId;
    if (isTeamCombat &&
        (teamACombatIds.isNotEmpty || teamBCombatIds.isNotEmpty)) {
      return teamACombatIds.contains(myId) || teamBCombatIds.contains(myId);
    }
    return _isLocalPlayerId(combatInitiatorId) || _isLocalPlayerId(combatTargetId);
  }

  /// Historical alias: "in the combat" = in the fighters roster.
  bool get isLocalPlayerInCombat => isLocalPlayerCombatParticipant;

  /// Player still on the grid, watching a combat without taking part (web client: spectator).
  bool get isLocalPlayerCombatSpectator {
    if (!inCombat) return false;
    if (isLocalPlayerCombatParticipant) return false;
    if (isLocalPlayerEliminated) return false;
    return grid != null && localPlayerOnGrid != null;
  }

  /// Show the combat UI (big scene, spectator card, or eliminated player watching).
  bool get shouldShowCombatOverlay =>
      inCombat &&
      (isLocalPlayerCombatParticipant ||
          isLocalPlayerCombatSpectator ||
          isLocalPlayerEliminated);

  /// "Choosing" banner (team): it is not the local player's turn to pick an action.
  bool get combatShowsRemoteChoosingPhase {
    if (!inCombat || !isTeamCombat) return false;
    if (combatWindDown) return false;
    if (needsTargetSelection) return false;
    if (combatChoicePending) return false;
    final tid = combatTurnId;
    if (tid == null || tid.isEmpty) return false;
    return !_isLocalPlayerId(tid);
  }

  GamePlayerState? _rosterPlayerById(String? id) {
    if (id == null || id.isEmpty) return null;
    for (final p in rosterPlayers) {
      if (p.id == id) return p;
    }
    return null;
  }

  /// Avatar shown in combat: grid first, then roster (the server may send
  /// players without `avatar` in combat updates).
  String? get combatInitiatorAvatar {
    final onGrid = _findPlayerOnGridById(combatInitiatorId);
    final a = onGrid?.avatar;
    if (a != null && a.trim().isNotEmpty) return a;
    final b = _rosterPlayerById(combatInitiatorId)?.avatar;
    if (b != null && b.trim().isNotEmpty) return b;
    return null;
  }

  String? get combatTargetAvatar {
    final onGrid = _findPlayerOnGridById(combatTargetId);
    final a = onGrid?.avatar;
    if (a != null && a.trim().isNotEmpty) return a;
    final b = _rosterPlayerById(combatTargetId)?.avatar;
    if (b != null && b.trim().isNotEmpty) return b;
    return null;
  }

  bool isFogOfWar = false;
  /// `gameMode` from the `/game/start` payload (Classic / CTF), for banners like the web client.
  String? sessionGameMode;

  /// `lobbyGameMode` returned by `/game/start` (Classic / Teams / FastElimination).
  /// Essential for drop-ins: `_lobby.room` is not populated because
  /// the player skips the waiting-room step.
  LobbyGameMode? _sessionLobbyGameMode;

  /// `dropInDropOutEnabled` returned by `/game/start` (same as above).
  bool? _sessionDropInEnabled;
  bool isDebug = false;
  bool isMoving = false;

  // Team combat state
  bool isTeamCombat = false;
  bool needsTargetSelection = false;
  List<GamePlayerState> availableTargets = <GamePlayerState>[];
  List<String> teamACombatIds = <String>[];
  List<String> teamBCombatIds = <String>[];
  Timer? _targetSelectionTimer;
  int targetTimerSecondsLeft = 0;

  // Trade state
  bool showTradePopup = false;
  String? tradePlayerId;
  String? tradeTeammateId;
  List<GameItem> tradePlayerInventory = <GameItem>[];
  List<GameItem> tradeTeammateInventory = <GameItem>[];
  GameItem? tradePlayerSelected;
  GameItem? tradeTeammateOffered;
  bool tradePlayerAccepted = false;
  bool tradeTeammateAccepted = false;

  final Set<String> reachableTileKeys = <String>{};
  List<GamePosition> pathPreviewPositions = <GamePosition>[];
  GamePosition? pathPreviewTarget;
  int _previewPathCost = 0;
  int _previewPathTurns = 0;

  bool _listenersAttached = false;
  bool _transitionCompleting = false;
  GamePlayerState? _pendingTurnPlayer;
  bool _pendingNextTurnAfterMove = false;
  String? _turnExpiryHandledForPlayerId;
  bool _turnDelayTickReceived = false;
  Timer? _turnTransitionFallback;

  int _lastNonCombatTimerValue = GameConstants.turnTimeSeconds;
  String? _combatLoserId;
  bool _combatPending = false;
  bool _expectingTurnTimer = false;

  bool shouldLeaveGame = false;

  // ── Inventaire local (miroir exact de PlayerPanelComponent Angular) ──
  List<GameItem> localInventory = <GameItem>[];
  bool showInventorySwapPopup = false;

  // Buffed stats — identical to Angular _buffedStats (starts at BASE_STAT=4)
  int buffedAttack = GameConstants.baseStat;
  int buffedDefense = GameConstants.baseStat;
  int potionLifeBonus = 0;
  bool _hasAppliedPotionBuff = false;
  bool _hasAppliedShieldBuff = false;
  List<GameItem> _previousInventory = <GameItem>[];

  bool get canAddToInventory =>
      localInventory.length < GameInventoryConstants.maxSize;

  void addItemToLocalInventory(GameItem item) {
    localInventory = List<GameItem>.from(localInventory)..add(item);
    _handleInventoryChange();
    notifyListeners();
  }

  void removeItemFromLocalInventory(GameItem item) {
    localInventory = localInventory
        .where((i) => i.uniqueId != item.uniqueId)
        .toList();
    _handleInventoryChange();
    notifyListeners();
  }

  void clearLocalInventory() {
    localInventory = <GameItem>[];
    _handleInventoryChange();
    notifyListeners();
  }

  /// Replicates Angular PlayerPanelComponent.handleInventory exactly.
  void _handleInventoryChange() {
    final hadPotionBefore =
        _previousInventory.any((i) => i.id == GameItemIds.item1Potion);
    final hasPotionNow =
        localInventory.any((i) => i.id == GameItemIds.item1Potion);
    _potionSequence(hasPotionNow, hadPotionBefore);

    final hadShieldBefore =
        _previousInventory.any((i) => i.id == GameItemIds.item3Bouclier);
    final hasShieldNow =
        localInventory.any((i) => i.id == GameItemIds.item3Bouclier);
    _shieldSequence(hasShieldNow, hadShieldBefore);

    _applyBuffs();
    _previousInventory = List<GameItem>.from(localInventory);
  }

  void _applyBuffs() {
    if (!_hasAppliedPotionBuff) _potionBuff();
    if (!_hasAppliedShieldBuff) _shieldBuff();
  }

  void _potionBuff() {
    final hasPotion =
        localInventory.any((i) => i.id == GameItemIds.item1Potion);
    if (hasPotion) {
      potionLifeBonus = GameItemEffects.potionLifeBonus;
      buffedDefense -= GameItemEffects.potionDefensePenalty;
      _hasAppliedPotionBuff = true;
    }
  }

  void _shieldBuff() {
    final hasShield =
        localInventory.any((i) => i.id == GameItemIds.item3Bouclier);
    if (hasShield) {
      buffedDefense += GameItemEffects.shieldDefenseBonus;
      buffedAttack -= GameItemEffects.shieldAttackPenalty;
      _hasAppliedShieldBuff = true;
    }
  }

  void _potionSequence(bool hasPotionNow, bool hadPotionBefore) {
    if (hasPotionNow && !hadPotionBefore) {
      _hasAppliedPotionBuff = false;
    } else if (!hasPotionNow && _hasAppliedPotionBuff) {
      buffedDefense += GameItemEffects.potionDefensePenalty;
      potionLifeBonus = 0;
      _hasAppliedPotionBuff = false;
    }
  }

  void _shieldSequence(bool hasShieldNow, bool hadShieldBefore) {
    if (hasShieldNow && !hadShieldBefore) {
      _hasAppliedShieldBuff = false;
    } else if (!hasShieldNow && _hasAppliedShieldBuff) {
      buffedAttack += GameItemEffects.shieldAttackPenalty;
      buffedDefense -= GameItemEffects.shieldDefenseBonus;
      _hasAppliedShieldBuff = false;
    }
  }

  // ── Fin de partie ──
  GameStatsPayload? endGameStats;
  String? winnerAnnouncementMessage;
  bool _gameEndRequested = false;

  bool _showYourTurnBanner = false;
  bool get showYourTurnBanner => _showYourTurnBanner;

  String? _turnFlashPlayerName;
  Timer? _turnFlashTimer;
  bool get showTurnFlashBanner => _turnFlashPlayerName != null;
  String? get turnFlashPlayerName => _turnFlashPlayerName;

  // ── Local player identity ──

  String get myPlayerId => _lobby.currentPlayer?.id ?? _socket.socketId ?? '';

  bool _isLocalPlayerId(String? playerId) {
    if (playerId == null || playerId.isEmpty) return false;
    final lobbyId = _lobby.currentPlayer?.id;
    final sid = _socket.socketId ?? '';
    return playerId == lobbyId || playerId == sid;
  }

  bool get isMyTurn {
    final turn = currentTurnPlayer;
    if (turn == null) return false;
    return _isLocalPlayerId(turn.id);
  }

  bool _localPlayerEliminated = false;

  bool get isLocalPlayerEliminated => _localPlayerEliminated;

  LobbyGameMode get lobbyGameMode =>
      _sessionLobbyGameMode ??
      _lobby.room?.lobbyGameMode ??
      LobbyGameMode.classic;

  bool get isCtfSession {
    final raw = sessionGameMode ??
        _lobby.room?.gameMode ??
        _lobby.baseGameMode ??
        '';
    return raw.toUpperCase() == 'CTF';
  }

  bool get isDropInSessionEnabled =>
      _sessionDropInEnabled ?? _lobby.room?.dropInDropOutEnabled ?? false;

  String getTeamIdForPlayer(String playerId) {
    for (final team in gameTeams) {
      if (team.players.any((p) => p.id == playerId)) return team.id;
    }
    return '';
  }

  String? getTeamColorForPlayer(String playerId) {
    for (final team in gameTeams) {
      if (team.players.any((p) => p.id == playerId)) return team.color;
    }
    return null;
  }

  bool isTeammate(String playerId) {
    final myId = myPlayerId;
    for (final team in gameTeams) {
      final ids = team.players.map((p) => p.id).toSet();
      if (ids.contains(myId) && ids.contains(playerId)) return true;
    }
    return false;
  }

  GamePlayerState? get localPlayerOnGrid {
    final g = grid;
    if (g == null) return null;
    for (final row in g.board) {
      for (final c in row) {
        if (_isLocalPlayerId(c.player?.id)) return c.player;
      }
    }
    return null;
  }

  GamePosition? get localPlayerCellPosition {
    final g = grid;
    if (g == null) return null;
    for (var x = 0; x < g.board.length; x++) {
      final row = g.board[x];
      for (var y = 0; y < row.length; y++) {
        if (_isLocalPlayerId(row[y].player?.id)) {
          return GamePosition(x: x, y: y);
        }
      }
    }
    return null;
  }

  int get playerCount => rosterPlayers.length;

  int get activePlayerCount {
    final disc = disconnectedPlayerIds.toSet();
    return rosterPlayers.where((p) => !disc.contains(p.id)).length;
  }

  // ── Combat display helpers ──

  String get combatInitiatorName {
    final onGrid = _findPlayerOnGridById(combatInitiatorId);
    if (onGrid != null && onGrid.name.trim().isNotEmpty) return onGrid.name;
    return _rosterPlayerById(combatInitiatorId)?.name ?? '';
  }

  String get combatTargetName {
    final onGrid = _findPlayerOnGridById(combatTargetId);
    if (onGrid != null && onGrid.name.trim().isNotEmpty) return onGrid.name;
    return _rosterPlayerById(combatTargetId)?.name ?? '';
  }

  GameCombatStats? get combatInitiatorCurrentStats {
    return _findPlayerOnGridById(combatInitiatorId)?.stats ?? combatInitialAttackerStats;
  }

  GameCombatStats? get combatTargetCurrentStats {
    return _findPlayerOnGridById(combatTargetId)?.stats ?? combatInitialDefenderStats;
  }

  /// Whether the combat initiator is the current round's attacker.
  bool get isInitiatorCurrentAttacker => combatInitiatorId == combatAttackerId;

  /// Ice malus: tile under the piece and/or `isIceApplied` (server), like the web client.
  bool isPlayerOnIceTile(String? playerId) {
    if (playerId == null || playerId.isEmpty) return false;
    final g = grid;
    if (g != null) {
      for (final row in g.board) {
        for (final c in row) {
          if (c.player?.id != playerId) continue;
          if (c.tile == GameTileTypes.ice) return true;
          if (c.player?.isIceApplied == true) return true;
        }
      }
    }
    return _rosterPlayerById(playerId)?.isIceApplied == true;
  }

  List<GamePlayerState> _combatPlayersOrdered(List<String> ids) {
    final list = <GamePlayerState>[];
    for (final id in ids) {
      final p = _findPlayerOnGridById(id);
      if (p != null) list.add(p);
    }
    return list;
  }

  List<GamePlayerState> get teamACombatPlayersOrdered =>
      _combatPlayersOrdered(teamACombatIds);

  List<GamePlayerState> get teamBCombatPlayersOrdered =>
      _combatPlayersOrdered(teamBCombatIds);

  Object combatDiceRollForPlayer(String? playerId) {
    if (playerId == null) return '-';
    if (playerId == combatDiceAttackPlayerId) return lastDiceAttack ?? '-';
    if (playerId == combatDiceDefensePlayerId) return lastDiceDefense ?? '-';
    return '-';
  }

  /// Exposed for the combat overlay (equivalent of reading the grid on the UI side).
  GamePlayerState? playerOnCombatGrid(String? id) => _findPlayerOnGridById(id);

  GamePlayerState? _findPlayerOnGridById(String? id) {
    if (id == null || id.isEmpty) return null;
    final g = grid;
    if (g == null) return null;
    for (final row in g.board) {
      for (final c in row) {
        if (c.player?.id == id) return c.player;
      }
    }
    return null;
  }

  // ── End of game: classic winner detection ──

  void _checkClassicWinCondition(Map<String, dynamic> combatUpdateMap) {
    if (_gameEndRequested) return;
    if (isCtfSession) return;
    final message = combatUpdateMap['message']?.toString();
    if (message != CombatResults.attackDefeated) return;
    // Aligned with `game-over-service.ts`: no end of game while the team combat continues.
    if (combatUpdateMap['teamCombatContinues'] == true) return;

    final gsRaw = combatUpdateMap['gameState'];
    if (gsRaw is! Map) return;
    final gs = Map<String, dynamic>.from(gsRaw);
    final players = gs['players'] as List<dynamic>?;
    if (players == null) return;

    final winningIds = combatUpdateMap['winningPlayerIds'];
    GamePlayerState? winner;

    if (winningIds is List && winningIds.isNotEmpty) {
      // Web client: `winningPlayerIds` = winning team of the combat, not necessarily end of game.
      // Il faut encore `victories >= WINNING_CONDITION` (3 en classique).
      for (final pRaw in players) {
        if (pRaw is! Map) continue;
        final p = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
        if (winningIds.any((e) => e?.toString() == p.id) &&
            p.victories >= GameConstants.winningCondition) {
          winner = p;
          break;
        }
      }
    } else {
      // 1v1: `listenForWinner` takes `players[0]`, then `gameOver` checks the victories.
      if (players.isNotEmpty && players.first is Map) {
        final p = GamePlayerState.fromJson(
          Map<String, dynamic>.from(players.first as Map),
        );
        if (p.victories >= GameConstants.winningCondition) {
          winner = p;
        }
      }
    }

    if (winner == null) return;

    _gameEndRequested = true;
    final i18n = I18n();
    if (_isLocalPlayerId(winner.id)) {
      winnerAnnouncementMessage = i18n.translate('game_over.you_won');
    } else {
      winnerAnnouncementMessage = i18n.translateWithParams(
        'game_over.winner_singular',
        {'name': winner.name},
      );
    }
    notifyListeners();
    _requestFetchStats();
  }

  void _requestFetchStats() {
    final roomId = _lobby.roomId;
    final g = grid;
    if (roomId == null || g == null) return;
    _socket.emit(ActiveGameSocketEvents.fetchStats, <String, dynamic>{
      'roomId': roomId,
      'grid': g.toMovePlayerGridJson(),
    });
    blockPlaying = true;
    notifyListeners();
  }

  // ── Journal (interne) ──

  String get _timeLabel {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:'
        '${now.minute.toString().padLeft(2, '0')}:'
        '${now.second.toString().padLeft(2, '0')}';
  }

  /// Log text (equivalent of `LogService.createNewLog` + `addLog`).
  void _logJournal(String message, {String? p1, String? p2}) {
    journalEntries.add(GameJournalEntry(
      timeLabel: _timeLabel,
      message: message,
      playerId1: p1,
      playerId2: p2,
    ));
    notifyListeners();
  }

  void _logJournalKey(String key, Map<String, String> params, {String? p1, String? p2}) {
    _logJournal(I18n().translateWithParams(key, params), p1: p1, p2: p2);
  }

  void _logEndGameThanks() {
    _logJournalKey('log.end_game', {'names': _rosterNamesJoined()});
  }

  String _rosterNamesJoined() {
    if (rosterPlayers.isEmpty) return '?';
    return rosterPlayers.map((e) => e.name).join(', ');
  }

  GamePlayerState? _journalFindPlayer(List<GamePlayerState> players, String? id) {
    if (id == null || id.isEmpty) return null;
    for (final p in players) {
      if (p.id == id) return p;
    }
    return null;
  }

  bool _isTeamCombatPayload(Map<String, dynamic> map) {
    final w = map['winningPlayerIds'];
    if (w is List && w.isNotEmpty) return true;
    final gsR = map['gameState'];
    if (gsR is! Map) return false;
    final com = Map<String, dynamic>.from(gsR)['combat'];
    if (com is! Map) return false;
    return Map<String, dynamic>.from(com)['teamCombat'] != null;
  }

  void _onFlagTaken(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final holder = map['flagHolder'];
    if (holder is! Map) return;
    final name = (holder['name'] ?? '?').toString();
    _logJournalKey('log.flag_taken', {'name': name});
  }

  /// Helper: player name from grid by ID.
  String _playerName(String? id) {
    if (id == null || id.isEmpty) return '?';
    final p = _findPlayerOnGridById(id);
    return p?.name ?? '?';
  }

  // ── Socket item helpers (accessible to the mixins) ──

  void _emitResetInventory(String playerId) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(ActiveGameSocketEvents.resetInventory, <String, dynamic>{
      'roomId': roomId,
      'playerId': playerId,
    });
  }

  void _emitItemsDropped(List<GameItem> inventory, List<GamePosition> positions) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(ActiveGameSocketEvents.itemsDropped, <String, dynamic>{
      'roomId': roomId,
      'inventory': inventory.map((e) => e.toJson()).toList(),
      'positions': positions.map((e) => e.toJson()).toList(),
    });
  }

  // ── Roster sync ──

  /// Update the roster entry for [player] so the UI reflects current victories.
  void _syncRosterVictories(GamePlayerState player) {
    for (int i = 0; i < rosterPlayers.length; i++) {
      if (rosterPlayers[i].id != player.id) continue;
      final r = rosterPlayers[i];
      if (r.victories != player.victories || r.isIceApplied != player.isIceApplied) {
        rosterPlayers[i] = r.copyWith(
          victories: player.victories,
          isIceApplied: player.isIceApplied,
        );
      }
      return;
    }
  }

  // ── Utilitaire ──

  Map<String, dynamic>? _asSocketMap(dynamic raw) {
    if (raw is Map) return Map<String, dynamic>.from(raw);
    if (raw is List && raw.isNotEmpty && raw.first is Map) {
      return Map<String, dynamic>.from(raw.first as Map);
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main service – lifecycle, socket wiring, public log, reset
// ═══════════════════════════════════════════════════════════════════════════

class ActiveGameService extends _ActiveGameBase
    with _GridMixin, _MovementMixin, _TurnMixin, _CombatMixin {
  ActiveGameService({
    required super.socketService,
    required super.lobbyRoomService,
    super.httpClient,
  });

  // ── Session ──

  Future<void> startSession(String roomId) async {
    detachSocketListeners();
    loadError = null;
    isLoading = true;
    // Carry over eliminated state from reconnect (drop-in as observer)
    if (_lobby.reconnectIsEliminated) {
      _localPlayerEliminated = true;
    }
    notifyListeners();
    _attachSocketListeners();

    // Parallelize the two independent HTTP calls for faster loading.
    final results = await Future.wait([
      _fetchPlayersResult(roomId),
      _loadGrid(roomId),
    ]);
    final gridErr = results[1] as String?;
    if (gridErr != null) {
      loadError = gridErr;
      isLoading = false;
      notifyListeners();
      return;
    }
    await _syncGridFromServer(roomId);
    isLoading = false;
    notifyListeners();
    _refreshMovementHints();

    // Signal to server that this client is ready to play.
    _socket.emit(ActiveGameSocketEvents.playerReady, <String, String?>{
      'roomId': roomId,
    });
  }

  /// Same as [_fetchPlayers] but returns a value so it can be used in Future.wait.
  Future<void> _fetchPlayersResult(String roomId) async {
    await _fetchPlayers(roomId);
  }

  Future<void> _fetchPlayers(String roomId) async {
    try {
      final res = await _http.get(Uri.parse('$_apiBase/game-room/$roomId/players'));
      if (res.statusCode != 200) return;
      final decoded = jsonDecode(res.body);
      if (decoded is! List) return;
      rosterPlayers = decoded
          .map((e) => GamePlayerState.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {}
  }

  Future<String?> _loadGrid(String roomId) async {
    try {
      final res = await _http.post(
        Uri.parse('$_apiBase/game/start'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode(<String, String>{'roomId': roomId}),
      );
      if (res.statusCode != 200) {
        return res.body.isNotEmpty ? res.body : 'Erreur ${res.statusCode}';
      }
      final payload = GameStartPayload.decodeResponseBody(res.body);
      grid = payload.map;
      isFogOfWar = payload.isFogOfWar ?? false;
      sessionGameMode = payload.gameMode;
      // Remembers the lobby mode from the `/game/start` payload for drop-ins
      // (`_lobby.room` is not populated because the waiting-room step is skipped).
      _sessionLobbyGameMode = lobbyGameModeFrom(payload.lobbyGameMode);
      _sessionDropInEnabled = payload.isDropInDropOut;
      // Also loads the teams from the payload (useful for drop-ins
      // that never received the full room snapshot).
      _applyTeamsPayload(payload.teams);
      final teamsRaw = payload.teams;
      if (teamsRaw is List && teamsRaw.isNotEmpty) {
        gameTeams = teamsRaw.map((e) {
          if (e is! Map) return null;
          final m = Map<String, dynamic>.from(e);
          final pls = (m['players'] as List<dynamic>?)
                  ?.map((p) => p is Map
                      ? LobbyPlayer.fromJson(Map<String, dynamic>.from(p))
                      : null)
                  .whereType<LobbyPlayer>()
                  .toList() ??
              <LobbyPlayer>[];
          final id = m['id']?.toString() ?? '';
          final isOwn = pls.any((p) => p.id == myPlayerId);
          return LobbyTeam(
            id: id,
            icon: m['icon'] as String? ?? '',
            color: m['color'] as String? ?? '#FFFFFF',
            players: pls,
            isOwnTeam: isOwn,
          );
        }).whereType<LobbyTeam>().toList();
      } else {
        gameTeams = <LobbyTeam>[];
      }
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  Future<void> _syncGridFromServer(String roomId) async {
    try {
      final res = await _http.get(Uri.parse('$_apiBase/game-room/$roomId/data'));
      if (res.statusCode != 200) return;
      if (_lobby.roomId != roomId) return;
      final decoded = jsonDecode(res.body);
      if (decoded is! Map) return;
      final mapRaw = decoded['map'];
      if (mapRaw == null) return;
      final mapObj = mapRaw is Map<String, dynamic>
          ? mapRaw
          : Map<String, dynamic>.from(mapRaw as Map);
      grid = GameGrid.fromJson(mapObj);
      final fog = decoded['isFogOfWar'];
      if (fog is bool) isFogOfWar = fog;

      _applyTeamsPayload(decoded['teams']);

      // Check if local player is already eliminated (drop-in as spectator)
      final playersRaw = decoded['players'];
      if (playersRaw is List) {
        for (final pRaw in playersRaw) {
          if (pRaw is! Map) continue;
          final p = Map<String, dynamic>.from(pRaw);
          if (_isLocalPlayerId(p['id']?.toString())) {
            if (p['state'] == 'eliminated' || p['isSpectator'] == true) {
              _localPlayerEliminated = true;
            }
            break;
          }
        }
      }

      final turnRaw = decoded['currentTurn'];
      if (turnRaw is Map && currentTurnPlayer == null && _pendingTurnPlayer == null) {
        final player = GamePlayerState.fromJson(Map<String, dynamic>.from(turnRaw));
        final isDropIn = _lobby.lastSelectAvatarResult?.isDropIn ?? false;
        if (isDropIn) {
          // Drop-in: silently adopt current turn state without resetting the
          // server timer.  Avoids disrupting the active player's countdown.
          currentTurnPlayer = player;
          blockPlaying = false;
          // When the drop-in player joins during their OWN turn, the
          // subsequent TurnUpdate from PlayerReady will be dropped by the
          // duplicate guard in _onTurnUpdate (same player ID).  We must
          // therefore initialise the full turn state here – exactly what
          // _completeTurnTransition does for normal turns.
          if (_isLocalPlayerId(player.id)) {
            _turnFlashTimer?.cancel();
            _turnFlashPlayerName = null;
            _resetLocalPlayerSpeed();
            actionsLeft = maxActions;
            isActionMode = false;
            _escapeAttempts = GameConstants.maxEscapeAttempts;
            combatEscapeDisabled = false;
            _lastNonCombatTimerValue = GameConstants.turnTimeSeconds;
            _showYourTurnBanner = true;
            Future<void>.delayed(
              const Duration(milliseconds: GameConstants.yourTurnPopupMs),
              () {
                _showYourTurnBanner = false;
                notifyListeners();
              },
            );
          }
        } else {
          _onTurnUpdate(<String, dynamic>{'player': player.toJson()});
        }
      }
      notifyListeners();
    } catch (_) {}
  }

  // ── Socket wiring ──

  void _attachSocketListeners() {
    if (_listenersAttached) return;
    _listenersAttached = true;
    _socket.on(ActiveGameSocketEvents.turnUpdate, _onTurnUpdate);
    _socket.on(ActiveGameSocketEvents.playerDisconnect, _onPlayerDisconnect);
    _socket.on(TimerSocketEvents.timerUpdate, _onTimerUpdate);
    _socket.on(TimerSocketEvents.timerEnd, _onTimerEnd);
    _socket.on(ActiveGameSocketEvents.playerNextPosition, _onPlayerNextPosition);
    _socket.on(ActiveGameSocketEvents.doorUpdated, _onDoorUpdatedAndRefresh);
    _socket.on(ActiveGameSocketEvents.itemPickedUp, _onItemPickedUp);
    _socket.on(ActiveGameSocketEvents.itemUpdate, _onItemUpdate);
    _socket.on(ActiveGameSocketEvents.itemsDropped, _onItemsDropped);
    _socket.on(ActiveGameSocketEvents.spawnPlayer, _onSpawnPlayerAndRefresh);
    _socket.on(ActiveGameSocketEvents.mapRequest, _onMapRequest);
    _socket.on(ActiveGameSocketEvents.playerStartedMoving, _onPlayerStartedMoving);
    _socket.on(ActiveGameSocketEvents.playerStoppedMoving, _onPlayerStoppedMoving);
    _socket.on(ActiveGameSocketEvents.combatInitiated, _onCombatInitiated);
    _socket.on(ActiveGameSocketEvents.combatUpdate, _onCombatUpdate);
    _socket.on(ActiveGameSocketEvents.gameEnded, _onGameEnded);
    _socket.on(ActiveGameSocketEvents.noMorePlayers, _onNoMorePlayers);
    _socket.on(DebugSocketEvents.toggleDebug, _onToggleDebug);
    _socket.on(CTFSocketEvents.flagTaken, _onFlagTaken);
    _socket.on(CTFSocketEvents.flagCaptured, _onFlagCaptured);
    _socket.on(ActiveGameSocketEvents.tradeStarted, _onTradeStarted);
    _socket.on(ActiveGameSocketEvents.tradeUpdate, _onTradeUpdate);
    _socket.on(ActiveGameSocketEvents.tradeAccept, _onTradeAccept);
    _socket.on(ActiveGameSocketEvents.tradeCancel, _onTradeCancel);
    _socket.on(ActiveGameSocketEvents.tradeComplete, _onTradeComplete);
    // Like the Angular `GameModeService.onInit`: teams updated during the game (team drop-in).
    _socket.on(GameRoomSocketEvents.updateTeams, _onUpdateTeamsDuringGame);
  }

  void detachSocketListeners() {
    if (!_listenersAttached) return;
    _listenersAttached = false;
    _socket.offAll(ActiveGameSocketEvents.turnUpdate);
    _socket.offAll(ActiveGameSocketEvents.playerDisconnect);
    _socket.offAll(TimerSocketEvents.timerUpdate);
    _socket.offAll(TimerSocketEvents.timerEnd);
    _socket.offAll(ActiveGameSocketEvents.playerNextPosition);
    _socket.offAll(ActiveGameSocketEvents.doorUpdated);
    _socket.offAll(ActiveGameSocketEvents.itemPickedUp);
    _socket.offAll(ActiveGameSocketEvents.itemUpdate);
    _socket.offAll(ActiveGameSocketEvents.itemsDropped);
    _socket.offAll(ActiveGameSocketEvents.spawnPlayer);
    _socket.offAll(ActiveGameSocketEvents.mapRequest);
    _socket.offAll(ActiveGameSocketEvents.playerStartedMoving);
    _socket.offAll(ActiveGameSocketEvents.playerStoppedMoving);
    _socket.offAll(ActiveGameSocketEvents.combatInitiated);
    _socket.offAll(ActiveGameSocketEvents.combatUpdate);
    _socket.offAll(ActiveGameSocketEvents.gameEnded);
    _socket.offAll(ActiveGameSocketEvents.noMorePlayers);
    _socket.offAll(DebugSocketEvents.toggleDebug);
    _socket.offAll(CTFSocketEvents.flagTaken);
    _socket.offAll(CTFSocketEvents.flagCaptured);
    _socket.offAll(ActiveGameSocketEvents.tradeStarted);
    _socket.offAll(ActiveGameSocketEvents.tradeUpdate);
    _socket.offAll(ActiveGameSocketEvents.tradeAccept);
    _socket.offAll(ActiveGameSocketEvents.tradeCancel);
    _socket.offAll(ActiveGameSocketEvents.tradeComplete);
    _socket.offAll(GameRoomSocketEvents.updateTeams);
  }

  void _onUpdateTeamsDuringGame(dynamic raw) {
    if (raw is! Map) return;
    final teamsRaw = raw['teams'];
    if (teamsRaw is! List || teamsRaw.isEmpty) return;
    _applyTeamsPayload(teamsRaw);
    notifyListeners();
  }

  /// Converts the received `teams` list (REST `/game/start`, `/game-room/:id/data`,
  /// or socket `updateTeams`) into a `List<LobbyTeam>` and stores it in `gameTeams`.
  /// No `notifyListeners` call here: left to the caller.
  void _applyTeamsPayload(dynamic teamsRaw) {
    if (teamsRaw is! List) return;
    final myId = myPlayerId;
    gameTeams = teamsRaw
        .map((e) {
          if (e is! Map) return null;
          final m = Map<String, dynamic>.from(e);
          final pls = (m['players'] as List<dynamic>?)
                  ?.map((p) => p is Map
                      ? LobbyPlayer.fromJson(Map<String, dynamic>.from(p))
                      : null)
                  .whereType<LobbyPlayer>()
                  .toList() ??
              <LobbyPlayer>[];
          final id = m['id']?.toString() ?? '';
          final isOwn = pls.any((p) => p.id == myId);
          return LobbyTeam(
            id: id,
            icon: m['icon'] as String? ?? '',
            color: m['color'] as String? ?? '#FFFFFF',
            players: pls,
            isOwnTeam: isOwn,
          );
        })
        .whereType<LobbyTeam>()
        .toList();
  }

  // ── Handlers requiring several mixins (dispatch) ──

  /// Wrapper around _onDoorUpdated: updates the grid then recomputes
  /// the reachable tiles (requires _MovementMixin, unreachable from _GridMixin).
  void _onDoorUpdatedAndRefresh(dynamic raw) {
    _onDoorUpdated(raw);
    _refreshMovementHints();
  }

  /// Wrapper around _onSpawnPlayer: places the player on the grid then
  /// recomputes the reachable tiles (a new player may block a
  /// path, or the local player just appeared after a drop-in).
  void _onSpawnPlayerAndRefresh(dynamic raw) {
    _onSpawnPlayer(raw);
    _refreshMovementHints();
  }

  void onLogicalCellTap(int lx, int ly) {
    if (!isMyTurn || blockPlaying || isBoardPlayLockedForCombat || isMoving) {
      return;
    }
    if (isActionMode) {
      _handleActionTap(lx, ly);
      return;
    }
    _handleMovementTap(lx, ly);
  }

  void _onPlayerStoppedMoving(dynamic _) {
    isMoving = false;
    if (_pendingNextTurnAfterMove) {
      _scheduleNextTurnEmit();
    } else {
      _refreshMovementHints();
      _checkAutoEndTurn();
    }
  }

  void _onMapRequest(dynamic _) {
    final roomId = _lobby.roomId;
    final g = grid;
    if (roomId == null || g == null) return;
    _socket.emit(ActiveGameSocketEvents.mapRequest, <String, dynamic>{
      'roomId': roomId,
      'map': g.boardToJson(),
    });
    Future<void>.delayed(const Duration(milliseconds: 220), () {
      final id = _lobby.roomId;
      if (id != null) _syncGridFromServer(id);
    });
  }

  void _onPlayerDisconnect(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final id = map['playerId']?.toString();
    if (id == null || id.isEmpty) return;
    final name = _playerName(id);
    if (!disconnectedPlayerIds.contains(id)) disconnectedPlayerIds.add(id);
    if (playerCount > 0 && rosterPlayers.any((p) => p.id == id)) {
      rosterPlayers = List<GamePlayerState>.from(rosterPlayers);
    }

    // ── If the disconnecting player was in combat, end the combat locally ──
    // Team combat: the web client does nothing here (`_teamCombatState` → return).
    if (inCombat &&
        !isTeamCombat &&
        (id == combatAttackerId ||
            id == combatDefenderId ||
            id == combatInitiatorId ||
            id == combatTargetId)) {
      final wasMyTurn = isMyTurn;
      _stopCombatChoiceTimer();
      combatChoicePending = false;
      inCombat = false;
      combatWinnerAnnouncement = null;
      _combatEndTimer?.cancel();
      _combatEndTimer = null;
      combatAttackerId = null;
      combatDefenderId = null;
      combatTurnId = null;
      combatInitialAttackerStats = null;
      combatInitialDefenderStats = null;
      combatInitiatorId = null;
      combatTargetId = null;
      _combatEscapeAttempts.clear();
      _escapeAttempts = GameConstants.maxEscapeAttempts;
      combatEscapeDisabled = false;
      combatResultMessage = null;
      initiatorDiceRoll = '-';
      targetDiceRoll = '-';
      _combatLoserId = null;
      _combatPending = false;
      combatDiceAttackPlayerId = null;
      combatDiceDefensePlayerId = null;
      // Clear team combat state (mirrors _finishCombatEnd)
      isTeamCombat = false;
      needsTargetSelection = false;
      availableTargets = <GamePlayerState>[];
      teamACombatIds = <String>[];
      teamBCombatIds = <String>[];
      _stopTargetSelectionTimer();
      _consumeAction();

      // Process any deferred TurnUpdate that arrived while combat was active.
      // _onTurnUpdate defers to _pendingTurnPlayer when inCombat is true, so
      // now that combat is over we must replay it to complete the transition.
      if (_pendingTurnPlayer != null) {
        final pending = _pendingTurnPlayer!;
        _pendingTurnPlayer = null;
        // Re-dispatch so the full turn-transition logic runs (timer reset,
        // blockPlaying, etc.).
        _onTurnUpdate(<String, dynamic>{'player': pending.toJson()});
      } else if (wasMyTurn) {
        // No pending turn change — the current turn player stays the same.
        // Restart the turn timer that was frozen when combat started.
        final remaining = _lastNonCombatTimerValue > 0 ? _lastNonCombatTimerValue : 1;
        _emitStartTimerAfterCombat(remaining);
        _refreshMovementHints();
        _checkAutoEndTurn();
      }
    } else if (_combatPending) {
      // Combat was being initiated but the target disconnected before the
      // server confirmed — just reset the pending flag.
      _combatPending = false;
    }

    // ── Remove the player from the grid (like Angular `removeStartingPoint`) ──
    _removePlayerFromGrid(id);

    // Handle item drops from the disconnected player
    final itemInfo = map['itemInformation'];
    if (itemInfo is Map) {
      final itemInfoMap = Map<String, dynamic>.from(itemInfo);
      final posRaw = itemInfoMap['position'];
      final invRaw = itemInfoMap['inventory'];
      if (posRaw is Map && invRaw is List) {
        final pos = GamePosition.fromJson(Map<String, dynamic>.from(posRaw));
        final inv = invRaw
            .whereType<Map>()
            .map((e) => GameItem.fromJson(Map<String, dynamic>.from(e)))
            .toList();
        final g = grid;
        if (g != null && inv.isNotEmpty) {
          final available = findAvailableTerrainForItem(pos, g.board);
          _emitItemsDropped(inv, available);
        }
      }
    }

    // If local player disconnects, clear inventory
    if (_isLocalPlayerId(id)) {
      if (localInventory.any((i) => i.isFlag)) {
        final roomId = _lobby.roomId;
        if (roomId != null) {
          _socket.emit(CTFSocketEvents.flagDropped, <String, String>{
            'roomId': roomId,
          });
        }
      }
      clearLocalInventory();
    }

    _logJournalKey('log.player_disconnected', {'name': name}, p1: id);
    notifyListeners();
  }

  // ── Trade handlers ──

  void _onTradeStarted(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final pId = map['playerId']?.toString();
    final tId = map['teammateId']?.toString();
    if (pId == null || tId == null) return;
    if (!_isLocalPlayerId(pId) && !_isLocalPlayerId(tId)) return;
    tradePlayerId = pId;
    tradeTeammateId = tId;
    tradePlayerInventory = _parseItemList(map['playerInventory']);
    tradeTeammateInventory = _parseItemList(map['teammateInventory']);
    tradePlayerSelected = null;
    tradeTeammateOffered = null;
    tradePlayerAccepted = false;
    tradeTeammateAccepted = false;
    showTradePopup = true;
    notifyListeners();
  }

  void _onTradeUpdate(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    tradePlayerInventory = _parseItemList(map['playerInventory']);
    tradeTeammateInventory = _parseItemList(map['teammateInventory']);
    final selRaw = map['playerSelected'];
    final offRaw = map['teammateItemOffered'];
    tradePlayerSelected = selRaw is Map ? GameItem.fromJson(Map<String, dynamic>.from(selRaw)) : null;
    tradeTeammateOffered = offRaw is Map ? GameItem.fromJson(Map<String, dynamic>.from(offRaw)) : null;
    notifyListeners();
  }

  void _onTradeAccept(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final aAccepted = map['playerAAccepted'] == true;
    final bAccepted = map['playerBAccepted'] == true;
    tradePlayerAccepted = _isLocalPlayerId(map['playerAId']?.toString()) ? aAccepted : bAccepted;
    tradeTeammateAccepted = _isLocalPlayerId(map['playerAId']?.toString()) ? bAccepted : aAccepted;
    notifyListeners();
  }

  void _onTradeCancel(dynamic _) {
    showTradePopup = false;
    tradePlayerId = null;
    tradeTeammateId = null;
    notifyListeners();
  }

  void _onTradeComplete(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    // Update local inventory from server data
    final aId = map['playerAId']?.toString();
    final bId = map['playerBId']?.toString();
    if (_isLocalPlayerId(aId)) {
      localInventory = _parseItemList(map['playerAInventory']);
    } else if (_isLocalPlayerId(bId)) {
      localInventory = _parseItemList(map['playerBInventory']);
    }
    _handleInventoryChange();
    showTradePopup = false;
    tradePlayerId = null;
    tradeTeammateId = null;
    _consumeAction();
    notifyListeners();
  }

  List<GameItem> _parseItemList(dynamic raw) {
    if (raw is! List) return <GameItem>[];
    return raw.whereType<Map>().map((e) => GameItem.fromJson(Map<String, dynamic>.from(e))).toList();
  }

  void updateTradeSelection(String itemUniqueId) {
    final roomId = _lobby.roomId;
    if (roomId == null || tradeTeammateId == null) return;
    _socket.emit(ActiveGameSocketEvents.tradeUpdate, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'teammateId': tradeTeammateId,
      'itemId': itemUniqueId,
    });
  }

  void acceptTrade() {
    final roomId = _lobby.roomId;
    if (roomId == null || tradeTeammateId == null) return;
    _socket.emit(ActiveGameSocketEvents.tradeAccept, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'teammateId': tradeTeammateId,
    });
  }

  void cancelTrade() {
    final roomId = _lobby.roomId;
    if (roomId == null || tradeTeammateId == null) return;
    _socket.emit(ActiveGameSocketEvents.tradeCancel, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'teammateId': tradeTeammateId,
    });
  }

  void _onGameEnded(dynamic raw) {
    _clearCombatIfActive();
    if (raw is Map) {
      final map = Map<String, dynamic>.from(raw);
      endGameStats = GameStatsPayload.fromJson(map);
    }
    notifyListeners();
  }

  void _onNoMorePlayers(dynamic _) {
    _clearCombatIfActive();
    if (!_gameEndRequested) {
      shouldLeaveGame = true;
    }
    notifyListeners();
  }

  /// Clears all combat state when the game ends or no players remain.
  /// This covers cases where a player abandons during combat in a 2-player
  /// game: the server emits GameEnded/NoMorePlayers without a PlayerDisconnect,
  /// so the combat overlay would otherwise stay visible.
  void _clearCombatIfActive() {
    if (!inCombat && !_combatPending && !_waitingForTeamCombatEnd) return;
    _stopCombatChoiceTimer();
    combatChoicePending = false;
    inCombat = false;
    _waitingForTeamCombatEnd = false;
    combatWinnerAnnouncement = null;
    _combatEndTimer?.cancel();
    _combatEndTimer = null;
    combatAttackerId = null;
    combatDefenderId = null;
    combatTurnId = null;
    combatInitialAttackerStats = null;
    combatInitialDefenderStats = null;
    combatInitiatorId = null;
    combatTargetId = null;
    _combatEscapeAttempts.clear();
    _escapeAttempts = GameConstants.maxEscapeAttempts;
    combatEscapeDisabled = false;
    combatResultMessage = null;
    initiatorDiceRoll = '-';
    targetDiceRoll = '-';
    _combatLoserId = null;
    _combatPending = false;
    combatDiceAttackPlayerId = null;
    combatDiceDefensePlayerId = null;
    isTeamCombat = false;
    needsTargetSelection = false;
    availableTargets = <GamePlayerState>[];
    teamACombatIds = <String>[];
    teamBCombatIds = <String>[];
    _stopTargetSelectionTimer();
    _pendingTurnPlayer = null;
  }

  /// CTF: the server sends { winningTeam: Player[] } when the flag is captured.
  void _onFlagCaptured(dynamic raw) {
    if (_gameEndRequested) return;
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final teamRaw = map['winningTeam'];
    if (teamRaw is! List || teamRaw.isEmpty) return;

    final winningPlayers = teamRaw
        .whereType<Map>()
        .map((e) => GamePlayerState.fromJson(Map<String, dynamic>.from(e)))
        .toList();
    if (winningPlayers.isEmpty) return;

    _gameEndRequested = true;

    final i18n = I18n();
    final localIsWinner = winningPlayers.any((p) => _isLocalPlayerId(p.id));
    if (localIsWinner) {
      winnerAnnouncementMessage = i18n.translate('game_over.you_won');
    } else {
      final names = winningPlayers.map((p) => p.name).join(', ');
      winnerAnnouncementMessage = winningPlayers.length == 1
          ? i18n.translateWithParams('game_over.winner_singular', {
              'name': names,
            })
          : i18n.translateWithParams('game_over.winners_plural', {
              'names': names,
            });
    }

    _logEndGameThanks();
    notifyListeners();
    _requestFetchStats();
  }

  void clearWinnerAnnouncement() {
    winnerAnnouncementMessage = null;
    notifyListeners();
  }

  /// Called from the swap popup: user chose [item] to discard.
  void confirmItemSwap(GameItem item) {
    removeItemFromLocalInventory(item);
    showInventorySwapPopup = false;

    final roomId = _lobby.roomId;
    if (roomId == null) return;

    // Notify server about the swapped item
    _socket.emit(ActiveGameSocketEvents.itemSwapped, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'item': item.toJson(),
      'inventory': localInventory.map((e) => e.toJson()).toList(),
    });

    if (item.isFlag) {
      _socket.emit(CTFSocketEvents.flagDropped, <String, String>{
        'roomId': roomId,
      });
    }
    notifyListeners();
  }

  /// Auto-swap: timer ran out during swap popup, discard a random item.
  void autoSwapRandomItem() {
    if (localInventory.isEmpty) return;
    final shuffled = List<GameItem>.from(localInventory)..shuffle();
    confirmItemSwap(shuffled.first);
  }

  // ── Journal (API publique) ──

  void clearCombatWinnerAnnouncement() {
    combatWinnerAnnouncement = null;
    notifyListeners();
  }

  void toggleJournalFilter() {
    journalFilterMineOnly = !journalFilterMineOnly;
    notifyListeners();
  }

  List<GameJournalEntry> get filteredJournal {
    final me = myPlayerId;
    if (!journalFilterMineOnly || me.isEmpty) {
      return List<GameJournalEntry>.from(journalEntries);
    }
    return journalEntries.where((e) => e.involvesPlayer(me)).toList();
  }

  // ── Reset ──

  void reset() {
    detachSocketListeners();
    grid = null;
    rosterPlayers = <GamePlayerState>[];
    gameTeams = <LobbyTeam>[];
    disconnectedPlayerIds.clear();
    currentTurnPlayer = null;
    blockPlaying = false;
    timerDisplay = '--';
    inCombat = false;
    isActionMode = false;
    journalEntries.clear();
    journalFilterMineOnly = false;
    loadError = null;
    isLoading = true;
    isFogOfWar = false;
    sessionGameMode = null;
    _sessionLobbyGameMode = null;
    _sessionDropInEnabled = null;
    isDebug = false;
    isMoving = false;
    reachableTileKeys.clear();
    pathPreviewPositions = <GamePosition>[];
    pathPreviewTarget = null;
    _previewPathCost = 0;
    _previewPathTurns = 0;
    _transitionCompleting = false;
    _showYourTurnBanner = false;
    _turnFlashTimer?.cancel();
    _turnFlashTimer = null;
    _turnFlashPlayerName = null;
    _pendingTurnPlayer = null;
    _pendingNextTurnAfterMove = false;
    _turnExpiryHandledForPlayerId = null;
    _turnDelayTickReceived = false;
    _turnTransitionFallback?.cancel();
    _turnTransitionFallback = null;
    _lastNonCombatTimerValue = GameConstants.turnTimeSeconds;
    _combatLoserId = null;
    _combatPending = false;
    _waitingForTeamCombatEnd = false;
    _expectingTurnTimer = false;
    combatWinnerAnnouncement = null;
    actionsLeft = 0;
    combatAttackerId = null;
    combatDefenderId = null;
    combatTurnId = null;
    combatInitialAttackerStats = null;
    combatInitialDefenderStats = null;
    lastDiceAttack = null;
    lastDiceDefense = null;
    lastDamage = null;
    combatResultMessage = null;
    combatChoicePending = false;
    combatEscapeDisabled = false;
    _escapeAttempts = GameConstants.maxEscapeAttempts;
    _combatChoiceTimer?.cancel();
    _combatChoiceTimer = null;
    _combatTimerTicks = 0;
    _combatTimerTotalTicks = 0;
    combatInitiatorId = null;
    combatTargetId = null;
    _combatEscapeAttempts.clear();
    initiatorDiceRoll = '-';
    targetDiceRoll = '-';
    combatDiceAttackPlayerId = null;
    combatDiceDefensePlayerId = null;
    _combatEndTimer?.cancel();
    _combatEndTimer = null;
    isTeamCombat = false;
    needsTargetSelection = false;
    availableTargets = <GamePlayerState>[];
    teamACombatIds = <String>[];
    teamBCombatIds = <String>[];
    _targetSelectionTimer?.cancel();
    _targetSelectionTimer = null;
    targetTimerSecondsLeft = 0;
    showTradePopup = false;
    tradePlayerId = null;
    tradeTeammateId = null;
    tradePlayerInventory = <GameItem>[];
    tradeTeammateInventory = <GameItem>[];
    tradePlayerSelected = null;
    tradeTeammateOffered = null;
    tradePlayerAccepted = false;
    tradeTeammateAccepted = false;
    localInventory = <GameItem>[];
    showInventorySwapPopup = false;
    buffedAttack = GameConstants.baseStat;
    buffedDefense = GameConstants.baseStat;
    potionLifeBonus = 0;
    _hasAppliedPotionBuff = false;
    _hasAppliedShieldBuff = false;
    _previousInventory = <GameItem>[];
    endGameStats = null;
    winnerAnnouncementMessage = null;
    _gameEndRequested = false;
    shouldLeaveGame = false;
    _localPlayerEliminated = false;
    notifyListeners();
  }
}
