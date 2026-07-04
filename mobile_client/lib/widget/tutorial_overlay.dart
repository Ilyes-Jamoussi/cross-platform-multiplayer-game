import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/services/tutorial_service.dart';
import 'package:mobile_client/widget/tutorial_steps_data.dart';
import 'package:provider/provider.dart';

/// Full-screen overlay: texts via [I18n], colors via [ThemeService] (blue / red).
/// Each step shows an annotated screenshot (numbered badges on the areas
/// of interest) and a numbered caption describing each UI element.
class TutorialOverlay extends StatelessWidget {
  const TutorialOverlay({
    super.key,
    required this.step,
    required this.onNext,
    required this.onDismiss,
  });

  final int step;
  final VoidCallback onNext;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final primary = themeService.primaryColor;
    final tertiary = themeService.tertiaryColor;
    final isRed = themeService.theme == AppThemeMode.red;

    final maxIndex = kTutorialTotalSteps - 1;
    final safeStep = step.clamp(0, maxIndex);
    final stepData = kTutorialSteps[safeStep];

    final i18n = I18n();
    final title = i18n.translate(stepData.titleKey);
    final description = i18n.translate(stepData.bodyKey);
    final stepLabel = i18n.translateWithParams('tutorial.step_progress', {
      'current': '${safeStep + 1}',
      'total': '$kTutorialTotalSteps',
    });

    final isLast = safeStep >= maxIndex;
    final progress = (safeStep + 1) / kTutorialTotalSteps;

    final cardBg = isRed ? const Color(0xFF2A1418) : const Color(0xFF1A1A2E);
    final progressTrack = isRed ? const Color(0xFF3D2028) : Colors.white12;

    return Material(
      color: Colors.black.withValues(alpha: 0.88),
      child: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final cardW = math.min(
              math.max(constraints.maxWidth - 32, 240),
              720,
            ).toDouble();
            final cardH = math.min(
              math.max(constraints.maxHeight - 32, 320),
              780,
            ).toDouble();
            return Center(
              child: SizedBox(
                width: cardW,
                height: cardH,
                child: Container(
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: primary, width: 2),
                    boxShadow: const <BoxShadow>[
                      BoxShadow(
                        color: Color(0x66000000),
                        blurRadius: 24,
                        offset: Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      _TutorialHeader(
                        stepLabel: stepLabel,
                        closeTooltip: i18n.translate('tutorial.close_tooltip'),
                        onDismiss: onDismiss,
                      ),
                      _TutorialProgressBar(
                        progress: progress,
                        track: progressTrack,
                        fill: tertiary,
                      ),
                      const SizedBox(height: 12),
                      Expanded(
                        child: SingleChildScrollView(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              _TutorialIllustration(
                                stepData: stepData,
                                primary: primary,
                                tertiary: tertiary,
                              ),
                              const SizedBox(height: 16),
                              Text(
                                title,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.pressStart2p(
                                  fontSize: 10,
                                  color: tertiary,
                                  height: 1.5,
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                description,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.white70,
                                  height: 1.5,
                                ),
                              ),
                              if (stepData.annotations.isNotEmpty) ...<Widget>[
                                const SizedBox(height: 14),
                                _TutorialLegend(
                                  annotations: stepData.annotations,
                                  primary: primary,
                                  i18n: i18n,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      _TutorialFooter(
                        isLast: isLast,
                        primary: primary,
                        i18n: i18n,
                        onDismiss: onDismiss,
                        onNext: onNext,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _TutorialHeader extends StatelessWidget {
  const _TutorialHeader({
    required this.stepLabel,
    required this.closeTooltip,
    required this.onDismiss,
  });

  final String stepLabel;
  final String closeTooltip;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
      child: Row(
        children: <Widget>[
          Text(
            stepLabel,
            style: GoogleFonts.pressStart2p(
              fontSize: 7,
              color: Colors.white54,
            ),
          ),
          const Spacer(),
          IconButton(
            icon: const Icon(Icons.close, color: Colors.white54, size: 20),
            onPressed: onDismiss,
            tooltip: closeTooltip,
          ),
        ],
      ),
    );
  }
}

class _TutorialProgressBar extends StatelessWidget {
  const _TutorialProgressBar({
    required this.progress,
    required this.track,
    required this.fill,
  });

  final double progress;
  final Color track;
  final Color fill;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(4),
        child: LinearProgressIndicator(
          value: progress,
          backgroundColor: track,
          valueColor: AlwaysStoppedAnimation<Color>(fill),
          minHeight: 4,
        ),
      ),
    );
  }
}

class _TutorialFooter extends StatelessWidget {
  const _TutorialFooter({
    required this.isLast,
    required this.primary,
    required this.i18n,
    required this.onDismiss,
    required this.onNext,
  });

  final bool isLast;
  final Color primary;
  final I18n i18n;
  final VoidCallback onDismiss;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      child: Row(
        children: <Widget>[
          TextButton(
            onPressed: onDismiss,
            style: TextButton.styleFrom(foregroundColor: Colors.white38),
            child: Text(
              i18n.translate('tutorial.skip'),
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.2,
                color: Colors.white38,
              ),
            ),
          ),
          const Spacer(),
          ElevatedButton(
            onPressed: onNext,
            style: ElevatedButton.styleFrom(
              backgroundColor: primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(
                horizontal: 24,
                vertical: 12,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text(
              isLast
                  ? i18n.translate('tutorial.finish')
                  : i18n.translate('tutorial.next'),
              style: GoogleFonts.pressStart2p(fontSize: 8),
            ),
          ),
        ],
      ),
    );
  }
}

/// Illustration area: logo (s0) or annotated screenshot.
class _TutorialIllustration extends StatelessWidget {
  const _TutorialIllustration({
    required this.stepData,
    required this.primary,
    required this.tertiary,
  });

  final TutorialStepData stepData;
  final Color primary;
  final Color tertiary;

  static const double _maxImageHeight = 280.0;
  static const double _badgeRadius = 14.0;

  @override
  Widget build(BuildContext context) {
    final imagePath = stepData.imagePath;
    if (imagePath == null) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.asset(
          'assets/logo.png',
          height: 160,
          fit: BoxFit.contain,
          errorBuilder: _imageErrorBuilder,
        ),
      );
    }

    final ar = stepData.imageAspectRatio ?? 1.6;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        double imgH = _maxImageHeight;
        double imgW = imgH * ar;
        if (imgW > maxW) {
          imgW = maxW;
          imgH = imgW / ar;
        }

        return Center(
          child: SizedBox(
            width: imgW,
            height: imgH,
            child: Stack(
              clipBehavior: Clip.none,
              children: <Widget>[
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: primary, width: 2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: Image.asset(
                          imagePath,
                          fit: BoxFit.fill,
                          errorBuilder: _imageErrorBuilder,
                        ),
                      ),
                    ),
                  ),
                ),
                for (int i = 0; i < stepData.annotations.length; i++)
                  Positioned(
                    left: stepData.annotations[i].target.dx * imgW - _badgeRadius,
                    top: stepData.annotations[i].target.dy * imgH - _badgeRadius,
                    child: _NumberBadge(
                      number: i + 1,
                      color: primary,
                      accent: tertiary,
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  static Widget _imageErrorBuilder(
    BuildContext context,
    Object error,
    StackTrace? stackTrace,
  ) {
    return const SizedBox(
      height: 100,
      child: Icon(Icons.image_not_supported, color: Colors.white24, size: 48),
    );
  }
}

class _NumberBadge extends StatelessWidget {
  const _NumberBadge({
    required this.number,
    required this.color,
    required this.accent,
  });

  final int number;
  final Color color;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: <BoxShadow>[
          BoxShadow(
            color: accent.withValues(alpha: 0.6),
            blurRadius: 8,
            spreadRadius: 1,
          ),
          const BoxShadow(
            color: Color(0xAA000000),
            blurRadius: 4,
            offset: Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '$number',
        style: GoogleFonts.pressStart2p(
          fontSize: 9,
          color: Colors.white,
          height: 1.0,
        ),
      ),
    );
  }
}

/// Numbered caption detailing each annotation of the step.
class _TutorialLegend extends StatelessWidget {
  const _TutorialLegend({
    required this.annotations,
    required this.primary,
    required this.i18n,
  });

  final List<TutorialAnnotation> annotations;
  final Color primary;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        for (int i = 0; i < annotations.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _LegendBullet(number: i + 1, color: primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    i18n.translate(annotations[i].labelKey),
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.white,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _LegendBullet extends StatelessWidget {
  const _LegendBullet({required this.number, required this.color});

  final int number;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 1.5),
      ),
      alignment: Alignment.center,
      child: Text(
        '$number',
        style: GoogleFonts.pressStart2p(
          fontSize: 7,
          color: Colors.white,
          height: 1.0,
        ),
      ),
    );
  }
}
