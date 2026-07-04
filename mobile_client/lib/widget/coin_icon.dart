import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Same SVG as the web client (`app-coin-icon`), tinted with [color].
class CoinIcon extends StatelessWidget {
  const CoinIcon({
    super.key,
    required this.color,
    this.size = 20,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/coin_icon.svg',
      width: size,
      height: size,
      theme: SvgTheme(currentColor: color),
    );
  }
}
