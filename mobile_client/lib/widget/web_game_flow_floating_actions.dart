import 'package:flutter/material.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/chat_channel_service.dart';
import 'package:mobile_client/services/chat_service.dart';
import 'package:mobile_client/services/music_service.dart';
import 'package:mobile_client/services/socket_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/music_menu.dart';
import 'package:mobile_client/widget/music_toolbar_button.dart';
import 'package:mobile_client/widget/poly_arena_chat_dialog.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Music + chat at the top right (same layout as the web client outside the home page).
class WebGameFlowFloatingActions extends StatelessWidget {
  const WebGameFlowFloatingActions({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final auth = context.read<AuthService>();
    final socket = context.read<SocketService>();
    final chat = context.read<ChatService>();
    final channels = context.read<ChatChannelService>();
    final music = context.watch<MusicService>();
    final accent = theme.primaryColor;

    return Material(
      type: MaterialType.transparency,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          MusicToolbarButton(
            primary: accent,
            musicService: music,
            onOpenMenu: (anchor) {
              showMusicMenu(
                context: context,
                musicService: context.read<MusicService>(),
                anchorGlobal: anchor,
                primaryColor: accent,
              );
            },
          ),
          const SizedBox(width: 10),
          WebGameFlowChatToolbarButton(
            accent: accent,
            showGlow: music.currentMusicId != musicOffId,
            onPressed: () async {
              if (!socket.isConnected) {
                showGamePageSnackBar(context, I18n().translate('home_page.chat_indisponible'), kind: GamePageSnackKind.warning);
                return;
              }
              await showPolyArenaChatDialog(
                context: context,
                authService: auth,
                borderBlue: accent,
                chatService: chat,
                chatChannelService: channels,
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Same template as [MusicToolbarButton]: 40×40, 70% black background, [accent] border, white icon.
class WebGameFlowChatToolbarButton extends StatelessWidget {
  const WebGameFlowChatToolbarButton({
    super.key,
    required this.accent,
    required this.showGlow,
    required this.onPressed,
  });

  final Color accent;
  final bool showGlow;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        await onPressed();
      },
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.7),
          shape: BoxShape.circle,
          border: Border.all(color: accent, width: 2),
          boxShadow: showGlow
              ? [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.4),
                    blurRadius: 10,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: const Icon(
          Icons.chat_bubble_outline,
          color: Colors.white,
          size: 20,
        ),
      ),
    );
  }
}
