import 'package:flutter/foundation.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/models/game_room_chat_message.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/services/socket_service.dart';

/// Waiting-room / in-game chat (Angular `GameChatService`).
class RoomChatService extends ChangeNotifier {
  RoomChatService({required SocketService socketService})
      : _socket = socketService {
    _socket.on(GlobalChannelSocketEvents.accountDeleted, _onAccountDeleted);
  }

  final SocketService _socket;

  final List<GameRoomChatMessage> messages = <GameRoomChatMessage>[];
  String? _roomId;

  /// Idempotent: if the room is unchanged, touches neither the socket nor the
  /// message list (equivalent of the Angular `initForRoom()` which only resets
  /// when the `roomId` changes).
  void attach(String roomId) {
    if (_roomId == roomId) return;
    _socket.offAll(GameChatSocketEvents.receiveMessage);
    _roomId = roomId;
    messages.clear();
    _socket.on(GameChatSocketEvents.receiveMessage, _onReceiveMessage);
    notifyListeners();
  }

  void detach() {
    if (_roomId == null && messages.isEmpty) return;
    _socket.offAll(GameChatSocketEvents.receiveMessage);
    _roomId = null;
    messages.clear();
    notifyListeners();
  }

  /// Limit set to 200 characters.
  static const int maxLength = 200;

  void send(String text, LobbyPlayer player) {
    final trimmed = text.trim();
    if (_roomId == null || trimmed.isEmpty || trimmed.length > maxLength) {
      return;
    }
    // Aligned with `newDate()` (`toLocaleTimeString('en-GB', { hour12: false })`).
    final now = DateTime.now();
    final time =
        '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}';
    _socket.emit(GameChatSocketEvents.sendMessage, <String, Object?>{
      'roomId': _roomId,
      'message': <String, Object?>{
        'message': trimmed,
        'time': time,
        'player': <String, Object?>{
          'id': player.id,
          'name': player.name,
          'avatar': player.avatar,
          'isHost': player.isHost,
        },
      },
    });
  }

  void _onReceiveMessage(dynamic raw) {
    if (raw is! Map) return;
    final map = Map<String, dynamic>.from(raw);
    final msg = map['message'];
    if (msg is! Map) return;
    messages.add(
      GameRoomChatMessage.fromJson(Map<String, dynamic>.from(msg)),
    );
    notifyListeners();
  }

  void _onAccountDeleted(dynamic data) {
    if (data is! Map) return;
    final oldUsername = (data['username'] as String?) ?? '';
    if (oldUsername.isEmpty) return;
    var changed = false;
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].authorName == oldUsername) {
        final m = messages[i];
        messages[i] = GameRoomChatMessage(
          text: m.text,
          time: m.time,
          authorName: deletedAccountUsername,
          authorId: m.authorId,
        );
        changed = true;
      }
    }
    if (changed) notifyListeners();
  }
}
