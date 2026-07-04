/// Player in the waiting room (aligned with `Player` on the server side).
class LobbyPlayer {
  const LobbyPlayer({
    required this.id,
    this.name,
    this.avatar,
    this.isHost = false,
    this.type,
  });

  final String id;
  final String? name;
  final String? avatar;
  final bool isHost;
  /// `VirtualPlayerTypes` on the server side (e.g. "Aggressif", "Défensif").
  final String? type;

  bool get isVirtual => id.startsWith('virtual-');

  factory LobbyPlayer.fromJson(Map<String, dynamic> json) {
    return LobbyPlayer(
      id: json['id'] as String? ?? '',
      name: json['name'] as String?,
      avatar: json['avatar'] as String?,
      isHost: json['isHost'] as bool? ?? false,
      type: json['type'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'avatar': avatar,
      'isHost': isHost,
      if (type != null) 'type': type,
    };
  }
}

enum LobbyGameMode { classic, teams, fastElimination }

LobbyGameMode lobbyGameModeFrom(dynamic raw) {
  if (raw == 'teams') return LobbyGameMode.teams;
  if (raw == 'fastElimination') return LobbyGameMode.fastElimination;
  return LobbyGameMode.classic;
}

class LobbyTeam {
  const LobbyTeam({
    required this.id,
    required this.icon,
    required this.color,
    required this.players,
    this.isOwnTeam = false,
  });

  final String id;
  final String icon;
  final String color;
  final List<LobbyPlayer> players;
  final bool isOwnTeam;
}

/// Room state returned by `roomUpdateResponse`.
class RoomLobbySnapshot {
  const RoomLobbySnapshot({
    required this.players,
    required this.playerMin,
    required this.playerMax,
    required this.isLocked,
    required this.isFriendsOnly,
    required this.dropInDropOutEnabled,
    required this.isFogOfWar,
    required this.entryFee,
    required this.lobbyGameMode,
    this.gameMode,
    this.teams,
  });

  final List<LobbyPlayer> players;
  final int playerMin;
  final int playerMax;
  final bool isLocked;
  final bool isFriendsOnly;
  final bool dropInDropOutEnabled;
  final bool isFogOfWar;
  final int entryFee;
  final LobbyGameMode lobbyGameMode;
  final String? gameMode;
  final List<LobbyTeam>? teams;

  factory RoomLobbySnapshot.fromJson(
    Map<String, dynamic> json, {
    required String currentPlayerId,
  }) {
    final playersRaw = json['players'] as List<dynamic>? ?? [];
    final players = playersRaw
        .map((e) => LobbyPlayer.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();

    List<LobbyTeam>? teams;
    final teamsRaw = json['teams'] as List<dynamic>?;
    if (teamsRaw != null) {
      teams = teamsRaw.map((e) {
        final m = Map<String, dynamic>.from(e as Map);
        final pls = (m['players'] as List<dynamic>?)
                ?.map(
                  (p) =>
                      LobbyPlayer.fromJson(Map<String, dynamic>.from(p as Map)),
                )
                .toList() ??
            <LobbyPlayer>[];
        final id = m['id'] as String? ?? '';
        final isOwn = pls.any((p) => p.id == currentPlayerId);
        return LobbyTeam(
          id: id,
          icon: m['icon'] as String? ?? '',
          color: m['color'] as String? ?? '#FFFFFF',
          players: pls,
          isOwnTeam: isOwn,
        );
      }).toList();
    }

    return RoomLobbySnapshot(
      players: players,
      playerMin: (json['playerMin'] as num?)?.toInt() ?? 2,
      playerMax: (json['playerMax'] as num?)?.toInt() ?? 2,
      isLocked: json['isLocked'] as bool? ?? false,
      isFriendsOnly: json['isFriendsOnly'] as bool? ?? false,
      dropInDropOutEnabled: json['dropInDropOutEnabled'] as bool? ?? false,
      isFogOfWar: json['isFogOfWar'] as bool? ?? false,
      entryFee: (json['entryFee'] as num?)?.toInt() ?? 0,
      lobbyGameMode: lobbyGameModeFrom(json['lobbyGameMode']),
      gameMode: json['gameMode'] as String?,
      teams: teams,
    );
  }
}
