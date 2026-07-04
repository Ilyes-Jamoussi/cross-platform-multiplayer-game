import 'package:flutter/material.dart';

class TopIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final double size;
  final Color? backgroundColor;
  final Color? borderColor;
  final double borderWidth;
  final Color? iconColor;

  const TopIconButton({
    required this.icon,
    required this.onPressed,
    this.size = 40,
    this.backgroundColor,
    this.borderColor,
    this.borderWidth = 2,
    this.iconColor,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? Colors.white.withValues(alpha: 0.92);
    final ic = iconColor ?? Colors.black87;
    final shape = borderColor != null
        ? CircleBorder(side: BorderSide(color: borderColor!, width: borderWidth))
        : const CircleBorder();
    return SizedBox(
      width: size,
      height: size,
      child: Material(
        color: bg,
        shape: shape,
        child: IconButton(
          padding: EdgeInsets.zero,
          icon: Icon(icon, size: 20, color: ic),
          onPressed: onPressed,
        ),
      ),
    );
  }
}
