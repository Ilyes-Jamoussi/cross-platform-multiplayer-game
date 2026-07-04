import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/game_room_chat_message.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/room_chat_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

/// Reproduction 1:1 de `game-chat.component` (HTML + SCSS Angular).
class WaitingRoomChatPanel extends StatefulWidget {
  const WaitingRoomChatPanel({
    super.key,
    required this.borderBlue,
    required this.currentPlayer,
    this.roomIsFriendsOnly = false,
  });

  /// `--app-primary`
  final Color borderBlue;
  final LobbyPlayer currentPlayer;

  /// Shows the private-room icon (visual equivalent of the web client).
  final bool roomIsFriendsOnly;

  @override
  State<WaitingRoomChatPanel> createState() => _WaitingRoomChatPanelState();
}

class _WaitingRoomChatPanelState extends State<WaitingRoomChatPanel> {
  final _controller = TextEditingController();
  final _scroll = ScrollController();
  final _inputFocus = FocusNode();
  RoomChatService? _chatService;

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      final pos = _scroll.position;
      if (pos.maxScrollExtent.isFinite) {
        _scroll.jumpTo(pos.maxScrollExtent);
      }
    });
  }

  void _onChatMessagesChanged() => _scrollToBottom();

  @override
  void initState() {
    super.initState();
    _controller.addListener(() => setState(() {}));
    _inputFocus.addListener(() => setState(() {}));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final svc = context.read<RoomChatService>();
    if (!identical(svc, _chatService)) {
      _chatService?.removeListener(_onChatMessagesChanged);
      _chatService = svc;
      _chatService!.addListener(_onChatMessagesChanged);
      _scrollToBottom();
    }
  }

  @override
  void dispose() {
    _chatService?.removeListener(_onChatMessagesChanged);
    _controller.dispose();
    _scroll.dispose();
    _inputFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<RoomChatService>();
    final mq = MediaQuery.sizeOf(context);
    final vmin = math.max(2.0, mq.shortestSide * 0.01);
    final primary = widget.borderBlue;
    final theme = context.watch<ThemeService>();
    final secondary = theme.secondaryColor;
    final chatOverlay = theme.chatOverlayColor;
    final chatSurface = theme.chatSurfaceColor;
    final chatBorder = theme.chatBorderColor;

    /// Taller input bar + send button (the web `3vmin` looked too thin).
    final sendSide = math.max(42.0, 4.25 * vmin);
    final borderW = 0.3 * vmin;
    final inputFocused = _inputFocus.hasFocus;

    // Same structure as `game-chat.component`: `.messages-container` + `.input-container`.
    return LayoutBuilder(
      builder: (context, outer) {
        if (!outer.hasBoundedHeight ||
            !outer.hasBoundedWidth ||
            outer.maxHeight < 8 ||
            outer.maxWidth < 8) {
          return const SizedBox.shrink();
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.roomIsFriendsOnly)
              Padding(
                padding: EdgeInsets.only(
                  left: vmin,
                  right: vmin,
                  bottom: 0.6 * vmin,
                ),
                child: Row(
                  children: [
                    Tooltip(
                      message: I18n().translate(
                        'loading_page.mode.friends_only',
                      ),
                      child: Image.asset(
                        'assets/waiting_view/lock.png',
                        width: 3.2 * vmin,
                        height: 3.2 * vmin,
                        gaplessPlayback: true,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.lock_outline,
                          size: 3.2 * vmin,
                          color: secondary,
                        ),
                      ),
                    ),
                    SizedBox(width: 0.6 * vmin),
                    Expanded(
                      child: Text(
                        I18n().translate('loading_page.mode.friends_only'),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: GoogleFonts.pressStart2p(
                          fontSize: (0.75 * vmin).clamp(7.0, 11.0),
                          color: Colors.white.withValues(alpha: 0.88),
                          height: 1.2,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: ColoredBox(
                color: chatOverlay,
                child: Consumer<RoomChatService>(
                  builder: (context, chat, _) {
                    return ScrollbarTheme(
                      data: ScrollbarThemeData(
                        thickness: WidgetStateProperty.all(0.6 * vmin),
                        radius: Radius.circular(0.3 * vmin),
                        thumbColor: WidgetStateProperty.resolveWith(
                          (states) => states.contains(WidgetState.dragged)
                              ? secondary
                              : primary,
                        ),
                        trackColor: WidgetStateProperty.all(chatSurface),
                      ),
                      child: Scrollbar(
                        controller: _scroll,
                        thumbVisibility: true,
                        child: ListView.separated(
                          controller: _scroll,
                          padding: EdgeInsets.all(vmin),
                          itemCount: chat.messages.length,
                          separatorBuilder: (context, index) =>
                              SizedBox(height: 0.8 * vmin),
                          itemBuilder: (context, i) {
                            final m = chat.messages[i];
                            final own = m.authorId == widget.currentPlayer.id;
                            return _MessageRow(
                              message: m,
                              isOwn: own,
                              primary: primary,
                              vmin: vmin,
                            );
                          },
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            AnimatedPadding(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: chatSurface,
                  border: Border(
                    top: BorderSide(color: primary, width: borderW),
                  ),
                ),
                padding: EdgeInsets.all(vmin),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _controller,
                          focusNode: _inputFocus,
                          scrollPadding: EdgeInsets.zero,
                          maxLength: RoomChatService.maxLength,
                          maxLines: 1,
                          autocorrect: false,
                          enableSuggestions: false,
                          textAlignVertical: TextAlignVertical.center,
                          style: GoogleFonts.pressStart2p(
                            color: inputFocused ? Colors.white : Colors.black,
                            fontSize: (0.85 * vmin).clamp(9.0, 14.0),
                            height: 1.05,
                          ),
                          cursorColor: inputFocused ? Colors.white : primary,
                          decoration: InputDecoration(
                            isDense: true,
                            counterText: '',
                            hintText: I18n().translate(
                              'game_chat.write_message',
                            ),
                            hintStyle: GoogleFonts.pressStart2p(
                              color: inputFocused
                                  ? Colors.white.withValues(alpha: 0.7)
                                  : theme.textMutedColor,
                              fontSize: (0.85 * vmin).clamp(9.0, 14.0),
                              height: 1.05,
                            ),
                            filled: true,
                            fillColor: inputFocused ? primary : Colors.white,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 1.0 * vmin,
                              vertical: 1.0 * vmin,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(0.3 * vmin),
                              borderSide: BorderSide(
                                color: primary,
                                width: borderW,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(0.3 * vmin),
                              borderSide: BorderSide(
                                color: primary,
                                width: borderW,
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(0.3 * vmin),
                              borderSide: BorderSide(
                                color: primary,
                                width: borderW,
                              ),
                            ),
                          ),
                          textInputAction: TextInputAction.send,
                          // Avoids auto-defocus on the Send action → the keyboard
                          // stays open so several messages can be sent.
                          onEditingComplete: () {},
                          onSubmitted: (_) => _send(),
                        ),
                      ),
                      SizedBox(width: 0.5 * vmin),
                      _SendButton(
                        primary: primary,
                        chatSurface: chatSurface,
                        chatBorder: chatBorder,
                        side: sendSide,
                        vmin: vmin,
                        enabled: _controller.text.trim().isNotEmpty,
                        onPressed: _send,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _send() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    context.read<RoomChatService>().send(text, widget.currentPlayer);
    _controller.clear();
  }
}

/// Bubble capped at 80% of the list viewport width.
///
/// [FractionallySizedBox] may see `maxWidth == ∞` depending on the parent → unbounded
/// width and failure of the [DecoratedBox] / the `Row` with `Expanded` inside the bubble.
class _MessageRow extends StatelessWidget {
  const _MessageRow({
    required this.message,
    required this.isOwn,
    required this.primary,
    required this.vmin,
  });

  final GameRoomChatMessage message;
  final bool isOwn;
  final Color primary;
  final double vmin;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        if (!c.hasBoundedWidth || c.maxWidth <= 0 || !c.maxWidth.isFinite) {
          return const SizedBox.shrink();
        }
        final bubbleW = c.maxWidth * 0.8;
        return Align(
          alignment: isOwn ? Alignment.centerRight : Alignment.centerLeft,
          child: SizedBox(
            width: bubbleW,
            child: _MessageBubble(
              message: message,
              isOwn: isOwn,
              primary: primary,
              vmin: vmin,
            ),
          ),
        );
      },
    );
  }
}

/// Same SVG as `game-chat.component.html` (send).
class _GameChatSendSvg extends StatelessWidget {
  const _GameChatSendSvg({required this.color, required this.size});

  final Color color;
  final double size;

  static const _raw = '''
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M22 2L11 13" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
<path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
</svg>''';

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _raw,
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }
}

/// `.send-button` (+ hover / disabled states from the SCSS; hover approximated for mouse).
class _SendButton extends StatefulWidget {
  const _SendButton({
    required this.primary,
    required this.chatSurface,
    required this.chatBorder,
    required this.side,
    required this.vmin,
    required this.enabled,
    required this.onPressed,
  });

  final Color primary;
  final Color chatSurface;
  final Color chatBorder;
  final double side;
  final double vmin;
  final bool enabled;
  final VoidCallback onPressed;

  @override
  State<_SendButton> createState() => _SendButtonState();
}

class _SendButtonState extends State<_SendButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final iconSize = 1.5 * widget.vmin;
    if (!widget.enabled) {
      return Opacity(
        opacity: 0.5,
        child: Container(
          width: widget.side,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: widget.chatSurface,
            borderRadius: BorderRadius.circular(0.3 * widget.vmin),
            border: Border.all(
              color: widget.chatBorder,
              width: 0.3 * widget.vmin,
            ),
          ),
          child: _GameChatSendSvg(color: widget.chatBorder, size: iconSize),
        ),
      );
    }

    final hovered = _hover;
    final bg = hovered ? widget.primary : Colors.white;
    final fg = hovered ? Colors.white : widget.primary;

    return MouseRegion(
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: SizedBox(
        width: widget.side,
        child: Material(
          color: bg,
          borderRadius: BorderRadius.circular(0.3 * widget.vmin),
          child: InkWell(
            onTap: widget.onPressed,
            borderRadius: BorderRadius.circular(0.3 * widget.vmin),
            child: Container(
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(0.3 * widget.vmin),
                border: Border.all(
                  color: widget.primary,
                  width: 0.3 * widget.vmin,
                ),
              ),
              child: _GameChatSendSvg(color: fg, size: iconSize),
            ),
          ),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isOwn,
    required this.primary,
    required this.vmin,
  });

  final GameRoomChatMessage message;
  final bool isOwn;
  final Color primary;
  final double vmin;

  /// Aligned with `newDate()` on the web client + already formatted strings.
  static String _formatTime(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return t;
    final noFrac = t.split('.').first;
    if (!t.contains('T') &&
        RegExp(r'^\d{1,2}:\d{2}(:\d{2})?$').hasMatch(noFrac)) {
      return noFrac;
    }
    final d = DateTime.tryParse(t);
    if (d != null) {
      final local = d.isUtc ? d.toLocal() : d;
      final h = local.hour.toString().padLeft(2, '0');
      final m = local.minute.toString().padLeft(2, '0');
      final s = local.second.toString().padLeft(2, '0');
      return '$h:$m:$s';
    }
    return t;
  }

  @override
  Widget build(BuildContext context) {
    final timeDisplay = _formatTime(message.time);
    final bubbleBg = isOwn ? primary : Colors.white;
    final bubbleBorder = isOwn ? Colors.white : primary;
    final authorColor = isOwn ? Colors.white : primary;
    final timeColor = isOwn
        ? Colors.white.withValues(alpha: 0.7)
        : const Color(0xFF999999);
    final contentColor = isOwn ? Colors.white : Colors.black;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: bubbleBg,
        borderRadius: BorderRadius.circular(0.3 * vmin),
        border: Border.all(color: bubbleBorder, width: 0.2 * vmin),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          0.8 * vmin,
          0.6 * vmin,
          0.8 * vmin,
          0.6 * vmin,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    message.authorName == deletedAccountUsername
                        ? I18n().translate('server_msg.deleted_account')
                        : message.authorName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.pressStart2p(
                      color: authorColor,
                      fontSize: 0.8 * vmin,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                ),
                SizedBox(width: 0.5 * vmin),
                Text(
                  timeDisplay,
                  style: GoogleFonts.pressStart2p(
                    color: timeColor,
                    fontSize: 0.8 * vmin,
                    height: 1.2,
                  ),
                ),
              ],
            ),
            SizedBox(height: 0.3 * vmin),
            Text(
              message.text,
              style: GoogleFonts.pressStart2p(
                color: contentColor,
                fontSize: 0.9 * vmin,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
