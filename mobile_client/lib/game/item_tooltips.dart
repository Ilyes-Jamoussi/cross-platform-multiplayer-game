import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/models/game_models.dart';

/// i18n key `map_editor.description.*` aligned with `common/constants.ts` `ITEM_DESCRIPTIONS`.
String? itemDescriptionKeyForRawId(String raw) {
  final n = raw.trim();
  if (n.isEmpty || n.contains(GameItemTypes.unusedStartingPoint)) return null;

  if (n.contains(GameItemIds.item1Potion)) {
    return 'map_editor.description.potion';
  }
  if (n.contains(GameItemIds.item2Dague)) {
    return 'map_editor.description.sword';
  }
  if (n.contains(GameItemIds.item3Bouclier)) {
    return 'map_editor.description.shield';
  }
  if (n.contains(GameItemIds.item4Poison)) {
    return 'map_editor.description.crane';
  }
  if (n.contains(GameItemIds.item5Revie)) {
    return 'map_editor.description.resurrection';
  }
  if (n.contains(GameItemIds.item6De)) {
    return 'map_editor.description.dices';
  }
  if (n.contains('item-7')) {
    return 'map_editor.description.item_random';
  }
  final nl = n.toLowerCase();
  if (nl.contains('item-flag') ||
      n.contains(GameItemIds.itemFlag) ||
      nl.contains('item-drapeau')) {
    return 'map_editor.description.flag';
  }
  if (n.contains('StartingPoint') || n.contains('item-StartingPoint')) {
    return 'map_editor.description.starting_point';
  }
  return null;
}

/// Equivalent of `player-panel.component` `getItemTooltip` (inventory / `GameItem` objects).
String translatedGameItemTooltip(I18n i18n, GameItem item) {
  final key = itemDescriptionKeyForRawId(item.id);
  if (key != null) return i18n.translate(key);
  if (item.tooltip.isNotEmpty) return item.tooltip;
  return item.displayName;
}

/// Item text on the grid (`ItemCellState`): card + fallback like the web client.
String translatedCellItemDescription(I18n i18n, ItemCellState item) {
  final key = itemDescriptionKeyForRawId(item.name);
  if (key != null) return i18n.translate(key);
  if (item.description.isNotEmpty) {
    if (item.description.contains('.')) {
      final t = i18n.translate(item.description);
      if (t != item.description) return t;
    }
    return item.description;
  }
  return item.name;
}
