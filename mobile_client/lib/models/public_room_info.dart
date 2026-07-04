/// Public room (`PublicRoomInfo` on the server side).
class PublicRoomInfo {
  const PublicRoomInfo({
    required this.roomId,
    required this.players,
    required this.playerMax,
    required this.gridSize,
    required this.gridImagePayload,
    required this.hasGameStarted,
    required this.isOpenToMorePlayers,
    required this.entryFee,
    this.lobbyGameMode,
    this.isFriendsOnly = false,
    this.hostUid,
  });

  factory PublicRoomInfo.fromJson(Map<String, dynamic> json) {
    return PublicRoomInfo(
      roomId: json['roomId'] as String? ?? '',
      players: (json['players'] as num?)?.toInt() ?? 0,
      playerMax: (json['playerMax'] as num?)?.toInt() ?? 0,
      gridSize: (json['gridSize'] as num?)?.toInt() ?? 0,
      gridImagePayload: json['gridImagePayload'] as String? ?? '',
      hasGameStarted: json['hasGameStarted'] as bool? ?? false,
      isOpenToMorePlayers: json['isOpenToMorePlayers'] as bool? ?? false,
      entryFee: (json['entryFee'] as num?)?.toInt() ?? 0,
      lobbyGameMode: json['lobbyGameMode'] as String?,
      isFriendsOnly: json['isFriendsOnly'] as bool? ?? false,
      hostUid: json['hostUid'] as String?,
    );
  }

  final String roomId;
  final int players;
  final int playerMax;
  final int gridSize;
  final String gridImagePayload;
  final bool hasGameStarted;
  final bool isOpenToMorePlayers;
  final int entryFee;
  final String? lobbyGameMode;
  final bool isFriendsOnly;
  final String? hostUid;
}
