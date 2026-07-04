class GlobalChatMessage {
  final String username;
  final String content;
  final DateTime timestamp;

  GlobalChatMessage({
    required this.username,
    required this.content,
    required this.timestamp,
  });

  factory GlobalChatMessage.fromMap(Map<String, dynamic> map) {
    return GlobalChatMessage(
      username: map['username'] ?? 'Utilisateur',
      content: map['content'] ?? '',
      timestamp: DateTime.parse(
        map['timestamp'] ?? DateTime.now().toIso8601String(),
      ),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'username': username,
      'content': content,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
