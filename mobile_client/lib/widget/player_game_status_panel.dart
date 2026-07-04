import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/constants/game_constants.dart';
import 'package:mobile_client/game/game_item_assets.dart';
import 'package:mobile_client/game/item_tooltips.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:provider/provider.dart';
import 'package:mobile_client/util/game_avatar_asset.dart';

/// Local player card like `app-player-panel` (name header, stats + avatar, inventory).
class PlayerGameStatusPanel extends StatelessWidget {
  const PlayerGameStatusPanel({
    super.key,
    required this.player,
    required this.buffedAttack,
    required this.buffedDefense,
    required this.potionLifeBonus,
    required this.actionsLeft,
    required this.maxActions,
    required this.inventory,
    this.teamBadgeId,
    this.teamBadgeColor,
  });

  final GamePlayerState? player;
  final int buffedAttack;
  final int buffedDefense;
  final int potionLifeBonus;
  final int actionsLeft;
  final int maxActions;
  final List<GameItem> inventory;

  /// Team mode: "Team X" chip under the name (like the Angular player-list badge).
  final String? teamBadgeId;
  final Color? teamBadgeColor;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final p = player;
    if (p == null) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: GameViewTheme.angularCard(borderColor: theme.primaryColor),
        child: Text(
          i18n.translate('game_page.player_panel.not_on_map'),
          textAlign: TextAlign.center,
          style: GameViewTheme.body(6.5).copyWith(color: GameViewTheme.labelMuted),
        ),
      );
    }
    final s = p.stats;
    final icon = gameAvatarIconAsset(p.avatar);

    final displayLife = (s?.life ?? 0) + potionLifeBonus;
    final displayMaxLife = (s?.maxLife ?? s?.life ?? 0) + potionLifeBonus;

    return Container(
      decoration: GameViewTheme.angularCard(borderColor: theme.primaryColor),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(color: theme.primaryColor),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  p.name,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GameViewTheme.body(7).copyWith(
                    color: theme.onPrimaryButtonText,
                    letterSpacing: 0.5,
                  ),
                ),
                if (teamBadgeId != null &&
                    teamBadgeId!.isNotEmpty &&
                    teamBadgeColor != null) ...[
                  const SizedBox(height: 6),
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: teamBadgeColor!, width: 1.2),
                        color: Colors.black.withValues(alpha: 0.25),
                      ),
                      child: Text(
                        i18n.translateWithParams('loading_page.team_label', {
                          'id': teamBadgeId!,
                        }),
                        style: GameViewTheme.body(4.8).copyWith(
                          color: teamBadgeColor,
                          shadows: [
                            Shadow(
                              color: teamBadgeColor!.withValues(alpha: 0.45),
                              blurRadius: 4,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: s == null
                      ? const SizedBox.shrink()
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _StatBar(
                              label: i18n.translate('game_page.life'),
                              current: displayLife,
                              max: displayMaxLife,
                              valueText: '$displayLife/$displayMaxLife',
                              filledColor: const Color(0xFFE74C3C),
                              valueColor: const Color(0xFFE74C3C),
                            ),
                            _StatBar(
                              label: i18n.translate('game_page.speed'),
                              current: s.speed,
                              max: s.maxSpeed ?? s.speed,
                              valueText: '${s.speed}/${s.maxSpeed ?? s.speed}',
                              filledColor: const Color(0xFF3498DB),
                              valueColor: const Color(0xFF3498DB),
                            ),
                            _StatBar(
                              label: i18n.translate('game_page.attack'),
                              current: buffedAttack,
                              max: GameConstants.baseStat,
                              valueText: '$buffedAttack +',
                              filledColor: const Color(0xFFE67E22),
                              valueColor: const Color(0xFFE67E22),
                              trailing: _DiceIcon(
                                faces: s.attack,
                                color: const Color(0xFFE67E22),
                              ),
                            ),
                            _StatBar(
                              label: i18n.translate('game_page.defense'),
                              current: buffedDefense,
                              max: GameConstants.baseStat,
                              valueText: '$buffedDefense +',
                              filledColor: const Color(0xFF2ECC71),
                              valueColor: const Color(0xFF2ECC71),
                              trailing: _DiceIcon(
                                faces: s.defense,
                                color: const Color(0xFF2ECC71),
                              ),
                            ),
                            _StatBar(
                              label: i18n.translate('game_page.action_left'),
                              current: actionsLeft,
                              max: maxActions,
                              valueText: '$actionsLeft',
                              filledColor: const Color(0xFFF1C40F),
                              valueColor: const Color(0xFFF1C40F),
                            ),
                          ],
                        ),
                ),
                const SizedBox(width: 8),
                if (icon != null)
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: theme.primaryColor,
                        width: 2,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: theme.secondaryColor.withValues(alpha: 0.35),
                          blurRadius: 8,
                          spreadRadius: 0,
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        icon,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) =>
                            const Icon(Icons.person, color: Colors.white54, size: 32),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (inventory.isNotEmpty) ...[
            Divider(height: 1, color: Colors.white.withValues(alpha: 0.06)),
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: inventory
                    .map(
                      (it) => SizedBox(
                        width: 48,
                        height: 48,
                        child: _InventoryItemCell(item: it),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatBar extends StatelessWidget {
  const _StatBar({
    required this.label,
    required this.current,
    required this.max,
    required this.valueText,
    required this.filledColor,
    required this.valueColor,
    this.trailing,
  });

  final String label;
  final int current;
  final int max;
  final String valueText;
  final Color filledColor;
  final Color valueColor;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final segmentCount = max > 0 ? max : 1;
    final clamped = current.clamp(0, segmentCount);
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            child: Text(
              label,
              style: GameViewTheme.body(5).copyWith(color: GameViewTheme.labelMuted),
            ),
          ),
          Expanded(
            child: SizedBox(
              height: 12,
              child: Row(
                children: List.generate(segmentCount, (i) {
                  final filled = i < clamped;
                  return Expanded(
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 0.5),
                      decoration: BoxDecoration(
                        color: filled
                            ? filledColor
                            : Colors.white.withValues(alpha: 0.06),
                        borderRadius: BorderRadius.circular(2),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.04),
                        ),
                        boxShadow: filled
                            ? [
                                BoxShadow(
                                  color: filledColor.withValues(alpha: 0.28),
                                  blurRadius: 3,
                                ),
                              ]
                            : null,
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox(
            width: 72,
            child: trailing != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        valueText,
                        style: GameViewTheme.body(4.8).copyWith(color: valueColor),
                      ),
                      const SizedBox(width: 2),
                      trailing!,
                    ],
                  )
                : Text(
                    valueText,
                    textAlign: TextAlign.right,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: GameViewTheme.body(4.8).copyWith(color: valueColor),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Small dice icon (d4 tetrahedron or d6 cube) matching the desktop SVG icons.
class _DiceIcon extends StatelessWidget {
  const _DiceIcon({required this.faces, required this.color});
  final int faces;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: const Size(12, 12),
      painter: _DicePainter(faces: faces, color: color),
    );
  }
}

class _DicePainter extends CustomPainter {
  _DicePainter({required this.faces, required this.color});
  final int faces;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final w = size.width;
    final h = size.height;

    if (faces == 4) {
      // d4 triangle
      final path = Path()
        ..moveTo(w / 2, 0)
        ..lineTo(w, h)
        ..lineTo(0, h)
        ..close();
      canvas.drawPath(path, paint);
      canvas.drawCircle(Offset(w / 2, h * 0.7), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.3, h * 0.45), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.7, h * 0.45), 1.2, dotPaint);
    } else {
      // d6 cube
      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, w, h),
        const Radius.circular(1.5),
      );
      canvas.drawRRect(rect, paint);
      canvas.drawCircle(Offset(w * 0.25, h * 0.25), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.75, h * 0.25), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.5, h * 0.5), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.25, h * 0.75), 1.2, dotPaint);
      canvas.drawCircle(Offset(w * 0.75, h * 0.75), 1.2, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _DicePainter old) =>
      old.faces != faces || old.color != color;
}

class _InventoryItemCell extends StatelessWidget {
  const _InventoryItemCell({required this.item});

  final GameItem item;

  void _showItemTooltip(BuildContext context, Offset tapPosition) {
    final desc = translatedGameItemTooltip(I18n(), item);
    final borderColor = context.read<ThemeService>().secondaryColor;
    final overlay = Overlay.of(context);
    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (_) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: () => entry.remove(),
        child: Stack(
          children: [
            Positioned(
              left: (tapPosition.dx - 80).clamp(8.0, MediaQuery.of(context).size.width - 168),
              top: tapPosition.dy - 48,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 160),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xEE222222),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: borderColor, width: 1),
                  ),
                  child: Text(
                    desc,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'PressStart2P',
                      fontSize: 6,
                      color: Colors.white,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
    overlay.insert(entry);
    Future<void>.delayed(const Duration(seconds: 3), () {
      if (entry.mounted) entry.remove();
    });
  }

  @override
  Widget build(BuildContext context) {
    final assetPath = gameItemAssetPath(item.id);

    return GestureDetector(
      onTapUp: (details) => _showItemTooltip(context, details.globalPosition),
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.12),
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(6),
          color: Colors.white.withValues(alpha: 0.05),
        ),
        child: Padding(
          padding: const EdgeInsets.all(4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: assetPath != null
                    ? Image.asset(
                        assetPath,
                        fit: BoxFit.contain,
                        errorBuilder: (_, e, st) => const Icon(
                          Icons.inventory_2,
                          color: Colors.white54,
                          size: 22,
                        ),
                      )
                    : const Icon(
                        Icons.inventory_2,
                        color: Colors.white54,
                        size: 22,
                      ),
              ),
              Text(
                item.displayName,
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GameViewTheme.body(4.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
