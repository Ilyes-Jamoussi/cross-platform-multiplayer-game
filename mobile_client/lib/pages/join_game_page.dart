import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/app/stats_route_args.dart';
import 'package:mobile_client/models/public_room_info.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/friends_service.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/coin_icon.dart';
import 'package:mobile_client/widget/game_creation_page_loading.dart';
import 'package:mobile_client/widget/poly_arena_message_popup.dart';
import 'package:mobile_client/widget/profile_background.dart';
import 'package:mobile_client/widget/public_room_card.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Join a game with a code or the public list (Angular `join-page` equivalent).
class JoinGamePage extends StatefulWidget {
  const JoinGamePage({super.key});

  @override
  State<JoinGamePage> createState() => _JoinGamePageState();
}

class _JoinGamePageState extends State<JoinGamePage> {
  final _codeController = TextEditingController();
  LobbyRoomService? _lobby;
  bool _loadingRooms = true;
  bool _submitting = false;

  bool _showFeeModal = false;
  int _pendingFee = 0;
  int _lastEntryFeeForStats = 0;
  bool _lobbyHooksAttached = false;

  bool _showPrivateJoinModal = false;
  bool _digitsOnlyError = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_lobbyHooksAttached) {
      _lobbyHooksAttached = true;
      _lobby = context.read<LobbyRoomService>();
      _lobby!.onGuestJoinNavigationToStats = _navigateToStatsAfterJoin;
      _lobby!.onReconnectNavigateToGame = _navigateToGameOnReconnect;
      _lobby!.addListener(_onLobbyUpdate);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          // Same socket uid as `registerFriendSocket` ("friends only" list on broadcast).
          context.read<FriendsService>().registerFriendSocket();
          _loadRoomsAndListenSocket();
        }
      });
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _lobby?.removeListener(_onLobbyUpdate);
    _lobby?.onGuestJoinNavigationToStats = null;
    _lobby?.onReconnectNavigateToGame = null;
    _lobby?.stopListeningPublicRooms();
    super.dispose();
  }

  void _onLobbyUpdate() {
    if (!mounted) return;
    final lobby = _lobby;
    if (lobby == null) return;

    if (lobby.pendingKickMessage != null) {
      final msg = lobby.pendingKickMessage!;
      final titleKey = lobby.pendingKickTitleKey ?? 'popup.connection_error_title';
      lobby.clearPendingMessages();
      lobby.cancelGuestJoinPending();
      lobby.leaveGameSocket();
      lobby.resetAfterLeave();
      final rootNav = Navigator.of(context, rootNavigator: true);
      rootNav.pushNamedAndRemoveUntil(AppRoutes.home, (r) => false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!rootNav.mounted) return;
        showPolyArenaMessageDialog(
          context: rootNav.context,
          kind: PolyArenaMessageKind.info,
          title: titleKey,
          message: msg,
          okLabel: 'common.ok',
        );
      });
      setState(() {});
      return;
    }

    final denied = lobby.pendingJoinDeniedMessage;
    if (denied != null) {
      lobby.clearPendingJoinDenied();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        showPolyArenaMessageDialog(
          context: context,
          kind: PolyArenaMessageKind.info,
          title: 'popup.error_title',
          message: denied,
          okLabel: 'common.ok',
        );
      });
    }
    setState(() {});
  }

  Future<void> _loadRoomsAndListenSocket() async {
    final lobby = context.read<LobbyRoomService>();
    setState(() => _loadingRooms = true);
    await lobby.fetchPublicRooms();
    if (!mounted) return;
    lobby.startListeningPublicRooms();
    setState(() => _loadingRooms = false);
  }

  bool _isValidCode(String s) => RegExp(r'^\d{4}$').hasMatch(s);

  Future<void> _navigateToStatsAfterJoin() async {
    if (!mounted) return;
    final id = _lobby?.roomId;
    if (id == null) return;
    await Navigator.pushReplacementNamed(
      context,
      AppRoutes.stats,
      arguments: StatsRouteArgs(roomId: id, entryFee: _lastEntryFeeForStats),
    );
  }

  Future<void> _navigateToGameOnReconnect() async {
    if (!mounted) return;
    await Navigator.pushReplacementNamed(context, AppRoutes.game);
  }

  Future<void> _submitFromCode() async {
    final code = _codeController.text.trim();
    if (!_isValidCode(code)) return;

    final lobby = context.read<LobbyRoomService>();
    final auth = context.read<AuthService>();

    setState(() => _submitting = true);
    try {
      lobby.roomId = code;
      final errVal = await lobby.validateRoom();
      if (!mounted) return;
      if (errVal != null) {
        lobby.cancelGuestJoinPending();
        await showPolyArenaMessageDialog(
          context: context,
          kind: PolyArenaMessageKind.info,
          title: 'join_page.room_not_found_title',
          message: lobby.localizeJoinServerMessage(errVal),
          okLabel: 'common.ok',
        );
        return;
      }

      final data = await lobby.fetchRoomData(code);
      if (!mounted) return;
      if (data == null) {
        lobby.cancelGuestJoinPending();
        await showPolyArenaMessageDialog(
          context: context,
          kind: PolyArenaMessageKind.info,
          title: 'popup.error_title',
          message: 'common.room_info_error',
          okLabel: 'common.ok',
        );
        return;
      }

      final fee = (data['entryFee'] as num?)?.toInt() ?? 0;
      final currency = auth.currentUser?.virtualCurrency ?? 0;

      if (fee == 0) {
        _lastEntryFeeForStats = 0;
        final joined = await lobby.requestGuestJoinSocket();
        if (!mounted) return;
        if (!joined) {
          showGamePageSnackBar(context, I18n().translate('home_page.join_error'), kind: GamePageSnackKind.error);
          lobby.cancelGuestJoinPending();
        }
        return;
      }

      if (currency < fee) {
        lobby.cancelGuestJoinPending();
        if (!mounted) return;
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(I18n().translate('popup.error_title')),
            content: Text(
              I18n().translateWithParams(
                'common.insufficient_currency',
                {'fee': '$fee', 'balance': '$currency'},
              ),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (r) => false,
                  );
                },
                child: Text(I18n().translate('common.ok')),
              ),
            ],
          ),
        );
        return;
      }

      _pendingFee = fee;
      _lastEntryFeeForStats = fee;
      setState(() {
        _showFeeModal = true;
        _showPrivateJoinModal = false;
      });
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _confirmFeeJoin() async {
    final lobby = context.read<LobbyRoomService>();
    setState(() => _showFeeModal = false);
    final joined = await lobby.requestGuestJoinSocket();
    if (!mounted) return;
    if (!joined) {
      showGamePageSnackBar(context, I18n().translate('home_page.join_error'), kind: GamePageSnackKind.error);
      lobby.cancelGuestJoinPending();
    }
  }

  void _cancelFeeJoin() {
    context.read<LobbyRoomService>().cancelGuestJoinPending();
    setState(() {
      _showFeeModal = false;
      _pendingFee = 0;
    });
  }

  Future<void> _joinPublicRoom(PublicRoomInfo room) async {
    _codeController.text = room.roomId;
    await _submitFromCode();
  }

  void _openPrivateJoinModal() {
    setState(() {
      _showPrivateJoinModal = true;
      _digitsOnlyError = false;
    });
  }

  void _closePrivateJoinModal() {
    FocusScope.of(context).unfocus();
    setState(() {
      _showPrivateJoinModal = false;
      _digitsOnlyError = false;
    });
  }

  void _onPrivateCodeChanged(String value) {
    final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
    final next = digitsOnly.length > 4
        ? digitsOnly.substring(0, 4)
        : digitsOnly;
    final hadNonDigit = value.isNotEmpty && value != digitsOnly;
    if (next != _codeController.text) {
      _codeController.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: next.length),
      );
    }
    setState(() => _digitsOnlyError = hadNonDigit);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final lobby = context.watch<LobbyRoomService>();
    final theme = context.watch<ThemeService>();
    final friends = context.watch<FriendsService>().friends;
    final currency = auth.currentUser?.virtualCurrency ?? 0;
    final primary = theme.primaryColor;
    final secondary = theme.secondaryColor;
    final topInset = MediaQuery.paddingOf(context).top;
    final i18n = I18n();

    final friendUids = friends.map((f) => f.uid).toSet();
    final rooms = lobby.publicRooms
        .where((r) =>
            !r.isFriendsOnly ||
            (r.hostUid != null && friendUids.contains(r.hostUid)))
        .toList();
    final openRooms =
        rooms.where((r) => r.isOpenToMorePlayers).toList();

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const Positioned.fill(child: ProfileBackground()),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              WebGameFlowHeader(
                onMenuPressed: () {
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.home,
                    (r) => false,
                  );
                },
              ),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: _JoinPrivateTriggerButton(
                            label: i18n.translate('join_page.join_private_game'),
                            onPressed: _openPrivateJoinModal,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                ColoredBox(
                                  color: Colors.black.withValues(alpha: 0.7),
                                ),
                                Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    12,
                                    12,
                                    12,
                                    6,
                                  ),
                                  child: Text(
                                    i18n.translate(
                                      'join_page.parties_publiques',
                                    ),
                                    textAlign: TextAlign.center,
                                    style: GoogleFonts.pressStart2p(
                                      fontSize: 11,
                                      height: 1.35,
                                      color: Colors.white,
                                      shadows: [
                                        Shadow(
                                          offset: const Offset(2, 2),
                                          color: primary,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: _loadingRooms
                                      ? GameCreationPageLoading(
                                          messageKey:
                                              'join_page.loading_public_rooms',
                                        )
                                      : lobby.publicRoomsLoadError
                                          ? _JoinPublicRoomsError(
                                              onRetry: _loadRoomsAndListenSocket,
                                            )
                                          : openRooms.isEmpty
                                              ? Center(
                                                  child: Padding(
                                                    padding:
                                                        const EdgeInsets.all(
                                                      20,
                                                    ),
                                                    child: Text(
                                                      i18n.translate(
                                                        'join_page.aucune_partie',
                                                      ),
                                                      textAlign:
                                                          TextAlign.center,
                                                      style:
                                                          GoogleFonts
                                                              .pressStart2p(
                                                        fontSize: 9,
                                                        height: 1.5,
                                                        color: Colors.white,
                                                      ),
                                                    ),
                                                  ),
                                                )
                                              : LayoutBuilder(
                                                    builder: (context, c) {
                                                      final cardH = c.maxHeight.clamp(250.0, 320.0);
                                                      return Align(
                                                        alignment: Alignment.topCenter,
                                                        child: SizedBox(
                                                          height: cardH,
                                                          child: ListView.builder(
                                                            scrollDirection: Axis.horizontal,
                                                            padding: const EdgeInsets.fromLTRB(14, 4, 14, 16),
                                                            itemCount: openRooms.length,
                                                            itemBuilder: (context, index) {
                                                              final r = openRooms[index];
                                                              return Padding(
                                                                padding: const EdgeInsets.only(right: 14),
                                                                child: SizedBox(
                                                                  width: 200,
                                                                  child: PublicRoomCard(
                                                                    room: r,
                                                                    onJoin: () => _joinPublicRoom(r),
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
                                Positioned.fill(
                                  child: IgnorePointer(
                                    child: CustomPaint(
                                      painter: _DashedRoundedRectPainter(
                                        color: secondary,
                                        strokeWidth: 2,
                                        borderRadius: 8,
                                        dashLength: 6,
                                        gapLength: 4,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            top: topInset + 12,
            right: 20,
            child: const WebGameFlowFloatingActions(),
          ),
          if (_showPrivateJoinModal)
            _PrivateJoinOverlay(
              i18n: i18n,
              theme: theme,
              codeController: _codeController,
              digitsOnlyError: _digitsOnlyError,
              submitting: _submitting,
              onClose: _closePrivateJoinModal,
              onCodeChanged: _onPrivateCodeChanged,
              onSubmit: _submitFromCode,
              isValidCode: _isValidCode,
            ),
          if (_showFeeModal)
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: _cancelFeeJoin,
                child: ColoredBox(
                  color: Colors.black.withValues(alpha: 0.8),
                  child: Center(
                    child: GestureDetector(
                      onTap: () {},
                      child: Container(
                        margin: const EdgeInsets.all(24),
                        padding: const EdgeInsets.all(22),
                        constraints: const BoxConstraints(maxWidth: 420),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFF1a1a2e), Color(0xFF16213e)],
                          ),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: secondary, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: theme.secondaryDisabledColor,
                              blurRadius: 24,
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              i18n.translate('join_page.paid_game'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 11,
                                height: 1.4,
                                color: secondary,
                              ),
                            ),
                            const SizedBox(height: 16),
                            _FeeModalRow(
                              label: i18n.translate('join_page.entry_price'),
                              coinColor: const Color(0xFFFF6B6B),
                              amount: _pendingFee,
                            ),
                            _FeeModalRow(
                              label: i18n.translate('join_page.your_balance'),
                              coinColor: const Color(0xFF4A9EFF),
                              amount: currency,
                            ),
                            Divider(
                              color: secondary.withValues(alpha: 0.5),
                              height: 20,
                            ),
                            _FeeModalRow(
                              label:
                                  i18n.translate('join_page.after_payment'),
                              coinColor: secondary,
                              amount: currency - _pendingFee,
                              emphasize: true,
                            ),
                            const SizedBox(height: 20),
                            Row(
                              children: [
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: _confirmFeeJoin,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: primary,
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                    ),
                                    child: Text(
                                      i18n.translate('common.confirm'),
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: 8,
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: _cancelFeeJoin,
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: Colors.white,
                                      side: BorderSide(
                                        color: Colors.white.withValues(
                                          alpha: 0.35,
                                        ),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                    ),
                                    child: Text(
                                      i18n.translate('common.cancel'),
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: 8,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
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

class _JoinPrivateTriggerButton extends StatelessWidget {
  const _JoinPrivateTriggerButton({
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final primary = theme.primaryColor;
    final surface = theme.primarySurfaceColor;
    final onSurface = theme.onPrimarySurfaceColor;
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;

    final fontSize = (1.05 * vMin).clamp(7.5, 10.0);
    final padH = (2.2 * vMin).clamp(14.0, 22.0);
    final padV = (2.0 * vMin).clamp(12.0, 18.0);
    final br = (4 * vMin).clamp(8.0, 14.0);

    return Padding(
      padding: EdgeInsets.symmetric(vertical: 0.5 * vMin),
      child: Material(
        color: surface,
        borderRadius: BorderRadius.circular(br),
        child: InkWell(
          borderRadius: BorderRadius.circular(br),
          onTap: onPressed,
          child: Container(
            padding: EdgeInsets.symmetric(
              horizontal: padH,
              vertical: padV,
            ),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(br),
              border: Border.all(
                color: primary,
                width: math.max(2, 0.45 * vMin),
              ),
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: fontSize,
                height: 1.25,
                color: onSurface,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _JoinPublicRoomsError extends StatelessWidget {
  const _JoinPublicRoomsError({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final primary = theme.primaryColor;
    final surface = theme.primarySurfaceColor;
    final onSurface = theme.onPrimarySurfaceColor;
    final i18n = I18n();
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              i18n.translate('join_page.public_rooms_error'),
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: 9,
                height: 1.5,
                color: Colors.white,
              ),
            ),
            SizedBox(height: 2 * vMin),
            Material(
              color: surface,
              borderRadius: BorderRadius.circular(4 * vMin),
              child: InkWell(
                borderRadius: BorderRadius.circular(4 * vMin),
                onTap: () => onRetry(),
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: 4 * vMin,
                    vertical: 2.5 * vMin,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(4 * vMin),
                    border: Border.all(color: primary, width: 2),
                  ),
                  child: Text(
                    i18n.translate('join_page.retry'),
                    style: GoogleFonts.pressStart2p(
                      fontSize: 8,
                      color: onSurface,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PrivateJoinOverlay extends StatelessWidget {
  const _PrivateJoinOverlay({
    required this.i18n,
    required this.theme,
    required this.codeController,
    required this.digitsOnlyError,
    required this.submitting,
    required this.onClose,
    required this.onCodeChanged,
    required this.onSubmit,
    required this.isValidCode,
  });

  final I18n i18n;
  final ThemeService theme;
  final TextEditingController codeController;
  final bool digitsOnlyError;
  final bool submitting;
  final VoidCallback onClose;
  final void Function(String) onCodeChanged;
  final Future<void> Function() onSubmit;
  final bool Function(String) isValidCode;

  @override
  Widget build(BuildContext context) {
    final primary = theme.primaryColor;
    final secondary = theme.secondaryColor;
    final surface = theme.primarySurfaceColor;
    final onSurface = theme.onPrimarySurfaceColor;
    final kb = MediaQuery.viewInsetsOf(context).bottom;

    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onClose,
        child: ColoredBox(
          color: Colors.black.withValues(alpha: 0.78),
          child: SafeArea(
            child: Center(
              child: GestureDetector(
                onTap: () {},
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + kb),
                  child: ValueListenableBuilder<TextEditingValue>(
                    valueListenable: codeController,
                    builder: (context, value, _) {
                      final text = value.text;
                      final len = text.length;
                      final complete = len == 4;
                      final ready = isValidCode(text) && !submitting;
                      return Container(
                        constraints: const BoxConstraints(maxWidth: 400),
                        padding: const EdgeInsets.fromLTRB(18, 18, 18, 14),
                        decoration: BoxDecoration(
                          color: surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: primary, width: 3),
                          boxShadow: [
                            BoxShadow(
                              color: secondary.withValues(alpha: 0.55),
                              offset: const Offset(0, 5),
                              blurRadius: 0,
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              i18n.translate('join_page.entrez_code'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 10,
                                height: 1.35,
                                color: secondary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              i18n.translate('join_page.code_hint'),
                              textAlign: TextAlign.center,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 7,
                                height: 1.5,
                                color: onSurface.withValues(alpha: 0.82),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              controller: codeController,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              style: GoogleFonts.pressStart2p(
                                fontSize: 16,
                                letterSpacing: 4,
                                color: onSurface,
                              ),
                              decoration: InputDecoration(
                                hintText: i18n.translate('join_page.code'),
                                hintStyle: GoogleFonts.pressStart2p(
                                  fontSize: 9,
                                  letterSpacing: 0,
                                  color: onSurface.withValues(alpha: 0.45),
                                ),
                                filled: true,
                                fillColor: surface,
                                contentPadding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                  horizontal: 12,
                                ),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: BorderSide(
                                    color: primary,
                                    width: 2,
                                  ),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: BorderSide(
                                    color: primary,
                                    width: 2,
                                  ),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  borderSide: BorderSide(
                                    color: secondary,
                                    width: 2,
                                  ),
                                ),
                              ),
                              onChanged: onCodeChanged,
                            ),
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: complete ? secondary : primary,
                                  width: 2,
                                ),
                                gradient: LinearGradient(
                                  begin: const Alignment(-0.2, -1),
                                  end: const Alignment(0.2, 1),
                                  colors: [
                                    Colors.black.withValues(alpha: 0.09),
                                    Colors.black.withValues(alpha: 0.04),
                                  ],
                                ),
                              ),
                              child: Row(
                                children: List.generate(4, (i) {
                                  final filled = len > i;
                                  return Expanded(
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 3,
                                      ),
                                      child: AnimatedContainer(
                                        duration: const Duration(
                                          milliseconds: 200,
                                        ),
                                        height: 11,
                                        decoration: BoxDecoration(
                                          borderRadius:
                                              BorderRadius.circular(2),
                                          gradient: filled
                                              ? LinearGradient(
                                                  begin: Alignment.topCenter,
                                                  end: Alignment.bottomCenter,
                                                  colors: [
                                                    secondary,
                                                    primary,
                                                  ],
                                                )
                                              : null,
                                          color: filled
                                              ? null
                                              : Colors.black.withValues(
                                                  alpha: 0.1,
                                                ),
                                          border: Border.all(
                                            color: filled
                                                ? primary
                                                : Colors.black.withValues(
                                                    alpha: 0.18,
                                                  ),
                                          ),
                                          boxShadow: filled
                                              ? [
                                                  BoxShadow(
                                                    color: secondary.withValues(
                                                      alpha: 0.35,
                                                    ),
                                                    blurRadius: 4,
                                                  ),
                                                ]
                                              : null,
                                        ),
                                      ),
                                    ),
                                  );
                                }),
                              ),
                            ),
                            if (digitsOnlyError) ...[
                              const SizedBox(height: 8),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF4444)
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(5),
                                  border: Border.all(
                                    color: const Color(0xFFFF4444),
                                    width: 2,
                                  ),
                                ),
                                child: Text(
                                  i18n.translate(
                                    'join_page.veuillez_entrer_chiffres',
                                  ),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.pressStart2p(
                                    fontSize: 7,
                                    height: 1.45,
                                    color: const Color(0xFFFF4444),
                                  ),
                                ),
                              ),
                            ],
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: ready ? () => onSubmit() : null,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: ready
                                      ? secondary
                                      : Colors.grey.shade600,
                                  foregroundColor: Colors.white,
                                  disabledBackgroundColor:
                                      Colors.grey.shade600,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 14,
                                  ),
                                  elevation: ready ? 4 : 0,
                                ),
                                child: Text(
                                  submitting
                                      ? i18n.translate('join_page.joining')
                                      : i18n.translate('join_page.rejoindre'),
                                  style: GoogleFonts.pressStart2p(fontSize: 8),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _FeeModalRow extends StatelessWidget {
  const _FeeModalRow({
    required this.label,
    required this.amount,
    required this.coinColor,
    this.emphasize = false,
  });

  final String label;
  final int amount;
  final Color coinColor;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: GoogleFonts.pressStart2p(
                fontSize: emphasize ? 8 : 7,
                height: 1.35,
                color: Colors.white70,
              ),
            ),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '$amount ',
                style: GoogleFonts.pressStart2p(
                  fontSize: emphasize ? 9 : 8,
                  height: 1.35,
                  color: coinColor,
                ),
              ),
              CoinIcon(color: coinColor, size: emphasize ? 18 : 16),
            ],
          ),
        ],
      ),
    );
  }
}

/// Rounded dashed border (equivalent of the web join-page `border: dashed`).
class _DashedRoundedRectPainter extends CustomPainter {
  _DashedRoundedRectPainter({
    required this.color,
    required this.strokeWidth,
    required this.borderRadius,
    this.dashLength = 6,
    this.gapLength = 4,
  });

  final Color color;
  final double strokeWidth;
  final double borderRadius;
  final double dashLength;
  final double gapLength;

  @override
  void paint(Canvas canvas, Size size) {
    final inset = strokeWidth / 2;
    final w = (size.width - strokeWidth).clamp(0.0, size.width);
    final h = (size.height - strokeWidth).clamp(0.0, size.height);
    final rr =
        (borderRadius - inset).clamp(0.0, borderRadius).toDouble();
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(inset, inset, w, h),
      Radius.circular(rr),
    );
    final path = Path()..addRRect(r);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    for (final metric in path.computeMetrics()) {
      var d = 0.0;
      while (d < metric.length) {
        final next = (d + dashLength).clamp(0.0, metric.length);
        if (next > d) {
          canvas.drawPath(metric.extractPath(d, next), paint);
        }
        d = next + gapLength;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRoundedRectPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.borderRadius != borderRadius ||
        oldDelegate.dashLength != dashLength ||
        oldDelegate.gapLength != gapLength;
  }
}
