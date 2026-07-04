import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/music_service.dart';
import 'package:mobile_client/widget/music_toolbar_button.dart';

const double _kMenuWidth = 260;
const double _kMenuMaxHeight = 320;

/// Music dropdown menu aligned with `music-menu.component` (Angular).
Future<void> showMusicMenu({
  required BuildContext context,
  required MusicService musicService,
  required Rect anchorGlobal,
  required Color primaryColor,
}) async {
  final ownedMusics = musicService.getOwnedMusics();
  final currentId = musicService.currentMusicId;
  final i18n = I18n();

  final screen = MediaQuery.sizeOf(context);
  final padding = MediaQuery.paddingOf(context);

  var left = anchorGlobal.right - _kMenuWidth;
  left = left.clamp(8.0, screen.width - _kMenuWidth - 8);
  final top = (anchorGlobal.bottom + 4).clamp(
    padding.top + 4,
    screen.height - 120,
  );

  final selected = await showGeneralDialog<String>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Dismiss',
    barrierColor: Colors.black.withValues(alpha: 0.45),
    transitionDuration: const Duration(milliseconds: 150),
    pageBuilder: (ctx, animation, secondaryAnimation) {
      return Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            left: left,
            top: top,
            width: _kMenuWidth,
            child: Theme(
              data: Theme.of(ctx).copyWith(
                scrollbarTheme: ScrollbarThemeData(
                  thumbColor: WidgetStateProperty.all(primaryColor),
                  trackColor: WidgetStateProperty.all(const Color(0xFF1A1A1A)),
                  thickness: WidgetStateProperty.all(6),
                  radius: const Radius.circular(3),
                  crossAxisMargin: 0,
                ),
              ),
              child: Material(
                color: Colors.transparent,
                child: Container(
                  constraints: const BoxConstraints(maxHeight: _kMenuMaxHeight),
                  decoration: BoxDecoration(
                    color: const Color(0xFF111111),
                    border: Border.all(color: primaryColor, width: 3),
                  ),
                  child: Scrollbar(
                    thumbVisibility: true,
                    child: SingleChildScrollView(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              border: Border(
                                bottom: BorderSide(
                                  color: primaryColor,
                                  width: 2,
                                ),
                              ),
                            ),
                            child: Text(
                              i18n.translate('music_menu.title'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 9,
                                height: 1.3,
                                color: primaryColor,
                              ),
                            ),
                          ),
                          _MusicMenuRow(
                            primaryColor: primaryColor,
                            selected: currentId == musicOffId,
                            bottomBorder: BorderSide(
                              color: const Color(0xFF222222),
                              width: 1,
                            ),
                            icon: const CustomPaint(
                              size: Size(16, 16),
                              painter: MusicOffIconPainter(menuStyle: true),
                            ),
                            label: i18n.translate('music_menu.off'),
                            onTap: () => Navigator.of(ctx).pop(musicOffId),
                          ),
                          Container(
                            height: 2,
                            color: const Color(0xFF333333),
                          ),
                          for (var i = 0; i < ownedMusics.length; i++)
                            _MusicMenuRow(
                              primaryColor: primaryColor,
                              selected: currentId == ownedMusics[i].id,
                              bottomBorder: i < ownedMusics.length - 1
                                  ? const BorderSide(
                                      color: Color(0xFF222222),
                                      width: 1,
                                    )
                                  : BorderSide.none,
                              icon: CustomPaint(
                                size: const Size(16, 16),
                                painter: MusicNoteIconPainter(
                                  color: Colors.white,
                                ),
                              ),
                              label: i18n.cosmeticLabel(ownedMusics[i].name),
                              onTap: () =>
                                  Navigator.of(ctx).pop(ownedMusics[i].id),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    },
    transitionBuilder: (ctx, anim, _, child) {
      return FadeTransition(opacity: anim, child: child);
    },
  );

  if (selected != null && selected != currentId) {
    await musicService.changeMusic(selected);
  }
}

class _MusicMenuRow extends StatelessWidget {
  const _MusicMenuRow({
    required this.primaryColor,
    required this.selected,
    required this.bottomBorder,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final Color primaryColor;
  final bool selected;
  final BorderSide bottomBorder;
  final Widget icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? primaryColor : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        hoverColor: primaryColor.withValues(alpha: 0.15),
        splashColor: primaryColor.withValues(alpha: 0.2),
        child: Container(
          decoration: bottomBorder.width > 0
              ? BoxDecoration(
                  border: Border(bottom: bottomBorder),
                )
              : null,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              SizedBox(width: 16, height: 16, child: icon),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 8,
                    height: 1.3,
                    color: Colors.white,
                  ),
                ),
              ),
              if (selected)
                Text(
                  '✓',
                  style: GoogleFonts.pressStart2p(
                    fontSize: 10,
                    height: 1,
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
