import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/character_stats_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Stats panel — aligned with `character-stats.component` (Angular).
class CharacterStatsPanel extends StatelessWidget {
  const CharacterStatsPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final borderPrimary = theme.primaryColor;
    return LayoutBuilder(
      builder: (context, constraints) {
        final s = MediaQuery.sizeOf(context).shortestSide;
        final vmin = s * 0.01;
        final panelH = 22 * vmin;

        return Consumer<CharacterStatsService>(
          builder: (context, stats, _) {
            return IntrinsicWidth(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: constraints.maxWidth,
                  minHeight: panelH,
                ),
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: vmin,
                    vertical: 0.5 * vmin,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.42),
                    borderRadius: BorderRadius.circular(1.5 * vmin),
                    border: Border.all(color: borderPrimary, width: 0.3 * vmin),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _lifeRow(stats, vmin),
                      SizedBox(height: 0.8 * vmin),
                      _speedRow(stats, vmin),
                      SizedBox(height: 0.8 * vmin),
                      _attackRow(stats, vmin),
                      SizedBox(height: 0.8 * vmin),
                      _defenseRow(stats, vmin),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _lifeRow(CharacterStatsService stats, double vmin) {
    return _statsBar(
      labelKey: 'character_stats.life',
      tooltipKey: 'character_stats.tooltip.life',
      filledCount: stats.life,
      maxSlots: 6,
      filledColor: const Color(0xFF22C55E),
      filledBorder: const Color(0xFF16A34A),
      pulseActive: !stats.isLifeOrSpeedMax,
      onTap: stats.toggleLife,
      vmin: vmin,
    );
  }

  Widget _speedRow(CharacterStatsService stats, double vmin) {
    return _statsBar(
      labelKey: 'character_stats.speed',
      tooltipKey: 'character_stats.tooltip.speed',
      filledCount: stats.speed,
      maxSlots: 6,
      filledColor: const Color(0xFFF59E0B),
      filledBorder: const Color(0xFFD97706),
      pulseActive: !stats.isLifeOrSpeedMax,
      onTap: stats.toggleSpeed,
      vmin: vmin,
    );
  }

  Widget _attackRow(CharacterStatsService stats, double vmin) {
    return _statsBar(
      labelKey: 'character_stats.attack',
      tooltipKey: 'character_stats.tooltip.attack',
      filledCount: stats.attack,
      maxSlots: 4,
      filledColor: const Color(0xFFEF4444),
      filledBorder: const Color(0xFFDC2626),
      pulseActive: !stats.isAttackOrDefenseMax,
      onTap: stats.toggleAttack,
      vmin: vmin,
      showDice: true,
      diceIsD4: stats.attack == 4,
      diceIsMax: stats.attack == CharacterStatsService.maxStat,
    );
  }

  Widget _defenseRow(CharacterStatsService stats, double vmin) {
    return _statsBar(
      labelKey: 'character_stats.defense',
      tooltipKey: 'character_stats.tooltip.defense',
      filledCount: stats.defense,
      maxSlots: 4,
      filledColor: const Color(0xFF3B82F6),
      filledBorder: const Color(0xFF2563EB),
      pulseActive: !stats.isAttackOrDefenseMax,
      onTap: stats.toggleDefense,
      vmin: vmin,
      showDice: true,
      diceIsD4: stats.defense == 4,
      diceIsMax: stats.defense == CharacterStatsService.maxStat,
    );
  }

  Widget _statsBar({
    required String labelKey,
    required String tooltipKey,
    required int filledCount,
    required int maxSlots,
    required Color filledColor,
    required Color filledBorder,
    required bool pulseActive,
    required VoidCallback onTap,
    required double vmin,
    bool showDice = false,
    bool diceIsD4 = true,
    bool diceIsMax = false,
  }) {
    final sq = 3 * vmin;
    final gap = 0.5 * vmin;
    final labelW = 10 * vmin;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        _InfoIconWithTooltip(
          tooltip: I18n().translate(tooltipKey),
          size: 4 * vmin,
          marginRight: vmin,
        ),
        SizedBox(
          width: labelW,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerRight,
            child: Text(
              I18n().translate(labelKey),
              textAlign: TextAlign.right,
              maxLines: 1,
              style: GoogleFonts.pressStart2p(
                fontSize: 1.5 * vmin,
                color: Colors.white,
                height: 1.2,
              ),
            ),
          ),
        ),
        SizedBox(width: 1.5 * vmin),
        _PulsingBarWrap(
          active: pulseActive,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(0.8 * vmin),
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 0.2 * vmin),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (int i = 0; i < maxSlots; i++) ...[
                      if (i > 0) SizedBox(width: gap),
                      _StatSquare(
                        filled: i < filledCount,
                        filledColor: filledColor,
                        borderColor: filledBorder,
                        size: sq,
                        radius: 0.8 * vmin,
                        borderW: (0.25 * vmin).clamp(1.0, 4.0),
                      ),
                    ],
                    if (showDice) ...[
                      SizedBox(width: 1.2 * vmin),
                      Text(
                        '+',
                        style: TextStyle(
                          fontSize: 1.5 * vmin,
                          color: Colors.white,
                          height: 1,
                        ),
                      ),
                      SizedBox(width: 0.5 * vmin),
                      _DiceBlock(
                        isD4: diceIsD4,
                        isMax: diceIsMax,
                        size: 3.5 * vmin,
                        label: diceIsMax ? 'D6' : 'D4',
                        labelSize: 0.9 * vmin,
                        onTap: onTap,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _InfoIconWithTooltip extends StatelessWidget {
  const _InfoIconWithTooltip({
    required this.tooltip,
    required this.size,
    required this.marginRight,
  });

  final String tooltip;
  final double size;
  final double marginRight;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(right: marginRight),
      child: Tooltip(
        message: tooltip,
        preferBelow: true,
        textStyle: GoogleFonts.pressStart2p(
          fontSize: 10,
          color: Colors.white,
          height: 1.3,
        ),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Image.asset(
          'assets/info_icon.png',
          width: size,
          height: size,
        ),
      ),
    );
  }
}

class _StatSquare extends StatelessWidget {
  const _StatSquare({
    required this.filled,
    required this.filledColor,
    required this.borderColor,
    required this.size,
    required this.radius,
    required this.borderW,
  });

  final bool filled;
  final Color filledColor;
  final Color borderColor;
  final double size;
  final double radius;
  final double borderW;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: filled
            ? filledColor
            : Colors.black.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(
          color: filled
              ? borderColor
              : Colors.white.withValues(alpha: 0.3),
          width: borderW,
        ),
      ),
    );
  }
}

class _DiceBlock extends StatelessWidget {
  const _DiceBlock({
    required this.isD4,
    required this.isMax,
    required this.size,
    required this.label,
    required this.labelSize,
    required this.onTap,
  });

  final bool isD4;
  final bool isMax;
  final double size;
  final String label;
  final double labelSize;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = isMax ? const Color(0xFFFFCC00) : const Color(0xFF888888);
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Image.asset(
            isD4 ? 'assets/4_face.png' : 'assets/6_face.png',
            width: size,
            height: size,
            errorBuilder: (context, error, stackTrace) =>
                Icon(Icons.casino, size: size, color: accent),
          ),
          SizedBox(height: 0.2 * (MediaQuery.sizeOf(context).shortestSide * 0.01)),
          Text(
            label,
            style: GoogleFonts.pressStart2p(
              fontSize: labelSize,
              color: accent,
              height: 1.1,
              fontWeight: isMax ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}

/// Red pulse like the Angular `.bar-container` (`pulse-glow`).
class _PulsingBarWrap extends StatefulWidget {
  const _PulsingBarWrap({required this.active, required this.child});

  final bool active;
  final Widget child;

  @override
  State<_PulsingBarWrap> createState() => _PulsingBarWrapState();
}

class _PulsingBarWrapState extends State<_PulsingBarWrap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );

  @override
  void initState() {
    super.initState();
    if (widget.active) {
      _c.repeat();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant _PulsingBarWrap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.active) {
      if (!_c.isAnimating) {
        _c.repeat();
      }
    } else {
      _c.stop();
      _c.reset();
    }
  }

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    if (!widget.active) return widget.child;

    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        final t = _c.value;
        final intensity = t < 0.2
            ? (t / 0.2)
            : (t < 0.5 ? (1 - ((t - 0.2) / 0.3)) : 0.0);
        final borderW = ((0.12 + 0.08 * intensity) * vmin).clamp(0.8, 2.4);
        final blur = ((0.4 + 1.1 * intensity) * vmin).clamp(1.0, 10.0);
        final red = const Color.fromRGBO(112, 2, 2, 1);

        return DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(0.8 * vmin),
            border: Border.all(
              color: red.withValues(alpha: 0.75 + 0.25 * intensity),
              width: borderW,
            ),
            boxShadow: [
              BoxShadow(
                color: red.withValues(alpha: 0.8),
                blurRadius: blur,
                spreadRadius: 0,
              ),
            ],
          ),
          child: child,
        );
      },
    );
  }
}
