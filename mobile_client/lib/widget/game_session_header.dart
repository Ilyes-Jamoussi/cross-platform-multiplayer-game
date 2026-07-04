import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/chat_channel_service.dart';
import 'package:mobile_client/services/chat_service.dart';
import 'package:mobile_client/services/music_service.dart';
import 'package:mobile_client/services/socket_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/icon_button.dart';
import 'package:mobile_client/widget/music_menu.dart';
import 'package:mobile_client/widget/music_toolbar_button.dart';
import 'package:mobile_client/widget/poly_arena_chat_dialog.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Top bar in game: music then chat, same styles as [HomePage] (floating).
class GameSessionHeader extends StatelessWidget {
  const GameSessionHeader({super.key});

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final chatService = context.read<ChatService>();
    final chatChannelService = context.read<ChatChannelService>();
    final socketService = context.read<SocketService>();
    final musicService = context.watch<MusicService>();
    final themeService = context.watch<ThemeService>();
    final primary = themeService.primaryColor;
    final i18n = I18n();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        children: [
          const Spacer(),
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
          const SizedBox(width: 10),
          TopIconButton(
            icon: Icons.chat_bubble_outline,
            backgroundColor: Colors.black.withValues(alpha: 0.7),
            borderColor: primary,
            iconColor: Colors.white,
            onPressed: () async {
              if (!socketService.isConnected) {
                showGamePageSnackBar(context, i18n.translate('home_page.chat_indisponible'), kind: GamePageSnackKind.warning);
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
        ],
      ),
    );
  }
}
