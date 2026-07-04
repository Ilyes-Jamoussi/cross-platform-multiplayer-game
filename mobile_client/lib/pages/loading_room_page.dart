import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_client/app/router.dart';
import 'package:mobile_client/services/lobby_room_service.dart';
import 'package:mobile_client/services/room_chat_service.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/widget/loading_room/loading_room_content.dart';
import 'package:mobile_client/widget/poly_arena_confirm_popup.dart'
    show PolyArenaConfirmVariant, showPolyArenaConfirmDialog;
import 'package:mobile_client/widget/poly_arena_message_popup.dart';
import 'package:mobile_client/widget/profile_background.dart';
import 'package:mobile_client/widget/waiting_room_chat_panel.dart';
import 'package:mobile_client/widget/web_game_flow_floating_actions.dart';
import 'package:mobile_client/widget/web_game_flow_header.dart';
import 'package:provider/provider.dart';

/// Waiting view (Angular `loading-page` equivalent).
class LoadingRoomPage extends StatefulWidget {
  const LoadingRoomPage({super.key});

  @override
  State<LoadingRoomPage> createState() => _LoadingRoomPageState();
}

class _LoadingRoomPageState extends State<LoadingRoomPage> {
  LobbyRoomService? _lobby;
  bool _listenerAttached = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_listenerAttached) return;
    _listenerAttached = true;
    _lobby = context.read<LobbyRoomService>();
    _lobby!.addListener(_onLobby);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final lobby = context.read<LobbyRoomService>();
      if (lobby.roomId == null || lobby.currentPlayer == null) {
        Navigator.pushReplacementNamed(context, AppRoutes.home);
        return;
      }
      lobby.enterWaitingRoomPhase();
      final id = lobby.roomId;
      if (id != null) {
        context.read<RoomChatService>().attach(id);
      }
    });
  }

  @override
  void dispose() {
    _lobby?.removeListener(_onLobby);
    // Do not detach the chat here: the game view reuses the messages by design.
    super.dispose();
  }

  void _onLobby() {
    if (!mounted) return;
    final l = _lobby;
    if (l == null) return;

    if (l.pendingKickMessage != null) {
      final msg = l.pendingKickMessage!;
      final titleKey = l.pendingKickTitleKey ?? 'popup.connection_error_title';
      l.clearPendingMessages();
      context.read<RoomChatService>().detach();
      l.leaveGameSocket();
      l.resetAfterLeave();
      final rootNav = Navigator.of(context, rootNavigator: true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!rootNav.mounted) return;
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
      });
      return;
    }

    if (l.hasStartGamePing) {
      l.clearStartGamePing();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(AppRoutes.game);
      });
    }
  }

  Future<void> _confirmLeaveToHome(BuildContext context) async {
    final ok = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'popup.leave_game_confirm_title',
      messageKey: 'popup.leave_game_confirm_message',
      variant: PolyArenaConfirmVariant.heavyQuit,
    );
    if (!ok || !context.mounted) return;
    _leaveToHome(context);
  }

  void _leaveToHome(BuildContext context) {
    final lobby = context.read<LobbyRoomService>();
    final chat = context.read<RoomChatService>();
    final rootNav = Navigator.of(context, rootNavigator: true);
    lobby.leaveGameSocket();
    lobby.resetAfterLeave();
    chat.detach();
    rootNav.pushNamedAndRemoveUntil(AppRoutes.home, (r) => false);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!rootNav.mounted) return;
      showPolyArenaMessageDialog(
        context: rootNav.context,
        kind: PolyArenaMessageKind.warning,
        title: 'popup.left_game_title',
        message: 'popup.left_game_message',
        okLabel: 'common.ok',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final lobby = context.watch<LobbyRoomService>();
    final theme = context.watch<ThemeService>();
    final borderColor = theme.primaryColor;

    final room = lobby.room;
    final myId = lobby.currentPlayer?.id;

    /// With `resizeToAvoidBottomInset: false`, the [Scaffold] removes the
    /// bottom [MediaQueryData.viewInsets] for the `body`. We re-inject the
    /// **real** insets from [View.of] so the keyboard is always
    /// visible in the chat tree without resizing the Scaffold body.
    final inherited = MediaQuery.of(context);
    final fromView = MediaQueryData.fromView(View.of(context));
    final mediaQuery = inherited.copyWith(viewInsets: fromView.viewInsets);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(_confirmLeaveToHome(context));
      },
      child: Scaffold(
        /// Do not shrink the whole page when the keyboard opens: only the chat
        /// applique [MediaQuery.viewInsets] (voir [LoadingRoomContent]).
        resizeToAvoidBottomInset: false,
        body: MediaQuery(
          data: mediaQuery,
          child: Stack(
            fit: StackFit.expand,
            children: [
              const Positioned.fill(child: ProfileBackground()),
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  WebGameFlowHeader(
                  onMenuPressed: () => unawaited(_confirmLeaveToHome(context)),
                ),
                  Expanded(
                    child: SafeArea(
                      top: false,
                      bottom: true,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          // Prefer the 3-column version (aligned with the web client)
                          // and only switch to compact mode on very small screens.
                          final narrow = constraints.maxWidth < 360;
                          final chatPanel = lobby.currentPlayer == null
                              ? const SizedBox.shrink()
                              : WaitingRoomChatPanel(
                                  borderBlue: borderColor,
                                  currentPlayer: lobby.currentPlayer!,
                                  roomIsFriendsOnly: room?.isFriendsOnly ?? false,
                                );

                          return LoadingRoomContent(
                            lobby: lobby,
                            room: room,
                            myId: myId,
                            borderColor: borderColor,
                            chatPanel: chatPanel,
                            narrow: narrow,
                            onLeave: () => unawaited(_confirmLeaveToHome(context)),
                          );
                        },
                      ),
                    ),
                  ),
                ],
              ),
              Positioned(
                top: mediaQuery.padding.top + 10,
                right: 14,
                child: const WebGameFlowFloatingActions(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
