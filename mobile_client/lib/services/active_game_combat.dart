part of 'active_game_service.dart';

/// Combat, actions sur portes/ennemis adjacents, timer de choix.
mixin _CombatMixin on _ActiveGameBase, _GridMixin, _MovementMixin, _TurnMixin {
  void _handleActionTap(int lx, int ly) {
    if (actionsLeft <= 0) return;
    if (!_isAdjacentToLocal(lx, ly)) return;
    final g = grid;
    if (g == null) return;
    final cell = g.board[lx][ly];

    if ((cell.tile == GameTileTypes.door || cell.tile == GameTileTypes.openedDoor) && cell.player == null) {
      _toggleDoor(lx, ly, cell);
      return;
    }
    if (cell.player != null && !_isLocalPlayerId(cell.player!.id)) {
      if (lobbyGameMode == LobbyGameMode.teams && isTeammate(cell.player!.id)) {
        _initiateTrade(cell.player!);
      } else {
        _initiateCombat(cell.player!);
      }
      return;
    }
  }

  void _toggleDoor(int lx, int ly, BoardCellState cell) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    final isOpened = cell.tile == GameTileTypes.door;
    _socket.emit(ActiveGameSocketEvents.toggledDoor, <String, dynamic>{
      'roomId': roomId,
      'position': GamePosition(x: lx, y: ly).toJson(),
      'isOpened': isOpened,
    });

    // Update the local grid immediately so the recalculation
    // of reachable tiles takes the new door state into account.
    final g = grid;
    if (g != null) {
      final newTile = isOpened ? GameTileTypes.openedDoor : GameTileTypes.door;
      final updated = BoardCellState(tile: newTile, item: cell.item, player: cell.player);
      grid = _cloneGridReplaceCell(lx, ly, updated, g);
    }

    _consumeAction();
    _refreshMovementHints();
    _checkAutoEndTurn();
  }

  void _initiateCombat(GamePlayerState target) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _combatPending = true;
    _emitStopTimer(isCombat: false);
    _socket.emit(ActiveGameSocketEvents.combatStarted, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'action': GameActions.startCombat,
      'target': target.toJson(),
    });
  }

  void sendCombatAction(String action) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _stopCombatChoiceTimer();
    combatChoicePending = false;

    // Team combat: choose action first, then select target
    if (isTeamCombat && needsTargetSelection && availableTargets.isNotEmpty) {
      _pendingTeamAction = action;
      if (action == GameActions.attack) {
        // Show target selection UI with countdown timer
        _startTargetSelectionTimer();
        notifyListeners();
        return;
      } else {
        // Flee: auto-select first enemy, action will be sent on TargetSelected
        sendTargetSelection(availableTargets.first.id);
        notifyListeners();
        return;
      }
    }

    notifyListeners();
    _socket.emit(ActiveGameSocketEvents.combatAction, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'action': action,
    });
  }

  /// Whether the player chose attack and now needs to pick a target.
  bool get showTargetSelectionAfterChoice =>
      _pendingTeamAction == GameActions.attack && needsTargetSelection;

  // ── Combat choice timer ──

  void _startCombatChoiceTimer() {
    _stopCombatChoiceTimer();
    final seconds = combatEscapeDisabled
        ? GameConstants.combatChoiceReducedSeconds
        : GameConstants.combatChoiceSeconds;
    _combatTimerTotalTicks = seconds * GameConstants.combatChoiceTicksPerSecond;
    _combatTimerTicks = _combatTimerTotalTicks;
    notifyListeners();

    _combatChoiceTimer = Timer.periodic(
      const Duration(milliseconds: 100),
      (_) {
        _combatTimerTicks--;
        if (_combatTimerTicks <= 0) {
          _combatTimerTicks = 0;
          _stopCombatChoiceTimer();
          if (combatChoicePending) {
            sendCombatAction(GameActions.attack);
          }
        }
        // No notifyListeners here: at 10 Hz it rebuilds the whole GamePage
        // (grid + GIF). The bar uses a local AnimationController
        // in [_ChoiceOverlay].
      },
    );
  }

  void _stopCombatChoiceTimer() {
    _combatChoiceTimer?.cancel();
    _combatChoiceTimer = null;
  }

  /// Same logic as `vs-pop-up.component.ts`: `AttackNotDefeated` →
  /// `animatorId = lastAttackerId ?? combat.defender`, player in `gameState.players`,
  /// duration `attackDuration || SNACKBAR_TIME` on `attacker.avatar`.
  void _triggerAngularVsAttackAnimation(
    Map<String, dynamic> map,
    Map<String, dynamic>? gsRaw,
  ) {
    String? animatorId = map['lastAttackerId']?.toString();
    if (animatorId == null || animatorId.isEmpty) {
      final c = gsRaw?['combat'];
      if (c is Map) {
        animatorId = Map<String, dynamic>.from(c)['defender']?.toString();
      }
    }
    if (animatorId == null || animatorId.isEmpty) return;

    Map<String, dynamic>? attackerRow;
    if (gsRaw != null) {
      final playersRaw = gsRaw['players'];
      if (playersRaw is List) {
        for (final raw in playersRaw) {
          if (raw is! Map) continue;
          final row = Map<String, dynamic>.from(raw);
          if (row['id']?.toString() == animatorId) {
            attackerRow = row;
            break;
          }
        }
      }
    }

    String? avatar;
    if (attackerRow != null) {
      final avatarRaw = attackerRow['avatar']?.toString();
      if (avatarRaw != null && avatarRaw.trim().isNotEmpty) {
        avatar = avatarRaw.trim();
      }
    }
    avatar ??= _findPlayerOnGridById(animatorId)?.avatar?.trim();
    if (avatar == null || avatar.isEmpty) {
      final r = _rosterPlayerById(animatorId)?.avatar?.trim();
      if (r != null && r.isNotEmpty) avatar = r;
    }

    combatAttackAnimationPlayerId = animatorId;
    combatAttackAnimationDurationMs = combatAttackDurationMsFor(avatar);
    combatAttackAnimationToken++;
  }

  // ── Socket handlers ──

  void _onCombatInitiated(dynamic raw) {
    _combatPending = false;
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final gsRaw = map['gameState'];
    if (gsRaw is! Map) return;
    final gs = Map<String, dynamic>.from(gsRaw);
    final combatRaw = gs['combat'];
    if (combatRaw is! Map) {
      if (isMyTurn) {
        final remaining = _lastNonCombatTimerValue > 0 ? _lastNonCombatTimerValue : 1;
        _emitStartTimerAfterCombat(remaining);
      }
      return;
    }
    final combat = Map<String, dynamic>.from(combatRaw);

    _combatEndTimer?.cancel();
    _combatEndTimer = null;
    combatWinnerAnnouncement = null;

    combatAttackerId = combat['attacker']?.toString();
    combatDefenderId = combat['defender']?.toString();
    combatTurnId = combat['turn']?.toString();

    combatInitiatorId = combatAttackerId;
    combatTargetId = combatDefenderId;

    _escapeAttempts = GameConstants.maxEscapeAttempts;
    combatEscapeDisabled = false;
    _combatEscapeAttempts.clear();
    combatDiceAttackPlayerId = null;
    combatDiceDefensePlayerId = null;
    combatAttackAnimationToken = 0;
    combatAttackAnimationPlayerId = null;
    combatAttackAnimationDurationMs = kAngularSnackbarTimeMs;

    final initRaw = combat['initialStats'];
    if (initRaw is Map) {
      final init = Map<String, dynamic>.from(initRaw);
      final atkRaw = init['attacker'];
      final defRaw = init['defender'];
      if (atkRaw is Map) {
        combatInitialAttackerStats = GameCombatStats.fromJson(Map<String, dynamic>.from(atkRaw));
      }
      if (defRaw is Map) {
        combatInitialDefenderStats = GameCombatStats.fromJson(Map<String, dynamic>.from(defRaw));
      }
    }

    // Apply ice-debuffed stats to the grid immediately so PlayerGameStatusPanel
    // reflects the penalty from combat start (not only after the first CombatUpdate).
    final playersRaw = gs['players'];
    if (playersRaw is List) {
      for (final pRaw in playersRaw) {
        if (pRaw is! Map) continue;
        final p = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
        _updatePlayerOnGrid(p);
      }
    }

    inCombat = true;
    _combatLoserId = null;

    // Parse team combat state
    final tcRaw = combat['teamCombat'];
    if (tcRaw is Map) {
      isTeamCombat = true;
      final tc = Map<String, dynamic>.from(tcRaw);
      teamACombatIds = (tc['teamA'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
      teamBCombatIds = (tc['teamB'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
      needsTargetSelection = tc['needsTargetSelection'] == true;
    } else {
      isTeamCombat = false;
      teamACombatIds = <String>[];
      teamBCombatIds = <String>[];
      needsTargetSelection = false;
    }

    if (isTeamCombat &&
        (teamACombatIds.isNotEmpty || teamBCombatIds.isNotEmpty)) {
      for (final id in {...teamACombatIds, ...teamBCombatIds}) {
        _combatEscapeAttempts[id] = GameConstants.maxEscapeAttempts;
      }
    } else {
      if (combatInitiatorId != null) {
        _combatEscapeAttempts[combatInitiatorId!] = GameConstants.maxEscapeAttempts;
      }
      if (combatTargetId != null) {
        _combatEscapeAttempts[combatTargetId!] = GameConstants.maxEscapeAttempts;
      }
    }

    // Freeze the turn timer (mirrors Angular's freezeTurn on combat start)
    _emitStopTimer(isCombat: false);

    combatResultMessage = null;
    lastDiceAttack = null;
    lastDiceDefense = null;
    lastDamage = null;
    initiatorDiceRoll = '-';
    targetDiceRoll = '-';

    if (_isLocalPlayerId(combatTurnId)) {
      if (isTeamCombat && needsTargetSelection) {
        _refreshAvailableTargets(gs);
      }
      combatChoicePending = true;
      _startCombatChoiceTimer();
    } else {
      combatChoicePending = false;
    }

    _activeAttackerId = combatAttackerId;
    _activeDefenderId = combatDefenderId;

    String attackerName = 'Player 1';
    String defenderName = 'Player 2';
    if (playersRaw is List) {
      for (final pRaw in playersRaw) {
        if (pRaw is! Map) continue;
        final p = Map<String, dynamic>.from(pRaw);
        final pid = p['id']?.toString();
        if (pid == _activeAttackerId) {
          attackerName = (p['name'] ?? attackerName).toString();
        } else if (pid == _activeDefenderId) {
          defenderName = (p['name'] ?? defenderName).toString();
        }
      }
    }
    _logJournalKey(
      'log.combat_initiated',
      {'player1': attackerName, 'player2': defenderName},
    );

    notifyListeners();
  }

  void _onCombatUpdate(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);

    // Check classic mode win condition before processing combat end
    _checkClassicWinCondition(map);
    final message = map['message']?.toString();
    final gsRaw = map['gameState'];

    lastDiceAttack = (map['diceAttack'] as num?)?.toInt();
    lastDiceDefense = (map['diceDefense'] as num?)?.toInt();
    lastDamage = (map['damage'] as num?)?.toInt();
    combatResultMessage = message;

    // Snapshot IDs BEFORE the server update overwrites them
    final String? previousAttackerId = combatAttackerId;
    final String? previousTurnId = combatTurnId;
    final String? preGsDefenderId = combatDefenderId;

    if (gsRaw is Map) {
      final gs = Map<String, dynamic>.from(gsRaw);
      final players = gs['players'];
      if (players is List) {
        for (final pRaw in players) {
          if (pRaw is! Map) continue;
          final p = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
          _updatePlayerOnGrid(p);
          _syncRosterVictories(p);
        }
      }
      final combatRaw = gs['combat'];
      if (combatRaw is Map) {
        final combat = Map<String, dynamic>.from(combatRaw);
        combatTurnId = combat['turn']?.toString();
        combatAttackerId = combat['attacker']?.toString();
        combatDefenderId = combat['defender']?.toString();
        // Update team combat arrays
        final tcRaw = combat['teamCombat'];
        if (tcRaw is Map) {
          final tc = Map<String, dynamic>.from(tcRaw);
          teamACombatIds = (tc['teamA'] as List?)?.map((e) => e.toString()).toList() ?? teamACombatIds;
          teamBCombatIds = (tc['teamB'] as List?)?.map((e) => e.toString()).toList() ?? teamBCombatIds;
          needsTargetSelection = tc['needsTargetSelection'] == true;
        }
      }
    }

    _assignDiceRolls(message, previousAttackerId);

    if (message == CombatResults.attackNotDefeated) {
      final lastAtk = map['lastAttackerId']?.toString();
      combatDiceAttackPlayerId = lastAtk ?? preGsDefenderId ?? combatDefenderId;
      combatDiceDefensePlayerId = preGsDefenderId ?? combatDefenderId;
    } else if (message == CombatResults.attackDefeated) {
      final fdRaw = map['finalDice'];
      if (fdRaw is Map) {
        combatDiceAttackPlayerId =
            map['lastAttackerId']?.toString() ?? combatAttackerId;
        combatDiceDefensePlayerId =
            map['defeatedPlayerId']?.toString() ?? combatDefenderId;
      }
    }

    final journalPlayers = <GamePlayerState>[];
    if (gsRaw is Map) {
      final pl = Map<String, dynamic>.from(gsRaw)['players'];
      if (pl is List) {
        for (final e in pl) {
          if (e is Map) {
            journalPlayers.add(GamePlayerState.fromJson(Map<String, dynamic>.from(e)));
          }
        }
      }
    }
    final incomingTeamCombat = _isTeamCombatPayload(map);

    switch (message) {
      case CombatResults.targetSelected:
        if (_isLocalPlayerId(combatAttackerId)) {
          needsTargetSelection = false;
          availableTargets = <GamePlayerState>[];
          // If we have a pending action (attack/flee chosen before target),
          // auto-send it now that the target is locked.
          if (_pendingTeamAction != null) {
            final action = _pendingTeamAction!;
            _pendingTeamAction = null;
            final roomId = _lobby.roomId;
            if (roomId != null) {
              _socket.emit(ActiveGameSocketEvents.combatAction, <String, dynamic>{
                'roomId': roomId,
                'playerId': myPlayerId,
                'action': action,
              });
            }
          } else {
            combatChoicePending = true;
            _startCombatChoiceTimer();
          }
        }
        break;
      case CombatResults.attackNotDefeated:
        _triggerAngularVsAttackAnimation(
          map,
          gsRaw is Map ? Map<String, dynamic>.from(gsRaw) : null,
        );
        if (incomingTeamCombat) {
          _journalTeamAttackNotDefeated(map, journalPlayers);
        } else {
          _journal1v1AttackNotDefeated(map, journalPlayers);
        }
        if (_isLocalPlayerId(combatTurnId)) {
          if (isTeamCombat && needsTargetSelection) {
            _refreshAvailableTargets(gsRaw is Map ? Map<String, dynamic>.from(gsRaw) : <String, dynamic>{});
          }
          combatChoicePending = true;
          _startCombatChoiceTimer();
        }
        break;
      case CombatResults.escapeFailed:
        _handleEscapeFailed(previousTurnId);
        if (incomingTeamCombat) {
          _journalTeamEscapeFailed(map, journalPlayers);
        } else {
          _journal1v1EscapeFailed(map, journalPlayers);
        }
        if (_isLocalPlayerId(combatTurnId)) {
          if (isTeamCombat && needsTargetSelection) {
            _refreshAvailableTargets(gsRaw is Map ? Map<String, dynamic>.from(gsRaw) : <String, dynamic>{});
          }
          combatChoicePending = true;
          _startCombatChoiceTimer();
        }
        break;
      case CombatResults.attackDefeated:
        _combatLoserId = combatDefenderId;
        if (incomingTeamCombat) {
          _journalTeamAttackDefeated(map, journalPlayers);
        } else {
          _journal1v1AttackDefeated(map, journalPlayers);
        }

        // Handle item drops on defeat (same as Angular ItemService.onCombatEnded)
        _handleItemsOnDefeat(map);

        if (_handleTeamCombatContinuesAfterElimination(map, gsRaw)) {
          break;
        }

        _beginCombatEnd(
          winnerAnnouncement: _combatWinnerAnnouncementText(map),
        );
        break;
      case CombatResults.escapeSucceeded:
        _combatLoserId = null;
        if (incomingTeamCombat) {
          _journalTeamEscapeSucceeded(map, journalPlayers);
        } else {
          _journal1v1EscapeSucceeded(map, journalPlayers);
        }
        if (_handleTeamCombatContinuesAfterElimination(map, gsRaw)) {
          break;
        }
        _beginCombatEnd();
        break;
    }

    // Update the log trackers after processing the message,
    // so that on the next update `_activeAttackerId` /
    // `_activeDefenderId` reflect the new roles (identical to Angular).
    _activeAttackerId = combatAttackerId;
    _activeDefenderId = combatDefenderId;

    notifyListeners();
  }

  /// Aligned with `combat.service.ts`: if `teamCombatContinues` and a player leaves the combat,
  /// either close the UI for the locally eliminated/escaped player, or continue without `_beginCombatEnd`.
  bool _handleTeamCombatContinuesAfterElimination(
    Map<String, dynamic> map,
    dynamic gsRaw,
  ) {
    if (map['teamCombatContinues'] != true) return false;
    final eliminatedId = map['defeatedPlayerId']?.toString() ??
        map['escapedPlayerId']?.toString();
    if (eliminatedId == null || eliminatedId.isEmpty) return false;

    if (_isLocalPlayerId(eliminatedId)) {
      _waitingForTeamCombatEnd = true;
      _resetCombatUiAfterLocalEliminatedMidTeamFight();
      return true;
    }

    final gsMap = gsRaw is Map ? Map<String, dynamic>.from(gsRaw) : null;
    if (gsMap != null) {
      _refreshAvailableTargets(gsMap);
    }
    _stopCombatChoiceTimer();
    if (_isLocalPlayerId(combatAttackerId)) {
      if (isTeamCombat && needsTargetSelection) {
        _refreshAvailableTargets(gsMap ?? <String, dynamic>{});
      }
      combatChoicePending = true;
      _startCombatChoiceTimer();
    } else {
      combatChoicePending = false;
    }
    _combatLoserId = null;
    return true;
  }

  /// Equivalent of `combatEndReset` + immediate close for the local player who left the team combat.
  void _resetCombatUiAfterLocalEliminatedMidTeamFight() {
    _combatEndTimer?.cancel();
    _combatEndTimer = null;
    _stopCombatChoiceTimer();
    combatChoicePending = false;
    combatWinnerAnnouncement = null;

    inCombat = false;
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
    isTeamCombat = false;
    needsTargetSelection = false;
    _pendingTeamAction = null;
    availableTargets = <GamePlayerState>[];
    teamACombatIds = <String>[];
    teamBCombatIds = <String>[];
    _stopTargetSelectionTimer();
    initiatorDiceRoll = '-';
    targetDiceRoll = '-';
    _combatLoserId = null;
    _combatPending = false;
    combatDiceAttackPlayerId = null;
    combatDiceDefensePlayerId = null;
    combatAttackAnimationToken = 0;
    combatAttackAnimationPlayerId = null;
    combatAttackAnimationDurationMs = kAngularSnackbarTimeMs;

    notifyListeners();
  }

  void _handleItemsOnDefeat(Map<String, dynamic> combatMap) {
    final myId = myPlayerId;

    // Team combat continues: defeated player drops items
    final teamCombatContinues = combatMap['teamCombatContinues'] == true;
    final defeatedPlayerId = combatMap['defeatedPlayerId']?.toString();

    if (teamCombatContinues && defeatedPlayerId != null) {
      if (_isLocalPlayerId(defeatedPlayerId)) {
        _dropLocalInventoryAndReset();
      }
      return;
    }

    // Team combat: losing player IDs
    final losingPlayerIds = combatMap['losingPlayerIds'];
    if (losingPlayerIds is List && losingPlayerIds.isNotEmpty) {
      if (losingPlayerIds.any((id) => _isLocalPlayerId(id?.toString()))) {
        _dropLocalInventoryAndReset();
      }
      return;
    }

    // Classic 1v1: loser is players[1] in gameState
    final gsRaw = combatMap['gameState'];
    if (gsRaw is! Map) return;
    final gs = Map<String, dynamic>.from(gsRaw);
    final players = gs['players'];
    if (players is! List || players.length < 2) return;
    final loserRaw = players[1];
    if (loserRaw is! Map) return;
    final loser = GamePlayerState.fromJson(Map<String, dynamic>.from(loserRaw));

    if (_isLocalPlayerId(loser.id)) {
      if (localInventory.isNotEmpty) {
        final loserPos = loser.position;
        final g = grid;
        if (loserPos != null && g != null) {
          final availablePositions =
              findAvailableTerrainForItem(loserPos, g.board);
          _emitItemsDropped(localInventory, availablePositions);
        }
      }
      // Check for flag
      if (localInventory.any((i) => i.isFlag)) {
        final roomId = _lobby.roomId;
        if (roomId != null) {
          _socket.emit(CTFSocketEvents.flagDropped, <String, String>{
            'roomId': roomId,
          });
        }
      }
      clearLocalInventory();
      _emitResetInventory(myId);
    }
  }

  void _dropLocalInventoryAndReset() {
    final myId = myPlayerId;
    if (localInventory.any((i) => i.isFlag)) {
      final roomId = _lobby.roomId;
      if (roomId != null) {
        _socket.emit(CTFSocketEvents.flagDropped, <String, String>{
          'roomId': roomId,
        });
      }
    }
    clearLocalInventory();
    _emitResetInventory(myId);
  }

  void _assignDiceRolls(String? message, String? previousAttackerId) {
    if (lastDiceAttack == null && lastDiceDefense == null) return;
    if (message == CombatResults.attackNotDefeated || message == CombatResults.attackDefeated) {
      final actingAttackerId = previousAttackerId ?? combatAttackerId;
      if (actingAttackerId == combatInitiatorId) {
        initiatorDiceRoll = lastDiceAttack ?? '-';
        targetDiceRoll = lastDiceDefense ?? '-';
      } else {
        targetDiceRoll = lastDiceAttack ?? '-';
        initiatorDiceRoll = lastDiceDefense ?? '-';
      }
    }
  }

  void _handleEscapeFailed(String? previousTurnId) {
    final escaperId = previousTurnId ?? combatTurnId;
    if (escaperId != null && _combatEscapeAttempts.containsKey(escaperId)) {
      _combatEscapeAttempts[escaperId] = (_combatEscapeAttempts[escaperId] ?? 1) - 1;
    }

    if (_isLocalPlayerId(escaperId)) {
      _escapeAttempts--;
      combatEscapeDisabled = _escapeAttempts <= 0;
    }
  }

  /// Text of the big announcement (web client `combat.you_won` / `combat.winner` / teams).
  String? _combatWinnerAnnouncementText(Map<String, dynamic> map) {
    final teamContinues = map['teamCombatContinues'] == true;
    final winIds = map['winningPlayerIds'];
    if (winIds is List && winIds.isNotEmpty) {
      final myId = myPlayerId;
      final iWon = winIds.any((e) => e?.toString() == myId);
      final i18n = I18n();
      return iWon
          ? i18n.translate('combat.your_team_won')
          : i18n.translate('combat.enemy_team_won');
    }
    if (teamContinues) {
      return null;
    }
    final gsRaw = map['gameState'];
    if (gsRaw is! Map) return null;
    final gs = Map<String, dynamic>.from(gsRaw);
    final players = gs['players'];
    if (players is! List || players.isEmpty) return null;
    final w0 = players[0];
    if (w0 is! Map) return null;
    final winner = GamePlayerState.fromJson(Map<String, dynamic>.from(w0));
    final i18n = I18n();
    if (_isLocalPlayerId(winner.id)) {
      return i18n.translate('combat.you_won');
    }
    return i18n.translateWithParams('combat.winner', {'name': winner.name});
  }

  /// Phase 1: give the UI + winner announcement time, then clean up.
  void _beginCombatEnd({String? winnerAnnouncement}) {
    _stopCombatChoiceTimer();
    combatChoicePending = false;
    combatWinnerAnnouncement = winnerAnnouncement;
    notifyListeners();

    _combatEndTimer?.cancel();
    _combatEndTimer = Timer(const Duration(milliseconds: 1500), () {
      _finishCombatEnd();
    });
  }

  /// Phase 2: actually clear all combat state and handle turn/timer properly.
  void _finishCombatEnd() {
    _combatEndTimer = null;

    final wasMyTurn = isMyTurn;
    final activePlayerLost =
        wasMyTurn && _combatLoserId != null && _isLocalPlayerId(_combatLoserId);
    final wasWaitingForTeam = _waitingForTeamCombatEnd;
    _waitingForTeamCombatEnd = false;

    inCombat = false;
    combatWinnerAnnouncement = null;
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
    isTeamCombat = false;
    needsTargetSelection = false;
    _pendingTeamAction = null;
    availableTargets = <GamePlayerState>[];
    teamACombatIds = <String>[];
    teamBCombatIds = <String>[];
    _stopTargetSelectionTimer();
    initiatorDiceRoll = '-';
    targetDiceRoll = '-';
    if (!wasWaitingForTeam) {
      _consumeAction();
    }
    _combatLoserId = null;
    combatDiceAttackPlayerId = null;
    combatDiceDefensePlayerId = null;
    combatAttackAnimationToken = 0;
    combatAttackAnimationPlayerId = null;
    combatAttackAnimationDurationMs = kAngularSnackbarTimeMs;

    if (activePlayerLost) {
      _scheduleNextTurnEmit();
    } else if (wasMyTurn) {
      // Only restart the turn timer when it IS our turn.
      // If it's not our turn the active player / server handles the timer.
      final remaining = _lastNonCombatTimerValue > 0 ? _lastNonCombatTimerValue : 1;
      _emitStartTimerAfterCombat(remaining);
      _refreshMovementHints();
      _checkAutoEndTurn();
    }

    notifyListeners();
  }

  // ── Team combat: target selection ──

  void sendTargetSelection(String targetId) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _stopTargetSelectionTimer();
    needsTargetSelection = false;
    availableTargets = <GamePlayerState>[];
    _socket.emit(ActiveGameSocketEvents.selectCombatTarget, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'targetId': targetId,
    });
    notifyListeners();
  }

  void _refreshAvailableTargets(Map<String, dynamic> gs) {
    final myId = myPlayerId;
    final isInTeamA = teamACombatIds.contains(myId);
    final enemyIds = isInTeamA ? teamBCombatIds : teamACombatIds;
    final players = gs['players'];
    final targets = <GamePlayerState>[];
    if (players is List) {
      for (final pRaw in players) {
        if (pRaw is! Map) continue;
        final p = GamePlayerState.fromJson(Map<String, dynamic>.from(pRaw));
        if (enemyIds.contains(p.id)) targets.add(p);
      }
    }
    // Fallback: create basic player states from grid if gs.players is empty
    if (targets.isEmpty) {
      for (final id in enemyIds) {
        final onGrid = _findPlayerOnGridById(id);
        if (onGrid != null) targets.add(onGrid);
      }
    }
    availableTargets = targets;
    notifyListeners();
  }

  void _startTargetSelectionTimer() {
    _stopTargetSelectionTimer();
    targetTimerSecondsLeft = GameConstants.targetSelectionSeconds;
    notifyListeners();
    _targetSelectionTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      targetTimerSecondsLeft--;
      if (targetTimerSecondsLeft <= 0) {
        _stopTargetSelectionTimer();
        // Auto-select a random target
        if (availableTargets.isNotEmpty) {
          final shuffled = List<GamePlayerState>.from(availableTargets)..shuffle();
          sendTargetSelection(shuffled.first.id);
        }
      }
      notifyListeners();
    });
  }

  void _stopTargetSelectionTimer() {
    _targetSelectionTimer?.cancel();
    _targetSelectionTimer = null;
  }

  // ── Combat log (aligned with the Angular `LogService`) ──

  void _journalTeamAttackNotDefeated(Map<String, dynamic> map, List<GamePlayerState> players) {
    final attacker = _journalFindPlayer(players, _activeAttackerId);
    final defender = _journalFindPlayer(players, _activeDefenderId);
    if (attacker == null || defender == null) return;
    _logJournalKey(
      'log.attacked',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
    _logJournalKey(
      'log.dice_roll',
      {
        'attacker': attacker.name,
        'attackRoll': '${map['diceAttack'] ?? ''}',
        'defender': defender.name,
        'defenseRoll': '${map['diceDefense'] ?? ''}',
      },
      p1: attacker.id,
      p2: defender.id,
    );
  }

  void _journalTeamAttackDefeated(Map<String, dynamic> map, List<GamePlayerState> players) {
    final teamContinues = map['teamCombatContinues'] == true;
    final fdRaw = map['finalDice'];
    int? fdAttack;
    int? fdDefense;
    if (fdRaw is Map) {
      final fd = Map<String, dynamic>.from(fdRaw);
      fdAttack = (fd['attack'] as num?)?.toInt();
      fdDefense = (fd['defense'] as num?)?.toInt();
    }

    final attacker = _journalFindPlayer(players, _activeAttackerId);
    final defender = _journalFindPlayer(players, _activeDefenderId);
    final defeatedId = map['defeatedPlayerId']?.toString();
    final defeated = _journalFindPlayer(players, defeatedId) ?? defender;
    final killer = attacker;

    if (defeated != null && killer != null && defeated.id != killer.id) {
      _logJournalKey(
        'log.dice_roll',
        {
          'attacker': killer.name,
          'attackRoll': '${fdAttack ?? ''}',
          'defender': defeated.name,
          'defenseRoll': '${fdDefense ?? ''}',
        },
        p1: killer.id,
        p2: defeated.id,
      );
      _logJournalKey('log.team_eliminated', {'name': defeated.name}, p1: defeated.id);
    }

    if (!teamContinues) {
      _journalTeamFightEnded(map, players);
    }
  }

  void _journalTeamFightEnded(Map<String, dynamic> map, List<GamePlayerState> players) {
    final winIds =
        (map['winningPlayerIds'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
    final loseIds =
        (map['losingPlayerIds'] as List?)?.map((e) => e.toString()).toList() ?? <String>[];
    final winnerNames = winIds.map((id) => _journalFindPlayer(players, id)?.name ?? id).join(', ');
    final loserNames = loseIds.map((id) => _journalFindPlayer(players, id)?.name ?? id).join(', ');
    _logJournalKey('log.team_fight_ended', {'winners': winnerNames, 'losers': loserNames});
    if (isCtfSession) return;
    final myId = myPlayerId;
    if (!winIds.contains(myId) && !loseIds.contains(myId)) return;
    GamePlayerState? winner;
    for (final id in winIds) {
      winner = _journalFindPlayer(players, id);
      if (winner != null) break;
    }
    if (winner != null && winner.victories >= GameConstants.winningCondition) {
      _logEndGameThanks();
    }
  }

  void _journalTeamEscapeSucceeded(Map<String, dynamic> map, List<GamePlayerState> players) {
    final teamContinues = map['teamCombatContinues'] == true;
    if (teamContinues) {
      final escapedId = map['escapedPlayerId']?.toString();
      final escaper = _journalFindPlayer(players, escapedId) ??
          _journalFindPlayer(players, _activeAttackerId);
      if (escaper == null) return;
      _logJournalKey('log.team_escape', {'name': escaper.name}, p1: escaper.id);
      return;
    }
    final losing = map['losingPlayerIds'];
    final winning = map['winningPlayerIds'];
    final losingCount = losing is List ? losing.length : 0;
    final winningCount = winning is List ? winning.length : 0;
    if (losingCount > 0 || winningCount > 0) {
      _logJournalKey('log.team_fled', const <String, String>{});
    }
  }

  void _journalTeamEscapeFailed(Map<String, dynamic> map, List<GamePlayerState> players) {
    final attacker = _journalFindPlayer(players, _activeAttackerId);
    final defender = _journalFindPlayer(players, _activeDefenderId);
    if (attacker == null || defender == null) return;
    _logJournalKey(
      'log.escape_attempt',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
    _logJournalKey(
      'log.escape_failed',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
  }

  void _journal1v1AttackNotDefeated(Map<String, dynamic> map, List<GamePlayerState> players) {
    final attacker = _journalFindPlayer(players, _activeAttackerId);
    final defender = _journalFindPlayer(players, _activeDefenderId);
    if (attacker == null || defender == null) return;
    _logJournalKey(
      'log.attacked',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
    final fdRaw = map['finalDice'];
    final atkRoll = fdRaw is Map
        ? Map<String, dynamic>.from(fdRaw)['attack']
        : map['diceAttack'];
    final defRoll = fdRaw is Map
        ? Map<String, dynamic>.from(fdRaw)['defense']
        : map['diceDefense'];
    _logJournalKey(
      'log.dice_roll',
      {
        'attacker': attacker.name,
        'attackRoll': '$atkRoll',
        'defender': defender.name,
        'defenseRoll': '$defRoll',
      },
      p1: attacker.id,
      p2: defender.id,
    );
  }

  void _journal1v1AttackDefeated(Map<String, dynamic> map, List<GamePlayerState> players) {
    final trackedAttacker = _journalFindPlayer(players, _activeAttackerId);
    final trackedDefender = _journalFindPlayer(players, _activeDefenderId);
    final defeatedId = map['defeatedPlayerId']?.toString();
    final loser = _journalFindPlayer(players, defeatedId) ?? trackedDefender;
    final winner = defeatedId != null
        ? _firstPlayerWhereIdNot(players, defeatedId) ?? trackedAttacker
        : trackedAttacker;
    final attacker = trackedAttacker ?? winner;
    final defender = trackedDefender ?? loser;

    if (attacker != null && defender != null) {
      _logJournalKey(
        'log.attacked',
        {'attacker': attacker.name, 'defender': defender.name},
        p1: attacker.id,
        p2: defender.id,
      );
      final fdRaw = map['finalDice'];
      final atkRoll =
          fdRaw is Map ? Map<String, dynamic>.from(fdRaw)['attack'] : map['diceAttack'];
      final defRoll =
          fdRaw is Map ? Map<String, dynamic>.from(fdRaw)['defense'] : map['diceDefense'];
      _logJournalKey(
        'log.dice_roll',
        {
          'attacker': attacker.name,
          'attackRoll': '$atkRoll',
          'defender': defender.name,
          'defenseRoll': '$defRoll',
        },
        p1: attacker.id,
        p2: defender.id,
      );
    }
    if (winner != null && loser != null) {
      _logJournalKey(
        'log.fight_ended',
        {'winner': winner.name, 'loser': loser.name},
        p1: winner.id,
        p2: loser.id,
      );
      if (!isCtfSession && winner.victories >= GameConstants.winningCondition) {
        _logEndGameThanks();
      }
    }
  }

  void _journal1v1EscapeFailed(Map<String, dynamic> map, List<GamePlayerState> players) {
    final attacker = _journalFindPlayer(players, _activeAttackerId);
    final defender = _journalFindPlayer(players, _activeDefenderId);
    if (attacker == null || defender == null) return;
    _logJournalKey(
      'log.escape_attempt',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
    _logJournalKey(
      'log.escape_failed',
      {'attacker': attacker.name, 'defender': defender.name},
      p1: attacker.id,
      p2: defender.id,
    );
  }

  void _journal1v1EscapeSucceeded(Map<String, dynamic> map, List<GamePlayerState> players) {
    final winner = _journalFindPlayer(players, _activeAttackerId);
    final loser = _journalFindPlayer(players, _activeDefenderId);
    if (winner == null || loser == null) return;
    _logJournalKey(
      'log.escape_attempt',
      {'attacker': winner.name, 'defender': loser.name},
      p1: winner.id,
      p2: loser.id,
    );
    _logJournalKey(
      'log.escaped',
      {'attacker': winner.name, 'defender': loser.name},
      p1: winner.id,
      p2: loser.id,
    );
  }

  GamePlayerState? _firstPlayerWhereIdNot(List<GamePlayerState> players, String excludedId) {
    for (final p in players) {
      if (p.id != excludedId) return p;
    }
    return null;
  }

  // ── Trade initiation (action on adjacent teammate) ──

  void _initiateTrade(GamePlayerState target) {
    final roomId = _lobby.roomId;
    if (roomId == null) return;
    _socket.emit(ActiveGameSocketEvents.tradeInit, <String, dynamic>{
      'roomId': roomId,
      'playerId': myPlayerId,
      'teammateId': target.id,
    });
  }

}
