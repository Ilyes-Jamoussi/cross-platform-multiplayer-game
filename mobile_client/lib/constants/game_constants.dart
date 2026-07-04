/// Aligned with `common/constants.ts` (TURN_TIME, TURN_DELAY).
abstract final class GameConstants {
  static const int turnTimeSeconds = 30;
  static const int turnDelaySeconds = 3;
  static const int yourTurnPopupMs = 3000;
  /// `POPUP_LENGTH` — "It's …'s turn" alert (Angular `TurnService`).
  static const int turnFlashPopupMs = 3000;
  /// `POPUP_LENGTH` (`common/constants.ts`) — objective shown at the start (web client).
  static const int gameStartObjectivePopupMs = 3000;
  static const int combatTurnTimeSeconds = 50;
  static const int combatTimeSeconds = 5;
  static const int combatChoiceSeconds = 5;
  static const int combatChoiceReducedSeconds = 3;
  static const int combatChoiceTicksPerSecond = 10;
  static const int maxEscapeAttempts = 2;
  static const int debounceTimeMs = 100;
  static const int defaultNbActions = 1;
  static const int winningCondition = 3;
  static const int endGameDelayMs = 3000;
  /// `POPUP_LENGTH` (`common/constants.ts`) — annonce vainqueur de combat (client lourd).
  static const int combatWinnerPopupMs = 3000;
  static const int baseStat = 4;
  static const int targetSelectionSeconds = 5;
}

/// `TileTypes` / `ItemTypes` (`common/enums.ts`) — strings used on the grid.
abstract final class GameTileTypes {
  static const ice = 'Glace';
  static const water = 'Eau';
  static const wall = 'Mur';
  static const door = 'Porte';
  static const openedDoor = 'PorteOuverte';
  static const defaultTile = 'TuileDeBase';
}

/// `TILE_COST` (`common/constants.ts`).
abstract final class GameTileCost {
  static int forTile(String tile) {
    switch (tile) {
      case GameTileTypes.water:
        return 2;
      case GameTileTypes.ice:
        return 0;
      case GameTileTypes.openedDoor:
        return 1;
      case GameTileTypes.defaultTile:
        return 1;
      default:
        return 0;
    }
  }
}

abstract final class GameItemTypes {
  static const startingPoint = 'StartingPoint';
  static const unusedStartingPoint = 'UnusedSpawnPoint';
  static const flag = 'Flag';
}

abstract final class GameItemIds {
  static const item1Potion = 'item-1-Potion';
  static const item2Dague = 'item-2-Dague';
  static const item3Bouclier = 'item-3-Bouclier';
  static const item4Poison = 'item-4-Poison';
  static const item5Revie = 'item-5-Revie';
  static const item6De = 'item-6-Dé';
  static const itemFlag = 'item-Flag';
}

abstract final class GameItemEffects {
  static const int potionLifeBonus = 2;
  static const int potionDefensePenalty = 1;
  static const int shieldDefenseBonus = 2;
  static const int shieldAttackPenalty = 1;
}

abstract final class GameInventoryConstants {
  static const int maxSize = 2;
}

/// Aligned with `common/constants.ts` (`FOG_OF_WAR_RADIUS`).
abstract final class GameFogConstants {
  static const int radius = 2;
}

/// Aligned with `common/enums.ts` `Actions`.
abstract final class GameActions {
  static const attack = 'attack';
  static const escape = 'escape';
  static const startCombat = 'startCombat';
}

/// Aligned with `common/enums.ts` `CombatResults`.
abstract final class CombatResults {
  static const attackDefeated = 'attackDefeated';
  static const attackNotDefeated = 'attackNotDefeated';
  static const escapeSucceeded = 'escapeSucceeded';
  static const escapeFailed = 'escapeFailed';
  static const combatStarted = 'combatStarted';
  static const targetSelected = 'TargetSelected';
}

/// Adjacent positions (north, east, south, west) — `common/constants.ts` `ADJACENT_POSITIONS`.
const List<List<int>> kAdjacentOffsets = <List<int>>[
  <int>[0, -1],
  <int>[1, 0],
  <int>[0, 1],
  <int>[-1, 0],
];
