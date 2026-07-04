import 'dart:collection';

import 'package:flutter/foundation.dart';

import '../app/gateway_events.dart';
import '../models/chat_type.dart';
import 'auth_service.dart';
import 'socket_service.dart';

class ChatService extends ChangeNotifier {
  ChatService({required this.authService, required this.socketService}) {
    _initialize();
  }

  final AuthService authService;
  final SocketService socketService;

  static const String _sendGlobalMessage = 'globalChannel:sendMessage';
  static const String _receiveGlobalMessage = 'globalChannel:receiveMessage';

  final List<GlobalChatMessage> _messages = <GlobalChatMessage>[];
  List<GlobalChatMessage> get messages =>
      UnmodifiableListView<GlobalChatMessage>(_messages);

  bool _initialized = false;
  bool _wasReady = false;

  void _initialize() {
    if (_initialized) return;
    _initialized = true;

    socketService.on(_receiveGlobalMessage, _onIncomingMessage);
    socketService.on(GlobalChannelSocketEvents.accountDeleted, _onAccountDeleted);
    socketService.connectionState.addListener(_onReadyStateChanged);
    authService.addListener(_onReadyStateChanged);

    _onReadyStateChanged();
  }

  /// Clears the global message list on every transition to the
  /// "socket connected AND user authenticated" state (login / reconnect),
  /// to only show messages received since the current connection.
  void _onReadyStateChanged() {
    final isReady =
        socketService.connectionState.value && authService.currentUser != null;
    if (isReady && !_wasReady) {
      _messages.clear();
      notifyListeners();
    }
    _wasReady = isReady;
  }

  void disconnect() {
    socketService.disconnect();
  }

  void sendMessage(String content) {
    final username = authService.currentUser?.username;
    final trimmed = content.trim();

    if (username == null || trimmed.isEmpty) {
      return;
    }

    final message = GlobalChatMessage(
      username: username,
      content: trimmed,
      timestamp: DateTime.now(),
    );

    socketService.emit(_sendGlobalMessage, message.toMap());

    if (kDebugMode) {
      debugPrint(
        'chat send -> user=$username, content="$trimmed", socketConnected=${socketService.isConnected}',
      );
      _logMessages('after send emit');
    }
  }

  void _onIncomingMessage(dynamic data) {
    try {
      final msg = GlobalChatMessage.fromMap(data as Map<String, dynamic>);
      _messages.add(msg);
      notifyListeners();

      _logMessages('globalChannel:receiveMessage');
    } catch (e) {
      if (kDebugMode) {
        debugPrint('chat receive parse error: $e');
      }
    }
  }

  void _onAccountDeleted(dynamic data) {
    if (data is! Map) return;
    final oldUsername = (data['username'] as String?) ?? '';
    if (oldUsername.isEmpty) return;
    var changed = false;
    for (var i = 0; i < _messages.length; i++) {
      if (_messages[i].username == oldUsername) {
        final m = _messages[i];
        _messages[i] = GlobalChatMessage(
          username: deletedAccountUsername,
          content: m.content,
          timestamp: m.timestamp,
        );
        changed = true;
      }
    }
    if (changed) notifyListeners();
  }

  void _logMessages(String source) {
    if (!kDebugMode) return;

    final snapshot = _messages
        .map((message) => message.toMap())
        .toList(growable: false);

    debugPrint('chat [$source] _messagesCount=${_messages.length}');
    debugPrint('chat [$source] _messages=$snapshot');
  }

  @override
  void dispose() {
    if (_initialized) {
      socketService.off(_receiveGlobalMessage, _onIncomingMessage);
      socketService.off(GlobalChannelSocketEvents.accountDeleted, _onAccountDeleted);
      socketService.connectionState.removeListener(_onReadyStateChanged);
      authService.removeListener(_onReadyStateChanged);
    }
    super.dispose();
  }
}
