import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/game/game_item_assets.dart';
import 'package:mobile_client/game/item_tooltips.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:provider/provider.dart';

/// Two inventory slots matching the Angular player panel inventory display.
class GameInventoryStrip extends StatelessWidget {
  const GameInventoryStrip({super.key, required this.items});

  final List<GameItem> items;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final slots = List<GameItem?>.filled(2, null);
    for (var i = 0; i < items.length && i < 2; i++) {
      slots[i] = items[i];
    }

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: GameViewTheme.angularCard(borderColor: theme.primaryColor),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            i18n.translate('game_page.inventory_title'),
            style: GameViewTheme.panelTitle(9),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              for (var i = 0; i < 2; i++)
                Expanded(
                  child: _Slot(
                    index: i,
                    item: slots[i],
                    borderColor: theme.primaryColor,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.index, required this.item, required this.borderColor});

  final int index;
  final GameItem? item;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final assetPath = item != null ? gameItemAssetPath(item!.id) : null;

    return AspectRatio(
      aspectRatio: 1,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: borderColor, width: 2),
          color: Colors.black26,
        ),
        child: item == null
            ? Center(
                child: Text(
                  '${index + 1}',
                  style: GameViewTheme.body(10),
                ),
              )
            : Tooltip(
                message: translatedGameItemTooltip(i18n, item!),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (assetPath != null)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Image.asset(
                            assetPath,
                            fit: BoxFit.contain,
                            errorBuilder: (_, e, st) => const Icon(
                              Icons.inventory_2,
                              color: Colors.white54,
                              size: 24,
                            ),
                          ),
                        ),
                      )
                    else
                      const Icon(
                        Icons.inventory_2,
                        color: Colors.white54,
                        size: 24,
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Text(
                        item!.displayName,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GameViewTheme.body(5),
                      ),
                    ),
                  ],
                ),
              ),
      ),
    );
  }
}
