/// Aligned with [common/enums.ts]: `GameSizes` and `Players`.
int maxPlayersForGridSize(int gridSize) {
  switch (gridSize) {
    case 10:
      return 2;
    case 15:
      return 4;
    case 20:
      return 6;
    default:
      return 2;
  }
}

/// Asset paths copied from the Angular client (`client/src/assets/`).
String gameModeImageAsset(String gameMode) {
  switch (gameMode) {
    case 'CTF':
      return 'assets/game_creation/ctf.png';
    case 'Classic':
      return 'assets/game_creation/classic.png';
    default:
      return 'assets/game_creation/classic.png';
  }
}
