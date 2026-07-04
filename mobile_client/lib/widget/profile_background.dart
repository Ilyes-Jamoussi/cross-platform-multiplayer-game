import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/cosmetics_service.dart';
import '../services/theme_service.dart';

class ProfileBackground extends StatelessWidget {
  const ProfileBackground({super.key, this.fit = BoxFit.cover});

  final BoxFit fit;

  static const String _defaultBackgroundId = 'background-default';
  static const String _defaultBackgroundAsset =
      'assets/backgrounds/background-default.png';

  /// Aligned with `app.component.scss` `.app-background.custom-bg`:
  /// `background-size: auto 70vh` + `center calc(50% + 4.5vmin)` (avoids the "cover" zoom).
  static const double _customBgHeightFraction = 0.70;
  static const double _customBgOffsetVmin = 4.5;

  @override
  Widget build(BuildContext context) {
    final selectedBackgroundId = context.select<AuthService, String>(
      (auth) => auth.currentUser?.selectedBackground ?? _defaultBackgroundId,
    );
    final isBlue = context.select<ThemeService, bool>((t) => t.isBlue);

    final background = CosmeticsService.backgrounds
        .cast<CosmeticBackground?>()
        .firstWhere(
          (bg) => bg?.id == selectedBackgroundId,
          orElse: () => null,
        );

    final assetPath =
        background?.assetForTheme(isBlue) ?? _defaultBackgroundAsset;

    final isDefault = selectedBackgroundId == _defaultBackgroundId;

    if (isDefault) {
      return SizedBox.expand(
        child: Image.asset(
          assetPath,
          fit: fit,
          alignment: Alignment.center,
        ),
      );
    }

    final mq = MediaQuery.sizeOf(context);
    final vmin = mq.shortestSide * 0.01;
    final imgH = mq.height * _customBgHeightFraction;
    final dy = vmin * _customBgOffsetVmin;

    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Colors.black),
        Center(
          child: Transform.translate(
            offset: Offset(0, dy),
            child: Image.asset(
              assetPath,
              height: imgH,
              fit: BoxFit.fitHeight,
              filterQuality: FilterQuality.none,
              alignment: Alignment.center,
            ),
          ),
        ),
      ],
    );
  }
}
