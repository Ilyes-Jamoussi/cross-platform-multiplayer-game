import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/profile_background.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:provider/provider.dart';

/// Explains why maps cannot be created on mobile (no external URL).
class GameCreationNoMapsHelpPage extends StatelessWidget {
  const GameCreationNoMapsHelpPage({super.key});

  static const Color _panelBg = Color(0xFF000116);

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.paddingOf(context).top;
    final primary = context.watch<ThemeService>().primaryColor;
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;

    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: ProfileBackground()),
          ColoredBox(
            color: _panelBg.withValues(alpha: 0.92),
            child: Column(
              children: [
                WebGameFlowHeader(
                  onMenuPressed: () {
                    Navigator.pushNamedAndRemoveUntil(
                      context,
                      AppRoutes.home,
                      (_) => false,
                    );
                  },
                ),
                Expanded(
                  child: SafeArea(
                    top: false,
                    bottom: true,
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        6 * vMin,
                        20,
                        24,
                      ),
                      child: Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 520),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Container(
                                padding: EdgeInsets.all(3 * vMin),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.45),
                                  borderRadius: BorderRadius.circular(2 * vMin),
                                  border: Border.all(color: primary, width: 3),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Text(
                                      I18n().translate('game_creation.no_maps_page_title'),
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: (2.2 * vMin).clamp(10.0, 14.0),
                                        height: 1.4,
                                        color: Colors.white,
                                      ),
                                    ),
                                    SizedBox(height: 3 * vMin),
                                    Text(
                                      I18n().translate('game_creation.no_maps_page_body'),
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: (1.35 * vMin).clamp(8.0, 11.0),
                                        height: 1.65,
                                        color: Colors.white.withValues(alpha: 0.92),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(height: 4 * vMin),
                              Center(
                                child: TextButton(
                                  style: TextButton.styleFrom(
                                    backgroundColor: primary,
                                    foregroundColor: Colors.white,
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 4 * vMin,
                                      vertical: 2 * vMin,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(2 * vMin),
                                    ),
                                  ),
                                  onPressed: () => Navigator.pop(context),
                                  child: Text(
                                    I18n().translate('game_creation.no_maps_back'),
                                    style: GoogleFonts.pressStart2p(
                                      fontSize: (1.4 * vMin).clamp(8.0, 11.0),
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          ),
          Positioned(
            top: topInset + 12,
            right: 20,
            child: const WebGameFlowFloatingActions(),
          ),
        ],
      ),
    );
  }
}
