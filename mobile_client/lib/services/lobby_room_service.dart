import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_client/app/active_game_socket_events.dart';
import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/lobby_models.dart';
import 'package:mobile_client/models/public_room_info.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/socket_service.dart';

/// Waiting-room state and actions (equivalent of `PlayerService` + the `game-room` HTTP flows).
class LobbyRoomService extends ChangeNotifier {
  LobbyRoomService({
    required AuthService authService,
    required SocketService socketService,
    http.Client? httpClient,
  })  : _auth = authService,
        _socket = socketService,
        _http = httpClient ?? http.Client() {
    _socket.on(GameRoomSocketEvents.joinAccepted, _onJoinAccepted);
    _socket.on(GameRoomSocketEvents.joinDenied, _onJoinDenied);
    _socket.on(GameRoomSocketEvents.kickUpdate, _onGlobalKickUpdate);
  }

  final AuthService _auth;
  final SocketService _socket;
  final http.Client _http;

  Timer? _publicRoomsSocketDebounce;

  String? roomId;
  bool _isHost = false;
  LobbyPlayer? currentPlayer;
  RoomLobbySnapshot? room;

  /// Avatar names already taken (`avatarUpdate` event, `selectedAvatars` values).
  List<String> selectedAvatarNames = [];

  String? _statsAvatarName;
  String? get statsAvatarName => _statsAvatarName;
  String? _baseGameMode;
  String? get baseGameMode => _baseGameMode;

  String? pendingKickMessage;
  String? pendingKickTitleKey;
  String? pendingJoinDeniedMessage;

  bool _startGamePing = false;

  /// Guest: after `joinAccepted`, navigate to the stats page.
  bool _awaitingGuestJoinNav = false;

  /// Callback registered by [JoinGamePage] to push the stats route.
  void Function()? onGuestJoinNavigationToStats;

  /// Callback for reconnect: navigate to game if `hasGameStarted`.
  void Function()? onReconnectNavigateToGame;

  /// True when the player reconnected as an eliminated observer.
  bool _reconnectIsEliminated = false;
  bool get reconnectIsEliminated => _reconnectIsEliminated;

  /// Real-time public rooms list (socket `publicRoomsUpdate`).
  List<PublicRoomInfo> publicRooms = [];

  /// Last failed `/game-room/public` HTTP load (aligned with the web join page).
  bool publicRoomsLoadError = false;

  bool get isHost => _isHost;

  bool get hasStartGamePing {
    return _startGamePing;
  }

  void clearStartGamePing() {
    _startGamePing = false;
  }

  static String get _apiBase => AuthService.serverBaseUrl;

  // ---------------------------------------------------------------------------
  // Create / Join
  // ---------------------------------------------------------------------------

  /// Creates the game on the server then emits `joinGame` (host).
  Future<String?> createRoomAndJoin({
    required String gameId,
    int entryFee = 0,
  }) async {
    try {
      // Clean up any leftover state from a previous game session.
      if (roomId != null) {
        leaveGameSocket();
      }
      _detachLobbyListeners();
      _socket.offAll(GameRoomSocketEvents.avatarUpdate);
      roomId = null;
      currentPlayer = null;
      room = null;
      _isHost = false;
      selectedAvatarNames = [];
      _statsAvatarName = null;
      lastSelectAvatarResult = null;
      _startGamePing = false;
      _awaitingGuestJoinNav = false;
      _baseGameMode = await _fetchBaseGameModeFromGameId(gameId);
      final headers = await _auth.buildProtectedHeaders();
      final uri = Uri.parse('$_apiBase/game-room/create');
      final res = await _http.post(
        uri,
        headers: headers,
        body: jsonEncode(<String, Object?>{
          'gameId': gameId,
          'entryFee': entryFee,
        }),
      );
      if (res.statusCode != 201 && res.statusCode != 200) {
        return _messageFromResponse(res);
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final id = map['roomId'] as String?;
      if (id == null || id.isEmpty) {
        return 'Réponse serveur invalide (roomId).';
      }
      roomId = id;
      _isHost = true;
      final joined = await joinGameSocket();
      if (!joined) {
        return 'Impossible de rejoindre la salle (session expirée).';
      }
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Emits `joinGame` with the current token.
  Future<bool> joinGameSocket() async {
    if (roomId == null) return false;
    try {
      final token = await _auth.getToken();
      if (token == null) return false;
      _socket.emit(GameRoomSocketEvents.joinGame, <String, Object?>{
        'roomId': roomId,
        'token': token,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Guest: `isHost` set to false, then `joinGame` and wait for `joinAccepted`.
  Future<bool> requestGuestJoinSocket() async {
    if (roomId == null) return false;
    _isHost = false;
    _awaitingGuestJoinNav = true;
    notifyListeners();
    final ok = await joinGameSocket();
    if (!ok) {
      _awaitingGuestJoinNav = false;
      notifyListeners();
    }
    return ok;
  }

  /// Cancels the attempt (e.g. price modal) before the socket.
  void cancelGuestJoinPending() {
    _awaitingGuestJoinNav = false;
    roomId = null;
    notifyListeners();
  }

  // ---------------------------------------------------------------------------
  // Public rooms (HTTP initial + socket real-time)
  // ---------------------------------------------------------------------------

  Future<List<PublicRoomInfo>> fetchPublicRooms() async {
    try {
      final headers = await _auth.buildProtectedHeaders();
      final res = await _http.get(
        Uri.parse('$_apiBase/game-room/public'),
        headers: headers,
      );
      if (res.statusCode != 200) {
        publicRoomsLoadError = true;
        publicRooms = [];
        notifyListeners();
        return <PublicRoomInfo>[];
      }
      final decoded = jsonDecode(res.body);
      if (decoded is! List) {
        publicRoomsLoadError = true;
        publicRooms = [];
        notifyListeners();
        return <PublicRoomInfo>[];
      }
      final list = decoded
          .map(
            (e) => PublicRoomInfo.fromJson(
              Map<String, dynamic>.from(e as Map),
            ),
          )
          .toList();
      publicRoomsLoadError = false;
      publicRooms = list;
      notifyListeners();
      return list;
    } catch (_) {
      publicRoomsLoadError = true;
      publicRooms = [];
      notifyListeners();
      return <PublicRoomInfo>[];
    }
  }

  void startListeningPublicRooms() {
    _socket.offAll(GameRoomSocketEvents.publicRoomsUpdate);
    _socket.on(GameRoomSocketEvents.publicRoomsUpdate, _onPublicRoomsUpdate);
  }

  void stopListeningPublicRooms() {
    _publicRoomsSocketDebounce?.cancel();
    _publicRoomsSocketDebounce = null;
    _socket.offAll(GameRoomSocketEvents.publicRoomsUpdate);
  }

  /// The broadcast sends one list per socket (`socket.data.uid`); if the uid is not yet
  /// registered, the payload excludes "friends only" games. We always reload via
  /// HTTP with JWT — same source of truth as the web page with its interceptor.
  void _onPublicRoomsUpdate(dynamic data) {
    if (data is! List) return;
    _publicRoomsSocketDebounce?.cancel();
    _publicRoomsSocketDebounce = Timer(const Duration(milliseconds: 120), () {
      fetchPublicRooms();
    });
  }

  // ---------------------------------------------------------------------------
  // Room data
  // ---------------------------------------------------------------------------

  Future<Map<String, dynamic>?> fetchRoomData(String roomId) async {
    try {
      final res = await _http.get(
        Uri.parse('$_apiBase/game-room/$roomId/data'),
      );
      if (res.statusCode != 200) {
        return null;
      }
      final map = jsonDecode(res.body);
      if (map is Map<String, dynamic>) {
        final gm = map['gameMode'];
        if (gm is String && gm.isNotEmpty) {
          _baseGameMode = gm;
        }
        return map;
      }
      final parsed = Map<String, dynamic>.from(map as Map);
      final gm = parsed['gameMode'];
      if (gm is String && gm.isNotEmpty) {
        _baseGameMode = gm;
      }
      return parsed;
    } catch (_) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Socket listeners: joinAccepted / joinDenied / kickUpdate (global)
  // ---------------------------------------------------------------------------

  void _onJoinAccepted(dynamic data) {
    if (data is Map && data['roomId'] != null) {
      roomId = data['roomId'].toString();
    }
    if (data is Map && data['gameMode'] is String) {
      final gm = data['gameMode'] as String;
      if (gm.isNotEmpty) _baseGameMode = gm;
    }

    // Parse reconnected player data from the server (includes state, isSpectator, id).
    if (data is Map && data['player'] is Map) {
      final pMap = Map<String, dynamic>.from(data['player'] as Map);
      currentPlayer = LobbyPlayer.fromJson(pMap);
      // Track eliminated state for observer mode detection after reconnect
      _reconnectIsEliminated =
          pMap['state'] == 'eliminated' || pMap['isSpectator'] == true;
    }

    final hasGameStarted = data is Map && data['hasGameStarted'] == true;

    if (hasGameStarted) {
      _awaitingGuestJoinNav = false;
      onReconnectNavigateToGame?.call();
      notifyListeners();
      return;
    }

    if (_awaitingGuestJoinNav) {
      _awaitingGuestJoinNav = false;
      onGuestJoinNavigationToStats?.call();
    }
    notifyListeners();
  }

  void _onJoinDenied(dynamic raw) {
    if (_awaitingGuestJoinNav) {
      _awaitingGuestJoinNav = false;
    }
    if (raw is Map && raw['message'] != null) {
      pendingJoinDeniedMessage = _translateServerMsg(raw['message'].toString());
      notifyListeners();
    }
  }

  void _onGlobalKickUpdate(dynamic raw) {
    if (raw is! Map || raw['message'] == null) return;
    if (roomId == null) return;
    final rawMsg = raw['message'].toString();
    pendingKickTitleKey = _kickTitleKeyFromServerMessage(rawMsg);
    pendingKickMessage = _translateServerMsg(rawMsg);
    notifyListeners();
  }

  /// For the join popups (HTTP validate, etc.) — same logic as [_translateServerMsg].
  String localizeJoinServerMessage(String raw) => _translateServerMsg(raw);

  /// Translates server keys like `AlertService.translateServerMessage` (Angular).
  /// Handles `key|{"param":"…"}` and simple keys (`server_msg.*`).
  String _translateServerMsg(String raw) {
    final t = raw.trim();
    final pipe = t.indexOf('|');
    if (pipe >= 0) {
      final key = t.substring(0, pipe).trim();
      final rest = t.substring(pipe + 1).trim();
      try {
        final decoded = jsonDecode(rest);
        if (decoded is Map) {
          final strParams = decoded.map(
            (k, v) => MapEntry(k.toString(), v?.toString() ?? ''),
          );
          final out = I18n().translateWithParams(key, strParams);
          if (out != key) return out;
        }
      } catch (_) {}
      final keyOnly = I18n().translate(key);
      if (keyOnly != key) return keyOnly;
      return raw;
    }
    final translated = I18n().translate(t);
    return translated != t ? translated : t;
  }

  // ---------------------------------------------------------------------------
  // Validate / Select avatar
  // ---------------------------------------------------------------------------

  /// GET `/game-room/validate/:roomId` (AuthGuard on the server).
  Future<String?> validateRoom() async {
    if (roomId == null) return 'roomId manquant';
    try {
      final headers = await _auth.buildProtectedHeaders();
      final uri = Uri.parse('$_apiBase/game-room/validate/$roomId');
      final res = await _http.get(uri, headers: headers);
      if (res.statusCode != 200) {
        return _messageFromResponse(res);
      }
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Result of selectAvatar, like the Angular `SelectAvatarResponse`.
  SelectAvatarResult? lastSelectAvatarResult;

  Future<String?> selectAvatar({
    required LobbyPlayer player,
    required Map<String, dynamic> stats,
  }) async {
    if (roomId == null) return 'roomId manquant';
    try {
      final headers = await _auth.buildProtectedHeaders();
      final body = <String, Object?>{
        'roomId': roomId,
        'player': <String, Object?>{
          ...player.toJson(),
          'stats': stats,
        },
      };
      final res = await _http.post(
        Uri.parse('$_apiBase/game-room/selectAvatar'),
        headers: headers,
        body: jsonEncode(body),
      );
      if (res.statusCode != 201 && res.statusCode != 200) {
        return _messageFromResponse(res);
      }
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      final p = map['player'] as Map<String, dynamic>?;
      if (p != null) {
        currentPlayer = LobbyPlayer.fromJson(Map<String, dynamic>.from(p));
      }

      final isDropIn = map['isDropIn'] as bool? ?? false;
      final isDropInSuccess = map['isDropInSuccess'] as bool? ?? false;
      lastSelectAvatarResult = SelectAvatarResult(
        isDropIn: isDropIn,
        isDropInSuccess: isDropInSuccess,
      );

      notifyListeners();
      return null;
    } catch (e) {
      return e.toString();
    }
  }

  /// Emits `DropIn` (like the Angular `dropInPlayer`) to spawn the player mid-game.
  void dropInPlayer(String playerId) {
    if (roomId == null) return;
    _socket.emit(ActiveGameSocketEvents.dropIn, <String, String?>{
      'player': playerId,
      'roomId': roomId,
    });
  }

  Future<void> leaveRoomHttp() async {
    if (roomId == null) return;
    try {
      await _http.post(
        Uri.parse('$_apiBase/game-room/leaveRoom'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode(<String, String?>{'roomId': roomId}),
      );
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Stats: avatar reservation
  // ---------------------------------------------------------------------------

  void enterStatsPhase({required String initialAvatarName}) {
    _statsAvatarName = initialAvatarName;
    _socket.offAll(GameRoomSocketEvents.avatarUpdate);
    _socket.on(GameRoomSocketEvents.avatarUpdate, _onAvatarUpdate);
    emitAvatarReservation(initialAvatarName);
  }

  void emitAvatarReservation(String avatarName) {
    _statsAvatarName = avatarName;
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.avatarUpdate, <String, Object?>{
      'roomId': roomId,
      'nextAvatar': avatarName,
    });
    notifyListeners();
  }

  void _onAvatarUpdate(dynamic data) {
    if (data is! Map) return;
    final map = Map<String, dynamic>.from(data);
    final list = map['selectedAvatars'];
    if (list is List) {
      selectedAvatarNames = list.map((e) => e.toString()).toList();
      notifyListeners();
    }
  }

  Future<void> leaveStatsPhase() async {
    _socket.offAll(GameRoomSocketEvents.avatarUpdate);
    await leaveRoomHttp();
  }

  // ---------------------------------------------------------------------------
  // Salle d'attente
  // ---------------------------------------------------------------------------

  void enterWaitingRoomPhase() {
    _socket.offAll(GameRoomSocketEvents.avatarUpdate);
    _detachLobbyListeners();
    _attachLobbyListeners();
    requestRoomUpdate();
  }

  /// Before the game view: removes the waiting-room listeners.
  void prepareForActiveGame() {
    _detachLobbyListeners();
  }

  void requestRoomUpdate() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.roomUpdateResponse, <String, String?>{
      'roomId': roomId,
    });
  }

  void _attachLobbyListeners() {
    _socket.on(GameRoomSocketEvents.roomUpdateResponse, _onRoomUpdate);
    _socket.on(GameRoomSocketEvents.toggleLock, _onToggleLock);
    _socket.on(GameRoomSocketEvents.toggleFriendOnly, _onToggleFriendOnly);
    _socket.on(GameRoomSocketEvents.toggleDropInDropOut, _onToggleDropIn);
    _socket.on(GameRoomSocketEvents.toggleFogOfWar, _onToggleFog);
    _socket.on(GameRoomSocketEvents.setLobbyGameMode, _onLobbyMode);
    _socket.on(GameRoomSocketEvents.updateTeams, _onUpdateTeams);
    _socket.on(GameRoomSocketEvents.kickUpdate, _onLobbyKickUpdate);
    _socket.on(GameRoomSocketEvents.startGame, _onStartGame);
  }

  void _detachLobbyListeners() {
    _socket.offAll(GameRoomSocketEvents.roomUpdateResponse);
    _socket.offAll(GameRoomSocketEvents.toggleLock);
    _socket.offAll(GameRoomSocketEvents.toggleFriendOnly);
    _socket.offAll(GameRoomSocketEvents.toggleDropInDropOut);
    _socket.offAll(GameRoomSocketEvents.toggleFogOfWar);
    _socket.offAll(GameRoomSocketEvents.setLobbyGameMode);
    _socket.offAll(GameRoomSocketEvents.updateTeams);
    _socket.offAll(GameRoomSocketEvents.kickUpdate);
    _socket.offAll(GameRoomSocketEvents.startGame);
  }

  void _onRoomUpdate(dynamic raw) {
    if (raw is! Map) return;
    final gm = raw['gameMode'];
    if (gm is String && gm.isNotEmpty) {
      _baseGameMode = gm;
    }
    final id = currentPlayer?.id ?? _socket.socketId ?? '';
    room = RoomLobbySnapshot.fromJson(
      Map<String, dynamic>.from(raw),
      currentPlayerId: id,
    );
    notifyListeners();
  }

  void _onToggleLock(dynamic raw) {
    if (raw is Map && raw['isLocked'] != null) {
      final locked = raw['isLocked'] as bool;
      final r = room;
      if (r != null) {
        room = RoomLobbySnapshot(
          players: r.players,
          playerMin: r.playerMin,
          playerMax: r.playerMax,
          isLocked: locked,
          isFriendsOnly: r.isFriendsOnly,
          dropInDropOutEnabled: r.dropInDropOutEnabled,
          isFogOfWar: r.isFogOfWar,
          entryFee: r.entryFee,
          lobbyGameMode: r.lobbyGameMode,
          gameMode: r.gameMode,
          teams: r.teams,
        );
        notifyListeners();
      }
    }
  }

  void _onToggleFriendOnly(dynamic raw) {
    if (raw is Map && raw['isFriendsOnly'] != null) {
      final friendsOnly = raw['isFriendsOnly'] as bool;
      final r = room;
      if (r != null) {
        room = RoomLobbySnapshot(
          players: r.players,
          playerMin: r.playerMin,
          playerMax: r.playerMax,
          isLocked: r.isLocked,
          isFriendsOnly: friendsOnly,
          dropInDropOutEnabled: r.dropInDropOutEnabled,
          isFogOfWar: r.isFogOfWar,
          entryFee: r.entryFee,
          lobbyGameMode: r.lobbyGameMode,
          gameMode: r.gameMode,
          teams: r.teams,
        );
        notifyListeners();
      }
    }
  }

  void _onToggleDropIn(dynamic raw) {
    if (raw is Map && raw['dropInDropOutEnabled'] != null) {
      final enabled = raw['dropInDropOutEnabled'] as bool;
      final r = room;
      if (r != null) {
        room = RoomLobbySnapshot(
          players: r.players,
          playerMin: r.playerMin,
          playerMax: r.playerMax,
          isLocked: r.isLocked,
          isFriendsOnly: r.isFriendsOnly,
          dropInDropOutEnabled: enabled,
          isFogOfWar: r.isFogOfWar,
          entryFee: r.entryFee,
          lobbyGameMode: r.lobbyGameMode,
          gameMode: r.gameMode,
          teams: r.teams,
        );
        notifyListeners();
      }
    }
  }

  void _onToggleFog(dynamic raw) {
    if (raw is Map && raw['isFogOfWar'] != null) {
      final enabled = raw['isFogOfWar'] as bool;
      final r = room;
      if (r != null) {
        room = RoomLobbySnapshot(
          players: r.players,
          playerMin: r.playerMin,
          playerMax: r.playerMax,
          isLocked: r.isLocked,
          isFriendsOnly: r.isFriendsOnly,
          dropInDropOutEnabled: r.dropInDropOutEnabled,
          isFogOfWar: enabled,
          entryFee: r.entryFee,
          lobbyGameMode: r.lobbyGameMode,
          gameMode: r.gameMode,
          teams: r.teams,
        );
        notifyListeners();
      }
    }
  }

  void _onLobbyMode(dynamic raw) {
    if (raw is Map && raw['lobbyGameMode'] != null) {
      requestRoomUpdate();
    }
  }

  void _onUpdateTeams(dynamic raw) {
    requestRoomUpdate();
  }

  void _onLobbyKickUpdate(dynamic raw) {
    if (raw is Map && raw['message'] != null) {
      final rawMsg = raw['message'].toString();
      pendingKickTitleKey = _kickTitleKeyFromServerMessage(rawMsg);
      pendingKickMessage = _translateServerMsg(rawMsg);
      notifyListeners();
    }
  }

  void _onStartGame(dynamic _) {
    _startGamePing = true;
    notifyListeners();
  }

  void clearPendingMessages() {
    pendingKickMessage = null;
    pendingKickTitleKey = null;
    pendingJoinDeniedMessage = null;
    notifyListeners();
  }

  void clearPendingJoinDenied() {
    pendingJoinDeniedMessage = null;
    notifyListeners();
  }

  String _kickTitleKeyFromServerMessage(String messageKey) {
    switch (messageKey) {
      case 'server_msg.player_kicked':
        return 'popup.kicked_title';
      case 'server_msg.host_left':
        return 'popup.host_left_title';
      case 'server_msg.last_player':
        return 'popup.game_over_title';
      default:
        return 'popup.connection_error_title';
    }
  }

  // ---------------------------------------------------------------------------
  // Host / player actions
  // ---------------------------------------------------------------------------

  void toggleLock() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.toggleLock, <String, String?>{'roomId': roomId});
  }

  void toggleFriendOnly() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.toggleFriendOnly, <String, String?>{'roomId': roomId});
  }

  void toggleDropInDropOut() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.toggleDropInDropOut, <String, String?>{'roomId': roomId});
  }

  void toggleFogOfWar() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.toggleFogOfWar, <String, String?>{'roomId': roomId});
  }

  void selectTeam(String teamId) {
    if (roomId == null || currentPlayer == null) return;
    _socket.emit(GameRoomSocketEvents.selectTeam, <String, dynamic>{
      'roomId': roomId,
      'player': currentPlayer!.toJson(),
      'teamId': teamId,
    });
  }

  void leaveTeam() {
    if (roomId == null || currentPlayer == null) return;
    _socket.emit(GameRoomSocketEvents.leaveTeam, <String, dynamic>{
      'roomId': roomId,
      'player': currentPlayer!.toJson(),
    });
  }

  /// Host: moves a virtual player to another team (aligned with `PlayerService.changeVirtualPlayerTeam`).
  void changeVirtualPlayerTeam(String playerId, String targetTeamId) {
    if (roomId == null || !_isHost) return;
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) return;
    _socket.emit(GameRoomSocketEvents.virtualPlayerTeamChanged, <String, Object?>{
      'roomId': roomId,
      'playerId': playerId,
      'targetTeamId': targetTeamId,
      'firebaseUid': uid,
    });
  }

  void setLobbyGameMode(LobbyGameMode mode) {
    if (roomId == null) return;
    final modeStr = mode == LobbyGameMode.teams
        ? 'teams'
        : mode == LobbyGameMode.fastElimination
            ? 'fastElimination'
            : 'classic';
    _socket.emit(GameRoomSocketEvents.setLobbyGameMode, <String, String?>{
      'roomId': roomId,
      'mode': modeStr,
    });
  }

  void addVirtualPlayer(String typeLabel) {
    if (roomId == null) return;
    final r = room;
    if (r == null || r.isLocked || r.players.length >= r.playerMax) {
      return;
    }
    _socket.emit(GameRoomSocketEvents.addVirtualPlayer, <String, Object?>{
      'roomId': roomId,
      'type': typeLabel,
    });
  }

  void kickPlayer(String playerId) {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.kickPlayer, <String, String?>{
      'roomId': roomId,
      'player': playerId,
    });
  }

  void startGame() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.startGame, <String, String?>{'roomId': roomId});
  }

  void leaveGameSocket() {
    if (roomId == null) return;
    _socket.emit(GameRoomSocketEvents.leaveGame, <String, String?>{'roomId': roomId});
  }

  /// Leaves the game (socket + local state). The caller navigates to home.
  void resetAfterLeave() {
    _detachLobbyListeners();
    _socket.offAll(GameRoomSocketEvents.avatarUpdate);
    stopListeningPublicRooms();
    _reconnectIsEliminated = false;
    roomId = null;
    currentPlayer = null;
    room = null;
    _isHost = false;
    selectedAvatarNames = [];
    _statsAvatarName = null;
    lastSelectAvatarResult = null;
    _startGamePing = false;
    _awaitingGuestJoinNav = false;
    _baseGameMode = null;
    publicRooms = [];
    notifyListeners();
  }

  Future<String?> _fetchBaseGameModeFromGameId(String gameId) async {
    try {
      final res = await _http.get(Uri.parse('$_apiBase/game/$gameId'));
      if (res.statusCode != 200) return null;
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        final raw = decoded['gameMode'] ?? decoded['mode'];
        if (raw is String && raw.isNotEmpty) return raw;
      } else if (decoded is Map) {
        final map = Map<String, dynamic>.from(decoded);
        final raw = map['gameMode'] ?? map['mode'];
        if (raw is String && raw.isNotEmpty) return raw;
      }
    } catch (_) {}
    return null;
  }

  bool canStartGame() {
    final r = room;
    if (r == null) return false;
    if (!r.isLocked) return false;
    if (r.lobbyGameMode == LobbyGameMode.classic ||
        r.lobbyGameMode == LobbyGameMode.fastElimination) {
      return r.players.length >= r.playerMin;
    }
    final teams = r.teams;
    if (teams == null) return false;
    final active = teams.where((t) => t.players.isNotEmpty).toList();
    final totalAssigned =
        teams.fold<int>(0, (s, t) => s + t.players.length);
    final hasEnoughTeams = active.length >= 2;
    final eachFull = active.every((t) => t.players.length == 2);
    final everyoneAssigned = totalAssigned == r.players.length;
    return hasEnoughTeams && eachFull && everyoneAssigned;
  }

  bool availableAvatarsExhausted() {
    final r = room;
    if (r == null) return false;
    return r.players.length >= r.playerMax;
  }

  String? _messageFromResponse(http.Response res) {
    try {
      final decoded = jsonDecode(res.body);
      if (decoded is Map && decoded['message'] is String) {
        final m = (decoded['message'] as String).trim();
        if (m.isNotEmpty) return m;
      }
    } catch (_) {}
    return 'server_msg.room_not_found';
  }
}

/// Result of `selectAvatar` (aligned with the server's `SelectAvatarResponse`).
class SelectAvatarResult {
  const SelectAvatarResult({
    required this.isDropIn,
    required this.isDropInSuccess,
  });

  final bool isDropIn;
  final bool isDropInSuccess;
}
