/// In-game chat message (`Message` on the server side).
class GameRoomChatMessage {
  const GameRoomChatMessage({
    required this.text,
    required this.time,
    required this.authorName,
    required this.authorId,
  });

  final String text;
  final String time;
  final String authorName;
  final String authorId;

  factory GameRoomChatMessage.fromJson(Map<String, dynamic> json) {
    var name = '';
    var id = '';
    final player = json['player'];
    if (player is Map) {
      name = player['name'] as String? ?? '';
      id = player['id'] as String? ?? '';
    }
    return GameRoomChatMessage(
      text: json['message'] as String? ?? '',
      time: json['time'] as String? ?? '',
      authorName: name,
      authorId: id,
    );
  }
}
