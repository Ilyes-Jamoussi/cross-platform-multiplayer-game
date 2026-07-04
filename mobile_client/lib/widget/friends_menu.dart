import 'dart:async';
import 'dart:math' as math show min, pi;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/account_type.dart';
import 'package:mobile_client/services/friends_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:provider/provider.dart';

import 'poly_arena_chat_dialog.dart' show PolyChatPalette;
import 'poly_arena_message_popup.dart';

/// Friends panel: framed right drawer (primary border), reduced height
/// par marges haut/bas, fond `--app-chat-overlay`.
class FriendsMenu extends StatefulWidget {
  const FriendsMenu({super.key, this.onClose, required this.friendsService});

  final VoidCallback? onClose;
  final FriendsService friendsService;

  @override
  State<FriendsMenu> createState() => _FriendsMenuState();
}

class _FriendsMenuState extends State<FriendsMenu> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final FocusNode _searchFocus = FocusNode();
  static const int _searchBlurDelayMs = 150;

  /// Fallback polling interval to guarantee statuses stay
  /// in sync even if a `statusUpdate` socket event is lost
  /// (notably for online → offline transitions during silent
  /// disconnects where the server cannot reach our socket).
  static const Duration _statusRefreshInterval = Duration(seconds: 5);

  Timer? _statusRefreshTimer;
  bool _pendingExpanded = true;
  bool _sentExpanded = true;

  /// Results only visible with focus + delay on blur (like the web client).
  bool _searchResultsVisible = false;

  void _onSearchFocusChanged() {
    if (_searchFocus.hasFocus) {
      setState(() => _searchResultsVisible = true);
      return;
    }
    setState(() {});
    Future<void>.delayed(const Duration(milliseconds: _searchBlurDelayMs), () {
      if (!mounted || _searchFocus.hasFocus) return;
      setState(() => _searchResultsVisible = false);
    });
  }

  void _onSearchControllerChanged() {
    if (!mounted) return;
    setState(() {});
    widget.friendsService.searchUsersDebounced(_controller.text);
  }

  @override
  void initState() {
    super.initState();
    _searchFocus.addListener(_onSearchFocusChanged);
    _controller.addListener(_onSearchControllerChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      // Force server-side re-registration in case a silent socket
      // reconnect invalidated the `userSockets` entry — otherwise the
      // `statusUpdate` broadcasts no longer reach us in real time.
      widget.friendsService.forceRegisterFriendSocket();
      try {
        await widget.friendsService.refresh();
      } catch (e, st) {
        debugPrint('FriendsMenu.refresh: $e\n$st');
      }
    });
    _startStatusRefreshTimer();
  }

  void _startStatusRefreshTimer() {
    _statusRefreshTimer?.cancel();
    _statusRefreshTimer = Timer.periodic(_statusRefreshInterval, (_) {
      if (!mounted) return;
      widget.friendsService.refresh().catchError((e, st) {
        debugPrint('FriendsMenu.statusRefresh: $e\n$st');
      });
    });
  }

  @override
  void dispose() {
    _statusRefreshTimer?.cancel();
    _searchFocus.removeListener(_onSearchFocusChanged);
    _searchFocus.dispose();
    _controller.removeListener(_onSearchControllerChanged);
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _onSendRequest(AccountType user) async {
    final i18n = I18n();
    final ok = await widget.friendsService.sendRequest(user);
    if (!mounted) return;
    if (ok) {
      await showPolyArenaMessageDialog(
        context: context,
        kind: PolyArenaMessageKind.success,
        title: i18n.translate('popup.success_title'),
        message: i18n.translate('common.request_sent_success'),
        okLabel: i18n.translate('common.ok'),
      );
    } else {
      await showPolyArenaMessageDialog(
        context: context,
        kind: PolyArenaMessageKind.info,
        title: i18n.translate('popup.error_title'),
        message: i18n.translate('common.request_send_error'),
        okLabel: i18n.translate('common.ok'),
      );
    }
  }

  Future<void> _removeFriend(AccountType friend) async {
    final i18n = I18n();
    final ok = await widget.friendsService.remove(friend.uid);
    if (!mounted) return;
    if (!ok) {
      await showPolyArenaMessageDialog(
        context: context,
        kind: PolyArenaMessageKind.info,
        title: i18n.translate('popup.error_title'),
        message: i18n.translate('common.remove_error'),
        okLabel: i18n.translate('common.ok'),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final primary = theme.primaryColor;
    final i18n = I18n();
    final viewPadding = MediaQuery.paddingOf(context);
    final screenW = MediaQuery.sizeOf(context).width;
    final panelW = math.min(420.0, screenW);
    final palette = PolyChatPalette(isBlue: theme.isBlue);
    final panelTop = viewPadding.top + 16;
    final panelBottom = viewPadding.bottom + 20;

    final service = widget.friendsService;

    return Stack(
      children: [
        GestureDetector(
          onTap: widget.onClose,
          child: Container(color: Colors.black.withValues(alpha: 0.7)),
        ),
        Positioned(
          top: panelTop,
          right: 0,
          bottom: panelBottom,
          width: panelW,
          child: Material(
            color: palette.chatOverlay,
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border(
                  top: BorderSide(color: primary, width: 4),
                  left: BorderSide(color: primary, width: 4),
                  bottom: BorderSide(color: primary, width: 4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _PanelHeader(
                    primary: primary,
                    i18n: i18n,
                    onClose: widget.onClose,
                  ),
                  Expanded(
                    child: AnimatedBuilder(
                      animation: service,
                      builder: (context, _) {
                        final searchSnapshot = List<AccountType>.from(
                          service.searchResults,
                        );
                        return Scrollbar(
                          controller: _scrollController,
                          thumbVisibility: false,
                          thickness: 8,
                          radius: const Radius.circular(0),
                          child: SingleChildScrollView(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                _SearchBlock(
                                  primary: primary,
                                  palette: palette,
                                  i18n: i18n,
                                  controller: _controller,
                                  focusNode: _searchFocus,
                                  onSearchTap: () {
                                    final q = _controller.text.trim();
                                    if (q.isNotEmpty) {
                                      service.searchUsers(q);
                                    }
                                  },
                                ),
                                if (searchSnapshot.isNotEmpty &&
                                    _searchResultsVisible) ...[
                                  const SizedBox(height: 10),
                                  Container(
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: primary,
                                        width: 2,
                                      ),
                                    ),
                                    child: ConstrainedBox(
                                      constraints: const BoxConstraints(
                                        maxHeight: 160,
                                      ),
                                      child: SingleChildScrollView(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.stretch,
                                          children: [
                                            for (
                                              var i = 0;
                                              i < searchSnapshot.length;
                                              i++
                                            )
                                              _SearchResultRow(
                                                primary: primary,
                                                palette: palette,
                                                i18n: i18n,
                                                user: searchSnapshot[i],
                                                isFriend: service.friends.any(
                                                  (f) =>
                                                      f.uid ==
                                                      searchSnapshot[i].uid,
                                                ),
                                                isPending:
                                                    service.requests.any(
                                                      (r) =>
                                                          r.uid ==
                                                          searchSnapshot[i].uid,
                                                    ) ||
                                                    service.sentRequests.any(
                                                      (s) =>
                                                          s.uid ==
                                                          searchSnapshot[i].uid,
                                                    ),
                                                onAdd: () => _onSendRequest(
                                                  searchSnapshot[i],
                                                ),
                                                showBottomDivider:
                                                    i <
                                                    searchSnapshot.length - 1,
                                              ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 20),
                                _CollapsibleSectionTitle(
                                  primary: primary,
                                  text: i18n.translate(
                                    'friends_menu.pending_requests',
                                  ),
                                  expanded: _pendingExpanded,
                                  badgeCount:
                                      !_pendingExpanded &&
                                          service.requests.isNotEmpty
                                      ? service.requests.length
                                      : null,
                                  onToggle: () => setState(
                                    () => _pendingExpanded = !_pendingExpanded,
                                  ),
                                ),
                                if (_pendingExpanded) ...[
                                  const SizedBox(height: 8),
                                  if (service.requests.isEmpty)
                                    _EmptyBlock(
                                      i18n: i18n,
                                      palette: palette,
                                      emptyKey: 'friends_menu.no_requests',
                                      leadingIcon: Icons.mail_outline,
                                    )
                                  else
                                    ...service.requests.map(
                                      (req) => _IncomingRequestRow(
                                        primary: primary,
                                        i18n: i18n,
                                        user: req,
                                        onAccept: () => service.accept(req.uid),
                                        onRefuse: () => service.refuse(req.uid),
                                      ),
                                    ),
                                ],
                                const SizedBox(height: 20),
                                _CollapsibleSectionTitle(
                                  primary: primary,
                                  text: i18n.translate(
                                    'friends_menu.sent_requests',
                                  ),
                                  expanded: _sentExpanded,
                                  badgeCount:
                                      !_sentExpanded &&
                                          service.sentRequests.isNotEmpty
                                      ? service.sentRequests.length
                                      : null,
                                  onToggle: () => setState(
                                    () => _sentExpanded = !_sentExpanded,
                                  ),
                                ),
                                if (_sentExpanded) ...[
                                  const SizedBox(height: 8),
                                  if (service.sentRequests.isEmpty)
                                    _EmptyBlock(
                                      i18n: i18n,
                                      palette: palette,
                                      emptyKey: 'friends_menu.no_sent_requests',
                                      leadingIcon: Icons.mail_outline,
                                    )
                                  else
                                    ...service.sentRequests.map(
                                      (sent) => _SentRequestRow(
                                        primary: primary,
                                        user: sent,
                                      ),
                                    ),
                                ],
                                const SizedBox(height: 20),
                                _StaticSectionTitle(
                                  primary: primary,
                                  text: i18n.translate(
                                    'friends_menu.my_friends',
                                  ),
                                ),
                                const SizedBox(height: 8),
                                if (service.friends.isEmpty)
                                  _EmptyBlock(
                                    i18n: i18n,
                                    palette: palette,
                                    emptyKey: 'friends_menu.no_friends',
                                    leadingIcon: Icons.groups_outlined,
                                  )
                                else
                                  ...service.friends.map(
                                    (f) => _FriendRow(
                                      primary: primary,
                                      i18n: i18n,
                                      friend: f,
                                      onRemove: () => _removeFriend(f),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _PanelHeader extends StatelessWidget {
  const _PanelHeader({
    required this.primary,
    required this.i18n,
    required this.onClose,
  });

  final Color primary;
  final I18n i18n;
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(left: 16, right: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: primary, width: 4)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                i18n.translate('friends_menu.title'),
                style: GoogleFonts.pressStart2p(
                  fontSize: 10,
                  height: 1.35,
                  color: primary,
                ),
              ),
            ),
          ),
          _HeaderIconBtn(
            primary: primary,
            tooltip: i18n.translate('friends_menu.close'),
            icon: Icons.close,
            iconSize: 14,
            onPressed: onClose,
          ),
        ],
      ),
    );
  }
}

class _HeaderIconBtn extends StatelessWidget {
  const _HeaderIconBtn({
    required this.primary,
    required this.tooltip,
    required this.icon,
    required this.onPressed,
    this.iconSize = 16,
  });

  final Color primary;
  final String tooltip;
  final IconData icon;
  final VoidCallback? onPressed;
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Tooltip(
        message: tooltip,
        child: Semantics(
          button: true,
          label: tooltip,
          child: Material(
            color: Colors.white,
            child: InkWell(
              onTap: onPressed,
              splashColor: primary.withValues(alpha: 0.35),
              highlightColor: primary.withValues(alpha: 0.12),
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  border: Border.all(color: primary, width: 3),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: iconSize, color: primary),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchBlock extends StatelessWidget {
  const _SearchBlock({
    required this.primary,
    required this.palette,
    required this.i18n,
    required this.controller,
    required this.focusNode,
    required this.onSearchTap,
  });

  final Color primary;
  final PolyChatPalette palette;
  final I18n i18n;
  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onSearchTap;

  @override
  Widget build(BuildContext context) {
    final focused = focusNode.hasFocus;
    return Container(
      padding: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: palette.chatBorder, width: 2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              focusNode: focusNode,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => onSearchTap(),
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                color: focused ? Colors.white : Colors.black,
              ),
              cursorColor: focused ? Colors.white : primary,
              decoration: InputDecoration(
                filled: true,
                fillColor: focused ? primary : Colors.white,
                hintText: i18n.translate('friends_menu.search'),
                hintStyle: GoogleFonts.pressStart2p(
                  fontSize: 8,
                  color: focused
                      ? Colors.white.withValues(alpha: 0.7)
                      : PolyChatPalette.muted66,
                ),
                contentPadding: const EdgeInsets.all(10),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.zero,
                  borderSide: BorderSide(color: primary, width: 3),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.zero,
                  borderSide: BorderSide(color: primary, width: 3),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Semantics(
            button: true,
            label: i18n.translate('friends_menu.search'),
            child: Material(
              color: Colors.white,
              child: InkWell(
                onTap: onSearchTap,
                splashColor: primary.withValues(alpha: 0.35),
                highlightColor: primary.withValues(alpha: 0.12),
                child: SizedBox(
                  width: 40,
                  height: 40,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border.all(color: primary, width: 3),
                      color: Colors.white,
                    ),
                    child: Center(
                      child: Icon(Icons.search, size: 16, color: primary),
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

/// Fixed section title (e.g. "My friends") — no arrow or click, like the web client.
class _StaticSectionTitle extends StatelessWidget {
  const _StaticSectionTitle({required this.primary, required this.text});

  final Color primary;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: primary, width: 2)),
      ),
      child: Text(
        text,
        style: GoogleFonts.pressStart2p(
          fontSize: 9,
          height: 1.35,
          color: primary,
        ),
      ),
    );
  }
}

/// Collapsible section header (arrow + badge), like the Angular `.section-title`.
class _CollapsibleSectionTitle extends StatelessWidget {
  const _CollapsibleSectionTitle({
    required this.primary,
    required this.text,
    required this.expanded,
    required this.onToggle,
    this.badgeCount,
  });

  final Color primary;
  final String text;
  final bool expanded;
  final VoidCallback onToggle;
  final int? badgeCount;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onToggle,
      child: Container(
        padding: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: primary, width: 2)),
        ),
        child: Row(
          children: [
            Transform.rotate(
              angle: expanded ? math.pi / 2 : 0,
              child: Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Text(
                  '\u25B6',
                  style: GoogleFonts.pressStart2p(
                    fontSize: 8,
                    height: 1,
                    color: primary,
                  ),
                ),
              ),
            ),
            Expanded(
              child: Text(
                text,
                style: GoogleFonts.pressStart2p(
                  fontSize: 9,
                  height: 1.35,
                  color: primary,
                ),
              ),
            ),
            if (badgeCount != null && badgeCount! > 0)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: primary,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${badgeCount!}',
                  style: GoogleFonts.pressStart2p(
                    fontSize: 7,
                    height: 1.2,
                    color: Colors.white,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _EmptyBlock extends StatelessWidget {
  const _EmptyBlock({
    required this.i18n,
    required this.palette,
    required this.emptyKey,
    this.leadingIcon = Icons.mail_outline,
  });

  final I18n i18n;
  final PolyChatPalette palette;
  final String emptyKey;
  final IconData leadingIcon;

  @override
  Widget build(BuildContext context) {
    final muted = palette.primaryText.withValues(alpha: 0.3);
    final mutedText = palette.primaryText.withValues(alpha: 0.5);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Column(
        children: [
          Icon(leadingIcon, size: 32, color: muted),
          const SizedBox(height: 8),
          Text(
            i18n.translate(emptyKey),
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 8,
              height: 1.4,
              color: mutedText,
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchResultRow extends StatelessWidget {
  const _SearchResultRow({
    required this.primary,
    required this.palette,
    required this.i18n,
    required this.user,
    required this.isFriend,
    required this.isPending,
    required this.onAdd,
    this.showBottomDivider = false,
  });

  final Color primary;
  final PolyChatPalette palette;
  final I18n i18n;
  final AccountType user;
  final bool isFriend;
  final bool isPending;
  final VoidCallback onAdd;
  final bool showBottomDivider;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        border: showBottomDivider
            ? Border(bottom: BorderSide(color: palette.chatBorder, width: 1))
            : null,
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              user.username,
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.35,
                color: palette.primaryText,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isFriend)
            SizedBox(
              width: 24,
              height: 24,
              child: Icon(
                Icons.check,
                size: 16,
                color: const Color(0xFF4CAF50),
              ),
            )
          else if (isPending)
            SizedBox(
              width: 24,
              height: 24,
              child: Icon(
                Icons.schedule,
                size: 16,
                color: const Color(0xFFFFAA00),
              ),
            )
          else
            _SquareActionBtn(
              color: primary,
              icon: Icons.person_add_alt_1,
              tooltip: i18n.translate('friends_menu.add'),
              onPressed: onAdd,
            ),
        ],
      ),
    );
  }
}

class _IncomingRequestRow extends StatelessWidget {
  const _IncomingRequestRow({
    required this.primary,
    required this.i18n,
    required this.user,
    required this.onAccept,
    required this.onRefuse,
  });

  final Color primary;
  final I18n i18n;
  final AccountType user;
  final VoidCallback onAccept;
  final VoidCallback onRefuse;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: primary, width: 2),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              user.username,
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.35,
                color: Colors.black,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          _SquareActionBtn(
            color: const Color(0xFF4CAF50),
            borderColor: const Color(0xFF4CAF50),
            icon: Icons.check,
            tooltip: i18n.translate('friends_menu.accept'),
            onPressed: onAccept,
          ),
          const SizedBox(width: 6),
          _SquareActionBtn(
            color: const Color(0xFFFF4444),
            borderColor: const Color(0xFFFF4444),
            icon: Icons.close,
            tooltip: i18n.translate('friends_menu.refuse'),
            onPressed: onRefuse,
          ),
        ],
      ),
    );
  }
}

class _SentRequestRow extends StatelessWidget {
  const _SentRequestRow({required this.primary, required this.user});

  final Color primary;
  final AccountType user;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: primary, width: 2),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              user.username,
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.35,
                color: Colors.black,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          SizedBox(
            width: 24,
            height: 24,
            child: Icon(Icons.access_time, color: Color(0xFFFFAA00), size: 16),
          ),
        ],
      ),
    );
  }
}

/// Angular `.action-btn`: 30×30, 2px border, white background, ~14px icon.
class _SquareActionBtn extends StatelessWidget {
  const _SquareActionBtn({
    required this.color,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.borderColor,
  });

  final Color color;
  final Color? borderColor;
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final b = borderColor ?? color;
    return Tooltip(
      message: tooltip,
      child: Semantics(
        button: true,
        label: tooltip,
        child: SizedBox(
          width: 30,
          height: 30,
          child: Material(
            color: Colors.white,
            clipBehavior: Clip.hardEdge,
            child: InkWell(
              onTap: onPressed,
              splashColor: b.withValues(alpha: 0.35),
              highlightColor: b.withValues(alpha: 0.12),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: b, width: 2),
                ),
                child: Center(child: Icon(icon, size: 14, color: color)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FriendRow extends StatelessWidget {
  const _FriendRow({
    required this.primary,
    required this.i18n,
    required this.friend,
    required this.onRemove,
  });

  final Color primary;
  final I18n i18n;
  final AccountType friend;
  final VoidCallback onRemove;

  static String _formatDate(DateTime dt) {
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} '
        '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final status = friend.status;
    final isCombat = status == 'inCombat';
    final isOnline = status == 'online' || isCombat;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: primary, width: 2),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        friend.username,
                        style: GoogleFonts.pressStart2p(
                          fontSize: 8,
                          height: 1.35,
                          color: Colors.black,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: isCombat
                            ? const Color(0xFFFF6A00)
                            : (isOnline
                                  ? const Color(0xFF32CD32)
                                  : const Color(0xFFAAAAAA)),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isCombat
                              ? const Color(0xFFCC5500)
                              : (isOnline
                                    ? const Color(0xFF2D8A2D)
                                    : const Color(0xFF888888)),
                          width: 2,
                        ),
                        boxShadow: isCombat
                            ? [
                                BoxShadow(
                                  color: const Color(
                                    0xFFFF6A00,
                                  ).withValues(alpha: 0.6),
                                  blurRadius: 6,
                                ),
                              ]
                            : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  isCombat
                      ? i18n.translate('friends_menu.status_in_combat')
                      : isOnline
                      ? i18n.translate('friends_menu.status_online')
                      : i18n.translate('friends_menu.status_offline'),
                  style: GoogleFonts.pressStart2p(
                    fontSize: 6,
                    height: 1.35,
                    color: isCombat
                        ? const Color(0xFFFF6A00)
                        : (isOnline
                              ? const Color(0xFF32CD32)
                              : const Color(0xFF888888)),
                  ),
                ),
                if (!isOnline && friend.lastLoginAt != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    '${i18n.translate('friends_menu.last_login')} ${_formatDate(friend.lastLoginAt!)}',
                    style: GoogleFonts.pressStart2p(
                      fontSize: 5,
                      height: 1.35,
                      color: const Color(0xFF666666),
                    ),
                  ),
                ],
              ],
            ),
          ),
          _SquareActionBtn(
            color: const Color(0xFFFF4444),
            borderColor: const Color(0xFFFF4444),
            icon: Icons.person_remove,
            tooltip: i18n.translate('friends_menu.remove'),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}
