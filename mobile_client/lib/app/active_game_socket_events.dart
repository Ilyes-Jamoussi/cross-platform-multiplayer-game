/// Aligned with `common/gateway-events.ts` (ActiveGameEvents, TimerEvents).
abstract final class ActiveGameSocketEvents {
  static const turnUpdate = 'turnUpdate';
  static const nextTurn = 'nextTurn';
  static const playerDisconnect = 'playerDisconnect';
  static const playerNextPosition = 'playerNextPosition';
  static const doorUpdated = 'doorUpdated';
  static const itemPickedUp = 'itemPickedUp';
  static const itemUpdate = 'itemUpdate';
  static const itemsDropped = 'itemsDropped';
  static const spawnPlayer = 'spawnPlayer';
  static const mapRequest = 'mapRequest';
  static const movePlayer = 'movePlayer';
  static const playerStartedMoving = 'playerStartedMoving';
  static const playerStoppedMoving = 'PlayerStoppedMoving';

  // Inventory / items
  static const itemSwapped = 'itemSwapped';
  static const resetInventory = 'resetInventory';

  // Actions
  static const toggledDoor = 'toggledDoor';
  static const combatStarted = 'combatStarted';
  static const combatInitiated = 'combatInitiated';
  static const combatAction = 'combatAction';
  static const combatUpdate = 'combatUpdate';
  static const selectCombatTarget = 'SelectCombatTarget';
  static const gameEnded = 'gameEnded';
  static const noMorePlayers = 'noMorePlayers';
  static const fetchStats = 'fetchStats';
  static const dropIn = 'dropIn';
  static const playerReady = 'playerReady';

  // Trade (item exchange between teammates)
  static const tradeInit = 'TradeInit';
  static const tradeStarted = 'TradeStarted';
  static const tradeUpdate = 'TradeUpdate';
  static const tradeAccept = 'TradeAccept';
  static const tradeCancel = 'TradeCancel';
  static const tradeComplete = 'TradeComplete';
}

abstract final class CTFSocketEvents {
  static const flagTaken = 'flagTaken';
  static const flagDropped = 'flagDropped';
  static const flagCaptured = 'flagCaptured';
}

/// `common/gateway-events.ts` `DebugEvents.ToggleDebug`.
abstract final class DebugSocketEvents {
  static const toggleDebug = 'debug';
}

abstract final class TimerSocketEvents {
  static const startTimer = 'start-timer';
  static const stopTimer = 'stop-timer';
  static const timerUpdate = 'timer-update';
  static const timerEnd = 'timer-end';
  static const resetTimer = 'reset-timer';
}
