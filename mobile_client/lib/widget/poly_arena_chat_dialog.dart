import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/chat_channel.dart';
import 'package:mobile_client/models/chat_type.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/chat_channel_service.dart';
import 'package:mobile_client/services/chat_service.dart';
import 'package:mobile_client/services/shake_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/poly_arena_chat_icons.dart';
import 'package:mobile_client/widget/poly_arena_confirm_popup.dart';
import 'package:provider/provider.dart';

/// Couleurs chat : `blue-theme` clair, `red-theme` sombre (`styles.scss`).
class PolyChatPalette {
  PolyChatPalette({required this.isBlue});
  final bool isBlue;

  Color get chatOverlay =>
      isBlue ? const Color(0xFFF0F0F0) : const Color(0xFF000000);
  Color get chatSurface =>
      isBlue ? const Color(0xFFEBEBEB) : const Color(0xFF1A1A1A);
  Color get chatBorder =>
      isBlue ? const Color(0xFFD0D0D0) : const Color(0xFF222222);
  Color get primaryText => isBlue ? const Color(0xFF000000) : Colors.white;
  Color get modalSurface =>
      isBlue ? const Color(0xFFFFFFFF) : const Color(0xFF111111);

  Color get mainTabHeaderBg => isBlue ? Colors.white : const Color(0xFF1A1A1A);

  Color get addChannelBackground => isBlue ? Colors.white : Colors.black;
  Color get addChannelForeground =>
      isBlue ? const Color(0xFF000000) : Colors.white;

  Color get sendDisabledBg =>
      isBlue ? const Color(0xFFEBEBEB) : const Color(0xFF333333);
  Color get sendDisabledBorder =>
      isBlue ? const Color(0xFFD0D0D0) : const Color(0xFF222222);

  Color get sendDisabledIcon => const Color(0xFF888888);

  Color get ownBubbleBorder => isBlue ? const Color(0xFF000000) : Colors.white;

  static const muted99 = Color(0xFF999999);
  static const muted66 = Color(0xFF666666);
  static const deleteHover = Color(0xFFFF4444);
}

enum _MainChatTab { global, channels }

/// Global chat + channels dialog (equivalent of the Angular `chat-external-page`, without windowed mode).
Future<void> showPolyArenaChatDialog({
  required BuildContext context,
  required AuthService authService,
  required Color borderBlue,
  required ChatService chatService,
  required ChatChannelService chatChannelService,
}) async {
  await showGeneralDialog<void>(
    context: context,
    barrierDismissible: false,
    barrierLabel: 'Chat',
    barrierColor: Colors.black.withValues(alpha: 0.35),
    pageBuilder: (dialogContext, animation, secondaryAnimation) {
      return SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  FocusScope.of(dialogContext).unfocus();
                  Navigator.of(dialogContext).pop();
                },
                child: const SizedBox.expand(),
              ),
            ),
            Positioned(
              top: 56,
              right: 12,
              left: null,
              bottom: 0,
              child: Material(
                color: Colors.transparent,
                child: _PolyArenaChatDialogBody(
                  borderBlue: borderBlue,
                  authService: authService,
                  chatService: chatService,
                  chatChannelService: chatChannelService,
                ),
              ),
            ),
          ],
        ),
      );
    },
    transitionDuration: const Duration(milliseconds: 140),
    transitionBuilder: (context, animation, _, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.98, end: 1).animate(curved),
          child: child,
        ),
      );
    },
  );
}

String _formatChannelSystemContent(String content) {
  try {
    final decoded = jsonDecode(content);
    if (decoded is Map && decoded['key'] != null) {
      final key = decoded['key'] as String;
      final paramsRaw = decoded['params'];
      final params = <String, String>{};
      if (paramsRaw is Map) {
        paramsRaw.forEach((k, v) {
          params[k.toString()] = v?.toString() ?? '';
        });
      }
      return I18n().translateWithParams(key, params);
    }
  } catch (_) {
    if (content.startsWith('server_msg.')) {
      return I18n().translate(content);
    }
  }
  return content;
}

String _translateChannelError(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  if (raw.startsWith('server_msg.')) {
    return I18n().translate(raw);
  }
  return raw;
}

class _PolyArenaChatDialogBody extends StatefulWidget {
  const _PolyArenaChatDialogBody({
    required this.borderBlue,
    required this.authService,
    required this.chatService,
    required this.chatChannelService,
  });

  final Color borderBlue;
  final AuthService authService;
  final ChatService chatService;
  final ChatChannelService chatChannelService;

  @override
  State<_PolyArenaChatDialogBody> createState() =>
      _PolyArenaChatDialogBodyState();
}

class _PolyArenaChatDialogBodyState extends State<_PolyArenaChatDialogBody> {
  String _selectedEmoji = '😂';
  final List<String> _emojis = ['😂', '🔥', '❤️', '😮', '😈'];
  bool _hasSentMessage = false;

  String? _lastSentMessage;

  late final TextEditingController _controller;
  late final ScrollController _globalScrollController;
  late final ScrollController _channelScrollController;
  late final FocusNode _inputFocusNode;
  late final ShakeService _shakeService;

  _MainChatTab _mainTab = _MainChatTab.global;
  ChatChannelInfo? _activeChannel;
  bool _channelScrollSnapPending = false;
  final TextEditingController _filterController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _globalScrollController = ScrollController();
    _channelScrollController = ScrollController();
    _inputFocusNode = FocusNode();
    _inputFocusNode.addListener(() {
      if (mounted) setState(() {});
    });

    _shakeService = ShakeService();
    _shakeService.onVerticalShake = _resendLastMessage;
    _shakeService.onHorizontalShake = _sendEmoji;
    _shakeService.start();

    widget.chatChannelService.addListener(_onChannelServiceUpdate);
  }

  void _onChannelServiceUpdate() {
    final ch = _activeChannel;
    if (ch != null &&
        !widget.chatChannelService.joinedChannels.any((c) => c.id == ch.id)) {
      if (mounted) {
        setState(() => _activeChannel = null);
      }
    }
  }

  @override
  void dispose() {
    widget.chatChannelService.removeListener(_onChannelServiceUpdate);
    _shakeService.stop();
    _inputFocusNode.unfocus();
    _controller.dispose();
    _globalScrollController.dispose();
    _channelScrollController.dispose();
    _inputFocusNode.dispose();
    _filterController.dispose();
    super.dispose();
  }

  void _onFirstMessageSent() {
    if (_hasSentMessage) return;
    _hasSentMessage = true;
    setState(() => _selectedEmoji = _emojis.first);
  }

  void _selectMainTab(_MainChatTab tab) {
    setState(() {
      _mainTab = tab;
      if (tab == _MainChatTab.global) {
        _activeChannel = null;
      } else {
        _activeChannel = null;
      }
    });
  }

  void _openChannel(ChatChannelInfo channel) {
    setState(() {
      _activeChannel = channel;
      _channelScrollSnapPending = true;
    });
    widget.chatChannelService.retrieveChannelMessages(channel.id);
  }

  void _backToChannelList() {
    setState(() {
      _activeChannel = null;
      _channelScrollSnapPending = false;
    });
  }

  void _sendEmoji() {
    if (_selectedEmoji.isEmpty) return;
    if (_mainTab == _MainChatTab.global) {
      _sendGlobal(_selectedEmoji);
    } else if (_activeChannel != null) {
      _sendChannel(_selectedEmoji);
    }
    _lastSentMessage = _selectedEmoji;
    _onFirstMessageSent();
  }

  void _resendLastMessage() {
    if (_lastSentMessage == null || _lastSentMessage!.isEmpty) return;
    if (_mainTab == _MainChatTab.global) {
      _sendGlobal(_lastSentMessage!);
    } else if (_activeChannel != null) {
      _sendChannel(_lastSentMessage!);
    }
  }

  void _sendGlobal(String text) {
    _sendMessageRaw(text, send: (c) => widget.chatService.sendMessage(c));
  }

  void _sendChannel(String text) {
    final id = _activeChannel?.id;
    if (id == null) return;
    _sendMessageRaw(
      text,
      send: (c) => widget.chatChannelService.sendChannelMessage(id, c),
    );
  }

  void _sendMessageRaw(String content, {required void Function(String) send}) {
    if (content.trim().isEmpty) return;
    send(content);
    _controller.clear();
  }

  Future<void> _confirmDeleteChannel(ChatChannelInfo ch) async {
    final ok = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'popup.delete_channel_title',
      messageKey: 'popup.delete_channel_message',
    );
    if (ok && mounted) {
      widget.chatChannelService.closeChannel(ch.id);
    }
  }

  Future<void> _confirmLeaveChannel(ChatChannelInfo ch) async {
    final ok = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'popup.leave_channel_title',
      messageKey: 'popup.leave_channel_message',
    );
    if (ok && mounted) {
      widget.chatChannelService.leaveChannel(ch.id);
    }
  }

  void _openChannelJoinCreateSheet() {
    widget.chatChannelService.clearChannelError();
    final primary = widget.borderBlue;
    final sheetPalette = PolyChatPalette(
      isBlue: context.read<ThemeService>().isBlue,
    );
    showDialog<void>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (ctx) {
        final mq = MediaQuery.of(ctx);
        // Aligned with the web client: .modal { width: 400px; max-height: 500px; }
        final maxW = math.min(400.0, mq.size.width - 32);
        return Dialog(
          backgroundColor: Colors.transparent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 24,
          ),
          child: Builder(
            builder: (ctx2) {
              final viewInsets = MediaQuery.viewInsetsOf(ctx2);
              final maxSheetH = math.min(
                500.0,
                (mq.size.height - 48).clamp(120.0, double.infinity),
              );
              return AnimatedPadding(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeOutCubic,
                padding: EdgeInsets.only(bottom: viewInsets.bottom),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: maxW,
                    maxHeight: maxSheetH,
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      color: sheetPalette.modalSurface,
                      border: Border.all(color: primary, width: 4),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: _ChannelJoinCreateSheet(
                      borderBlue: primary,
                      channelService: widget.chatChannelService,
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  List<ChatChannelInfo> _filteredJoined() {
    final q = _filterController.text.trim().toLowerCase();
    final list = widget.chatChannelService.joinedChannels;
    if (q.isEmpty) return List<ChatChannelInfo>.from(list);
    return list
        .where((c) => c.name.toLowerCase().startsWith(q))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final palette = PolyChatPalette(
      isBlue: context.watch<ThemeService>().isBlue,
    );
    final viewInsets = MediaQuery.of(context).viewInsets;
    final screenW = MediaQuery.sizeOf(context).width;
    final panelW = math.min(400.0, screenW - 24);

    return SizedBox(
      width: panelW,
      height: double.infinity,
      child: Container(
        decoration: BoxDecoration(
          color: palette.chatOverlay,
          borderRadius: BorderRadius.circular(4),
          border: Border.all(color: widget.borderBlue, width: 4),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            _buildHeader(palette),
            Expanded(child: _buildMainBody(palette)),
            if (_showEmojiAndInput)
              AnimatedPadding(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                padding: EdgeInsets.only(bottom: viewInsets.bottom),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _emojiBar(widget.borderBlue, palette),
                    _buildInputRow(palette),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool get _showEmojiAndInput {
    if (_mainTab == _MainChatTab.global) return true;
    return _activeChannel != null;
  }

  Widget _buildHeader(PolyChatPalette palette) {
    final i18n = I18n();
    final primary = widget.borderBlue;
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: palette.mainTabHeaderBg,
        border: Border(bottom: BorderSide(color: primary, width: 4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: _mainTabButton(
              label: i18n.translate('chat_global.chat_global'),
              selected: _mainTab == _MainChatTab.global,
              icon: PolyArenaChatIcons.globe(
                16,
                _mainTab == _MainChatTab.global
                    ? primary
                    : PolyChatPalette.muted99,
              ),
              onTap: () => _selectMainTab(_MainChatTab.global),
            ),
          ),
          Expanded(
            child: _mainTabButton(
              label: i18n.translate('channel_chat.channels'),
              selected: _mainTab == _MainChatTab.channels,
              icon: PolyArenaChatIcons.channelsTab(
                16,
                _mainTab == _MainChatTab.channels
                    ? primary
                    : PolyChatPalette.muted99,
              ),
              onTap: () => _selectMainTab(_MainChatTab.channels),
            ),
          ),
          Center(
            child: InkWell(
              onTap: () {
                FocusScope.of(context).unfocus();
                Navigator.of(context).pop();
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                child: Text(
                  '✕',
                  style: GoogleFonts.pressStart2p(
                    fontSize: 14,
                    color: primary,
                    height: 1,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _mainTabButton({
    required String label,
    required bool selected,
    required Widget icon,
    required VoidCallback onTap,
  }) {
    final primary = widget.borderBlue;
    return InkWell(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? primary : Colors.transparent,
              width: 4,
            ),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            icon,
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                style: GoogleFonts.pressStart2p(
                  fontSize: 10,
                  height: 1.2,
                  color: selected ? primary : PolyChatPalette.muted99,
                ),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMainBody(PolyChatPalette palette) {
    if (_mainTab == _MainChatTab.global) {
      return _buildGlobalMessages(palette);
    }
    if (_activeChannel == null) {
      return _buildChannelList(palette);
    }
    return _buildChannelConversation(palette);
  }

  Widget _buildGlobalMessages(PolyChatPalette palette) {
    final i18n = I18n();
    return Container(
      color: palette.chatOverlay,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      child: AnimatedBuilder(
        animation: widget.chatService,
        builder: (context, child) {
          final messages = widget.chatService.messages;
          if (messages.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Opacity(
                    opacity: 0.3,
                    child: PolyArenaChatIcons.emptyChatBubble(
                      48,
                      palette.primaryText,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    i18n.translate('chat_global.aucun_message'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: 10,
                      color: palette.primaryText,
                      height: 1.4,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          _scrollChatToEnd(_globalScrollController);
          return ListView.builder(
            controller: _globalScrollController,
            itemCount: messages.length,
            itemBuilder: (context, index) {
              final msg = messages[index];
              final isMe =
                  msg.username ==
                  (widget.authService.currentUser?.username ?? '');
              return polyArenaChatBubble(
                msg,
                isMe: isMe,
                borderBlue: widget.borderBlue,
                palette: palette,
              );
            },
          );
        },
      ),
    );
  }

  void _scrollChatToEnd(ScrollController scroll) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (!scroll.hasClients) return;
        try {
          final position = scroll.position;
          if (position.maxScrollExtent > position.pixels) {
            scroll.jumpTo(position.maxScrollExtent);
          }
        } catch (_) {}
      });
    });
  }

  /// Channel list: chronological order (top → bottom). Snaps to the bottom on open
  /// or after loading; otherwise only follows if the user is already near the bottom.
  void _syncChannelScroll(List<ChatChannelMessage> messages) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final scroll = _channelScrollController;
        if (!scroll.hasClients) return;
        try {
          final p = scroll.position;
          if (_channelScrollSnapPending) {
            if (messages.isEmpty) return;
            scroll.jumpTo(p.maxScrollExtent);
            _channelScrollSnapPending = false;
            return;
          }
          const nearBottom = 96.0;
          if (p.maxScrollExtent - p.pixels <= nearBottom) {
            scroll.jumpTo(p.maxScrollExtent);
          }
        } catch (_) {}
      });
    });
  }

  Widget _buildChannelList(PolyChatPalette palette) {
    final i18n = I18n();
    final primary = widget.borderBlue;
    return Container(
      color: palette.chatOverlay,
      child: AnimatedBuilder(
        animation: widget.chatChannelService,
        builder: (context, _) {
          final notifications = widget.chatChannelService.deletedNotifications;
          final filtered = _filteredJoined();
          return ListView(
            padding: EdgeInsets.zero,
            children: [
              for (final n in notifications)
                _DeletedChannelBanner(
                  notification: n,
                  borderBlue: primary,
                  onDismiss: () => widget.chatChannelService
                      .dismissDeletedNotification(n.channelName),
                ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(color: palette.chatBorder, width: 2),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _filterController,
                        onChanged: (_) => setState(() {}),
                        style: GoogleFonts.pressStart2p(
                          fontSize: 8,
                          color: palette.primaryText,
                          height: 1.3,
                        ),
                        decoration: InputDecoration(
                          hintText: i18n.translate('channel_chat.filter'),
                          hintStyle: GoogleFonts.pressStart2p(
                            fontSize: 8,
                            color: PolyChatPalette.muted66,
                          ),
                          isDense: true,
                          filled: true,
                          fillColor: palette.chatSurface,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 10,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(4),
                            borderSide: BorderSide(color: primary, width: 2),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(4),
                            borderSide: BorderSide(color: primary, width: 2),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Tooltip(
                      message: i18n.translate('channel_chat.add_channel'),
                      child: Material(
                        color: palette.addChannelBackground,
                        shape: CircleBorder(
                          side: BorderSide(color: primary, width: 2),
                        ),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: _openChannelJoinCreateSheet,
                          child: SizedBox(
                            width: 40,
                            height: 40,
                            child: Center(
                              child: Text(
                                '＋',
                                style: TextStyle(
                                  fontSize: 20,
                                  color: palette.addChannelForeground,
                                  height: 1,
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
              if (filtered.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 48),
                  child: Column(
                    children: [
                      Text(
                        '📋',
                        style: TextStyle(
                          fontSize: 48,
                          color: palette.primaryText.withValues(alpha: 0.3),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        i18n.translate('channel_chat.no_channel'),
                        style: GoogleFonts.pressStart2p(
                          fontSize: 10,
                          color: palette.primaryText,
                          height: 1.4,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                )
              else
                ...filtered.map((ch) => _channelListTile(ch, palette)),
            ],
          );
        },
      ),
    );
  }

  Widget _channelListTile(ChatChannelInfo ch, PolyChatPalette palette) {
    final i18n = I18n();
    final me = widget.authService.currentUser?.username ?? '';
    final owner = widget.chatChannelService.isOwner(ch, me);
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: palette.chatBorder, width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: () => _openChannel(ch),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                child: Row(
                  children: [
                    if (owner)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: PolyArenaChatIcons.ownerCrown(16),
                      ),
                    Expanded(
                      child: Text(
                        ch.name,
                        style: GoogleFonts.pressStart2p(
                          fontSize: 9,
                          color: palette.primaryText,
                          height: 1.3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          _channelActionIcon(
            tooltip: i18n.translate('channel_chat.delete_tooltip'),
            icon: PolyArenaChatIcons.trash(14, PolyChatPalette.muted66),
            onPressed: () => _confirmDeleteChannel(ch),
          ),
          _channelActionIcon(
            tooltip: i18n.translate('channel_chat.leave_tooltip'),
            icon: PolyArenaChatIcons.leaveDoor(14, PolyChatPalette.muted66),
            onPressed: () => _confirmLeaveChannel(ch),
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }

  Widget _channelActionIcon({
    required String tooltip,
    required Widget icon,
    required VoidCallback onPressed,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(4),
          child: SizedBox(width: 28, height: 28, child: Center(child: icon)),
        ),
      ),
    );
  }

  Widget _buildChannelConversation(PolyChatPalette palette) {
    final ch = _activeChannel!;
    final i18n = I18n();
    final primary = widget.borderBlue;
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: palette.chatSurface,
            border: Border(bottom: BorderSide(color: primary, width: 2)),
          ),
          child: Row(
            children: [
              // `.back-btn` : bordure primaire, pas de border-radius (coins droits).
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _backToChannelList,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: primary, width: 2),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        PolyArenaChatIcons.backChevron(12, primary),
                        const SizedBox(width: 4),
                        Text(
                          i18n.translate('channel_chat.return'),
                          style: GoogleFonts.pressStart2p(
                            fontSize: 8,
                            height: 1.2,
                            color: primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  ch.name,
                  textAlign: TextAlign.start,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 10,
                    color: palette.primaryText,
                    height: 1.2,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              // `.close-channel-btn`: leave icon (not trash), like `chat-menu.component.html`.
              Tooltip(
                message: i18n.translate('channel_chat.leave_tooltip'),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => _confirmLeaveChannel(ch),
                    borderRadius: BorderRadius.circular(4),
                    child: Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: PolyChatPalette.muted66,
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: PolyArenaChatIcons.leaveDoor(
                        16,
                        PolyChatPalette.muted66,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: Container(
            color: palette.chatOverlay,
            child: AnimatedBuilder(
              animation: widget.chatChannelService,
              builder: (context, _) {
                final messages = widget.chatChannelService.messagesForChannel(
                  ch.id,
                );
                final me = widget.authService.currentUser?.username ?? '';
                _syncChannelScroll(messages);
                return ListView.builder(
                  controller: _channelScrollController,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 10,
                  ),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final m = messages[index];
                    if (m.username == 'system') {
                      return _ChannelSystemBubble(
                        text: _formatChannelSystemContent(m.content),
                        borderBlue: widget.borderBlue,
                      );
                    }
                    final gm = GlobalChatMessage(
                      username: m.username,
                      content: m.content,
                      timestamp: m.timestamp,
                    );
                    return polyArenaChatBubble(
                      gm,
                      isMe: m.username == me,
                      borderBlue: widget.borderBlue,
                      palette: palette,
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }

  Widget _emojiBar(Color borderBlue, PolyChatPalette palette) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: palette.chatSurface,
        border: Border(top: BorderSide(color: borderBlue, width: 4)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: _emojis.map((emoji) {
          final isSelected = emoji == _selectedEmoji;

          return GestureDetector(
            onTap: () {
              setState(() {
                _selectedEmoji = emoji;
              });
            },
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: isSelected
                    ? borderBlue.withValues(alpha: 0.2)
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: isSelected
                    ? Border.all(color: borderBlue, width: 2)
                    : null,
              ),
              child: Text(
                emoji,
                style: TextStyle(fontSize: isSelected ? 26 : 22),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildInputRow(PolyChatPalette palette) {
    final primary = widget.borderBlue;
    final focused = _inputFocusNode.hasFocus;
    final canSend = _controller.text.trim().isNotEmpty;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.chatSurface,
        border: Border(top: BorderSide(color: primary, width: 4)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _inputFocusNode,
              onChanged: (_) => setState(() {}),
              maxLength: 500,
              style: GoogleFonts.pressStart2p(
                fontSize: 9,
                color: focused ? Colors.white : Colors.black,
                height: 1.4,
              ),
              buildCounter:
                  (
                    context, {
                    required currentLength,
                    required isFocused,
                    maxLength,
                  }) => const SizedBox.shrink(),
              decoration: InputDecoration(
                hintText: I18n().translate('chat_global.ecrire_message'),
                hintStyle: GoogleFonts.pressStart2p(
                  fontSize: 9,
                  color: focused
                      ? Colors.white.withValues(alpha: 0.7)
                      : PolyChatPalette.muted66,
                ),
                filled: true,
                fillColor: focused ? primary : Colors.white,
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(2),
                  borderSide: BorderSide(color: primary, width: 3),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(2),
                  borderSide: BorderSide(color: primary, width: 3),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
              ),
              cursorColor: focused ? Colors.white : primary,
              textInputAction: TextInputAction.send,
              // Avoids auto-defocus on the Send action → the keyboard stays open
              // so several messages can be sent in a row (same as
              // chat partie / salle d’attente).
              onEditingComplete: () {},
              onSubmitted: (value) {
                if (value.trim().isEmpty) return;
                if (_mainTab == _MainChatTab.global) {
                  _sendGlobal(value);
                } else {
                  _sendChannel(value);
                }
                _lastSentMessage = value;
                _onFirstMessageSent();
                if (mounted) _inputFocusNode.requestFocus();
              },
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 44,
            height: 44,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: canSend
                    ? () {
                        _lastSentMessage = _controller.text;
                        if (_mainTab == _MainChatTab.global) {
                          _sendGlobal(_controller.text);
                        } else {
                          _sendChannel(_controller.text);
                        }
                        _onFirstMessageSent();
                        if (!mounted) return;
                        _inputFocusNode.requestFocus();
                      }
                    : null,
                child: Container(
                  decoration: BoxDecoration(
                    color: canSend ? Colors.white : palette.sendDisabledBg,
                    border: Border.all(
                      color: canSend ? primary : palette.sendDisabledBorder,
                      width: 3,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: PolyArenaChatIcons.sendPlane(
                    18,
                    canSend ? primary : palette.sendDisabledIcon,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DeletedChannelBanner extends StatelessWidget {
  const _DeletedChannelBanner({
    required this.notification,
    required this.borderBlue,
    required this.onDismiss,
  });

  final DeletedChannelNotification notification;
  final Color borderBlue;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final text = notification.selfDeleted
        ? i18n.translateWithParams('channel_chat.channel_closed_self', {
            'name': notification.channelName,
          })
        : i18n.translateWithParams('channel_chat.channel_closed', {
            'name': notification.channelName,
          });
    final self = notification.selfDeleted;
    final accent = self
        ? borderBlue
        : Color.lerp(PolyChatPalette.deleteHover, borderBlue, 0.12)!;
    final bg = self
        ? borderBlue.withValues(alpha: 0.15)
        : PolyChatPalette.deleteHover.withValues(alpha: 0.15);
    final fg = self
        ? Color.lerp(borderBlue, Colors.white, 0.42)!
        : Color.lerp(Colors.white, PolyChatPalette.deleteHover, 0.12)!;
    return Container(
      margin: const EdgeInsets.only(bottom: 0),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        border: Border(bottom: BorderSide(color: accent, width: 2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.4,
                color: fg,
              ),
            ),
          ),
          Tooltip(
            message: i18n.translate('channel_chat.dismiss_notification'),
            child: InkWell(
              onTap: onDismiss,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                child: Text('✕', style: TextStyle(fontSize: 12, color: fg)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChannelSystemBubble extends StatelessWidget {
  const _ChannelSystemBubble({required this.text, required this.borderBlue});

  final String text;
  final Color borderBlue;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.pressStart2p(
          fontSize: 7,
          height: 1.5,
          color: PolyChatPalette.muted66,
          fontStyle: FontStyle.italic,
        ),
      ),
    );
  }
}

class _ChannelJoinCreateSheet extends StatefulWidget {
  const _ChannelJoinCreateSheet({
    required this.borderBlue,
    required this.channelService,
  });

  final Color borderBlue;
  final ChatChannelService channelService;

  @override
  State<_ChannelJoinCreateSheet> createState() =>
      _ChannelJoinCreateSheetState();
}

class _ChannelJoinCreateSheetState extends State<_ChannelJoinCreateSheet> {
  final TextEditingController _query = TextEditingController();
  bool _joinTab = true;
  bool _awaitingCreate = false;
  int _joinedLenAtCreate = 0;

  @override
  void initState() {
    super.initState();
    widget.channelService.addListener(_onChannelSvc);
  }

  @override
  void dispose() {
    widget.channelService.removeListener(_onChannelSvc);
    _query.dispose();
    super.dispose();
  }

  void _onChannelSvc() {
    if (!mounted || !_awaitingCreate || _joinTab) return;
    final err = widget.channelService.lastErrorMessage;
    if (err != null && err.isNotEmpty) {
      setState(() => _awaitingCreate = false);
      return;
    }
    if (widget.channelService.joinedChannels.length > _joinedLenAtCreate) {
      setState(() => _awaitingCreate = false);
      Navigator.of(context).pop();
    }
  }

  void _onQueryChanged() {
    widget.channelService.clearChannelError();
    final q = _query.text.trim();
    if (_joinTab) {
      if (q.isNotEmpty) {
        widget.channelService.searchChannels(q);
      } else {
        widget.channelService.clearSearchResults();
      }
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final palette = PolyChatPalette(
      isBlue: context.watch<ThemeService>().isBlue,
    );
    final i18n = I18n();
    final primary = widget.borderBlue;
    final screenH = MediaQuery.sizeOf(context).height;
    // Cap for the list: the area only scrolls beyond this height.
    final maxJoinListHeight = math.min(320.0, screenH * 0.42);

    return SingleChildScrollView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              color: palette.mainTabHeaderBg,
              border: Border(bottom: BorderSide(color: primary, width: 4)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Expanded(
                        child: _modalHeaderTab(
                          label: i18n.translate('channel_chat.join'),
                          selected: _joinTab,
                          onTap: () => setState(() {
                            _joinTab = true;
                            _awaitingCreate = false;
                            widget.channelService.clearChannelError();
                          }),
                        ),
                      ),
                      Expanded(
                        child: _modalHeaderTab(
                          label: i18n.translate('channel_chat.create'),
                          selected: !_joinTab,
                          onTap: () => setState(() {
                            _joinTab = false;
                            widget.channelService.clearChannelError();
                          }),
                        ),
                      ),
                    ],
                  ),
                ),
                Center(
                  child: InkWell(
                    onTap: () => Navigator.pop(context),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 12,
                      ),
                      child: Text(
                        '✕',
                        style: GoogleFonts.pressStart2p(
                          fontSize: 14,
                          color: primary,
                          height: 1,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: _query,
              maxLength: 30,
              style: GoogleFonts.pressStart2p(
                fontSize: 9,
                color: palette.primaryText,
                height: 1.4,
              ),
              onChanged: (_) => _onQueryChanged(),
              decoration: InputDecoration(
                hintText: _joinTab
                    ? i18n.translate('channel_chat.search')
                    : i18n.translate('channel_chat.name'),
                hintStyle: GoogleFonts.pressStart2p(
                  fontSize: 9,
                  color: PolyChatPalette.muted66,
                ),
                filled: true,
                fillColor: palette.isBlue
                    ? Colors.white
                    : const Color(0xFF2A2A2A),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.zero,
                  borderSide: BorderSide(color: primary, width: 3),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.zero,
                  borderSide: BorderSide(color: primary, width: 3),
                ),
                contentPadding: const EdgeInsets.all(12),
              ),
              scrollPadding: EdgeInsets.zero,
              textInputAction: _joinTab
                  ? TextInputAction.search
                  : TextInputAction.done,
              onSubmitted: (_) {
                if (!_joinTab && _query.text.trim().isNotEmpty) {
                  _submitCreate();
                }
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: _joinTab
                ? _buildJoinResultsBody(
                    i18n,
                    primary,
                    maxJoinListHeight,
                    palette,
                  )
                : _buildCreateBody(i18n, primary),
          ),
        ],
      ),
    );
  }

  Widget _buildCreateBody(I18n i18n, Color primary) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 4),
        if (widget.channelService.lastErrorMessage != null)
          Text(
            _translateChannelError(widget.channelService.lastErrorMessage),
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 8,
              color: PolyChatPalette.deleteHover,
              height: 1.4,
            ),
          ),
        if (widget.channelService.lastErrorMessage != null)
          const SizedBox(height: 8),
        Opacity(
          opacity: _query.text.trim().isEmpty ? 0.5 : 1,
          child: Material(
            color: primary,
            child: InkWell(
              onTap: _query.text.trim().isEmpty ? null : _submitCreate,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: Text(
                    i18n.translate('channel_chat.create_button'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: 10,
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
    );
  }

  Widget _buildJoinResultsBody(
    I18n i18n,
    Color primary,
    double maxListHeight,
    PolyChatPalette palette,
  ) {
    return AnimatedBuilder(
      animation: widget.channelService,
      builder: (context, _) {
        final results = widget.channelService.searchResults;
        final q = _query.text.trim();
        if (q.isEmpty) {
          return const SizedBox.shrink();
        }
        if (results.isEmpty) {
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              i18n.translate('channel_chat.no_results'),
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                color: PolyChatPalette.muted66,
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
          );
        }
        return ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxListHeight),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const ClampingScrollPhysics(),
            itemCount: results.length,
            separatorBuilder: (_, _) =>
                Divider(height: 1, color: palette.chatBorder),
            itemBuilder: (context, i) {
              final ch = results[i];
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        ch.name,
                        style: GoogleFonts.pressStart2p(
                          fontSize: 9,
                          color: palette.primaryText,
                          height: 1.3,
                        ),
                      ),
                    ),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: primary,
                        side: BorderSide(color: primary, width: 2),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                      onPressed: () {
                        widget.channelService.joinChannel(ch.id);
                        widget.channelService.removeSearchResult(ch.id);
                      },
                      child: Text(
                        i18n.translate('channel_chat.join'),
                        style: GoogleFonts.pressStart2p(
                          fontSize: 7,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _modalHeaderTab({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    final primary = widget.borderBlue;
    return InkWell(
      onTap: onTap,
      child: Container(
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? primary : Colors.transparent,
              width: 4,
            ),
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.pressStart2p(
            fontSize: 9,
            height: 1.2,
            color: selected ? primary : PolyChatPalette.muted99,
          ),
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  void _submitCreate() {
    final name = _query.text.trim();
    if (name.isEmpty) return;
    widget.channelService.clearChannelError();
    _joinedLenAtCreate = widget.channelService.joinedChannels.length;
    setState(() => _awaitingCreate = true);
    widget.channelService.createChannel(name);
  }
}

String _formatElapsed(DateTime timestamp) {
  final local = timestamp.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');

  return '${two(local.hour)}:${two(local.minute)}:${two(local.second)}';
}

Widget polyArenaChatBubble(
  GlobalChatMessage msg, {
  required bool isMe,
  required Color borderBlue,
  required PolyChatPalette palette,
}) {
  return Align(
    alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 280),
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isMe ? borderBlue : Colors.white,
        border: Border.all(
          color: isMe ? palette.ownBubbleBorder : borderBlue,
          width: 2,
        ),
      ),
      child: Column(
        crossAxisAlignment: isMe
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: double.infinity,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    msg.username == deletedAccountUsername
                        ? I18n().translate('server_msg.deleted_account')
                        : msg.username,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                      color: isMe ? Colors.white : borderBlue,
                      height: 1.3,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _formatElapsed(msg.timestamp),
                  style: GoogleFonts.pressStart2p(
                    fontSize: 7,
                    color: isMe
                        ? Colors.white.withValues(alpha: 0.7)
                        : PolyChatPalette.muted99,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            msg.content,
            style: GoogleFonts.pressStart2p(
              fontSize: 9,
              height: 1.6,
              color: isMe ? Colors.white : Colors.black,
            ),
          ),
        ],
      ),
    ),
  );
}
