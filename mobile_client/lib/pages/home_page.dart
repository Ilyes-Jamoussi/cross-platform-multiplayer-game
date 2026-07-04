import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/services/friends_service.dart';
import 'package:mobile_client/services/language_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/services/tutorial_service.dart';
import 'package:mobile_client/widget/avatar_button.dart';
import 'package:mobile_client/widget/coin_icon.dart';
import 'package:mobile_client/widget/icon_button.dart';
import 'package:mobile_client/widget/poly_arena_chat_dialog.dart';
import 'package:mobile_client/widget/profile_menu.dart';
import 'package:mobile_client/widget/music_menu.dart';
import 'package:mobile_client/widget/music_toolbar_button.dart';
import 'package:mobile_client/widget/tutorial_overlay.dart';
import 'package:provider/provider.dart';

import '../theme/game_page_overlays.dart';
import '../services/auth_service.dart';
import '../services/chat_channel_service.dart';
import '../services/chat_service.dart';
import '../services/music_service.dart';
import '../services/socket_service.dart';

/// Home page — aligned with the web client (`main-page` + floating `app.component` actions).
class HomePage extends StatefulWidget {
  const HomePage({super.key, this.pendingRewardDelta});

  /// End-of-game reward: shop balance animation when arriving on the home page.
  final int? pendingRewardDelta;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> with SingleTickerProviderStateMixin {
  /// Aligned with `SHOP_CURRENCY_FEEDBACK_MS` + `float-up` (`shop-menu.component.scss`).
  static const Duration _kCurrencyFloatDuration = Duration(milliseconds: 2000);

  /// Shop button border + coins (`shop-menu.component.scss`, not `--app-primary`).
  static const Color _shopMenuGold = Color(0xFFE6B830);

  bool _tutorialFetched = false;
  bool _friendsRegistered = false;
  bool _musicStarted = false;
  AnimationController? _currencyFloatController;
  int? _currencyFloatAmount;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _startPendingCurrencyFloatFeedback();
    });
  }

  /// Same effect as the web client: `+X` text above the balance, floats up and fades.
  void _startPendingCurrencyFloatFeedback() {
    final d = widget.pendingRewardDelta;
    if (d == null || d <= 0) return;

    _currencyFloatController?.dispose();
    _currencyFloatController = AnimationController(
      vsync: this,
      duration: _kCurrencyFloatDuration,
    );
    setState(() => _currencyFloatAmount = d);
    _currencyFloatController!.forward().then((_) {
      if (!mounted) return;
      setState(() => _currencyFloatAmount = null);
      _currencyFloatController?.dispose();
      _currencyFloatController = null;
    });
  }

  @override
  void dispose() {
    _currencyFloatController?.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_tutorialFetched) {
      _tutorialFetched = true;
      context.read<TutorialService>().fetchProgress();
    }
    if (!_friendsRegistered) {
      _friendsRegistered = true;
      context.read<FriendsService>().registerFriendSocket();
    }
    if (!_musicStarted) {
      _musicStarted = true;
      // Avoids notifyListeners() during build (MusicService.startFromProfile).
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.read<MusicService>().startFromProfile();
      });
    }
  }

  void _onTutorialNext() {
    context.read<TutorialService>().nextStep();
  }

  void _onTutorialDismiss() {
    context.read<TutorialService>().dismiss();
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final chatService = context.read<ChatService>();
    final chatChannelService = context.read<ChatChannelService>();
    final socketService = context.read<SocketService>();
    final friendsService = context.read<FriendsService>();
    final musicService = context.watch<MusicService>();
    final tutorialService = context.watch<TutorialService>();
    final themeService = context.watch<ThemeService>();
    // Rebuild when the language changes from the profile menu (no dedicated button here).
    context.watch<LanguageService>();
    final primary = themeService.primaryColor;
    final displayedCoins = authService.currentUser?.virtualCurrency ?? 0;
    final pad = MediaQuery.paddingOf(context);
    final backgroundAsset = themeService.theme == AppThemeMode.red
        ? 'assets/dark_theme_background.gif'
        : 'assets/gif_stats.gif';

    const teamFooter =
        'Rafai Adam, Brière Simon, Chauret-Décoste Scotty, Faraoni William, '
        'Jamoussi Ilyes, Kanga Jaures';

    /// Like `app.component.html`: shop, music, chat, profile (left → right).
    final floatingChildren = <Widget>[
      Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => Navigator.pushNamed(context, AppRoutes.shop),
          borderRadius: BorderRadius.circular(20),
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 15),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(20),
              border: const Border.fromBorderSide(
                BorderSide(color: _shopMenuGold, width: 2),
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CoinIcon(color: _shopMenuGold, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      '$displayedCoins',
                      style: GoogleFonts.pressStart2p(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _shopMenuGold,
                      ),
                    ),
                  ],
                ),
                if (_currencyFloatAmount != null &&
                    _currencyFloatController != null)
                  Positioned(
                    top: -10,
                    right: 10,
                    child: IgnorePointer(
                      child: AnimatedBuilder(
                        animation: _currencyFloatController!,
                        builder: (context, child) {
                          final curved = Curves.easeOut.transform(
                            _currencyFloatController!.value,
                          );
                          return Transform.translate(
                            offset: Offset(0, -40 * curved),
                            child: Opacity(
                              opacity: 1.0 - curved,
                              child: Text(
                                '+${_currencyFloatAmount!}',
                                style: GoogleFonts.pressStart2p(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: const Color(0xFF00FF00),
                                  height: 1.2,
                                  shadows: const [
                                    Shadow(
                                      blurRadius: 5,
                                      color: Color(0xFF00FF00),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
      MusicToolbarButton(
        primary: primary,
        musicService: musicService,
        onOpenMenu: (anchor) {
          showMusicMenu(
            context: context,
            musicService: musicService,
            anchorGlobal: anchor,
            primaryColor: primary,
          );
        },
      ),
      TopIconButton(
        icon: Icons.chat_bubble_outline,
        backgroundColor: Colors.black.withValues(alpha: 0.7),
        borderColor: primary,
        iconColor: Colors.white,
        onPressed: () async {
          if (!socketService.isConnected) {
            showGamePageSnackBar(context, I18n().translate('home_page.chat_indisponible'), kind: GamePageSnackKind.warning);
            return;
          }
          await showPolyArenaChatDialog(
            context: context,
            authService: authService,
            borderBlue: primary,
            chatService: chatService,
            chatChannelService: chatChannelService,
          );
        },
      ),
      AvatarIconButton(
        avatarAssetPath: authService.currentUser?.avatar,
        backgroundColor: Colors.black.withValues(alpha: 0.5),
        borderColor: primary,
        onPressed: () {
          showProfileMenu(
            context: context,
            authService: authService,
            friendsService: friendsService,
          );
        },
      ),
    ];

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.black,
      body: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              child: ColoredBox(
                color: Colors.black,
                child: Image.asset(
                  backgroundAsset,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  alignment: Alignment.center,
                ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                pad.left,
                pad.top,
                pad.right,
                pad.bottom,
              ),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final shortest = math.min(
                    constraints.maxWidth,
                    constraints.maxHeight,
                  );
                  final vmin = shortest / 100.0;
                  final logoW = shortest * 0.6;
                  final btnW =
                      math.min(45 * vmin, constraints.maxWidth * 0.94);
                  final btnH = (10 * vmin).clamp(48.0, 120.0);
                  final gap = (2 * vmin).clamp(8.0, 20.0);
                  final radius = (5 * vmin).clamp(16.0, 48.0);
                  final borderW = (0.5 * vmin).clamp(1.5, 4.0);
                  final fs = (1.5 * vmin).clamp(9.0, 14.0);
                  final footerFs = (1 * vmin).clamp(7.0, 11.0);

                  return SizedBox(
                    width: constraints.maxWidth,
                    height: constraints.maxHeight,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SizedBox(
                          width: logoW,
                          child: Image.asset(
                            'assets/logo.png',
                            fit: BoxFit.contain,
                          ),
                        ),
                        Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _MainPageMenuButton(
                              label: I18n().translate('home_page.joindre'),
                              width: btnW,
                              height: btnH,
                              fontSize: fs,
                              borderRadius: radius,
                              borderWidth: borderW,
                              themeMode: themeService.theme,
                              primary: primary,
                              onPressed: () => Navigator.pushNamed(
                                context,
                                AppRoutes.joinGame,
                              ),
                            ),
                            SizedBox(height: gap),
                            _MainPageMenuButton(
                              label: I18n().translate('home_page.creer'),
                              width: btnW,
                              height: btnH,
                              fontSize: fs,
                              borderRadius: radius,
                              borderWidth: borderW,
                              themeMode: themeService.theme,
                              primary: primary,
                              onPressed: () => Navigator.pushNamed(
                                context,
                                AppRoutes.createGame,
                              ),
                            ),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '${I18n().translate('home_page.equipe')} 206',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.pressStart2p(
                                  fontSize: footerFs,
                                  color: const Color(0xFFFFA500),
                                  height: 1.4,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                teamFooter,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.pressStart2p(
                                  fontSize: footerFs,
                                  color: const Color(0xFFFFA500),
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          Positioned(
            top: 20 + pad.top,
            right: 20 + pad.right,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < floatingChildren.length; i++) ...[
                  if (i > 0) const SizedBox(width: 10),
                  floatingChildren[i],
                ],
              ],
            ),
          ),
          if (tutorialService.shouldShowTutorial)
            Positioned.fill(
              child: TutorialOverlay(
                step: tutorialService.currentStep,
                onNext: _onTutorialNext,
                onDismiss: _onTutorialDismiss,
              ),
            ),
        ],
      ),
    );
  }
}

class _MainPageMenuButton extends StatelessWidget {
  final String label;
  final double width;
  final double height;
  final double fontSize;
  final double borderRadius;
  final double borderWidth;
  final AppThemeMode themeMode;
  final Color primary;
  final VoidCallback? onPressed;

  const _MainPageMenuButton({
    required this.label,
    required this.width,
    required this.height,
    required this.fontSize,
    required this.borderRadius,
    required this.borderWidth,
    required this.themeMode,
    required this.primary,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    final bg = themeMode == AppThemeMode.blue ? Colors.white : Colors.black;
    final fg = themeMode == AppThemeMode.blue ? Colors.black : Colors.white;

    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(borderRadius),
        side: BorderSide(color: primary, width: borderWidth),
      ),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(borderRadius),
        child: SizedBox(
          width: width,
          height: height,
          child: Center(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: fontSize * 0.8),
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.pressStart2p(
                  fontSize: fontSize,
                  color: fg,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
