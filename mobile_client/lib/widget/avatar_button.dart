import 'package:flutter/material.dart';
import 'package:mobile_client/widget/avatar_preview.dart';

/// 40×40 avatar button (toolbar or light header).
///
/// With [borderColor]: like the web client — photo filling the circle, **ring
/// drawn on top of** the image (2px border), not under the photo.
class AvatarIconButton extends StatelessWidget {
  final String? avatarAssetPath;
  final VoidCallback onPressed;
  final Color? backgroundColor;
  final Color? borderColor;

  const AvatarIconButton({
    super.key,
    required this.avatarAssetPath,
    required this.onPressed,
    this.backgroundColor,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final avatarKey = avatarAssetPath ?? 'avatar-1';

    if (borderColor != null) {
      final bg = backgroundColor ?? Colors.black.withValues(alpha: 0.5);
      final ring = borderColor!;
      return SizedBox(
        width: 40,
        height: 40,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onPressed,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipOval(
                  child: ColoredBox(
                    color: bg,
                    child: Image(
                      image: avatarImageProvider(avatarKey),
                      fit: BoxFit.cover,
                      width: 40,
                      height: 40,
                      gaplessPlayback: true,
                      errorBuilder: (context, error, stackTrace) => ColoredBox(
                        color: bg,
                        child: const Icon(Icons.person, color: Colors.white38),
                      ),
                    ),
                  ),
                ),
                IgnorePointer(
                  child: CustomPaint(
                    painter: _AvatarRingPainter(
                      color: ring,
                      strokeWidth: 2,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final lightBg = backgroundColor ?? Colors.white.withValues(alpha: 0.92);
    return SizedBox(
      width: 40,
      height: 40,
      child: Material(
        color: lightBg,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onPressed,
          child: Center(
            child: AppAvatar(
              avatar: avatarKey,
              size: 32,
              shape: AvatarShape.circle,
            ),
          ),
        ),
      ),
    );
  }
}

class _AvatarRingPainter extends CustomPainter {
  _AvatarRingPainter({
    required this.color,
    required this.strokeWidth,
  });

  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2 - strokeWidth / 2;
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth,
    );
  }

  @override
  bool shouldRepaint(covariant _AvatarRingPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.strokeWidth != strokeWidth;
}
