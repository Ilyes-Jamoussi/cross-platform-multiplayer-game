import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/models/chat_channel.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/socket_service.dart';

class ChatChannelService extends ChangeNotifier {
  ChatChannelService({
    required this.authService,
    required this.socketService,
  }) {
    _registerListeners();
    authService.addListener(_onAuthOrSocketChanged);
    socketService.connectionState.addListener(_onAuthOrSocketChanged);
    _onAuthOrSocketChanged();
  }

  final AuthService authService;
  final SocketService socketService;

  final List<ChatChannelInfo> _joinedChannels = [];
  final List<ChatChannelInfo> _searchResults = [];
  final Map<String, List<ChatChannelMessage>> _channelMessages = {};
  final List<DeletedChannelNotification> _deletedNotifications = [];

  String? _lastErrorMessage;

  UnmodifiableListView<ChatChannelInfo> get joinedChannels =>
      UnmodifiableListView<ChatChannelInfo>(_joinedChannels);
  UnmodifiableListView<ChatChannelInfo> get searchResults =>
      UnmodifiableListView<ChatChannelInfo>(_searchResults);
  UnmodifiableListView<DeletedChannelNotification> get deletedNotifications =>
      UnmodifiableListView<DeletedChannelNotification>(_deletedNotifications);

  String? get username => authService.currentUser?.username;

  String? get lastErrorMessage => _lastErrorMessage;

  void clearChannelError() {
    _lastErrorMessage = null;
  }

  List<ChatChannelMessage> messagesForChannel(String channelId) {
    return UnmodifiableListView<ChatChannelMessage>(
      _channelMessages[channelId] ?? const <ChatChannelMessage>[],
    );
  }

  void sendChannelMessage(String channelId, String content) {
    final u = username;
    final trimmed = content.trim();
    if (u == null || trimmed.isEmpty) return;
    socketService.emit(
      CustomChannelSocketEvents.sendMessage,
      ChatChannelMessage(
        channelId: channelId,
        username: u,
        content: trimmed,
        timestamp: DateTime.now(),
      ).toMap(),
    );
  }

  void retrieveChannelMessages(String channelId) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.retrieveMessages, {
      'channelId': channelId,
      'username': u,
    });
  }

  void createChannel(String name) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.create, {
      'name': name,
      'username': u,
    });
  }

  void joinChannel(String channelId) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.join, {
      'channelId': channelId,
      'username': u,
    });
  }

  void leaveChannel(String channelId) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.leave, {
      'channelId': channelId,
      'username': u,
    });
  }

  void closeChannel(String channelId) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.closeChannel, {
      'channelId': channelId,
      'username': u,
    });
  }

  void searchChannels(String query) {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.search, {
      'query': query,
      'username': u,
    });
  }

  void removeSearchResult(String channelId) {
    _searchResults.removeWhere((c) => c.id == channelId);
    notifyListeners();
  }

  void clearSearchResults() {
    _searchResults.clear();
    notifyListeners();
  }

  void dismissDeletedNotification(String channelName) {
    _deletedNotifications
        .removeWhere((n) => n.channelName == channelName);
    notifyListeners();
  }

  void refreshJoinedChannels() {
    final u = username;
    if (u == null) return;
    socketService.emit(CustomChannelSocketEvents.getJoinedChannels, u);
  }

  bool isOwner(ChatChannelInfo channel, String currentUsername) {
    return channel.owner == currentUsername;
  }

  void _registerListeners() {
    socketService.on(
      CustomChannelSocketEvents.receiveMessage,
      _onReceiveMessage,
    );
    socketService.on(
      CustomChannelSocketEvents.giveMessages,
      _onGiveMessages,
    );
    socketService.on(
      CustomChannelSocketEvents.channelDeleted,
      _onChannelDeleted,
    );
    socketService.on(
      CustomChannelSocketEvents.searchResults,
      _onSearchResults,
    );
    socketService.on(
      CustomChannelSocketEvents.giveJoinedChannels,
      _onGiveJoinedChannels,
    );
    socketService.on(CustomChannelSocketEvents.newOwner, _onNewOwner);
    socketService.on(CustomChannelSocketEvents.error, _onError);
    socketService.on(GlobalChannelSocketEvents.accountDeleted, _onAccountDeleted);
  }

  void _onAccountDeleted(dynamic data) {
    if (data is! Map) return;
    final oldUsername = (data['username'] as String?) ?? '';
    if (oldUsername.isEmpty) return;
    var changed = false;
    for (final entry in _channelMessages.entries) {
      final list = entry.value;
      for (var i = 0; i < list.length; i++) {
        if (list[i].username == oldUsername) {
          final m = list[i];
          list[i] = ChatChannelMessage(
            channelId: m.channelId,
            username: deletedAccountUsername,
            content: m.content,
            timestamp: m.timestamp,
          );
          changed = true;
        }
      }
    }
    if (changed) notifyListeners();
  }

  void _onError(dynamic data) {
    _lastErrorMessage = data?.toString();
    notifyListeners();
  }

  void _onAuthOrSocketChanged() {
    if (!socketService.isConnected || username == null) {
      if (username == null) {
        _clearLocalState();
      }
      return;
    }
    refreshJoinedChannels();
  }

  void _clearLocalState() {
    _joinedChannels.clear();
    _searchResults.clear();
    _channelMessages.clear();
    _deletedNotifications.clear();
    notifyListeners();
  }

  void _onReceiveMessage(dynamic data) {
    try {
      final message = ChatChannelMessage.fromMap(data as Map<String, dynamic>);
      final list = _channelMessages.putIfAbsent(
        message.channelId,
        () => <ChatChannelMessage>[],
      );
      list.add(message);
      list.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel receive parse error: $e');
      }
    }
  }

  void _onGiveMessages(dynamic data) {
    try {
      final map = data as Map<String, dynamic>;
      final channelId = map['channelId'] as String;
      final rawMessages = map['messages'] as List;
      final messages = rawMessages
          .map((e) => ChatChannelMessage.fromMap(e as Map<String, dynamic>))
          .toList();
      messages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
      _channelMessages[channelId] = messages;
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel giveMessages parse error: $e');
      }
    }
  }

  void _onChannelDeleted(dynamic data) {
    try {
      final payload = ChannelDeletedPayload.fromMap(
        data as Map<String, dynamic>,
      );
      _channelMessages.remove(payload.channelId);
      final wasJoined = _joinedChannels.any((c) => c.id == payload.channelId);
      _joinedChannels.removeWhere((c) => c.id == payload.channelId);
      refreshJoinedChannels();
      if (wasJoined &&
          payload.channelName.isNotEmpty &&
          !_deletedNotifications.any((n) => n.channelName == payload.channelName)) {
        final selfDeleted = payload.deletedBy == username;
        _deletedNotifications.add(
          DeletedChannelNotification(
            channelName: payload.channelName,
            selfDeleted: selfDeleted,
          ),
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel deleted parse error: $e');
      }
    }
  }

  void _onSearchResults(dynamic data) {
    try {
      final raw = data as List;
      _searchResults
        ..clear()
        ..addAll(
          raw.map((e) => ChatChannelInfo.fromMap(e as Map<String, dynamic>)),
        );
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel searchResults parse error: $e');
      }
    }
  }

  void _onGiveJoinedChannels(dynamic data) {
    try {
      final raw = data as List;
      _joinedChannels
        ..clear()
        ..addAll(
          raw.map((e) => ChatChannelInfo.fromMap(e as Map<String, dynamic>)),
        );
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel giveJoined parse error: $e');
      }
    }
  }

  /// Like Angular `CustomChannelEvents.newOwner`: the server does not send
  /// `giveJoined` to the remaining members when the owner leaves — only this event.
  void _onNewOwner(dynamic data) {
    try {
      if (data is! Map) return;
      final channelId = data['channelId']?.toString();
      final newOwner = data['newOwner']?.toString();
      if (channelId == null ||
          channelId.isEmpty ||
          newOwner == null ||
          newOwner.isEmpty) {
        return;
      }
      final idx = _joinedChannels.indexWhere((c) => c.id == channelId);
      if (idx < 0) return;
      final ch = _joinedChannels[idx];
      _joinedChannels[idx] = ChatChannelInfo(
        id: ch.id,
        name: ch.name,
        type: ch.type,
        createdBy: ch.createdBy,
        owner: newOwner,
      );
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('ChatChannel newOwner parse error: $e');
      }
    }
  }

  @override
  void dispose() {
    authService.removeListener(_onAuthOrSocketChanged);
    socketService.connectionState.removeListener(_onAuthOrSocketChanged);
    socketService.off(CustomChannelSocketEvents.receiveMessage, _onReceiveMessage);
    socketService.off(CustomChannelSocketEvents.giveMessages, _onGiveMessages);
    socketService.off(CustomChannelSocketEvents.channelDeleted, _onChannelDeleted);
    socketService.off(CustomChannelSocketEvents.searchResults, _onSearchResults);
    socketService.off(CustomChannelSocketEvents.giveJoinedChannels, _onGiveJoinedChannels);
    socketService.off(CustomChannelSocketEvents.newOwner, _onNewOwner);
    socketService.off(CustomChannelSocketEvents.error, _onError);
    socketService.off(GlobalChannelSocketEvents.accountDeleted, _onAccountDeleted);
    super.dispose();
  }
}
