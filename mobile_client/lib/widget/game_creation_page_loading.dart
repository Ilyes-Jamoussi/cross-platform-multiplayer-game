import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Reprend l’esprit du `app-page-loading` Angular (panneau sombre, anneau pixel, texte Press Start 2P).
class GameCreationPageLoading extends StatefulWidget {
  const GameCreationPageLoading({super.key, required this.messageKey});

  final String messageKey;

  @override
  State<GameCreationPageLoading> createState() => _GameCreationPageLoadingState();
}

class _GameCreationPageLoadingState extends State<GameCreationPageLoading>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final secondary = context.watch<ThemeService>().secondaryColor;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: secondary.withValues(alpha: 0.9), width: 2),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF14151c), Color(0xFF0c0d12)],
              ),
              boxShadow: [
                BoxShadow(
                  color: secondary.withValues(alpha: 0.22),
                  blurRadius: 28,
                  spreadRadius: 1,
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.55),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 36),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 76,
                    height: 76,
                    child: AnimatedBuilder(
                      animation: _controller,
                      builder: (context, _) {
                        return CustomPaint(
                          painter: _OrbitPixelPainter(
                            progress: _controller.value,
                            secondary: secondary,
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(
                    I18n().translate(widget.messageKey),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 9,
                      height: 1.75,
                      color: Colors.white,
                      shadows: const [
                        Shadow(
                          offset: Offset(0, 1),
                          blurRadius: 0,
                          color: Color(0x8C000000),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _OrbitPixelPainter extends CustomPainter {
  _OrbitPixelPainter({required this.progress, required this.secondary});

  final double progress;
  final Color secondary;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide * 0.34;
    final pixel = size.shortestSide * 0.11;

    final halo = Paint()
      ..color = secondary.withValues(alpha: 0.12)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, r + pixel * 0.9, halo);

    final ring = Paint()
      ..color = secondary.withValues(alpha: 0.85)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(center, r + pixel * 0.45, ring);

    for (var i = 0; i < 8; i++) {
      final angle = (i / 8) * 2 * math.pi + progress * 2 * math.pi;
      final armEnd = center + Offset(math.sin(angle), -math.cos(angle)) * r;
      final rect = RRect.fromRectAndRadius(
        Rect.fromCenter(center: armEnd, width: pixel, height: pixel),
        const Radius.circular(1),
      );
      final p = Paint()
        ..color = const Color(0xFFE8F2FF)
        ..style = PaintingStyle.fill;
      canvas.drawRRect(rect, p);
      canvas.drawRRect(
        rect,
        Paint()
          ..color = Colors.white.withValues(alpha: 0.45)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 0.8,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitPixelPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
