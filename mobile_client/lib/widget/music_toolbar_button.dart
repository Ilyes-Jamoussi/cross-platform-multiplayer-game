import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mobile_client/services/music_service.dart';

/// Music button aligned with the web client: 40×40, primary border, crossed-out note or equalizer.
class MusicToolbarButton extends StatefulWidget {
  const MusicToolbarButton({
    super.key,
    required this.primary,
    required this.musicService,
    required this.onOpenMenu,
  });

  final Color primary;
  final MusicService musicService;
  final void Function(Rect anchorGlobal) onOpenMenu;

  @override
  State<MusicToolbarButton> createState() => _MusicToolbarButtonState();
}

class _MusicToolbarButtonState extends State<MusicToolbarButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _eq;

  bool get _isOff => widget.musicService.currentMusicId == musicOffId;

  @override
  void initState() {
    super.initState();
    _eq = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    );
    if (!_isOff) {
      _eq.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant MusicToolbarButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    final wasOff = oldWidget.musicService.currentMusicId == musicOffId;
    final nowOff = _isOff;
    if (wasOff != nowOff) {
      if (nowOff) {
        _eq.stop();
      } else {
        _eq.repeat();
      }
    }
  }

  @override
  void dispose() {
    _eq.dispose();
    super.dispose();
  }

  void _emitAnchorAndOpen() {
    final box = context.findRenderObject() as RenderBox?;
    if (box == null || !box.hasSize) return;
    final offset = box.localToGlobal(Offset.zero);
    final size = box.size;
    widget.onOpenMenu(Rect.fromLTWH(offset.dx, offset.dy, size.width, size.height));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _emitAnchorAndOpen,
      onLongPress: () => widget.musicService.toggle(),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.7),
          shape: BoxShape.circle,
          border: Border.all(color: widget.primary, width: 2),
          boxShadow: !_isOff
              ? [
                  BoxShadow(
                    color: widget.primary.withValues(alpha: 0.4),
                    blurRadius: 10,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: Center(
          child: _isOff
              ? CustomPaint(
                  size: const Size(20, 20),
                  painter: const MusicOffIconPainter(),
                )
              : AnimatedBuilder(
                  animation: _eq,
                  builder: (context, child) {
                    return _EqualizerBars(
                      progress: _eq.value,
                      color: widget.primary,
                    );
                  },
                ),
        ),
      ),
    );
  }
}

class _EqualizerBars extends StatelessWidget {
  const _EqualizerBars({
    required this.progress,
    required this.color,
  });

  final double progress;
  final Color color;

  double _barH(double phase) {
    final t = progress * 2 * math.pi + phase;
    return (4 + 12 * (0.5 + 0.5 * math.sin(t))).clamp(4.0, 16.0);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 16,
      height: 16,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 3,
            height: _barH(0),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
          const SizedBox(width: 2),
          Container(
            width: 3,
            height: _barH(0.2 * 2 * math.pi),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
          const SizedBox(width: 2),
          Container(
            width: 3,
            height: _barH(0.4 * 2 * math.pi),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        ],
      ),
    );
  }
}

/// Note + bar icon ("off" state), like the Angular SVG.
/// [menuStyle]: white icons in the dropdown menu; otherwise gray (game bar).
class MusicOffIconPainter extends CustomPainter {
  const MusicOffIconPainter({this.menuStyle = false});

  final bool menuStyle;

  @override
  void paint(Canvas canvas, Size size) {
    final sc = size.shortestSide / 24.0;
    canvas.save();
    canvas.scale(sc);
    final note = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = menuStyle ? Colors.white : const Color(0xFF999999);
    final path = Path()
      ..moveTo(9, 18)
      ..lineTo(9, 5)
      ..lineTo(21, 3)
      ..lineTo(21, 16);
    canvas.drawPath(path, note);
    canvas.drawCircle(const Offset(6, 18), 3, note);
    canvas.drawCircle(const Offset(18, 16), 3, note);
    final red = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..color = const Color(0xFFFF4444);
    canvas.drawLine(const Offset(2, 2), const Offset(22, 22), red);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant MusicOffIconPainter oldDelegate) =>
      oldDelegate.menuStyle != menuStyle;
}

/// Note alone (tracks), like the Angular SVG outside "off".
class MusicNoteIconPainter extends CustomPainter {
  MusicNoteIconPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final sc = size.shortestSide / 24.0;
    canvas.save();
    canvas.scale(sc);
    final note = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = color;
    final path = Path()
      ..moveTo(9, 18)
      ..lineTo(9, 5)
      ..lineTo(21, 3)
      ..lineTo(21, 16);
    canvas.drawPath(path, note);
    canvas.drawCircle(const Offset(6, 18), 3, note);
    canvas.drawCircle(const Offset(18, 16), 3, note);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant MusicNoteIconPainter oldDelegate) =>
      oldDelegate.color != color;
}
