import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/lobby_player_card.dart';
import 'package:mobile_client/widget/poly_arena_confirm_popup.dart';
import 'package:provider/provider.dart';

class LoadingRoomContent extends StatefulWidget {
  const LoadingRoomContent({
    super.key,
    required this.lobby,
    required this.room,
    required this.myId,
    required this.borderColor,
    required this.chatPanel,
    required this.narrow,
    required this.onLeave,
  });

  final LobbyRoomService lobby;
  final RoomLobbySnapshot? room;
  final String? myId;
  final Color borderColor;
  final Widget chatPanel;
  final bool narrow;
  final VoidCallback onLeave;

  @override
  State<LoadingRoomContent> createState() => _LoadingRoomContentState();
}

class _LoadingRoomContentState extends State<LoadingRoomContent> {
  bool _jvMenuOpen = false;
  Timer? _dotsTimer;
  String _loadingDots = '';

  @override
  void initState() {
    super.initState();
    _dotsTimer = Timer.periodic(const Duration(milliseconds: 450), (_) {
      if (!mounted) return;
      setState(
        () => _loadingDots = _loadingDots.length < 3 ? '$_loadingDots.' : '',
      );
    });
  }

  @override
  void dispose() {
    _dotsTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(LoadingRoomContent oldWidget) {
    super.didUpdateWidget(oldWidget);
    final r = widget.room;
    final locked = r?.isLocked ?? false;
    final full = r != null && r.players.length >= r.playerMax;
    if ((locked || full) && _jvMenuOpen) {
      setState(() => _jvMenuOpen = false);
    }
  }

  Future<void> _confirmKickById(String playerId) async {
    final ok = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'loading_page.kick_player',
      messageKey: 'loading.message',
    );
    if (!ok || !mounted) return;
    widget.lobby.kickPlayer(playerId);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.narrow) {
      /// Keyboard as an overlay (like the game page): no special handling of
      /// `viewInsets` au niveau parent — seul l'input du chat remonte via
      /// l'`AnimatedPadding` interne de [WaitingRoomChatPanel].
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _buildMainColumn(context),
            const SizedBox(height: 12),
            SizedBox(height: 240, child: widget.chatPanel),
          ],
        ),
      );
    }

    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    // Same logic as the Angular `.right-panel`: height ~80vmin, centered in the column.
    final rightPanelHeight = 80 * vmin;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(flex: 3, child: _buildLeftPanel(context)),
          const SizedBox(width: 12),
          Expanded(flex: 4, child: _buildCenterPanel(context)),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: LayoutBuilder(
              builder: (context, c) {
                final maxH = c.maxHeight;
                final hBase = maxH.isFinite
                    ? math.min(rightPanelHeight, maxH)
                    : rightPanelHeight;

                /// Keyboard as an overlay: the right panel keeps its nominal height,
                /// only the chat input moves up (handled in [WaitingRoomChatPanel]
                /// via an `AnimatedPadding`, like the game page).
                final panelH = math.max(200.0, hBase);
                return Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox(
                    height: panelH,
                    width: double.infinity,
                    child: _buildRightPanel(context),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeftPanel(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final room = widget.room;
    final players = room?.players ?? const <LobbyPlayer>[];
    final maxP = room?.playerMax ?? 2;
    final minP = room?.playerMin ?? 2;
    final isHost = widget.lobby.isHost;
    final isTeamsMode = room?.lobbyGameMode == LobbyGameMode.teams;
    final teams = room?.teams ?? const <LobbyTeam>[];
    final assignedIds = teams.expand((t) => t.players).map((p) => p.id).toSet();
    final unassignedPlayers = isTeamsMode
        ? players.where((p) => !assignedIds.contains(p.id)).toList()
        : const <LobbyPlayer>[];
    final isCtf =
        ((room?.gameMode ?? widget.lobby.baseGameMode ?? '')).toUpperCase() ==
        'CTF';
    final entryFee = room?.entryFee ?? 0;
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final sectionGap = 0.8 * vmin;
    final dividerHeight = 0.2 * vmin;
    // Same relative size as the "active" cards of the central panel.
    final activeCardW = ((21 * vmin).clamp(116.0, 150.0)) * 0.9;
    final activeCardH = ((25 * vmin).clamp(136.0, 190.0)) * 0.9;

    return Container(
      padding: EdgeInsets.all(2 * vmin),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        border: Border.all(color: widget.borderColor, width: 0.3 * vmin),
        borderRadius: BorderRadius.circular(vmin),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${I18n().translate('loading_page.access_code')}: ${widget.lobby.roomId ?? ''}',
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              color: theme.tertiaryColor,
              fontSize: (1.95 * vmin).clamp(10.0, 18.0),
            ),
          ),
          _friendsOnlyLockHint(context, room),
          if (entryFee > 0) ...[
            SizedBox(height: sectionGap),
            Container(
              padding: EdgeInsets.symmetric(
                vertical: 1 * vmin,
                horizontal: 1.5 * vmin,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    widget.borderColor.withValues(alpha: 0.85),
                    widget.borderColor.withValues(alpha: 0.65),
                  ],
                ),
                border: Border.all(
                  color: widget.borderColor,
                  width: 0.2 * vmin,
                ),
                borderRadius: BorderRadius.circular(vmin),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.monetization_on,
                    color: Colors.white,
                    size: 1.5 * vmin,
                  ),
                  SizedBox(width: 0.8 * vmin),
                  Flexible(
                    child: Text(
                      '${I18n().translate('loading_page.entry_fee')}: $entryFee ${I18n().translate('loading_page.coins')}',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.pressStart2p(
                        color: Colors.white,
                        fontSize: (1.2 * vmin).clamp(8.0, 12.0),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          SizedBox(height: sectionGap),
          Container(
            height: dividerHeight,
            color: Colors.white.withValues(alpha: 0.15),
          ),
          SizedBox(height: sectionGap),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: Text(
                  I18n().translate('loading_page.players'),
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    color: Colors.white,
                    fontSize: (1.8 * vmin).clamp(9.0, 14.0),
                  ),
                ),
              ),
              SizedBox(width: 0.8 * vmin),
              Text(
                '(${players.length}/$maxP)',
                style: GoogleFonts.pressStart2p(
                  color: players.length >= minP
                      ? theme.successColor
                      : theme.errorColor,
                  fontSize: (1.65 * vmin).clamp(9.0, 14.0),
                ),
              ),
              if (isHost) ...[
                SizedBox(width: vmin),
                _heavyTooltip(
                  context: context,
                  message: players.length >= maxP
                      ? I18n().translate('loading_page.team_full')
                      : (room?.isLocked ?? false)
                      ? I18n().translate('loading_page.lock.locked')
                      : I18n().translate('loading_page.lock.unlocked'),
                  child: _ScaleOnHover(
                    child: SizedBox(
                      width: 4.5 * vmin,
                      height: 4.5 * vmin,
                      child: ElevatedButton(
                        onPressed: players.length >= maxP
                            ? null
                            : () => widget.lobby.toggleLock(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: (room?.isLocked ?? false)
                              ? theme.errorColor
                              : theme.successColor,
                          disabledBackgroundColor: Colors.grey.withValues(
                            alpha: 0.55,
                          ),
                          padding: EdgeInsets.zero,
                          shape: const CircleBorder(),
                        ),
                        child: (room?.isLocked ?? false)
                            ? Image.asset(
                                'assets/waiting_view/lock.png',
                                width: 2.4 * vmin,
                                height: 2.4 * vmin,
                                gaplessPlayback: true,
                                errorBuilder: (_, __, ___) => Icon(
                                  Icons.lock,
                                  color: Colors.white,
                                  size: 2.4 * vmin,
                                ),
                              )
                            : Image.asset(
                                'assets/waiting_view/unlock.png',
                                width: 2.4 * vmin,
                                height: 2.4 * vmin,
                                gaplessPlayback: true,
                                errorBuilder: (_, __, ___) => Icon(
                                  Icons.lock_open,
                                  color: Colors.white,
                                  size: 2.4 * vmin,
                                ),
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
          SizedBox(height: sectionGap),
          Container(
            height: dividerHeight,
            color: Colors.white.withValues(alpha: 0.15),
          ),
          SizedBox(height: sectionGap),
          _ModeRow(
            mode: room?.lobbyGameMode ?? LobbyGameMode.classic,
            enabled: isHost,
            maxPlayers: maxP,
            currentPlayers: players.length,
            isCtfBaseMode: isCtf,
            onChanged: isHost ? (m) => widget.lobby.setLobbyGameMode(m) : null,
          ),
          SizedBox(height: sectionGap),
          if (isTeamsMode) ...[
            Container(
              height: dividerHeight,
              color: Colors.white.withValues(alpha: 0.15),
            ),
            SizedBox(height: sectionGap),
            if (unassignedPlayers.isNotEmpty) ...[
              Text(
                I18n().translate('loading_page.unassigned_label'),
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  color: Colors.white.withValues(alpha: 0.65),
                  fontSize: (1.3 * vmin).clamp(8.0, 11.0),
                ),
              ),
              SizedBox(height: sectionGap),
            ],
            Expanded(
              child: unassignedPlayers.isEmpty
                  ? const SizedBox.shrink()
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        final uaGap = 1.45 * vmin;
                        final uaPad = 0.6 * vmin;
                        final cellCross = activeCardW + 2 * uaPad;
                        final rowExtent = activeCardH + 2 * uaPad;
                        final need3 = 3 * cellCross + 2 * uaGap;
                        final need2 = 2 * cellCross + uaGap;
                        final cols = maxP > 4 && constraints.maxWidth >= need3
                            ? 3
                            : constraints.maxWidth >= need2
                            ? 2
                            : 1;
                        return GridView.builder(
                          padding: EdgeInsets.zero,
                          gridDelegate:
                              SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: cols,
                                crossAxisSpacing: uaGap,
                                mainAxisSpacing: uaGap,
                                mainAxisExtent: rowExtent,
                              ),
                          itemCount: unassignedPlayers.length,
                          itemBuilder: (context, index) {
                            final p = unassignedPlayers[index];
                            return Padding(
                              padding: EdgeInsets.all(uaPad),
                              child: Align(
                                alignment: Alignment.topCenter,
                                child: SizedBox(
                                  width: activeCardW,
                                  height: activeCardH,
                                  child: LobbyPlayerCard(
                                    player: p,
                                    canKick:
                                        isHost &&
                                        widget.myId != null &&
                                        p.id != widget.myId &&
                                        !p.isHost,
                                    onKick: isHost
                                        ? () => _confirmKickById(p.id)
                                        : null,
                                  ),
                                ),
                              ),
                            );
                          },
                        );
                      },
                    ),
            ),
          ] else
            Expanded(child: const SizedBox.shrink()),
          if (isHost) ...[
            SizedBox(height: sectionGap),
            Container(
              height: dividerHeight,
              color: Colors.white.withValues(alpha: 0.15),
            ),
            SizedBox(height: sectionGap),
            _HostControls(lobby: widget.lobby, room: room),
          ],
        ],
      ),
    );
  }

  Widget _buildCenterPanel(BuildContext context) {
    final room = widget.room;
    final players = room?.players ?? const <LobbyPlayer>[];
    final maxP = room?.playerMax ?? 2;
    final isLocked = room?.isLocked ?? false;
    final isHost = widget.lobby.isHost;
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final waiting = players.length < maxP && !isLocked;
    final emptyCount = (maxP - players.length).clamp(0, maxP);
    final gridCols = maxP <= 4 ? 2 : 3;
    final cardW = ((21 * vmin).clamp(116.0, 150.0)) * 0.9;
    final cardH = ((25 * vmin).clamp(136.0, 190.0)) * 0.9;

    return Container(
      padding: EdgeInsets.all(1.8 * vmin),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Visibility(
            visible: waiting,
            maintainSize: true,
            maintainAnimation: true,
            maintainState: true,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    I18n().translate('loading_page.waiting_players'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.pressStart2p(
                      color: Colors.white,
                      fontSize: (2.2 * vmin).clamp(12.0, 20.0),
                    ),
                  ),
                  SizedBox(
                    width: (7.5 * vmin).clamp(44.0, 68.0),
                    child: Text(
                      _loadingDots,
                      textAlign: TextAlign.left,
                      style: GoogleFonts.pressStart2p(
                        color: Colors.white,
                        fontSize: (2.2 * vmin).clamp(12.0, 20.0),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: vmin),
          Expanded(
            child:
                room?.lobbyGameMode == LobbyGameMode.teams &&
                    room?.teams != null &&
                    room!.teams!.isNotEmpty
                ? _TeamsDisplay(
                    teams: room.teams!,
                    maxPlayers: maxP,
                    isHost: isHost,
                    myId: widget.myId,
                    onKick: (id) => _confirmKickById(id),
                    onJoinTeam: (id) => widget.lobby.selectTeam(id),
                    onLeaveTeam: () => widget.lobby.leaveTeam(),
                    onVirtualPlayerTeamChange: isHost
                        ? widget.lobby.changeVirtualPlayerTeam
                        : null,
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      final totalSlots = players.length + emptyCount;
                      final rows = (totalSlots / gridCols).ceil().clamp(1, 3);
                      final cellPad = 0.6 * vmin;
                      final gridGap = maxP <= 4 ? 1.75 * vmin : 2.1 * vmin;
                      final rowExtent = cardH + 2 * cellPad;
                      final cellCross = cardW + 2 * cellPad;
                      final gridWidth =
                          (gridCols * cellCross) + ((gridCols - 1) * gridGap);
                      final gridHeight =
                          (rows * rowExtent) + ((rows - 1) * gridGap);
                      return Center(
                        child: SizedBox(
                          width: gridWidth.clamp(0.0, constraints.maxWidth),
                          height: gridHeight.clamp(0.0, constraints.maxHeight),
                          child: GridView.builder(
                            padding: EdgeInsets.zero,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: totalSlots,
                            gridDelegate:
                                SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: gridCols,
                                  crossAxisSpacing: gridGap,
                                  mainAxisSpacing: gridGap,
                                  mainAxisExtent: rowExtent,
                                ),
                            itemBuilder: (context, index) {
                              if (index < players.length) {
                                final p = players[index];
                                return Padding(
                                  padding: EdgeInsets.all(cellPad),
                                  child: LobbyPlayerCard(
                                    player: p,
                                    canKick:
                                        isHost &&
                                        widget.myId != null &&
                                        p.id != widget.myId &&
                                        !p.isHost,
                                    onKick: isHost
                                        ? () => _confirmKickById(p.id)
                                        : null,
                                  ),
                                );
                              }
                              return Padding(
                                padding: EdgeInsets.all(cellPad),
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(
                                      0.8 * vmin,
                                    ),
                                    color: Colors.white.withValues(alpha: 0.03),
                                  ),
                                  child: Center(
                                    child: CustomPaint(
                                      painter: _DashedRoundedRectPainter(
                                        color: Colors.white24,
                                        radius: 0.8 * vmin,
                                        strokeWidth: 0.22 * vmin,
                                      ),
                                      child: Center(
                                        child: Text(
                                          '?',
                                          style: GoogleFonts.pressStart2p(
                                            color: Colors.white24,
                                            fontSize: (2.4 * vmin).clamp(
                                              16.0,
                                              26.0,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  /// Panneau droit : **chat** ([Expanded] + [_buildRightChatSection]) puis **boutons**
  /// ([_buildRightFixedActionsSection]) — no shared [Stack], no offset: the
  /// keyboard only shrinks the parent's [SizedBox.height].
  Widget _buildRightPanel(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _buildRightChatSection(context, theme, vmin)),
        _buildRightFixedActionsSection(context, vmin),
      ],
    );
  }

  Widget _buildRightChatSection(
    BuildContext context,
    ThemeService theme,
    double vmin,
  ) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(vmin),
      child: Container(
        decoration: BoxDecoration(
          color: theme.primarySurfaceColor,
          border: Border.all(color: widget.borderColor, width: 0.3 * vmin),
        ),
        child: Column(
          children: [
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: vmin,
                vertical: 0.8 * vmin,
              ),
              decoration: BoxDecoration(
                color: theme.primarySurfaceColor,
                border: Border(
                  bottom: BorderSide(
                    color: widget.borderColor,
                    width: 0.3 * vmin,
                  ),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.chat_bubble_outline,
                    color: widget.borderColor,
                    size: 1.6 * vmin,
                  ),
                  SizedBox(width: 0.5 * vmin),
                  Text(
                    I18n().translate('game_chat.tab_chat'),
                    style: GoogleFonts.pressStart2p(
                      color: widget.borderColor,
                      fontSize: (1 * vmin).clamp(8.0, 11.0),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(child: widget.chatPanel),
          ],
        ),
      ),
    );
  }

  Widget _buildRightFixedActionsSection(BuildContext context, double vmin) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(height: 0.8 * vmin),
        if (widget.lobby.isHost)
          _VirtualPlayerRow(
            lobby: widget.lobby,
            room: widget.room,
            menuOpen: _jvMenuOpen,
            onToggleMenu: () => setState(() => _jvMenuOpen = !_jvMenuOpen),
          ),
        SizedBox(height: 0.8 * vmin),
        _BottomActions(
          lobby: widget.lobby,
          room: widget.room,
          onLeave: widget.onLeave,
        ),
      ],
    );
  }

  Widget _friendsOnlyLockHint(BuildContext context, RoomLobbySnapshot? room) {
    if (room?.isFriendsOnly != true) return const SizedBox.shrink();
    final s = MediaQuery.sizeOf(context).shortestSide;
    final iconS = (0.032 * s).clamp(14.0, 22.0);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Tooltip(
            message: I18n().translate('loading_page.lock_icon_alt'),
            child: Image.asset(
              'assets/waiting_view/lock.png',
              width: iconS,
              height: iconS,
              gaplessPlayback: true,
              errorBuilder: (_, __, ___) =>
                  Icon(Icons.lock_outline, size: iconS, color: Colors.white70),
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              I18n().translate('loading_page.mode.friends_only'),
              textAlign: TextAlign.center,
              maxLines: 2,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainColumn(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final room = widget.room;
    final players = room?.players ?? const <LobbyPlayer>[];
    final minP = room?.playerMin ?? 2;
    final maxP = room?.playerMax ?? 2;
    final isLocked = room?.isLocked ?? false;
    final entryFee = room?.entryFee ?? 0;
    final isHost = widget.lobby.isHost;
    final waiting = players.length < maxP && !isLocked;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${I18n().translate('loading_page.access_code')}: ${widget.lobby.roomId ?? ''}',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: theme.tertiaryColor,
            fontSize: 22,
            fontWeight: FontWeight.w900,
            shadows: const [Shadow(blurRadius: 6, color: Colors.black87)],
          ),
        ),
        _friendsOnlyLockHint(context, room),
        if (entryFee > 0) ...[
          const SizedBox(height: 6),
          Text(
            '💰 ${I18n().translate('loading_page.entry_fee')}: $entryFee',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFFFFD700), fontSize: 12),
          ),
        ],
        const SizedBox(height: 8),
        if (waiting)
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              '${I18n().translate('loading_page.waiting_players')}...',
              textAlign: TextAlign.center,
              maxLines: 1,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: 12,
              ),
            ),
          ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${I18n().translate('loading_page.players')} ',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
            Text(
              '(${players.length}/$maxP)',
              style: TextStyle(
                color: players.length >= minP
                    ? theme.successColor
                    : theme.errorColor,
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (isHost) _HostControls(lobby: widget.lobby, room: room),
        const SizedBox(height: 8),
        _ModeRow(
          mode: room?.lobbyGameMode ?? LobbyGameMode.classic,
          enabled: isHost,
          maxPlayers: maxP,
          currentPlayers: players.length,
          isCtfBaseMode:
              ((room?.gameMode ?? widget.lobby.baseGameMode ?? ''))
                  .toUpperCase() ==
              'CTF',
          onChanged: isHost ? (m) => widget.lobby.setLobbyGameMode(m) : null,
        ),
      ],
    );
  }
}

Widget _heavyTooltip({
  required BuildContext context,
  required String message,
  required Widget child,
}) {
  final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
  final theme = context.read<ThemeService>();
  return Tooltip(
    message: message,
    waitDuration: const Duration(milliseconds: 220),
    textStyle: GoogleFonts.pressStart2p(
      color: Colors.white,
      fontSize: (0.95 * vmin).clamp(7.0, 10.0),
    ),
    padding: EdgeInsets.symmetric(horizontal: 1.1 * vmin, vertical: 0.8 * vmin),
    decoration: BoxDecoration(
      color: Colors.black.withValues(alpha: 0.92),
      border: Border.all(color: theme.primaryColor, width: 0.2 * vmin),
      borderRadius: BorderRadius.circular(0.6 * vmin),
    ),
    child: child,
  );
}

class _HostControls extends StatelessWidget {
  const _HostControls({required this.lobby, required this.room});
  final LobbyRoomService lobby;
  final RoomLobbySnapshot? room;

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final theme = context.watch<ThemeService>();
    final r = room;
    final isSmallGame = (r?.playerMax ?? 0) <= 2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildControlButton(
          context: context,
          background: r?.isFriendsOnly == true
              ? const Color(0xFFD39E00)
              : theme.primaryColor,
          label: r?.isLocked == true
              ? I18n().translate('loading_page.lock.locked')
              : (r?.isFriendsOnly == true
                    ? I18n().translate('loading_page.mode.friends_only')
                    : I18n().translate('loading_page.mode.public')),
          tooltip: r?.isLocked == true
              ? I18n().translate('loading_page.lock.locked')
              : (r?.isFriendsOnly == true
                    ? I18n().translate('loading_page.tooltip.friends_only')
                    : I18n().translate('loading_page.tooltip.public')),
          onPressed: r?.isLocked == true
              ? null
              : () => lobby.toggleFriendOnly(),
          // Like the web client: `.public` / `.friends-only` after `:disabled` → unchanged background, only opacity 0.6.
          preserveColorsWhenDisabled: true,
        ),
        if (!isSmallGame) ...[
          SizedBox(height: 0.8 * vmin),
          _buildControlButton(
            context: context,
            background: r?.dropInDropOutEnabled == true
                ? const Color(0xFF4CAF50)
                : theme.surfaceAltColor,
            label: r?.dropInDropOutEnabled == true
                ? I18n().translate('loading_page.drop_in_enabled')
                : I18n().translate('loading_page.drop_in_disabled'),
            tooltip: I18n().translate('loading_page.tooltip.drop_in_out'),
            onPressed: () => lobby.toggleDropInDropOut(),
          ),
        ],
        SizedBox(height: 0.8 * vmin),
        _buildControlButton(
          context: context,
          background: r?.isFogOfWar == true
              ? const Color(0xFF5C4D9A)
              : theme.surfaceAltColor,
          label: r?.isFogOfWar == true
              ? I18n().translate('loading_page.fog_of_war_enabled')
              : I18n().translate('loading_page.fog_of_war_disabled'),
          tooltip: I18n().translate('loading_page.tooltip.fog_of_war'),
          onPressed: () => lobby.toggleFogOfWar(),
        ),
      ],
    );
  }

  Widget _buildControlButton({
    required BuildContext context,
    required Color background,
    required String label,
    required String tooltip,
    required VoidCallback? onPressed,
    bool preserveColorsWhenDisabled = false,
  }) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final inactive = onPressed == null;
    final useDimmedColor = inactive && preserveColorsWhenDisabled;

    Widget button = SizedBox(
      height: 4.5 * vmin,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: background,
          disabledBackgroundColor: preserveColorsWhenDisabled
              ? background
              : context.read<ThemeService>().surfaceAltColor.withValues(
                  alpha: 0.65,
                ),
          foregroundColor: Colors.white,
          disabledForegroundColor: Colors.white,
          elevation: 0,
          shadowColor: Colors.transparent,
          surfaceTintColor: Colors.transparent,
          padding: EdgeInsets.symmetric(horizontal: 1.5 * vmin),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(5 * vmin),
          ),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.pressStart2p(
            fontSize: (1.05 * vmin).clamp(7.0, 10.5),
            color: Colors.white,
          ),
        ),
      ),
    );

    if (useDimmedColor) {
      button = Opacity(opacity: 0.6, child: button);
    }

    return _heavyTooltip(
      context: context,
      message: tooltip,
      child: _ScaleOnHover(child: button),
    );
  }
}

class _ModeRow extends StatefulWidget {
  const _ModeRow({
    required this.mode,
    required this.enabled,
    required this.maxPlayers,
    required this.currentPlayers,
    required this.isCtfBaseMode,
    this.onChanged,
  });
  final LobbyGameMode mode;
  final bool enabled;
  final int maxPlayers;
  final int currentPlayers;
  final bool isCtfBaseMode;
  final void Function(LobbyGameMode)? onChanged;

  @override
  State<_ModeRow> createState() => _ModeRowState();
}

class _ModeRowState extends State<_ModeRow> {
  bool _open = false;

  String _labelForMode(I18n i18n, LobbyGameMode mode) {
    if (mode == LobbyGameMode.teams)
      return i18n.translate('loading_page.modes.teams');
    if (mode == LobbyGameMode.fastElimination) {
      return i18n.translate('loading_page.modes.fast_elimination');
    }
    return i18n.translate(
      widget.isCtfBaseMode
          ? 'loading_page.modes.ctf_standard'
          : 'loading_page.modes.classic_standard',
    );
  }

  void _pick(LobbyGameMode next) {
    if (!widget.enabled || widget.onChanged == null) return;
    // On mobile, avoid switching to Teams before 4 players,
    // while keeping the mode active if the room is already in it.
    if (next == LobbyGameMode.teams &&
        widget.currentPlayers < 4 &&
        widget.mode != LobbyGameMode.teams) {
      return;
    }
    widget.onChanged!(next);
    setState(() => _open = false);
  }

  @override
  Widget build(BuildContext context) {
    final i18n = I18n();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final showTeams = widget.maxPlayers > 2;
    final teamsEnabled =
        showTeams &&
        (widget.currentPlayers >= 4 || widget.mode == LobbyGameMode.teams);
    final isDisabled = !widget.enabled;
    final currentLabel = _labelForMode(i18n, widget.mode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          i18n.translate('loading_page.game_mode_label'),
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            color: Colors.white,
            fontSize: (1.45 * vmin).clamp(9.0, 12.0),
          ),
        ),
        SizedBox(height: 0.8 * vmin),
        Opacity(
          opacity: isDisabled ? 0.5 : 1,
          child: TapRegion(
            onTapOutside: (_) {
              if (_open) setState(() => _open = false);
            },
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                GestureDetector(
                  onTap: isDisabled
                      ? null
                      : () => setState(() => _open = !_open),
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: vmin,
                      vertical: 0.8 * vmin,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.3),
                        width: 0.2 * vmin,
                      ),
                      borderRadius: BorderRadius.circular(0.8 * vmin),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            currentLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.pressStart2p(
                              color: Colors.white,
                              fontSize: (1.2 * vmin).clamp(8.0, 11.0),
                            ),
                          ),
                        ),
                        SizedBox(width: 0.8 * vmin),
                        Text(
                          '▼',
                          style: GoogleFonts.pressStart2p(
                            color: Colors.white,
                            fontSize: (1.1 * vmin).clamp(8.0, 10.0),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                if (_open)
                  Padding(
                    padding: EdgeInsets.only(top: 0.2 * vmin),
                    child: Material(
                      color: const Color(0xFF1A1A2E),
                      elevation: 8,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.35),
                          width: 0.2 * vmin,
                        ),
                        borderRadius: BorderRadius.vertical(
                          bottom: Radius.circular(0.8 * vmin),
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          _ModeOption(
                            label: i18n.translate(
                              widget.isCtfBaseMode
                                  ? 'loading_page.modes.ctf_standard'
                                  : 'loading_page.modes.classic_standard',
                            ),
                            selected: widget.mode == LobbyGameMode.classic,
                            onTap: () => _pick(LobbyGameMode.classic),
                          ),
                          if (showTeams)
                            _ModeOption(
                              label: i18n.translate('loading_page.modes.teams'),
                              selected: widget.mode == LobbyGameMode.teams,
                              enabled: teamsEnabled,
                              onTap: () => _pick(LobbyGameMode.teams),
                            ),
                          _ModeOption(
                            label: i18n.translate(
                              'loading_page.modes.fast_elimination',
                            ),
                            selected:
                                widget.mode == LobbyGameMode.fastElimination,
                            onTap: () => _pick(LobbyGameMode.fastElimination),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ModeOption extends StatelessWidget {
  const _ModeOption({
    required this.label,
    required this.selected,
    this.enabled = true,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    return InkWell(
      onTap: enabled ? onTap : null,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: vmin, vertical: 0.8 * vmin),
        decoration: BoxDecoration(
          color: selected
              ? Colors.white.withValues(alpha: 0.1)
              : (enabled
                    ? Colors.transparent
                    : Colors.white.withValues(alpha: 0.03)),
          border: selected
              ? Border(
                  left: BorderSide(
                    color: const Color(0xFFFFCC00),
                    width: 0.4 * vmin,
                  ),
                )
              : null,
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.pressStart2p(
            color: !enabled
                ? Colors.white.withValues(alpha: 0.35)
                : (selected ? const Color(0xFFFFCC00) : Colors.white),
            fontSize: (1.15 * vmin).clamp(8.0, 10.5),
          ),
        ),
      ),
    );
  }
}

class _ScaleOnHover extends StatefulWidget {
  const _ScaleOnHover({required this.child});

  final Widget child;

  @override
  State<_ScaleOnHover> createState() => _ScaleOnHoverState();
}

class _ScaleOnHoverState extends State<_ScaleOnHover> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedScale(
        scale: _hovered ? 1.05 : 1,
        duration: const Duration(milliseconds: 160),
        child: widget.child,
      ),
    );
  }
}

class _DashedRoundedRectPainter extends CustomPainter {
  _DashedRoundedRectPainter({
    required this.color,
    required this.radius,
    required this.strokeWidth,
  });

  final Color color;
  final double radius;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    const dash = 7.0;
    const gap = 5.0;
    for (final metric in metrics) {
      double distance = 0;
      while (distance < metric.length) {
        final next = distance + dash;
        canvas.drawPath(
          metric.extractPath(distance, next.clamp(0, metric.length)),
          paint,
        );
        distance += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRoundedRectPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.radius != radius ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

Color _colorFromHex(String hex) {
  final h = hex.replaceAll('#', '');
  if (h.length == 6) return Color(int.parse('FF$h', radix: 16));
  if (h.length == 8) return Color(int.parse(h, radix: 16));
  return Colors.white;
}

class _VirtualTeamDragData {
  const _VirtualTeamDragData({
    required this.playerId,
    required this.sourceTeamId,
  });
  final String playerId;
  final String sourceTeamId;
}

class _TeamsDisplay extends StatelessWidget {
  const _TeamsDisplay({
    required this.teams,
    required this.maxPlayers,
    required this.isHost,
    required this.myId,
    required this.onKick,
    this.onJoinTeam,
    this.onLeaveTeam,
    this.onVirtualPlayerTeamChange,
  });
  final List<LobbyTeam> teams;
  final int maxPlayers;
  final bool isHost;
  final String? myId;
  final void Function(String id) onKick;
  final void Function(String teamId)? onJoinTeam;
  final VoidCallback? onLeaveTeam;
  final void Function(String playerId, String targetTeamId)?
  onVirtualPlayerTeamChange;

  @override
  Widget build(BuildContext context) {
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final desiredTeamCount = maxPlayers <= 4 ? 2 : 3;
    final visibleTeams = teams.take(desiredTeamCount).toList();
    const teamCapacity = 2;
    if (visibleTeams.isEmpty) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        final colGap = 2.0 * vmin;
        final rowGap = 2.0 * vmin;
        final teamCellPad = 0.6 * vmin;
        final headerHeight = (5.4 * vmin).clamp(38.0, 62.0);
        final teamCount = visibleTeams.length;
        final columnWidth =
            (constraints.maxWidth - ((teamCount - 1) * colGap)) / teamCount;

        var cardW = (columnWidth * 0.9).clamp(88.0, 126.0);
        var cardH = (cardW / 0.84).clamp(106.0, 150.0);
        final slotHeight = cardH + 2 * teamCellPad;
        final neededHeight =
            (teamCapacity * slotHeight) + ((teamCapacity - 1) * rowGap);
        final availableHeight =
            (constraints.maxHeight - headerHeight - (1.0 * vmin)).clamp(
              80.0,
              10000.0,
            );
        if (neededHeight > availableHeight) {
          final scale = availableHeight / neededHeight;
          cardW *= scale;
          cardH *= scale;
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: headerHeight,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < visibleTeams.length; i++) ...[
                    if (i > 0) SizedBox(width: colGap),
                    Expanded(
                      child: _buildTeamHeader(
                        context,
                        visibleTeams[i],
                        teamCapacity: teamCapacity,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(height: 1.0 * vmin),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (var i = 0; i < visibleTeams.length; i++) ...[
                    if (i > 0) SizedBox(width: colGap),
                    Expanded(
                      child: _buildTeamColumn(
                        context,
                        visibleTeams[i],
                        cardW: cardW,
                        cardH: cardH,
                        rowGap: rowGap,
                        teamCellPad: teamCellPad,
                        teamCapacity: teamCapacity,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTeamHeader(
    BuildContext context,
    LobbyTeam team, {
    required int teamCapacity,
  }) {
    final i18n = I18n();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final theme = context.watch<ThemeService>();
    final teamColor = _colorFromHex(team.color);
    final isOwn = team.isOwnTeam;
    final isFull = team.players.length >= teamCapacity;
    final btnFont = (0.58 * vmin).clamp(5.5, 7.0);
    final btnPadH = 0.48 * vmin;
    final btnPadV = 0.48 * vmin;
    final teamBtnStyle = ButtonStyle(
      minimumSize: WidgetStateProperty.all(Size(0, 2.35 * vmin)),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      padding: WidgetStateProperty.all(
        EdgeInsets.symmetric(horizontal: btnPadH, vertical: btnPadV),
      ),
      visualDensity: VisualDensity.standard,
    );

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 0.65 * vmin,
        vertical: 0.45 * vmin,
      ),
      decoration: BoxDecoration(
        border: Border.all(color: teamColor, width: 0.28 * vmin),
        borderRadius: BorderRadius.circular(1.4 * vmin),
      ),
      child: Row(
        children: [
          Text(
            team.icon,
            style: TextStyle(fontSize: (1.35 * vmin).clamp(11.0, 15.0)),
          ),
          SizedBox(width: 0.45 * vmin),
          Expanded(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.center,
              child: Text(
                i18n
                    .translate('loading_page.team_label')
                    .replaceAll('{{id}}', team.id),
                maxLines: 1,
                softWrap: false,
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  color: teamColor,
                  fontSize: (0.95 * vmin).clamp(7.5, 9.5),
                  height: 1.1,
                ),
              ),
            ),
          ),
          SizedBox(width: 0.45 * vmin),
          if (!isOwn && onJoinTeam != null)
            ElevatedButton(
              onPressed: isFull ? null : () => onJoinTeam!(team.id),
              style: teamBtnStyle.copyWith(
                backgroundColor: WidgetStateProperty.resolveWith(
                  (s) => s.contains(WidgetState.disabled)
                      ? Colors.grey.withValues(alpha: 0.55)
                      : theme.primaryColor,
                ),
                foregroundColor: const WidgetStatePropertyAll(Colors.white),
              ),
              child: Text(
                i18n.translate('loading_page.join_team'),
                maxLines: 1,
                softWrap: false,
                style: GoogleFonts.pressStart2p(
                  fontSize: btnFont,
                  height: 1.05,
                ),
              ),
            )
          else if (isOwn && onLeaveTeam != null)
            ElevatedButton(
              onPressed: onLeaveTeam,
              style: teamBtnStyle.copyWith(
                backgroundColor: WidgetStatePropertyAll(theme.errorColor),
                foregroundColor: const WidgetStatePropertyAll(Colors.white),
              ),
              child: Text(
                i18n.translate('loading_page.leave_team'),
                maxLines: 1,
                softWrap: false,
                style: GoogleFonts.pressStart2p(
                  fontSize: btnFont,
                  height: 1.05,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTeamColumn(
    BuildContext context,
    LobbyTeam team, {
    required double cardW,
    required double cardH,
    required double rowGap,
    required double teamCellPad,
    required int teamCapacity,
  }) {
    final teamColor = _colorFromHex(team.color);
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final column = Column(
      children: [
        for (int index = 0; index < teamCapacity; index++) ...[
          if (index < team.players.length)
            Padding(
              padding: EdgeInsets.all(teamCellPad),
              child: SizedBox(
                width: cardW,
                height: cardH,
                child: _teamSlotPlayerCard(
                  team.players[index],
                  team,
                  cardW,
                  cardH,
                ),
              ),
            )
          else
            Padding(
              padding: EdgeInsets.all(teamCellPad),
              child: SizedBox(
                width: cardW,
                height: cardH,
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(0.8 * vmin),
                    color: Colors.white.withValues(alpha: 0.03),
                  ),
                  child: CustomPaint(
                    painter: _DashedRoundedRectPainter(
                      color: teamColor.withValues(alpha: 0.45),
                      radius: 0.8 * vmin,
                      strokeWidth: 0.22 * vmin,
                    ),
                    child: Center(
                      child: Text(
                        '?',
                        style: GoogleFonts.pressStart2p(
                          color: Colors.white24,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          if (index < teamCapacity - 1) SizedBox(height: rowGap),
        ],
      ],
    );

    final moveHandler = onVirtualPlayerTeamChange;
    if (!isHost || moveHandler == null) {
      return column;
    }

    return DragTarget<_VirtualTeamDragData>(
      onWillAcceptWithDetails: (details) {
        final d = details.data;
        if (d.sourceTeamId == team.id) return false;
        if (team.players.length >= teamCapacity) return false;
        return true;
      },
      onAcceptWithDetails: (details) {
        moveHandler(details.data.playerId, team.id);
      },
      builder: (context, candidateData, rejectedData) {
        final highlight = candidateData.isNotEmpty;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          decoration: highlight
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(1.2 * vmin),
                  border: Border.all(
                    color: teamColor.withValues(alpha: 0.95),
                    width: 0.45 * vmin,
                  ),
                  color: teamColor.withValues(alpha: 0.14),
                )
              : null,
          child: column,
        );
      },
    );
  }

  Widget _teamSlotPlayerCard(
    LobbyPlayer player,
    LobbyTeam team,
    double cardW,
    double cardH,
  ) {
    Widget card() => LobbyPlayerCard(
      player: player,
      canKick: isHost && myId != null && player.id != myId && !player.isHost,
      onKick: isHost ? () => onKick(player.id) : null,
    );

    final moveHandler = onVirtualPlayerTeamChange;
    if (!isHost || !player.isVirtual || moveHandler == null) {
      return card();
    }

    return LongPressDraggable<_VirtualTeamDragData>(
      data: _VirtualTeamDragData(playerId: player.id, sourceTeamId: team.id),
      feedback: Material(
        color: Colors.transparent,
        elevation: 12,
        shadowColor: Colors.black54,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(width: cardW, height: cardH, child: card()),
      ),
      childWhenDragging: Opacity(opacity: 0.38, child: card()),
      child: card(),
    );
  }
}

class _VirtualPlayerRow extends StatelessWidget {
  const _VirtualPlayerRow({
    required this.lobby,
    required this.room,
    required this.menuOpen,
    required this.onToggleMenu,
  });
  final LobbyRoomService lobby;
  final RoomLobbySnapshot? room;
  final bool menuOpen;
  final VoidCallback onToggleMenu;

  static const Color _aggressiveRed = Color(0xFFFF0000);
  static const Color _defensiveBlue = Color(0xFF0000FF);

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final r = room;
    final locked = r?.isLocked ?? false;
    final full = r != null && r.players.length >= r.playerMax;
    final addBotDisabled = locked || full;
    final btnHeight = 4.5 * vmin;
    // Same rendering as `.action-btn` / `:disabled` (web loading-page).
    final disabledBg = theme.surfaceAltColor;
    final disabledFg = theme.textMutedColor;
    final disabledBorder = theme.surfaceAltColor;

    Widget addBotButton = OutlinedButton(
      onPressed: addBotDisabled ? null : onToggleMenu,
      style: OutlinedButton.styleFrom(
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: addBotDisabled ? disabledFg : Colors.white,
        backgroundColor: addBotDisabled ? disabledBg : theme.primaryColor,
        side: BorderSide(
          color: addBotDisabled ? disabledBorder : theme.primaryColor,
          width: 0.3 * vmin,
        ),
        padding: EdgeInsets.symmetric(horizontal: vmin, vertical: 0.5 * vmin),
        minimumSize: Size(double.infinity, btnHeight),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(5 * vmin),
        ),
      ),
      child: Text(
        I18n().translate('loading_page.add_virtual_player'),
        style: GoogleFonts.pressStart2p(
          fontSize: (1.1 * vmin).clamp(8.0, 11.0),
          color: addBotDisabled ? disabledFg : Colors.white,
        ),
      ),
    );

    if (addBotDisabled) {
      addBotButton = Opacity(opacity: 0.5, child: addBotButton);
      return _heavyTooltip(
        context: context,
        message: I18n().translate('loading.virtual_player'),
        child: addBotButton,
      );
    }

    final showPrompt = menuOpen && !locked && !full;

    // The menu must be in the layout flow: a Stack sized to the button does not
    // hit-test the area above it, taps go through to the chat (Expanded).
    return LayoutBuilder(
      builder: (context, constraints) {
        final side = constraints.maxWidth * 0.05;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (showPrompt) ...[
              Padding(
                padding: EdgeInsets.symmetric(horizontal: side),
                child: _virtualTypePrompt(
                  context: context,
                  vmin: vmin,
                  lobby: lobby,
                  onCloseMenu: onToggleMenu,
                ),
              ),
              SizedBox(height: 0.5 * vmin),
            ],
            addBotButton,
          ],
        );
      },
    );
  }

  /// Aligned with `.type-prompt` + `.aggressive-button` / `.defensive-button` (web SCSS).
  static Widget _virtualTypePrompt({
    required BuildContext context,
    required double vmin,
    required LobbyRoomService lobby,
    required VoidCallback onCloseMenu,
  }) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(0.8 * vmin),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 1.5 * vmin,
            spreadRadius: 0,
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(1.0 * vmin),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              I18n().translate('loading_page.choose_virtual_type'),
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                color: Colors.black,
                fontSize: (1.2 * vmin).clamp(8.0, 12.0),
                height: 1.15,
              ),
            ),
            SizedBox(height: 0.5 * vmin),
            Row(
              children: [
                Expanded(
                  child: _virtualTypeChip(
                    vmin: vmin,
                    background: _aggressiveRed,
                    label: I18n().translate(
                      'loading_page.virtual_type.aggressive',
                    ),
                    onTap: () {
                      final snap = lobby.room;
                      if (snap == null ||
                          snap.isLocked ||
                          snap.players.length >= snap.playerMax) {
                        return;
                      }
                      lobby.addVirtualPlayer('Aggressif');
                      onCloseMenu();
                    },
                  ),
                ),
                SizedBox(width: 0.5 * vmin),
                Expanded(
                  child: _virtualTypeChip(
                    vmin: vmin,
                    background: _defensiveBlue,
                    label: I18n().translate(
                      'loading_page.virtual_type.defensive',
                    ),
                    onTap: () {
                      final snap = lobby.room;
                      if (snap == null ||
                          snap.isLocked ||
                          snap.players.length >= snap.playerMax) {
                        return;
                      }
                      lobby.addVirtualPlayer('Défensif');
                      onCloseMenu();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static Widget _virtualTypeChip({
    required double vmin,
    required Color background,
    required String label,
    required VoidCallback onTap,
  }) {
    final radius = BorderRadius.circular(0.5 * vmin);
    return Material(
      color: background,
      borderRadius: radius,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: Padding(
          padding: EdgeInsets.symmetric(
            vertical: 0.5 * vmin,
            horizontal: 1.0 * vmin,
          ),
          child: Center(
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.pressStart2p(
                color: Colors.white,
                fontSize: (1.1 * vmin).clamp(7.0, 10.0),
                height: 1.1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BottomActions extends StatelessWidget {
  const _BottomActions({
    required this.lobby,
    required this.room,
    required this.onLeave,
  });
  final LobbyRoomService lobby;
  final RoomLobbySnapshot? room;
  final VoidCallback onLeave;

  String _buildStartTooltip(RoomLobbySnapshot? r) {
    if (r == null) return '';
    final i18n = I18n();
    final conditions = <String>[];
    final isSmallGame = r.playerMax == 2;
    if (!r.isLocked && !isSmallGame) {
      conditions.add(i18n.translate('loading_page.start_tooltip.locked'));
    }
    final mode = r.lobbyGameMode;
    if (mode == LobbyGameMode.classic ||
        mode == LobbyGameMode.fastElimination) {
      if (r.players.length < r.playerMin) {
        conditions.add(
          i18n.translateWithParams('loading_page.start_tooltip.min_players', {
            'count': '${r.playerMin}',
          }),
        );
      }
    }
    if (mode == LobbyGameMode.teams) {
      final teams = r.teams;
      if (teams != null) {
        final active = teams.where((t) => t.players.isNotEmpty).toList();
        final totalAssigned = teams.fold<int>(
          0,
          (s, t) => s + t.players.length,
        );
        if (active.length < 2) {
          conditions.add(
            i18n.translate('loading_page.start_tooltip.min_teams'),
          );
        }
        if (active.any((t) => t.players.length != 2)) {
          conditions.add(
            i18n.translate('loading_page.start_tooltip.team_size'),
          );
        }
        if (totalAssigned < r.players.length) {
          conditions.add(
            i18n.translate('loading_page.start_tooltip.unassigned'),
          );
        }
      }
    }
    return conditions.map((c) => '\u2022 $c').join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final vmin = MediaQuery.sizeOf(context).shortestSide * 0.01;
    final r = room;
    final canStart =
        r != null &&
        lobby.isHost &&
        r.isLocked &&
        lobby.canStartGame() &&
        r.players.length >= r.playerMin;
    final tooltipText = canStart ? '' : _buildStartTooltip(r);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (lobby.isHost)
          Tooltip(
            message: tooltipText,
            textStyle: GoogleFonts.pressStart2p(
              fontSize: 7,
              color: Colors.white,
              height: 1.5,
            ),
            decoration: BoxDecoration(
              color: const Color(0xDD000000),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Opacity(
              opacity: canStart ? 1.0 : 0.5,
              child: ElevatedButton(
                onPressed: canStart ? () => lobby.startGame() : null,
                style: ElevatedButton.styleFrom(
                  elevation: 0,
                  shadowColor: Colors.transparent,
                  surfaceTintColor: Colors.transparent,
                  backgroundColor: canStart
                      ? theme.primaryColor
                      : theme.surfaceAltColor,
                  foregroundColor: canStart
                      ? theme.onPrimaryButtonText
                      : theme.textMutedColor,
                  disabledBackgroundColor: theme.surfaceAltColor,
                  disabledForegroundColor: theme.textMutedColor,
                  padding: EdgeInsets.symmetric(
                    vertical: 0.5 * vmin,
                    horizontal: vmin,
                  ),
                  minimumSize: Size.fromHeight(4.5 * vmin),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(5 * vmin),
                    side: BorderSide(
                      color: canStart
                          ? theme.primaryColor
                          : theme.surfaceAltColor,
                      width: 0.3 * vmin,
                    ),
                  ),
                ),
                child: Text(
                  I18n().translate('loading_page.start_game'),
                  style: GoogleFonts.pressStart2p(
                    fontSize: (1.05 * vmin).clamp(8.0, 11.0),
                    color: canStart
                        ? theme.onPrimaryButtonText
                        : theme.textMutedColor,
                  ),
                ),
              ),
            ),
          ),
        if (lobby.isHost) const SizedBox(height: 8),
        OutlinedButton(
          onPressed: onLeave,
          style: OutlinedButton.styleFrom(
            foregroundColor: theme.primaryColor,
            side: BorderSide(color: theme.primaryColor, width: 0.3 * vmin),
            backgroundColor: theme.primarySurfaceColor,
            padding: EdgeInsets.symmetric(vertical: 1.1 * vmin),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(5 * vmin),
            ),
          ),
          child: Text(
            I18n().translate('loading_page.leave_game'),
            style: GoogleFonts.pressStart2p(
              fontSize: (1.05 * vmin).clamp(8.0, 11.0),
              color: theme.onPrimarySurfaceColor,
            ),
          ),
        ),
      ],
    );
  }
}
