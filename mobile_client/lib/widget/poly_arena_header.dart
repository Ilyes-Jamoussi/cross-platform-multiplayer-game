import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/chat_channel_service.dart';
import 'package:mobile_client/services/chat_service.dart';
import 'package:mobile_client/services/friends_service.dart';
import 'package:mobile_client/services/socket_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/avatar_button.dart';
import 'package:mobile_client/services/music_service.dart';
import 'package:mobile_client/widget/icon_button.dart';
import 'package:mobile_client/widget/music_menu.dart';
import 'package:mobile_client/widget/music_toolbar_button.dart';
import 'package:mobile_client/widget/poly_arena_chat_dialog.dart';
import 'package:mobile_client/widget/profile_menu.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Shared top bar (menu, PolyArena title, coins, chat, sound, profile).
class PolyArenaHeader extends StatelessWidget {
  const PolyArenaHeader({
    super.key,
    required this.onMenuPressed,
    this.menuLabelKey = 'menu_principal',
    this.titleKey = 'game_creation.title',
    this.showBlackBackground = true,
  });

  final VoidCallback onMenuPressed;
  final String menuLabelKey;
  final String titleKey;
  final bool showBlackBackground;

  static const Color borderBlue = Color(0xFF1E5BB8);

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final friendsService = context.read<FriendsService>();
    final chatService = context.read<ChatService>();
    final chatChannelService = context.read<ChatChannelService>();
    final socketService = context.read<SocketService>();
    final musicService = context.watch<MusicService>();
    final currency = authService.currentUser?.virtualCurrency ?? 0;
    final accent = context.watch<ThemeService>().primaryColor;

    final content = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      child: Row(
        children: [
          TextButton(
            style: TextButton.styleFrom(
              backgroundColor: accent,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
              ),
            ),
            onPressed: onMenuPressed,
            child: Text(
              I18n().translate(menuLabelKey),
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 11,
              ),
            ),
          ),
          Expanded(
            child: Text(
              I18n().translate(titleKey),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w900,
                letterSpacing: 0.8,
                shadows: [Shadow(blurRadius: 4, color: Colors.black54)],
              ),
            ),
          ),
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/shop'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🪙', style: TextStyle(fontSize: 15)),
                        const SizedBox(width: 4),
                        Text(
                          '$currency',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                TopIconButton(
                  icon: Icons.chat_bubble_outline,
                  onPressed: () async {
                    if (!socketService.isConnected) {
                      showGamePageSnackBar(
                        context,
                        I18n().translate('home_page.chat_indisponible'),
                        kind: GamePageSnackKind.warning,
                      );
                      return;
                    }
                    await showPolyArenaChatDialog(
                      context: context,
                      authService: authService,
                      borderBlue: accent,
                      chatService: chatService,
                      chatChannelService: chatChannelService,
                    );
                  },
                ),
                const SizedBox(width: 4),
                MusicToolbarButton(
                  primary: accent,
                  musicService: musicService,
                  onOpenMenu: (anchor) {
                    showMusicMenu(
                      context: context,
                      musicService: musicService,
                      anchorGlobal: anchor,
                      primaryColor: accent,
                    );
                  },
                ),
                const SizedBox(width: 4),
                AvatarIconButton(
                  avatarAssetPath: authService.currentUser?.avatar,
                  onPressed: () {
                    showProfileMenu(
                      context: context,
                      authService: authService,
                      friendsService: friendsService,
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (!showBlackBackground) {
      return content;
    }

    return ColoredBox(
      color: Colors.black,
      child: content,
    );
  }
}
