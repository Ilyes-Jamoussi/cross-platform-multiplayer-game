part of 'active_game_service.dart';

/// Turn management, timer, transitions, actions, automatic end of turn.
mixin _TurnMixin on _ActiveGameBase, _GridMixin, _MovementMixin {
  void _onTurnUpdate(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final pRaw = map['player'];
    if (pRaw is! Map) return;
    final player = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
    if (currentTurnPlayer?.id == player.id) return;

    // Guard against duplicate TurnUpdate for the same player while a
    // transition is already in progress.  This happens when the server's
    // PlayerReady unicast arrives after a broadcast TurnUpdate for the same
    // player – only Flutter receives the unicast, so processing it would
    // emit an extra resetTimer(TURN_DELAY) that desynchronises the shared
    // server timer between Angular and Flutter clients.
    if (_pendingTurnPlayer?.id == player.id) return;

    // Guard against double turn transitions after combat.
    // The server (handleCombat→handleEndTurn) and the web client
    // (checkTurn→nextTurn) can both trigger handleEndTurn, producing two
    // TurnUpdate events ~150 ms apart.  If a second one arrives while the
    // combat-end wind-down is still active, update the pending player to the
    // latest one (don't silently drop it) so mobile always syncs to the
    // server's true current turn.
    if (_pendingTurnPlayer != null &&
        (isBoardPlayLockedForCombat || _combatEndTimer != null)) {
      _pendingTurnPlayer = player;
      return;
    }

    _turnExpiryHandledForPlayerId = null;
    _expectingTurnTimer = false;
    _pendingTurnPlayer = player;
    _transitionCompleting = false;
    _turnDelayTickReceived = false;
    currentTurnPlayer = null;
    blockPlaying = true;
    _triggerTurnFlash(player.name);
    notifyListeners();

    // Always emit resetTimer, exactly like Angular does.  Both clients reset
    // the server timer to TURN_DELAY on every TurnUpdate.  This keeps mobile
    // synchronised even when there is no Angular client in the room.
    _emitResetTimer(GameConstants.turnDelaySeconds, isCombat: false);

    // Local fallback: if the server timer-zero event is missed (lag, packet
    // loss), force-complete the transition after TURN_DELAY + 2 s.
    _turnTransitionFallback?.cancel();
    _turnTransitionFallback = Timer(
      const Duration(seconds: GameConstants.turnDelaySeconds + 2),
      () {
        if (blockPlaying && currentTurnPlayer == null && !_transitionCompleting) {
          _transitionCompleting = true;
          _completeTurnTransition();
        }
      },
    );

    _logJournalKey('log.turn_update', {'name': player.name}, p1: player.id);
  }

  void _onTimerUpdate(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final isCombatTimer = map['isCombat'] == true;
    if (isCombatTimer) {
      final t = map['timeLeft'];
      final next = t is num ? t.toInt() : '--';
      if (timerDisplay != next) {
        timerDisplay = next;
        notifyListeners();
      }
      return;
    }

    // Non-combat timer tick: update display but do NOT touch inCombat
    // (combat state is managed exclusively by _CombatMixin).
    final t = map['timeLeft'];
    timerDisplay = t is num ? t.toInt() : '--';
    if (t is num && !isBoardPlayLockedForCombat) {
      _lastNonCombatTimerValue = t.toInt();
    }
    if (t is num &&
        t.toInt() > GameConstants.turnDelaySeconds &&
        !blockPlaying &&
        !isBoardPlayLockedForCombat) {
      _expectingTurnTimer = true;
    }

    // Track that we received at least one non-zero tick during the turn-delay
    // phase (equivalent to Angular's _isTurn flag).  This prevents a stale
    // timer=0 from a previous cycle from triggering the transition.
    if (t is num && t.toInt() > 0 && blockPlaying && currentTurnPlayer == null) {
      _turnDelayTickReceived = true;
    }

    _handleTimerTickAtZero(isCombatTimer: isCombatTimer, t: t);
    notifyListeners();
  }

  void _handleTimerTickAtZero({required bool isCombatTimer, required dynamic t}) {
    if (isCombatTimer) return;
    final timeLeft = t is num ? t.toInt() : -1;
    if (timeLeft != 0) return;

    // Complete the turn-delay → active-turn transition.
    // _turnDelayTickReceived guards against stale timer=0 from a previous
    // cycle (same role as Angular's _isTurn flag).
    if (blockPlaying && currentTurnPlayer == null && !_transitionCompleting && _turnDelayTickReceived) {
      _transitionCompleting = true;
      _completeTurnTransition();
      return;
    }

    if (!blockPlaying &&
        currentTurnPlayer != null &&
        isMyTurn &&
        !isBoardPlayLockedForCombat &&
        _expectingTurnTimer) {
      final pid = currentTurnPlayer!.id;
      if (_turnExpiryHandledForPlayerId == pid) return;
      _turnExpiryHandledForPlayerId = pid;
      _scheduleNextTurnEmit();
    }
  }

  void _completeTurnTransition() {
    _turnTransitionFallback?.cancel();
    _turnTransitionFallback = null;
    final pending = _pendingTurnPlayer;
    _pendingTurnPlayer = null;
    blockPlaying = false;
    _transitionCompleting = false;
    _turnExpiryHandledForPlayerId = null;
    if (pending != null) {
      currentTurnPlayer = _mergeStatsFromGrid(pending);
      _lastNonCombatTimerValue = GameConstants.turnTimeSeconds;
      // Always emit resetTimer for the main turn, exactly like Angular.
      _emitResetTimer(GameConstants.turnTimeSeconds, isCombat: false);
      if (_isLocalPlayerId(currentTurnPlayer!.id)) {
        _turnFlashTimer?.cancel();
        _turnFlashPlayerName = null;
        _resetLocalPlayerSpeed();
        actionsLeft = maxActions;
        isActionMode = false;
        _escapeAttempts = GameConstants.maxEscapeAttempts;
        combatEscapeDisabled = false;
        _showYourTurnBanner = true;
        Future<void>.delayed(
          const Duration(milliseconds: GameConstants.yourTurnPopupMs),
          () {
            _showYourTurnBanner = false;
            notifyListeners();
          },
        );
      }
    }
    _refreshMovementHints();
  }

  /// Equivalent of `alertService.notify(turn_notification)` on the web client.
  void _triggerTurnFlash(String name) {
    _turnFlashTimer?.cancel();
    _turnFlashPlayerName = name;
    _turnFlashTimer = Timer(
      const Duration(milliseconds: GameConstants.turnFlashPopupMs),
      () {
        _turnFlashPlayerName = null;
        notifyListeners();
      },
    );
  }

  void _resetLocalPlayerSpeed() {
    final g = grid;
    if (g == null) return;
    for (var x = 0; x < g.board.length; x++) {
      final row = g.board[x];
      for (var y = 0; y < row.length; y++) {
        final c = row[y];
        if (c.player != null && _isLocalPlayerId(c.player!.id)) {
          final s = c.player!.stats;
          if (s == null) return;
          final maxSpd = s.maxSpeed ?? s.speed;
          if (s.speed == maxSpd) return;
          final resetStats = GameCombatStats(
            life: s.life,
            speed: maxSpd,
            attack: s.attack,
            defense: s.defense,
            maxLife: s.maxLife,
            maxSpeed: s.maxSpeed,
          );
          final resetPlayer = c.player!.copyWith(stats: resetStats);
          final updated = BoardCellState(tile: c.tile, item: c.item, player: resetPlayer);
          grid = _cloneGridReplaceCell(x, y, updated, g);
          notifyListeners();
          return;
        }
      }
    }
  }

  GamePlayerState _mergeStatsFromGrid(GamePlayerState base) {
    final onGrid = _findPlayerOnGrid(base.id);
    if (onGrid?.stats != null) return base.copyWith(stats: onGrid!.stats);
    return base;
  }

  void _onTimerEnd(dynamic raw) {
    final map = _asSocketMap(raw);
    if (map == null) return;
    final turnEnd = map['turnEnd'] == true;
    final isCombatEnd = map['isCombat'] == true;
    if (isCombatEnd) return;
    if (turnEnd &&
        isMyTurn &&
        !blockPlaying &&
        !isBoardPlayLockedForCombat &&
        _expectingTurnTimer) {
      final pid = currentTurnPlayer?.id;
      if (pid != null && _turnExpiryHandledForPlayerId == pid) return;
      if (pid != null) _turnExpiryHandledForPlayerId = pid;
      _scheduleNextTurnEmit();
    }
  }

  void _emitResetTimer(int seconds, {required bool isCombat}) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(TimerSocketEvents.resetTimer, <String, Object?>{
      'roomId': roomId,
      'startValue': seconds,
      'isCombat': isCombat,
    });
  }

  void _emitStopTimer({required bool isCombat}) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(TimerSocketEvents.stopTimer, <String, Object?>{
      'roomId': roomId,
      'isCombat': isCombat,
    });
  }

  void _emitStartTimerAfterCombat(int seconds) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(TimerSocketEvents.startTimer, <String, Object?>{
      'roomId': roomId,
      'startValue': seconds,
      'isCombat': false,
      'isCombatOver': true,
    });
  }

  void requestNextTurn() => _scheduleNextTurnEmit();

  void _scheduleNextTurnEmit() {
    final roomId = _lobby.roomId;
    if (roomId == null ||
        !isMyTurn ||
        blockPlaying ||
        isBoardPlayLockedForCombat ||
        isLocalPlayerEliminated) {
      _pendingNextTurnAfterMove = false;
      return;
    }
    if (isMoving) {
      _pendingNextTurnAfterMove = true;
      return;
    }
    _pendingNextTurnAfterMove = false;
    _socket.emit(ActiveGameSocketEvents.nextTurn, <String, String?>{'roomId': roomId});
  }

  void toggleActionMode() {
    if (!isMyTurn || blockPlaying || isMoving || isBoardPlayLockedForCombat) {
      return;
    }
    isActionMode = !isActionMode;
    _clearPathPreviewInternal();
    _refreshMovementHints();
  }

  void _consumeAction() {
    if (actionsLeft > 0) actionsLeft--;
    isActionMode = false;
    notifyListeners();
  }

  void _checkAutoEndTurn() {
    if (!isMyTurn || blockPlaying || isBoardPlayLockedForCombat || isMoving) {
      return;
    }

    // Like Angular `checkAndProcessTurnEnd`: no auto-end if the timer is already at 0
    // (the server / TimerEnd handles it) nor if ice is adjacent (special case).
    final td = timerDisplay;
    if (td is num && td.toInt() == 0) return;

    final g = grid;
    final cell = localPlayerCellPosition;
    if (MovementPathfinding.isIceAdjacentToCell(g, cell)) return;

    // Determine if the player can actually move to a DIFFERENT tile.
    // reachableTileKeys always contains the current position (for highlight),
    // so we must exclude it when checking whether movement is possible.
    final myCell = localPlayerCellPosition;
    bool canMove;
    if (myCell != null) {
      final myKey = MovementPathfinding.posKey(myCell);
      canMove = reachableTileKeys.any((k) => k != myKey);
    } else {
      canMove = reachableTileKeys.isNotEmpty;
    }

    final hasActions = actionsLeft > 0;
    final info = getAdjacentActionInfo();
    final hasTargets =
        info.doors.isNotEmpty || info.combatTargets.isNotEmpty || info.tradeTargets.isNotEmpty;

    // Condition 1: No movement AND no actions left → exhausted everything
    // Condition 2: No movement AND has actions but no valid adjacent targets
    // Condition 3: No actions left AND blocked (can't move to any other tile)
    final bool shouldEnd =
        (!canMove && !hasActions) ||
        (!canMove && hasActions && !hasTargets) ||
        (!hasActions && !canMove);

    if (!shouldEnd) return;

    Future<void>.delayed(const Duration(milliseconds: GameConstants.debounceTimeMs), () {
      if (isMyTurn &&
          !blockPlaying &&
          !isBoardPlayLockedForCombat &&
          !isMoving) {
        _scheduleNextTurnEmit();
      }
    });
  }
}
