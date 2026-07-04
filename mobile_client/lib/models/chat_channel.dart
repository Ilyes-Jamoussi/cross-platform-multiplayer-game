class ChatChannelInfo {
  ChatChannelInfo({
    required this.id,
    required this.name,
    this.type = 'custom',
    this.createdBy,
    this.owner,
  });

  final String id;
  final String name;
  final String type;
  final String? createdBy;
  final String? owner;

  factory ChatChannelInfo.fromMap(Map<String, dynamic> map) {
    final rawId = map['_id'];
    final id = rawId is String
        ? rawId
        : rawId != null
            ? rawId.toString()
            : '';
    return ChatChannelInfo(
      id: id,
      name: map['name'] as String? ?? '',
      type: map['type'] as String? ?? 'custom',
      createdBy: map['createdBy'] as String?,
      owner: map['owner'] as String?,
    );
  }
}

class ChatChannelMessage {
  ChatChannelMessage({
    required this.channelId,
    required this.username,
    required this.content,
    required this.timestamp,
  });

  final String channelId;
  final String username;
  final String content;
  final DateTime timestamp;

  factory ChatChannelMessage.fromMap(Map<String, dynamic> map) {
    return ChatChannelMessage(
      channelId: map['channelId'] as String? ?? '',
      username: map['username'] as String? ?? '',
      content: map['content'] as String? ?? '',
      timestamp: _parseTimestamp(map['timestamp']),
    );
  }

  /// Same logic as the server / Angular side: UTC ISO dates (`…Z`) for consistent sorting.
  static DateTime _parseTimestamp(dynamic ts) {
    if (ts is String) {
      return DateTime.tryParse(ts)?.toUtc() ?? DateTime.now().toUtc();
    }
    if (ts is int) {
      return DateTime.fromMillisecondsSinceEpoch(ts, isUtc: true);
    }
    if (ts is Map && ts['\$date'] != null) {
      final v = ts['\$date'];
      if (v is int) {
        return DateTime.fromMillisecondsSinceEpoch(v, isUtc: true);
      }
      if (v is String) {
        return DateTime.tryParse(v)?.toUtc() ?? DateTime.now().toUtc();
      }
    }
    return DateTime.now().toUtc();
  }

  Map<String, dynamic> toMap() {
    return {
      'channelId': channelId,
      'username': username,
      'content': content,
      'timestamp': timestamp.toUtc().toIso8601String(),
    };
  }
}

class ChannelDeletedPayload {
  ChannelDeletedPayload({
    required this.channelId,
    required this.channelName,
    required this.deletedBy,
  });

  final String channelId;
  final String channelName;
  final String deletedBy;

  factory ChannelDeletedPayload.fromMap(Map<String, dynamic> map) {
    return ChannelDeletedPayload(
      channelId: map['channelId'] as String? ?? '',
      channelName: map['channelName'] as String? ?? '',
      deletedBy: map['deletedBy'] as String? ?? '',
    );
  }
}

class DeletedChannelNotification {
  DeletedChannelNotification({
    required this.channelName,
    required this.selfDeleted,
  });

  final String channelName;
  final bool selfDeleted;
}
