import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_client/models/account_type.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/socket_service.dart';

class FriendsService with ChangeNotifier {
  final String baseUrl;
  final AuthService authService;
  final SocketService socketService;

  FriendsService({
    required this.baseUrl,
    required this.authService,
    required this.socketService,
  }) {
    _attachFriendSocketListeners();
    socketService.connectionState.addListener(_onReadyStateChanged);
    authService.addListener(_onReadyStateChanged);
    _onReadyStateChanged();
  }

  /// Re-registers the friends socket as soon as (socket connected + user authenticated)
  /// becomes true, to cover the case where the socket reconnects
  /// silently (e.g. app in the background) and the server keeps a
  /// stale `socketId` in `userSockets`.
  void _onReadyStateChanged() {
    final isReady =
        socketService.connectionState.value && authService.currentUser != null;
    if (isReady) {
      // Re-attach the listeners on every transition to "ready" because some
      // socket_io_client Dart builds lose the callbacks after a
      // silent reconnect (app backgrounded then resumed).
      _attachFriendSocketListeners();
      if (!_socketRegistered) registerFriendSocket();
    } else {
      _socketRegistered = false;
    }
  }

  List<AccountType> _friends = [];
  List<AccountType> _requests = [];
  List<AccountType> _sentRequests = [];
  List<AccountType> _searchResults = [];
  bool _socketRegistered = false;
  Timer? _socketRefreshDebounce;

  List<AccountType> get friends => _friends;
  List<AccountType> get requests => _requests;
  List<AccountType> get sentRequests => _sentRequests;
  List<AccountType> get searchResults => _searchResults;

  // ------------------- Headers -------------------
  Future<Map<String, String>> _headers() async {
    final token = await authService.getToken();
    final sessionToken = await authService.getSessionToken();

    if (token == null) throw Exception("Token manquant");
    if (sessionToken == null) throw Exception("Session token manquant");

    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
      "x-session-token": sessionToken,
    };
  }

  // ------------------- Socket Events -------------------
  void _attachFriendSocketListeners() {
    socketService.off('requestNotification', _onRequestNotification);
    socketService.off('requestReply', _onRequestReply);
    socketService.off('statusUpdate', _onStatusUpdate);
    socketService.on('requestNotification', _onRequestNotification);
    socketService.on('requestReply', _onRequestReply);
    socketService.on('statusUpdate', _onStatusUpdate);
  }

  void _scheduleRefreshAfterSocketEvent() {
    _socketRefreshDebounce?.cancel();
    _socketRefreshDebounce = Timer(const Duration(milliseconds: 150), () {
      _socketRefreshDebounce = null;
      refresh();
    });
  }

  /// Register user socket for friend events (call after login/connect).
  void registerFriendSocket() {
    final uid = authService.currentUser?.uid;
    if (uid != null && socketService.isConnected && !_socketRegistered) {
      socketService.emit('registerFriendSocket', {'uid': uid});
      _socketRegistered = true;
      if (kDebugMode) {
        debugPrint('[FriendsService] registerFriendSocket emitted uid=$uid');
      }
      refresh().catchError((e, st) {
        debugPrint('FriendsService.refresh (registerFriendSocket): $e\n$st');
      });
    }
  }

  /// Unconditional variant: re-emits `registerFriendSocket` and re-attaches
  /// the listeners even if we believe we are already registered. Useful to recover
  /// after a silent socket reconnect (the server lost the entry
  /// in `userSockets`, so no more `statusUpdate` broadcasts).
  void forceRegisterFriendSocket() {
    final uid = authService.currentUser?.uid;
    if (uid == null || !socketService.isConnected) return;
    _attachFriendSocketListeners();
    socketService.emit('registerFriendSocket', {'uid': uid});
    _socketRegistered = true;
  }

  void _onRequestNotification(dynamic _) {
    _scheduleRefreshAfterSocketEvent();
  }

  void _onRequestReply(dynamic _) {
    _scheduleRefreshAfterSocketEvent();
  }

  void _onStatusUpdate(dynamic data) {
    if (kDebugMode) {
      debugPrint('[FriendsService] statusUpdate received: $data');
    }
    if (data is! Map) return;
    final uid = data['uid']?.toString();
    final raw = data['status']?.toString();
    if (uid == null || raw == null) return;

    String normalized;
    switch (raw.toLowerCase()) {
      case 'online':
        normalized = 'online';
        break;
      case 'offline':
        normalized = 'offline';
        break;
      case 'incombat':
        normalized = 'inCombat';
        break;
      default:
        normalized = raw;
    }

    bool changed = false;
    _friends = _friends.map((friend) {
      if (friend.uid == uid) {
        changed = true;
        return friend.copyWith(
          status: normalized,
          isOnline: normalized == 'online' || normalized == 'inCombat',
        );
      }
      return friend;
    }).toList();

    if (kDebugMode) {
      debugPrint(
        '[FriendsService] statusUpdate uid=$uid raw=$raw normalized=$normalized changed=$changed',
      );
    }
    if (changed) notifyListeners();
    _scheduleRefreshAfterSocketEvent();
  }

  void cleanupSocket() {
    _socketRefreshDebounce?.cancel();
    socketService.connectionState.removeListener(_onReadyStateChanged);
    authService.removeListener(_onReadyStateChanged);
    socketService.off('requestNotification', _onRequestNotification);
    socketService.off('requestReply', _onRequestReply);
    socketService.off('statusUpdate', _onStatusUpdate);
    _socketRegistered = false;
  }

  // ------------------- Refresh -------------------
  Future<void> refresh() async {
    await Future.wait([
      getFriends(notify: false),
      getRequests(notify: false),
      getSentRequests(notify: false),
    ]);
    _searchResults = _filterSearchResults(_searchResults);
    notifyListeners();
  }

  Future<void> getFriends({bool notify = true}) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/friends'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        _friends = (jsonDecode(res.body) as List)
            .map((e) => AccountType.fromJson(e))
            .toList();
      } else {
        _friends = [];
      }
    } catch (e) {
      debugPrint('Error getFriends: $e');
      _friends = [];
    }
    if (notify) notifyListeners();
  }

  Future<void> getRequests({bool notify = true}) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/friends/requests'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        _requests = (jsonDecode(res.body) as List)
            .map((e) => AccountType.fromJson(e))
            .toList();
      } else {
        _requests = [];
      }
    } catch (e) {
      debugPrint('Error getRequests: $e');
      _requests = [];
    }
    if (notify) notifyListeners();
  }

  Future<void> getSentRequests({bool notify = true}) async {
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/friends/requests/sent'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        _sentRequests = (jsonDecode(res.body) as List)
            .map((e) => AccountType.fromJson(e))
            .toList();
      } else {
        _sentRequests = [];
      }
    } catch (e) {
      debugPrint('Error getSentRequests: $e');
      _sentRequests = [];
    }
    if (notify) notifyListeners();
  }

  // ------------------- Search -------------------
  Timer? _searchDebounce;

  void searchUsersDebounced(String query) {
    _searchDebounce?.cancel();
    if (query.trim().isEmpty) {
      _searchResults = [];
      notifyListeners();
      return;
    }
    _searchDebounce = Timer(const Duration(milliseconds: 350), () {
      searchUsers(query.trim());
    });
  }

  Future<void> searchUsers(String query) async {
    if (query.isEmpty) {
      _searchResults = [];
      notifyListeners();
      return;
    }
    try {
      final res = await http.get(
        Uri.parse('$baseUrl/friends/search?name=$query'),
        headers: await _headers(),
      );
      if (res.statusCode == 200) {
        final all = (jsonDecode(res.body) as List)
            .map((e) => AccountType.fromJson(e))
            .toList();
        _searchResults = _filterSearchResults(all);
      } else {
        _searchResults = [];
      }
    } catch (e) {
      debugPrint('Error searchUsers: $e');
      _searchResults = [];
    }
    notifyListeners();
  }

  /// Filters the search results to exclude existing friends.
  List<AccountType> _filterSearchResults(List<AccountType> results) {
    final friendUids = _friends.map((f) => f.uid).toSet();
    return results.where((u) => !friendUids.contains(u.uid)).toList();
  }

  // ------------------- Actions -------------------
  /// Returns `true` if the request was accepted by the server (like the Angular client).
  Future<bool> sendRequest(AccountType user) async {
    _sentRequests.add(user);
    notifyListeners();
    try {
      final res = await http.post(
        Uri.parse('$baseUrl/friends/${user.uid}'),
        headers: await _headers(),
        body: jsonEncode({}),
      );
      if (res.statusCode != 200 && res.statusCode != 201) {
        _sentRequests.removeWhere((u) => u.uid == user.uid);
        notifyListeners();
        return false;
      }
      refresh().catchError((e, st) {
        debugPrint('FriendsService.refresh (sendRequest): $e\n$st');
      });
      return true;
    } catch (e) {
      debugPrint('Error sendRequest: $e');
      _sentRequests.removeWhere((u) => u.uid == user.uid);
      notifyListeners();
      return false;
    }
  }

  Future<void> accept(String uid) async {
    final idx = _requests.indexWhere((r) => r.uid == uid);
    if (idx < 0) return;
    final req = _requests[idx];
    _requests.removeWhere((r) => r.uid == uid);
    _friends.add(req);
    _sentRequests.removeWhere((r) => r.uid == uid);
    notifyListeners();

    try {
      final res = await http.post(
        Uri.parse('$baseUrl/friends/accept/$uid'),
        headers: await _headers(),
      );
      if (res.statusCode != 200 && res.statusCode != 201) {
        debugPrint('accept failed: ${res.statusCode}');
      }
    } catch (e) {
      debugPrint('Error accept: $e');
    } finally {
      await refresh();
    }
  }

  Future<void> refuse(String uid) async {
    _requests.removeWhere((r) => r.uid == uid);
    notifyListeners();
    try {
      await http.post(
        Uri.parse('$baseUrl/friends/refuse/$uid'),
        headers: await _headers(),
      );
    } catch (e) {
      debugPrint('Error refuse: $e');
    }
  }

  /// Like Angular: immediate removal on the UI side, rollback + error if the API fails.
  Future<bool> remove(String uid) async {
    final prevFriends = List<AccountType>.from(_friends);
    final prevRequests = List<AccountType>.from(_requests);
    final prevSent = List<AccountType>.from(_sentRequests);

    _friends.removeWhere((r) => r.uid == uid);
    _requests.removeWhere((r) => r.uid == uid);
    _sentRequests.removeWhere((r) => r.uid == uid);
    notifyListeners();
    try {
      final res = await http.delete(
        Uri.parse('$baseUrl/friends/$uid'),
        headers: await _headers(),
      );
      if (res.statusCode < 200 || res.statusCode >= 300) {
        debugPrint('remove failed: ${res.statusCode}');
        _friends = prevFriends;
        _requests = prevRequests;
        _sentRequests = prevSent;
        notifyListeners();
        return false;
      }
      await refresh();
      return true;
    } catch (e) {
      debugPrint('Error remove: $e');
      _friends = prevFriends;
      _requests = prevRequests;
      _sentRequests = prevSent;
      notifyListeners();
      return false;
    }
  }
}
