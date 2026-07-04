import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// "Leave the game" variant: orange border / buttons `#e67e22` like
/// `.popup-container.confirm` + vmin scale (`confirm-popup.component.scss`).
enum PolyArenaConfirmVariant { standard, heavyQuit }

/// Same visual principle as `ConfirmPopupComponent` + `confirm-popup.component.scss` (Angular client).
Future<bool> showPolyArenaConfirmDialog({
  required BuildContext context,
  required String titleKey,
  required String messageKey,
  Map<String, String> messageParams = const {},
  PolyArenaConfirmVariant variant = PolyArenaConfirmVariant.standard,
}) async {
  final i18n = I18n();
  final title = i18n.translate(titleKey);
  final message = messageParams.isEmpty
      ? i18n.translate(messageKey)
      : i18n.translateWithParams(messageKey, messageParams);

  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) {
      final sw = MediaQuery.sizeOf(ctx).shortestSide;
      final vmin = sw * 0.01;
      double? heavyMinW;
      double? heavyMaxW;
      if (variant == PolyArenaConfirmVariant.heavyQuit) {
        heavyMinW = 32 * vmin;
        heavyMaxW = math.max(heavyMinW, math.min(540.0, 50 * vmin));
      }

      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.symmetric(
          horizontal: variant == PolyArenaConfirmVariant.heavyQuit
              ? math.max(16.0, 3 * vmin)
              : 22,
          vertical: variant == PolyArenaConfirmVariant.heavyQuit
              ? math.max(20.0, 3 * vmin)
              : 24,
        ),
        child: _PolyArenaConfirmPanel(
          title: title,
          message: message,
          cancelLabel: i18n.translate('common.cancel'),
          confirmLabel: i18n.translate('common.confirm'),
          onCancel: () => Navigator.of(ctx).pop(false),
          onConfirm: () => Navigator.of(ctx).pop(true),
          variant: variant,
          vmin: variant == PolyArenaConfirmVariant.heavyQuit ? vmin : null,
          minWidth: heavyMinW,
          maxWidth: heavyMaxW,
        ),
      );
    },
  );
  return result ?? false;
}

class _PolyArenaConfirmPanel extends StatefulWidget {
  const _PolyArenaConfirmPanel({
    required this.title,
    required this.message,
    required this.cancelLabel,
    required this.confirmLabel,
    required this.onCancel,
    required this.onConfirm,
    this.variant = PolyArenaConfirmVariant.standard,
    this.vmin,
    this.minWidth,
    this.maxWidth,
  });

  final String title;
  final String message;
  final String cancelLabel;
  final String confirmLabel;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;
  final PolyArenaConfirmVariant variant;
  final double? vmin;
  final double? minWidth;
  final double? maxWidth;

  @override
  State<_PolyArenaConfirmPanel> createState() => _PolyArenaConfirmPanelState();
}

class _PolyArenaConfirmPanelState extends State<_PolyArenaConfirmPanel>
    with SingleTickerProviderStateMixin {
  static const Color _messageColor = Color(0xFFAAB0BC);

  late final AnimationController _float;

  @override
  void initState() {
    super.initState();
    _float = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _float.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final heavy = widget.variant == PolyArenaConfirmVariant.heavyQuit;
    final vmin = widget.vmin ?? 4.0;
    final accent = heavy ? const Color(0xFFE67E22) : theme.secondaryColor;
    final accentDark = heavy ? const Color(0xFFCF6D17) : theme.secondaryHoverColor;

    final iconSize = heavy ? (7 * vmin).clamp(48.0, 76.0) : 44.0;
    final iconGlyph = heavy ? (2.8 * vmin).clamp(16.0, 26.0) : 18.0;
    final titleFs = heavy ? (1.4 * vmin).clamp(10.0, 15.0) : 10.0;
    final messageFs = heavy ? (1.0 * vmin).clamp(7.0, 11.0) : 7.0;
    final btnFs = heavy ? (0.9 * vmin).clamp(7.5, 10.5) : 7.0;
    final pad = heavy
        ? EdgeInsets.fromLTRB(4 * vmin, 3 * vmin, 4 * vmin, 2.5 * vmin)
        : const EdgeInsets.fromLTRB(20, 22, 20, 18);
    final radius = heavy ? (1.2 * vmin).clamp(10.0, 16.0) : 10.0;

    final constraints = widget.minWidth != null && widget.maxWidth != null
        ? BoxConstraints(
            minWidth: widget.minWidth!,
            maxWidth: widget.maxWidth!,
          )
        : const BoxConstraints(minWidth: 240, maxWidth: 320);

    return ConstrainedBox(
      constraints: constraints,
      child: Container(
        padding: pad,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment(-0.9, -1),
            end: Alignment(0.85, 1),
            colors: [
              Color(0xFF16171F),
              Color(0xFF0D0E14),
              Color(0xFF12131A),
            ],
            stops: [0.0, 0.48, 1.0],
          ),
          borderRadius: BorderRadius.circular(radius),
          border: Border.all(
            color: accent,
            width: heavy ? math.max(2.0, 0.25 * vmin) : 2,
          ),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: heavy ? 0.22 : 0.18),
              blurRadius: heavy ? 22 : 18,
              spreadRadius: heavy ? 1 : 0,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.55),
              offset: Offset(0, heavy ? 0.85 * vmin : 6),
              blurRadius: heavy ? 3.5 * vmin : 20,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: iconSize,
              height: iconSize,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(
                  color: accent,
                  width: heavy ? math.max(2.0, 0.25 * vmin) : 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.2),
                    blurRadius: heavy ? 0.85 * vmin : 8,
                  ),
                ],
              ),
              child: AnimatedBuilder(
                animation: _float,
                builder: (context, child) {
                  final t = _float.value;
                  final dy = (t - 0.5) * 2 * (heavy ? 6.0 : 3.4);
                  return Transform.translate(
                    offset: Offset(0, -dy),
                    child: child,
                  );
                },
                child: Center(
                  child: Text(
                    '?',
                    style: GoogleFonts.pressStart2p(
                      fontSize: iconGlyph,
                      color: accent,
                      height: 1,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(height: heavy ? 2 * vmin : 14),
            Text(
              widget.title,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: titleFs,
                color: Colors.white,
                height: 1.35,
              ),
            ),
            SizedBox(height: heavy ? 1.2 * vmin : 10),
            Text(
              widget.message,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: messageFs,
                color: _messageColor,
                height: 1.55,
              ),
            ),
            SizedBox(height: heavy ? 2.5 * vmin : 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _PopupButton(
                  label: widget.cancelLabel,
                  filled: false,
                  fontSize: btnFs,
                  heavyQuit: heavy,
                  onPressed: widget.onCancel,
                ),
                SizedBox(width: heavy ? 1.5 * vmin : 12),
                _PopupButton(
                  label: widget.confirmLabel,
                  filled: true,
                  fontSize: btnFs,
                  heavyQuit: heavy,
                  accent: accent,
                  accentDark: accentDark,
                  onPressed: widget.onConfirm,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PopupButton extends StatelessWidget {
  const _PopupButton({
    required this.label,
    required this.filled,
    required this.onPressed,
    this.fontSize = 7,
    this.heavyQuit = false,
    this.accent,
    this.accentDark,
  });

  final String label;
  final bool filled;
  final VoidCallback onPressed;
  final double fontSize;
  final bool heavyQuit;
  final Color? accent;
  final Color? accentDark;

  static const Color _muted = Color(0xFFAAB0BC);

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final fill = accent ?? theme.secondaryColor;
    final borderC = accentDark ?? theme.secondaryHoverColor;
    final radius = heavyQuit ? 6.0 : 6.0;
    final padH = heavyQuit ? 20.0 : 16.0;
    final padV = heavyQuit ? 14.0 : 12.0;
    if (filled) {
      return Material(
        color: fill,
        borderRadius: BorderRadius.circular(radius),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(radius),
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(color: borderC, width: 2),
            ),
            child: Text(
              label,
              style: GoogleFonts.pressStart2p(
                fontSize: fontSize,
                color: Colors.white,
                height: 1.2,
              ),
            ),
          ),
        ),
      );
    }
    return Material(
      color: Colors.white.withValues(alpha: 0.06),
      borderRadius: BorderRadius.circular(radius),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: padH, vertical: padV),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.12),
              width: 2,
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.pressStart2p(
              fontSize: fontSize,
              color: _muted,
              height: 1.2,
            ),
          ),
        ),
      ),
    );
  }
}
