import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/game/game_item_assets.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Same principle as the Angular `inventory-popup` (overlay, list, X on selection, secondary button).
class InventorySwapDialog extends StatefulWidget {
  const InventorySwapDialog({
    super.key,
    required this.items,
    required this.onItemChosen,
  });

  final List<GameItem> items;
  final void Function(GameItem discarded) onItemChosen;

  @override
  State<InventorySwapDialog> createState() => _InventorySwapDialogState();
}

class _InventorySwapDialogState extends State<InventorySwapDialog> {
  String? _selectedUniqueId;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final canConfirm = _selectedUniqueId != null;

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 420),
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
        decoration: GamePageOverlays.inventoryTradeShellDecoration(
          borderColor: theme.secondaryColor,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              i18n.translate('game_page.remove_item_popup.title'),
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: 10,
                color: Colors.white,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 18),
            Wrap(
              spacing: 14,
              runSpacing: 14,
              alignment: WrapAlignment.center,
              children: widget.items.map((item) {
                final isSelected = _selectedUniqueId == item.uniqueId;
                final assetPath = gameItemAssetPath(item.id);
                return GestureDetector(
                  onTap: () =>
                      setState(() => _selectedUniqueId = item.uniqueId),
                  child: Container(
                    width: 88,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: GamePageOverlays.appSurfaceAlt,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isSelected
                            ? theme.secondaryColor
                            : Colors.white.withValues(alpha: 0.08),
                        width: isSelected ? 2 : 1,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.3),
                          offset: const Offset(2, 2),
                          blurRadius: 6,
                        ),
                      ],
                    ),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (assetPath != null)
                              Image.asset(
                                assetPath,
                                width: 44,
                                height: 44,
                                fit: BoxFit.contain,
                                errorBuilder: (_, e, st) => const Icon(
                                  Icons.help,
                                  color: Colors.white54,
                                  size: 36,
                                ),
                              )
                            else
                              const Icon(
                                Icons.help,
                                color: Colors.white54,
                                size: 36,
                              ),
                            const SizedBox(height: 6),
                            Text(
                              item.displayName,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 5.5,
                                color: Colors.white70,
                                height: 1.3,
                              ),
                            ),
                          ],
                        ),
                        if (isSelected)
                          Positioned.fill(
                            child: Container(
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.55),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'X',
                                style: GoogleFonts.pressStart2p(
                                  fontSize: 22,
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 22),
            FilledButton(
              onPressed: !canConfirm
                  ? null
                  : () {
                      final chosen = widget.items.firstWhere(
                        (i) => i.uniqueId == _selectedUniqueId,
                      );
                      widget.onItemChosen(chosen);
                    },
              style: GamePageOverlays.inventoryConfirmButtonStyle(
                enabled: canConfirm,
                secondaryColor: theme.secondaryColor,
                surfaceAltColor: theme.surfaceAltColor,
              ),
              child: Text(
                i18n.translate('game_page.remove_item_popup.finish'),
                style: GoogleFonts.pressStart2p(fontSize: 8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
