import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Same structure as the Angular `header.component`: `#000116` background across **the full width
/// and up to the top of the screen** (under the status bar), then title + menu row.
class WebGameFlowHeader extends StatelessWidget {
  const WebGameFlowHeader({super.key, required this.onMenuPressed});

  final VoidCallback onMenuPressed;

  /// `header.component.scss` — `background-color: #000116`
  static const Color barColor = Color(0xFF000116);

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final secondary = theme.secondaryColor;
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;
    final horizontalPad = 2 * vMin;
    final barHeight = (8 * vMin).clamp(52.0, 80.0);
    final topInset = MediaQuery.paddingOf(context).top;

    return Material(
      color: barColor,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(height: topInset),
          SizedBox(
            height: barHeight,
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: horizontalPad),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Center(
                    child: Text(
                      'PolyArena',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.pressStart2p(
                        fontSize: (3 * vMin).clamp(10.0, 16.0),
                        height: 1.15,
                        color: Colors.white,
                        shadows: const [
                          Shadow(
                            blurRadius: 3,
                            offset: Offset(0, 1),
                            color: Colors.black54,
                          ),
                        ],
                      ),
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      style: TextButton.styleFrom(
                        backgroundColor: secondary,
                        foregroundColor: Colors.white,
                        padding: EdgeInsets.symmetric(
                          horizontal: 2 * vMin,
                          vertical: 1 * vMin,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(
                            (0.5 * vMin).clamp(3.0, 8.0),
                          ),
                        ),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      onPressed: onMenuPressed,
                      child: Text(
                        I18n().translate('menu_principal'),
                        style: GoogleFonts.pressStart2p(
                          fontSize: (1.6 * vMin).clamp(7.0, 11.0),
                          height: 1.25,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
