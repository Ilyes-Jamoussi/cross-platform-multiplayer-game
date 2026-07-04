import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/game/item_tooltips.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/active_game_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Aligned with the Angular `inventory-trade-popup` (shell, columns, success / error).
class TradePopup extends StatelessWidget {
  const TradePopup({super.key, required this.game});
  final ActiveGameService game;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 20),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
        decoration: GamePageOverlays.inventoryTradeShellDecoration(
          borderColor: theme.secondaryColor,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                i18n.translate('trade_popup.title'),
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: 10,
                  color: Colors.white,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _InventoryColumn(
                      label: i18n.translate('trade_popup.your_inventory'),
                      items: game.tradePlayerInventory,
                      selectedId: game.tradePlayerSelected?.id,
                      accepted: game.tradePlayerAccepted,
                      accentSecondary: theme.secondaryColor,
                      onSelectItem: (item) =>
                          game.updateTradeSelection(item.uniqueId),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 28, left: 6, right: 6),
                    child: Icon(
                      Icons.swap_horiz,
                      color: Colors.white.withValues(alpha: 0.85),
                      size: 28,
                    ),
                  ),
                  Expanded(
                    child: _InventoryColumn(
                      label: i18n.translate('trade_popup.teammate_inventory'),
                      items: game.tradeTeammateInventory,
                      selectedId: game.tradeTeammateOffered?.id,
                      accepted: game.tradeTeammateAccepted,
                      accentSecondary: theme.secondaryColor,
                      onSelectItem: null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _TradeActionButton(
                      label: i18n.translate('trade_popup.accept'),
                      background: GamePageOverlays.appSuccess,
                      onPressed: game.acceptTrade,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _TradeActionButton(
                      label: i18n.translate('trade_popup.refuse'),
                      background: GamePageOverlays.appError,
                      onPressed: () {
                        game.cancelTrade();
                        Navigator.of(context).pop();
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TradeActionButton extends StatelessWidget {
  const _TradeActionButton({
    required this.label,
    required this.background,
    required this.onPressed,
  });

  final String label;
  final Color background;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: background,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: Colors.black.withValues(alpha: 0.15),
              width: 1,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 7,
              color: Colors.white,
              height: 1.2,
            ),
          ),
        ),
      ),
    );
  }
}

class _InventoryColumn extends StatelessWidget {
  const _InventoryColumn({
    required this.label,
    required this.items,
    required this.selectedId,
    required this.accepted,
    required this.accentSecondary,
    this.onSelectItem,
  });

  final String label;
  final List<GameItem> items;
  final String? selectedId;
  final bool accepted;
  final Color accentSecondary;
  final void Function(GameItem)? onSelectItem;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: 6.5,
                  color: GamePageOverlays.appTextMuted,
                  height: 1.3,
                ),
              ),
            ),
            if (accepted) ...[
              const SizedBox(width: 6),
              Text(
                i18n.translate('trade_popup.ready'),
                style: GoogleFonts.pressStart2p(
                  fontSize: 5.5,
                  color: GamePageOverlays.appSuccess,
                  height: 1.2,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(
                Icons.check_circle,
                color: GamePageOverlays.appSuccess,
                size: 14,
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        if (items.isEmpty)
          const SizedBox.shrink()
        else
          ...items.map((item) {
            final isSelected = item.id == selectedId;
            return Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: GestureDetector(
                onTap: onSelectItem != null ? () => onSelectItem!(item) : null,
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0x66FFFF00)
                        : GamePageOverlays.appSurfaceAlt,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? accentSecondary
                          : Colors.white.withValues(alpha: 0.08),
                      width: isSelected ? 2 : 1,
                    ),
                  ),
                  child: Text(
                    translatedGameItemTooltip(i18n, item),
                    style: GoogleFonts.pressStart2p(
                      fontSize: 6,
                      color: Colors.white,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            );
          }),
      ],
    );
  }
}
