import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/game_models.dart';
import 'package:mobile_client/models/game_room_chat_message.dart';
import 'package:mobile_client/services/game_team_chat_service.dart';
import 'package:mobile_client/services/room_chat_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/theme/game_view_theme.dart';
import 'package:mobile_client/widget/poly_arena_chat_dialog.dart'
    show PolyChatPalette;
import 'package:provider/provider.dart';

/// Right in-game panel: Chat / Team / Log tabs — aligned with
/// `log-chat` + `game-chat` / `game-team-chat` Angular (bulles, saisie, journal).
class GameChatJournalPanel extends StatefulWidget {
  const GameChatJournalPanel({
    super.key,
    required this.roomChat,
    required this.teamChat,
    required this.isTeamGame,
    required this.localPlayerId,
    required this.journal,
    required this.journalFilterMineOnly,
    required this.onToggleJournalFilter,
    required this.chatInputController,
    required this.onSubmitMessage,
    this.chatInputFocusNode,
    this.showJournalTab = true,

    /// `end-page.component`: `.chat-wrapper` + single white-background tab (not the game tabs).
    this.endPageChatChrome = false,
  });

  final RoomChatService roomChat;
  final GameTeamChatService teamChat;
  final bool isTeamGame;

  /// For `own-message` (blue bubble on the right), like `gameChatService.isMyMessage`.
  final String? localPlayerId;
  final List<GameJournalEntry> journal;
  final bool journalFilterMineOnly;
  final VoidCallback onToggleJournalFilter;
  final TextEditingController chatInputController;
  final void Function(bool teamChannel) onSubmitMessage;
  /// Optional FocusNode of the input field. Lets the parent release the
  /// focus (and thus close the keyboard) on external events such as
  /// entering or leaving a combat.
  final FocusNode? chatInputFocusNode;
  /// If `false`: Chat only (and Team when in team mode), without the Log tab.
  final bool showJournalTab;
  final bool endPageChatChrome;

  @override
  State<GameChatJournalPanel> createState() => _GameChatJournalPanelState();
}

class _GameChatJournalPanelState extends State<GameChatJournalPanel> {
  int _tabIndex = 0;

  int get _journalTabIndex {
    if (!widget.showJournalTab) return -1;
    return widget.isTeamGame ? 2 : 1;
  }

  void _selectTab(int i) {
    if (_tabIndex == i) return;
    setState(() {
      _tabIndex = i;
    });
  }

  @override
  void didUpdateWidget(covariant GameChatJournalPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    final maxIx = widget.showJournalTab
        ? (widget.isTeamGame ? 2 : 1)
        : (widget.isTeamGame ? 1 : 0);
    if (_tabIndex > maxIx) {
      setState(() => _tabIndex = 0);
    }
  }

  void _submit() {
    if (_tabIndex == _journalTabIndex) return;
    final team = widget.isTeamGame && _tabIndex == 1;
    widget.onSubmitMessage(team);
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final theme = context.watch<ThemeService>();
    final palette = PolyChatPalette(isBlue: theme.isBlue);
    final showInput = _tabIndex != _journalTabIndex;
    final accent = theme.primaryColor;
    final tabInactive = PolyChatPalette.muted99;

    final mq = MediaQuery.sizeOf(context);
    final vmin = mq.shortestSide * 0.01;

    Widget bodyStack() {
      return Expanded(
        child: ColoredBox(
          color: palette.chatOverlay,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: IndexedStack(
                  index: _tabIndex,
                  children: [
                    _AngularGameChatPane(
                      listenable: widget.roomChat,
                      messages: () => widget.roomChat.messages,
                      localPlayerId: widget.localPlayerId,
                      mineBubbleColor: accent,
                      onMineContrast: theme.onPrimaryButtonText,
                      peerAccentColor: accent,
                    ),
                    if (widget.isTeamGame)
                      _AngularGameChatPane(
                        listenable: widget.teamChat,
                        messages: () => widget.teamChat.messages,
                        localPlayerId: widget.localPlayerId,
                        mineBubbleColor: accent,
                        onMineContrast: theme.onPrimaryButtonText,
                        peerAccentColor: accent,
                      ),
                    if (widget.showJournalTab)
                      _JournalPanel(
                        entries: widget.journal,
                        filterMineOnly: widget.journalFilterMineOnly,
                        onToggleFilter: widget.onToggleJournalFilter,
                        accentPrimary: accent,
                        activeToggleTextColor: theme.onPrimaryButtonText,
                      ),
                  ],
                ),
              ),
              if (showInput)
                AnimatedPadding(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOut,
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).viewInsets.bottom,
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      color: palette.chatSurface,
                      border: Border(
                        top: BorderSide(color: accent, width: 2.5),
                      ),
                    ),
                    padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
                    child: _AngularChatInputRow(
                      controller: widget.chatInputController,
                      focusNode: widget.chatInputFocusNode,
                      onSend: _submit,
                      maxLength: RoomChatService.maxLength,
                      enabledBorderColor: accent,
                      focusedBorderColor: theme.secondaryColor,
                      sendAccentColor: accent,
                      sendDisabledBg: palette.sendDisabledBg,
                      sendDisabledBorder: palette.sendDisabledBorder,
                      sendDisabledIcon: palette.sendDisabledIcon,
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    if (widget.endPageChatChrome) {
      final borderW = math.max(2.0, vmin * 0.3);
      final radius = math.max(6.0, vmin);
      return Container(
        decoration: BoxDecoration(
          border: Border.all(color: accent, width: borderW),
          borderRadius: BorderRadius.circular(radius),
          color: theme.chatOverlayColor,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(
                  bottom: BorderSide(color: accent, width: borderW),
                ),
              ),
              padding: EdgeInsets.symmetric(
                vertical: vmin,
                horizontal: vmin * 0.8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.chat_bubble_outline,
                    color: accent,
                    size: math.max(14.0, vmin * 1.6),
                  ),
                  SizedBox(width: vmin * 0.5),
                  Text(
                    i18n.translate('game_chat.tab_chat'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: math.max(5.0, vmin * 0.95),
                      color: accent,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
            bodyStack(),
          ],
        ),
      );
    }

    return Container(
      decoration: GameViewTheme.angularChatContainer(borderColor: accent),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            decoration: BoxDecoration(
              color: palette.mainTabHeaderBg,
              border: Border(bottom: BorderSide(color: accent, width: 2.5)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _LogChatTabButton(
                    active: _tabIndex == 0,
                    icon: Icons.chat_bubble_outline,
                    label: i18n.translate('game_chat.tab_chat'),
                    onTap: () => _selectTab(0),
                    accentColor: accent,
                    inactiveIconColor: tabInactive,
                  ),
                ),
                if (widget.isTeamGame)
                  Expanded(
                    child: _LogChatTabButton(
                      active: _tabIndex == 1,
                      icon: Icons.groups_outlined,
                      label: i18n.translate('game_page.team'),
                      onTap: () => _selectTab(1),
                      accentColor: accent,
                      inactiveIconColor: tabInactive,
                    ),
                  ),
                if (widget.showJournalTab)
                  Expanded(
                    child: _LogChatTabButton(
                      active: _tabIndex == _journalTabIndex,
                      icon: Icons.description_outlined,
                      label: i18n.translate('game_page.journal'),
                      onTap: () => _selectTab(_journalTabIndex),
                      accentColor: accent,
                      inactiveIconColor: tabInactive,
                    ),
                  ),
              ],
            ),
          ),
          bodyStack(),
        ],
      ),
    );
  }
}

/// `.tab-btn`-style tab button (icon + text, active underline).
class _LogChatTabButton extends StatelessWidget {
  const _LogChatTabButton({
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
    required this.accentColor,
    required this.inactiveIconColor,
  });

  final bool active;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color accentColor;
  final Color inactiveIconColor;

  @override
  Widget build(BuildContext context) {
    final base = GoogleFonts.pressStart2p(
      fontSize: 5.5,
      height: 1.2,
      color: active ? accentColor : inactiveIconColor,
    );
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: active ? accentColor : Colors.transparent,
                width: 3,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 14,
                color: active ? accentColor : inactiveIconColor,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: base,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Message list + bottom scroll (equivalent of `game-chat` / `messages-container`).
class _AngularGameChatPane extends StatefulWidget {
  const _AngularGameChatPane({
    required this.listenable,
    required this.messages,
    required this.localPlayerId,
    required this.mineBubbleColor,
    required this.onMineContrast,
    required this.peerAccentColor,
  });

  final Listenable listenable;
  final List<GameRoomChatMessage> Function() messages;
  final String? localPlayerId;
  final Color mineBubbleColor;
  final Color onMineContrast;
  final Color peerAccentColor;

  @override
  State<_AngularGameChatPane> createState() => _AngularGameChatPaneState();
}

class _AngularGameChatPaneState extends State<_AngularGameChatPane> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    widget.listenable.addListener(_onMessagesChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  @override
  void didUpdateWidget(covariant _AngularGameChatPane oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.listenable != widget.listenable) {
      oldWidget.listenable.removeListener(_onMessagesChanged);
      widget.listenable.addListener(_onMessagesChanged);
    }
  }

  @override
  void dispose() {
    widget.listenable.removeListener(_onMessagesChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _onMessagesChanged() {
    if (!mounted) return;
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
  }

  bool _isMine(GameRoomChatMessage m) =>
      widget.localPlayerId != null &&
      widget.localPlayerId!.isNotEmpty &&
      m.authorId == widget.localPlayerId;

  @override
  Widget build(BuildContext context) {
    final list = widget.messages();

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxBubble = constraints.maxWidth * 0.8;
        return Scrollbar(
          controller: _scrollController,
          thumbVisibility: true,
          thickness: 4,
          radius: const Radius.circular(2),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.all(6),
            itemCount: list.length,
            itemBuilder: (context, i) {
              final m = list[i];
              final mine = _isMine(m);
              return Align(
                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: maxBubble),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 7),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: mine ? widget.mineBubbleColor : Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: mine ? Colors.black : widget.peerAccentColor,
                        width: 2,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                m.authorName == deletedAccountUsername
                                    ? I18n().translate(
                                        'server_msg.deleted_account',
                                      )
                                    : m.authorName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.pressStart2p(
                                  fontSize: 6,
                                  fontWeight: FontWeight.bold,
                                  color: mine
                                      ? widget.onMineContrast
                                      : widget.peerAccentColor,
                                  height: 1.4,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              m.time,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 5.5,
                                color: mine
                                    ? widget.onMineContrast.withValues(
                                        alpha: 0.6,
                                      )
                                    : const Color(0xFF999999),
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          m.text,
                          style: GoogleFonts.pressStart2p(
                            fontSize: 6.5,
                            color: mine ? widget.onMineContrast : Colors.black,
                            height: 1.5,
                          ),
                        ),
                      ],
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
}

/// `.input-container` + `.chat-input` + `.send-button`
class _AngularChatInputRow extends StatelessWidget {
  const _AngularChatInputRow({
    required this.controller,
    required this.onSend,
    required this.maxLength,
    required this.enabledBorderColor,
    required this.focusedBorderColor,
    required this.sendAccentColor,
    required this.sendDisabledBg,
    required this.sendDisabledBorder,
    required this.sendDisabledIcon,
    this.focusNode,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
  final VoidCallback onSend;
  final int maxLength;
  final Color enabledBorderColor;
  final Color focusedBorderColor;
  final Color sendAccentColor;
  final Color sendDisabledBg;
  final Color sendDisabledBorder;
  final Color sendDisabledIcon;

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final canSend = value.text.trim().isNotEmpty;
        return Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                maxLength: maxLength,
                maxLines: 1,
                style: GoogleFonts.pressStart2p(
                  fontSize: 7.5,
                  color: Colors.black,
                  height: 1.45,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  counterText: '',
                  filled: true,
                  fillColor: Colors.white,
                  hintText: i18n.translate('game_chat.write_message'),
                  hintStyle: GoogleFonts.pressStart2p(
                    fontSize: 7,
                    color: const Color(0xFF999999),
                    height: 1.45,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 12,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4),
                    borderSide: BorderSide(color: enabledBorderColor, width: 2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4),
                    borderSide: BorderSide(color: focusedBorderColor, width: 2),
                  ),
                ),
                textInputAction: TextInputAction.send,
                // Avoids auto-defocus on the Send action → the keyboard stays open
                // so several messages can be sent in a row.
                onEditingComplete: () {},
                onSubmitted: (_) {
                  if (canSend) onSend();
                },
              ),
            ),
            const SizedBox(width: 6),
            _AngularSendButton(
              enabled: canSend,
              onPressed: onSend,
              accentColor: sendAccentColor,
              disabledBg: sendDisabledBg,
              disabledBorder: sendDisabledBorder,
              disabledIcon: sendDisabledIcon,
            ),
          ],
        );
      },
    );
  }
}

class _AngularSendButton extends StatelessWidget {
  const _AngularSendButton({
    required this.enabled,
    required this.onPressed,
    required this.accentColor,
    required this.disabledBg,
    required this.disabledBorder,
    required this.disabledIcon,
  });

  final bool enabled;
  final VoidCallback onPressed;
  final Color accentColor;
  final Color disabledBg;
  final Color disabledBorder;
  final Color disabledIcon;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? Colors.white : disabledBg,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: enabled ? onPressed : null,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            border: Border.all(
              color: enabled ? accentColor : disabledBorder,
              width: 2,
            ),
          ),
          child: Opacity(
            opacity: enabled ? 1 : 0.5,
            child: CustomPaint(
              size: const Size(18, 18),
              painter: _PaperPlanePainter(
                color: enabled ? accentColor : disabledIcon,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Path close to the `game-chat` SVG (send).
class _PaperPlanePainter extends CustomPainter {
  _PaperPlanePainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = math.max(1.2, size.shortestSide * 0.1)
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final scale = size.shortestSide / 24;
    canvas.scale(scale);
    canvas.drawLine(const Offset(22, 2), const Offset(11, 13), p);
    final path = Path()
      ..moveTo(22, 2)
      ..lineTo(15, 22)
      ..lineTo(11, 13)
      ..lineTo(2, 9)
      ..close();
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(covariant _PaperPlanePainter oldDelegate) =>
      oldDelegate.color != color;
}

/// Journal : scroll puis bouton « Mon journal » en bas (`.logs` / `.myLogs`).
class _JournalPanel extends StatefulWidget {
  const _JournalPanel({
    required this.entries,
    required this.filterMineOnly,
    required this.onToggleFilter,
    required this.accentPrimary,
    required this.activeToggleTextColor,
  });

  final List<GameJournalEntry> entries;
  final bool filterMineOnly;
  final VoidCallback onToggleFilter;
  final Color accentPrimary;
  final Color activeToggleTextColor;

  @override
  State<_JournalPanel> createState() => _JournalPanelState();
}

class _JournalPanelState extends State<_JournalPanel> {
  final ScrollController _scrollController = ScrollController();

  @override
  void didUpdateWidget(covariant _JournalPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.entries.length != oldWidget.entries.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    return Padding(
      padding: const EdgeInsets.all(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Scrollbar(
              controller: _scrollController,
              thumbVisibility: true,
              thickness: 4,
              radius: const Radius.circular(2),
              child: ListView.builder(
                controller: _scrollController,
                itemCount: widget.entries.length,
                itemBuilder: (context, i) {
                  final e = widget.entries[i];
                  return Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: widget.accentPrimary, width: 2),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.timeLabel,
                          style: GoogleFonts.pressStart2p(
                            fontSize: 5.5,
                            color: const Color(0xFF999999),
                            height: 1.4,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          e.message,
                          style: GoogleFonts.pressStart2p(
                            fontSize: 6,
                            color: Colors.black,
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Opacity(
              opacity: widget.filterMineOnly ? 1 : 0.55,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: widget.onToggleFilter,
                  borderRadius: BorderRadius.circular(6),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 132,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: widget.filterMineOnly
                          ? widget.accentPrimary
                          : Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: widget.accentPrimary, width: 2),
                    ),
                    child: Text(
                      i18n.translate('game_page.my_journal'),
                      style: GoogleFonts.pressStart2p(
                        fontSize: 5.5,
                        color: widget.filterMineOnly
                            ? widget.activeToggleTextColor
                            : widget.accentPrimary,
                        height: 1.2,
                      ),
                    ),
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
