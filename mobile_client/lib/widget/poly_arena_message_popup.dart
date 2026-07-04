import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Aligned with `ConfirmPopupComponent` (type `success` | `info`) from the Angular client.
enum PolyArenaMessageKind { success, info, warning }

Future<void> showPolyArenaMessageDialog({
  required BuildContext context,
  required PolyArenaMessageKind kind,
  required String title,
  required String message,
  required String okLabel,
}) async {
  final resolvedTitle = _resolveMessageText(title);
  final resolvedMessage = _resolveMessageText(message);
  final resolvedOkLabel = _resolveMessageText(okLabel);
  await showDialog<void>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: true,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) {
      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 22, vertical: 24),
        child: _PolyArenaMessagePanel(
          kind: kind,
          title: resolvedTitle,
          message: resolvedMessage,
          okLabel: resolvedOkLabel,
          onOk: () => Navigator.of(ctx).pop(),
        ),
      );
    },
  );
}

String _resolveMessageText(String raw) {
  final t = raw.trim();
  final looksLikeI18nKey = RegExp(r'^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$').hasMatch(t);
  if (!looksLikeI18nKey) return raw;

  final translated = I18n().translate(t);
  if (translated != t) return translated;
  return raw;
}

class _PolyArenaMessagePanel extends StatefulWidget {
  const _PolyArenaMessagePanel({
    required this.kind,
    required this.title,
    required this.message,
    required this.okLabel,
    required this.onOk,
  });

  final PolyArenaMessageKind kind;
  final String title;
  final String message;
  final String okLabel;
  final VoidCallback onOk;

  @override
  State<_PolyArenaMessagePanel> createState() => _PolyArenaMessagePanelState();
}

class _PolyArenaMessagePanelState extends State<_PolyArenaMessagePanel>
    with SingleTickerProviderStateMixin {
  static const Color _messageColor = Color(0xFFAAB0BC);
  static const Color _successAccent = Color(0xFF44FF88);

  late final AnimationController _float;
  bool _okHovered = false;

  String get _iconChar =>
      widget.kind == PolyArenaMessageKind.success
      ? '✓'
      : widget.kind == PolyArenaMessageKind.warning
          ? '!'
          : 'i';

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
    final accent = widget.kind == PolyArenaMessageKind.success
        ? _successAccent
        : theme.secondaryColor;
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;

    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 240, maxWidth: 320),
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
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
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: accent, width: 2),
          boxShadow: [
            BoxShadow(
              color: accent.withValues(alpha: 0.16),
              blurRadius: 18,
              spreadRadius: 0,
            ),
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.55),
              offset: const Offset(0, 6),
              blurRadius: 20,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: accent, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.2),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: AnimatedBuilder(
                animation: _float,
                builder: (context, child) {
                  final t = _float.value;
                  final dy = (t - 0.5) * 2 * 3.4;
                  return Transform.translate(
                    offset: Offset(0, -dy),
                    child: child,
                  );
                },
                child: Center(
                  child: Text(
                    _iconChar,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 18,
                      color: accent,
                      height: 1,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              widget.title,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: 10,
                color: Colors.white,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              widget.message,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: 7,
                color: _messageColor,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 20),
            MouseRegion(
              onEnter: (_) => setState(() => _okHovered = true),
              onExit: (_) => setState(() => _okHovered = false),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                transform: Matrix4.identity()
                  ..translate(0.0, _okHovered ? -0.2 * vmin : 0.0),
                constraints: BoxConstraints(minWidth: 10 * vmin),
                padding: EdgeInsets.symmetric(
                  horizontal: 2.5 * vmin,
                  vertical: vmin,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: _okHovered ? 0.10 : 0.06),
                  borderRadius: BorderRadius.circular(0.6 * vmin),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12),
                    width: 0.2 * vmin,
                  ),
                  boxShadow: _okHovered
                      ? [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.35),
                            blurRadius: 1.5 * vmin,
                            spreadRadius: 0,
                          ),
                        ]
                      : null,
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: widget.onOk,
                    borderRadius: BorderRadius.circular(0.6 * vmin),
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: 0.8 * vmin,
                        vertical: 0.2 * vmin,
                      ),
                      child: Text(
                        widget.okLabel,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.pressStart2p(
                          fontSize: (0.9 * vmin).clamp(7.0, 10.0),
                          color: Colors.white,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
