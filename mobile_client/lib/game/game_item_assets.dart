/// Aligned with `getItemImage` / `ITEM_IMAGE_MAP` from the Angular client (`active-grid`).
String? gameItemAssetPath(String rawName) {
  if (rawName.isEmpty || rawName.contains('UnusedSpawnPoint')) {
    return null;
  }
  if (rawName.contains('StartingPoint') || rawName.contains('item-StartingPoint')) {
    return 'assets/game/items/red.png';
  }
  if (rawName.contains('flag') || rawName.contains('Flag')) {
    return 'assets/game/items/flag.png';
  }

  var name = rawName;
  if (name.endsWith('A') || name.endsWith('B')) {
    name = name.substring(0, name.length - 1);
  }

  const prefix = 'assets/game/items';
  if (name.contains('item-1') || name.contains('Potion')) {
    return '$prefix/1.png';
  }
  if (name.contains('item-2') || name.contains('Dague')) {
    return '$prefix/2.png';
  }
  if (name.contains('item-3') || name.contains('Bouclier')) {
    return '$prefix/3.png';
  }
  if (name.contains('item-4') || name.contains('Poison')) {
    return '$prefix/4.png';
  }
  if (name.contains('item-5') || name.contains('Revie')) {
    return '$prefix/5.png';
  }
  if (name.contains('item-6') || name.contains('Dé')) {
    return '$prefix/6.png';
  }
  if (name.contains('item-7')) {
    return '$prefix/7.png';
  }
  return null;
}
