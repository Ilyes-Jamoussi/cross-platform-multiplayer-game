import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../app/i18n.dart';
import '../theme/game_page_overlays.dart';
import '../services/auth_service.dart';
import '../services/friends_service.dart';
import '../services/language_service.dart';
import '../services/theme_service.dart';
import 'avatar_preview.dart';
import 'friends_menu.dart';

/// Avatar menu aligned with `profile-menu.component` (Angular).
/// Colors follow [ThemeService] (rebuild on theme change).
Future<void> showProfileMenu({
  required BuildContext context,
  required AuthService authService,
  required FriendsService friendsService,
}) async {
  OverlayEntry? entry;

  void close() => entry?.remove();

  entry = OverlayEntry(
    builder: (_) => Positioned.fill(
      child: GestureDetector(
        onTap: close,
        child: Container(
          color: Colors.black.withValues(alpha: 0.45),
          child: Stack(
            children: [
              Positioned(
                top: 60,
                right: 12,
                width: 300,
                child: GestureDetector(
                  onTap: () {},
                  child: Material(
                    color: Colors.transparent,
                    child: _ProfileMenuContent(
                      authService: authService,
                      friendsService: friendsService,
                      onClose: close,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  Overlay.of(context).insert(entry);
}

class _ProfileMenuContent extends StatelessWidget {
  const _ProfileMenuContent({
    required this.authService,
    required this.friendsService,
    required this.onClose,
  });

  final AuthService authService;
  final FriendsService friendsService;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final langService = context.watch<LanguageService>();
    final themeService = context.watch<ThemeService>();
    final isFr = langService.lang == 'fr';
    final isBlue = themeService.theme == AppThemeMode.blue;
    final primary = themeService.primaryColor;
    final surface = themeService.primarySurfaceColor;
    final hoverBg = themeService.highlightBgColor;
    final i18n = I18n();

    return Container(
      decoration: BoxDecoration(
        color: surface,
        border: Border.all(color: primary, width: 4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // `.menu-item { border-bottom: 3px solid var(--app-primary) }` sauf dernier.
          Material(
            color: surface,
            child: InkWell(
              onTap: () {
                onClose();
                Navigator.pushNamed(context, '/profile');
              },
              hoverColor: hoverBg,
              splashColor: primary.withValues(alpha: 0.12),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    _DropdownAvatar(
                      avatar: authService.currentUser?.avatar ?? '',
                      primary: primary,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            authService.currentUser?.username ??
                                i18n.translate('profile_menu.profile'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.pressStart2p(
                              fontSize: 9,
                              height: 1.3,
                              color: primary,
                            ),
                          ),
                          if ((authService.currentUser?.email ?? '')
                              .isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              authService.currentUser?.email ?? '',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 7,
                                height: 1.3,
                                color: const Color(0xFF888888),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Text(
                      '›',
                      style: TextStyle(
                        fontSize: 16,
                        color: primary,
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          _PrimaryRowDivider(color: primary),
          Material(
            color: surface,
            child: InkWell(
              onTap: () {
                onClose();
                _openFriendsOverlay(context);
              },
              hoverColor: hoverBg,
              splashColor: primary.withValues(alpha: 0.12),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        i18n.translate('profile_menu.amis'),
                        style: GoogleFonts.pressStart2p(
                          fontSize: 9,
                          height: 1.3,
                          color: primary,
                        ),
                      ),
                    ),
                    Text(
                      '›',
                      style: TextStyle(
                        fontSize: 16,
                        color: primary,
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          _PrimaryRowDivider(color: primary),
          Material(
            color: surface,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      i18n.translate('profile_menu.language'),
                      style: GoogleFonts.pressStart2p(
                        fontSize: 9,
                        height: 1.3,
                        color: primary,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: _ToggleGroup(
                        primary: primary,
                        children: [
                          _ToggleOption(
                            label: 'FR',
                            active: isFr,
                            accentColor: primary,
                            onTap: () => langService.setLang('fr'),
                          ),
                          _ToggleOption(
                            label: 'EN',
                            active: !isFr,
                            accentColor: primary,
                            onTap: () => langService.setLang('en'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _PrimaryRowDivider(color: primary),
          Material(
            color: surface,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      i18n.translate('profile_menu.theme'),
                      style: GoogleFonts.pressStart2p(
                        fontSize: 9,
                        height: 1.3,
                        color: primary,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: _ToggleGroup(
                        primary: primary,
                        children: [
                          _ToggleOption(
                            label: i18n.translate('profile_menu.blue'),
                            active: isBlue,
                            accentColor: primary,
                            onTap: () async {
                              await themeService.setTheme(AppThemeMode.blue);
                              await authService.updateTheme('blue-theme');
                            },
                          ),
                          _ToggleOption(
                            label: i18n.translate('profile_menu.red'),
                            active: !isBlue,
                            accentColor: primary,
                            onTap: () async {
                              await themeService.setTheme(AppThemeMode.red);
                              await authService.updateTheme('red-theme');
                            },
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _PrimaryRowDivider(color: primary),
          _LogoutMenuRow(
            label: i18n.translate('home_page.deconnexion'),
            onLogout: () async {
              try {
                await authService.logout();
                await themeService.setTheme(AppThemeMode.blue);
                if (!context.mounted) return;
                onClose();
                Navigator.pushNamedAndRemoveUntil(
                  context,
                  '/login',
                  (_) => false,
                );
              } catch (e) {
                if (!context.mounted) return;
                showGamePageSnackBar(context, '${I18n().translate('home_page.deconnexion')}: $e', kind: GamePageSnackKind.error);
              }
            },
          ),
        ],
      ),
    );
  }

  void _openFriendsOverlay(BuildContext context) {
    // Modal route (not Overlay.insert): otherwise dialogs always stay behind.
    Navigator.of(context).push<void>(
      PageRouteBuilder<void>(
        opaque: false,
        barrierDismissible: false,
        barrierColor: Colors.transparent,
        transitionDuration: Duration.zero,
        reverseTransitionDuration: Duration.zero,
        pageBuilder: (routeContext, _, _) {
          return ChangeNotifierProvider.value(
            value: friendsService,
            child: FriendsMenu(
              onClose: () => Navigator.of(routeContext).pop(),
              friendsService: friendsService,
            ),
          );
        },
      ),
    );
  }
}

/// Equivalent of `border-bottom: 3px solid var(--app-primary)` on each `.menu-item`.
class _PrimaryRowDivider extends StatelessWidget {
  const _PrimaryRowDivider({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 3,
      width: double.infinity,
      child: ColoredBox(color: color),
    );
  }
}

class _DropdownAvatar extends StatelessWidget {
  const _DropdownAvatar({
    required this.avatar,
    required this.primary,
  });

  final String avatar;
  final Color primary;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        border: Border.all(color: primary, width: 3),
      ),
      clipBehavior: Clip.hardEdge,
      child: Image(
        image: avatarImageProvider(avatar),
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => ColoredBox(
          color: Colors.grey.shade300,
          child: Icon(Icons.person, color: primary.withValues(alpha: 0.5)),
        ),
      ),
    );
  }
}

/// Fixed height (36px) for well-filled segments, like the web client.
class _ToggleGroup extends StatelessWidget {
  const _ToggleGroup({
    required this.primary,
    required this.children,
  });

  final Color primary;
  final List<Widget> children;

  static const double _h = 36;

  @override
  Widget build(BuildContext context) {
    // Same as the web client's `.toggle-group`: 2px border, square corners, overflow hidden.
    return SizedBox(
      width: 158,
      height: _h,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: primary, width: 2),
        ),
        clipBehavior: Clip.hardEdge,
        child: Row(
          children: [
            for (var i = 0; i < children.length; i++) ...[
              if (i > 0)
                Container(
                  width: 2,
                  height: _h,
                  color: primary,
                ),
              Expanded(child: children[i]),
            ],
          ],
        ),
      ),
    );
  }
}

class _ToggleOption extends StatelessWidget {
  const _ToggleOption({
    required this.label,
    required this.active,
    required this.accentColor,
    required this.onTap,
  });

  final String label;
  final bool active;
  final Color accentColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final surface = theme.primarySurfaceColor;
    final activeText = theme.primaryHoverTextColor;
    final hoverBg = theme.highlightBgColor;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        hoverColor: active ? accentColor : hoverBg,
        splashColor: accentColor.withValues(alpha: 0.28),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: double.infinity,
          height: 36,
          color: active ? accentColor : surface,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 7,
              height: 1.2,
              color: active ? activeText : const Color(0xFF999999),
            ),
          ),
        ),
      ),
    );
  }
}

class _LogoutMenuRow extends StatefulWidget {
  const _LogoutMenuRow({
    required this.label,
    required this.onLogout,
  });

  final String label;
  final Future<void> Function() onLogout;

  @override
  State<_LogoutMenuRow> createState() => _LogoutMenuRowState();
}

class _LogoutMenuRowState extends State<_LogoutMenuRow> {
  bool _hover = false;

  static const _red = Color(0xFFDC3545);

  @override
  Widget build(BuildContext context) {
    final surface = context.watch<ThemeService>().primarySurfaceColor;
    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: Material(
        color: _hover ? _red : surface,
        child: InkWell(
          onTap: () => widget.onLogout(),
          splashColor: _red.withValues(alpha: 0.35),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Center(
              child: Text(
                widget.label,
                style: GoogleFonts.pressStart2p(
                  fontSize: 9,
                  height: 1.3,
                  color: _hover ? Colors.white : _red,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
