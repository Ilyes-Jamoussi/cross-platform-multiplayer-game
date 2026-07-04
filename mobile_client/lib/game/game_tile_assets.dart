/// Same mapping as `common/constants.ts` → `TILE_IMAGES` (Flutter asset paths).
abstract final class GameTileAssets {
  static const String _base = 'assets/game/images';

  static String pathForTileType(String tile) {
    switch (tile) {
      case 'Eau':
        return '$_base/water_tile.png';
      case 'Glace':
        return '$_base/ice_tile.png';
      case 'Mur':
        return '$_base/wall_tile.png';
      case 'PorteOuverte':
        return '$_base/opened_door.png';
      case 'Porte':
        return '$_base/closed_door.png';
      case 'TuileDeBase':
      default:
        return '$_base/ground_tile.png';
    }
  }
}
