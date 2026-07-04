import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'package:mobile_client/app/gateway_events.dart';
import 'package:mobile_client/app/server_config.dart';
import 'package:mobile_client/services/socket_service.dart';
import '../models/account_type.dart';

class AuthService extends ChangeNotifier {
  static String get serverBaseUrl => AppConfig.apiBaseUrl;
  static String get authUrl => '$serverBaseUrl/auth';

  AuthService({
    FirebaseAuth? firebaseAuth,
    http.Client? httpClient,
    SocketService? socketService,
  })  : _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
        _http = httpClient ?? http.Client(),
        _socketService = socketService {
    if (_socketService != null) {
      _socketService!.connectionState.addListener(_onSocketConnectionChanged);
      _initSocketListeners();
    }
    _cleanupStaleSessionOnStart();
  }

  static const String _sessionTokenPrefsKey = 'auth_session_token';

  final FirebaseAuth _firebaseAuth;
  final http.Client _http;
  final SocketService? _socketService;

  AccountType? _currentProfile;
  String? _sessionToken;
  bool _isLoading = false;
  String? _errorMessage;
  bool _isDisposed = false;
  bool _socketListenersRegistered = false;

  /// Delta of the last currency update (for animations, like Angular)
  int _lastCurrencyChange = 0;
  int get lastCurrencyChange => _lastCurrencyChange;

  void clearCurrencyChangeIndicator() {
    _lastCurrencyChange = 0;
  }

  AccountType? get currentUser => _currentProfile;
  String? get sessionToken => _sessionToken;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<Map<String, String>> buildProtectedHeaders() async {
    final token = await getToken();

    if (token == null) {
      throw Exception('Aucun token Firebase (utilisateur non connecte)');
    }
    if (_sessionToken == null) {
      throw Exception('Aucun sessionToken (session serveur non initialisee)');
    }

    return <String, String>{
      'Content-Type': 'application/json',
      'authorization': 'Bearer $token',
      'x-session-token': _sessionToken!,
    };
  }

  Future<void> login(String email, String password) async {
    _setLoading(true);
    _setError(null);

    User? signedInUser;

    try {
      // 1️⃣ Connexion Firebase
      final credential = await _firebaseAuth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      signedInUser = credential.user;
      if (signedInUser == null) {
        _setError('server_msg.generic_error');
        return;
      }

      print('[DEBUG] Firebase user signed in: ${signedInUser.uid}');

      // 2️⃣ Server call to fetch the sessionToken
      final response = await _http.post(
        Uri.parse('$authUrl/login'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'uid': signedInUser.uid}),
      );

      print('[DEBUG] Server response code: ${response.statusCode}');
      print('[DEBUG] Server response body: ${response.body}');

      if (response.statusCode != 200 && response.statusCode != 201) {
        final message = _messageFromNestBody(response.body);
        await _firebaseAuth.signOut();
        _setError(message ?? 'server_msg.generic_error');
        return;
      }

      // 3️⃣ Decode the JSON response
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      print('[DEBUG] Decoded response: $decoded');

      final userJson = decoded['user'] as Map<String, dynamic>?;
      final sessionToken = decoded['sessionToken'] as String?;

      print('[DEBUG] userJson: $userJson');
      print('[DEBUG] sessionToken from server: $sessionToken');

      if (userJson == null || sessionToken == null) {
        await _firebaseAuth.signOut();
        _setError('server_msg.generic_error');
        return;
      }

      // 4️⃣ Save the sessionToken on the client side
      _sessionToken = sessionToken;
      _currentProfile = AccountType.fromJson(userJson);
      await _persistSessionToken(sessionToken);
      print('[DEBUG] Session token saved in AuthService: $_sessionToken');

      _setError(null);
      _notify();
    } on FirebaseAuthException catch (e) {
      try {
        await _firebaseAuth.signOut();
      } catch (_) {}
      _setError(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      if (signedInUser != null) {
        try {
          await _firebaseAuth.signOut();
        } catch (_) {}
      }

      if (kDebugMode) {
        debugPrint('[AuthService] login error: $e');
      }
      _setError('server_msg.generic_error');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> register({
    required String username,
    required String email,
    required String password,
    required String avatar,
  }) async {
    _setLoading(true);
    _setError(null);

    try {
      final checkResponse = await _http.post(
        Uri.parse('$authUrl/check-username'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username}),
      );

      if (checkResponse.statusCode == 200 || checkResponse.statusCode == 201) {
        final decoded = jsonDecode(checkResponse.body) as Map<String, dynamic>?;
        final available = decoded?['available'] as bool?;
        if (available != true) {
          _setError('server_msg.username_taken');
          return;
        }
      } else {
        _setError('server_msg.username_taken');
        return;
      }

      final credential = await _firebaseAuth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );

      final user = credential.user;
      if (user == null) {
        _setError('server_msg.generic_error');
        return;
      }

      final response = await _http.post(
        Uri.parse(authUrl),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'uid': user.uid,
          'username': username,
          'email': email,
          'avatar': avatar,
        }),
      );

      if (response.statusCode != 200 && response.statusCode != 201) {
        final error = _messageFromNestBody(response.body);
        await _firebaseAuth.signOut();
        _setError(error ?? 'server_msg.generic_error');
        return;
      }

      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      final userJson = decoded['user'] as Map<String, dynamic>?;
      final sessionToken = decoded['sessionToken'] as String?;

      if (userJson == null || sessionToken == null) {
        await _firebaseAuth.signOut();
        _setError('server_msg.generic_error');
        return;
      }

      _sessionToken = sessionToken;
      _currentProfile = AccountType.fromJson(userJson);
      await _persistSessionToken(sessionToken);
      _setError(null);
      _notify();
    } on FirebaseAuthException catch (e) {
      await _firebaseAuth.signOut();
      _setError(_getFirebaseErrorMessage(e.code));
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AuthService] register error: $e');
      }
      try {
        await _firebaseAuth.signOut();
      } catch (_) {}
      _setError('server_msg.generic_error');
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    _setLoading(true);
    _setError(null);

    try {
      if (_sessionToken != null) {
        final headers = await buildProtectedHeaders();
        final response = await _http.post(
          Uri.parse('$authUrl/logout'),
          headers: headers,
          body: jsonEncode({}),
        );

        if (response.statusCode < 200 || response.statusCode >= 300) {
          String? message;

          try {
            final decoded = jsonDecode(response.body);
            if (decoded is Map<String, dynamic> &&
                decoded['message'] is String) {
              message = decoded['message'] as String;
            }
          } catch (_) {}

          throw Exception(
            message ?? 'Erreur logout serveur (${response.statusCode})',
          );
        }
      }

      _sessionToken = null;
      _currentProfile = null;
      await _clearPersistedSessionToken();
      _notify();

      await _firebaseAuth.signOut();
    } catch (e) {
      _setError(_formatError(e));
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  /// On startup, if the server kept a session from a previous
  /// launch (hard kill, unfinished logout on `detached`),
  /// the user gets `server_msg.already_logged_in` on the next
  /// login. Here we force the server + Firebase cleanup using
  /// the persisted `sessionToken` and the Firebase user
  /// still signed in locally.
  Future<void> _cleanupStaleSessionOnStart() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final staleToken = prefs.getString(_sessionTokenPrefsKey);
      final firebaseUser = _firebaseAuth.currentUser;

      if (staleToken == null || firebaseUser == null) {
        if (firebaseUser != null) {
          try {
            await _firebaseAuth.signOut();
          } catch (_) {}
        }
        await prefs.remove(_sessionTokenPrefsKey);
        return;
      }

      try {
        final firebaseToken = await firebaseUser.getIdToken();
        if (firebaseToken != null) {
          await _http.post(
            Uri.parse('$authUrl/logout'),
            headers: {
              'Content-Type': 'application/json',
              'authorization': 'Bearer $firebaseToken',
              'x-session-token': staleToken,
            },
            body: jsonEncode({}),
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint('[AuthService] stale session cleanup logout error: $e');
        }
      }

      try {
        await _firebaseAuth.signOut();
      } catch (_) {}
      await prefs.remove(_sessionTokenPrefsKey);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[AuthService] _cleanupStaleSessionOnStart error: $e');
      }
    }
  }

  Future<void> _persistSessionToken(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_sessionTokenPrefsKey, token);
    } catch (_) {}
  }

  Future<void> _clearPersistedSessionToken() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_sessionTokenPrefsKey);
    } catch (_) {}
  }

  /// Update username via PUT /auth. Returns i18n key on failure, null on success.
  Future<String?> updateUsername(String newUsername) async {
    try {
      final headers = await buildProtectedHeaders();
      final response = await _http.put(
        Uri.parse(authUrl),
        headers: headers,
        body: jsonEncode({'username': newUsername}),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _currentProfile = _currentProfile?.copyWith(username: newUsername);
        _notify();
        return null;
      }
      return 'profile_page.error_username_taken';
    } catch (_) {
      return 'profile_page.error_update_profile';
    }
  }

  /// Update email via PUT /auth. Returns i18n key on failure, null on success.
  Future<String?> updateEmail(String newEmail) async {
    try {
      final headers = await buildProtectedHeaders();
      final response = await _http.put(
        Uri.parse(authUrl),
        headers: headers,
        body: jsonEncode({'email': newEmail}),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _currentProfile = _currentProfile?.copyWith(email: newEmail);
        _notify();
        return null;
      }
      if (response.statusCode == 400) {
        return 'profile_page.error_email_invalid';
      }
      return 'profile_page.error_email_taken';
    } catch (_) {
      return 'profile_page.error_update_profile';
    }
  }

  Future<void> updateAvatar(String newAvatar) async {
    // Build the request body
    final body = jsonEncode({'avatar': newAvatar});

    // Headers with Firebase token + sessionToken
    final headers = await buildProtectedHeaders();

    final response = await _http.put(
      Uri.parse(authUrl), // juste /auth
      headers: headers,
      body: body,
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Impossible de mettre à jour l\'avatar (${response.statusCode})',
      );
    }

    // Local profile update
    _currentProfile = _currentProfile!.copyWith(avatar: newAvatar);
    notifyListeners();
  }

  Future<void> deleteAccount() async {
    if (_currentProfile == null) {
      throw Exception("Utilisateur non connecté");
    }

    final headers = await buildProtectedHeaders();

    final response = await _http.delete(Uri.parse(authUrl), headers: headers);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      String? message;
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic> && decoded['message'] is String) {
          message = decoded['message'] as String;
        }
      } catch (_) {}
      throw Exception(
        message ??
            'Erreur lors de la suppression du compte (${response.statusCode})',
      );
    }

    // On success, clear the session and the local profile
    _currentProfile = null;
    _sessionToken = null;
    await _clearPersistedSessionToken();
    notifyListeners();

    // Firebase sign-out
    await _firebaseAuth.signOut();
  }

  Future<void> refreshProfile() async {
    final headers = await buildProtectedHeaders();
    final response = await _http.get(
      Uri.parse(authUrl),
      headers: headers,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      _currentProfile = AccountType.fromJson(decoded);
      _notify();
    }
  }

  Future<bool> purchaseBackground(String backgroundId, int price) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.post(
      Uri.parse('$authUrl/purchase-background'),
      headers: headers,
      body: jsonEncode({'backgroundId': backgroundId, 'price': price}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      _currentProfile = AccountType.fromJson(decoded);
      _notify();
      return true;
    }
    return false;
  }

  Future<bool> purchaseAvatar(String avatarName, int price) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.post(
      Uri.parse('$authUrl/purchase-avatar'),
      headers: headers,
      body: jsonEncode({'avatarName': avatarName, 'price': price}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      _currentProfile = AccountType.fromJson(decoded);
      _notify();
      return true;
    }
    return false;
  }

  Future<bool> purchaseMusic(String musicId, int price) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.post(
      Uri.parse('$authUrl/purchase-music'),
      headers: headers,
      body: jsonEncode({'musicId': musicId, 'price': price}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body) as Map<String, dynamic>;
      _currentProfile = AccountType.fromJson(decoded);
      _notify();
      return true;
    }
    return false;
  }

  Future<bool> updateSelectedBackground(String backgroundId) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.put(
      Uri.parse(authUrl),
      headers: headers,
      body: jsonEncode({'selectedBackground': backgroundId}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      _currentProfile = _currentProfile?.copyWith(selectedBackground: backgroundId);
      _notify();
      return true;
    }
    return false;
  }

  Future<bool> updateSelectedMusic(String musicId) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.put(
      Uri.parse(authUrl),
      headers: headers,
      body: jsonEncode({'selectedMusic': musicId}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      _currentProfile = _currentProfile?.copyWith(selectedMusic: musicId);
      _notify();
      return true;
    }
    return false;
  }

  Future<bool> updateTheme(String theme) async {
    final headers = await buildProtectedHeaders();
    final response = await _http.post(
      Uri.parse('$authUrl/change-theme'),
      headers: headers,
      body: jsonEncode({'theme': theme}),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      _currentProfile = _currentProfile?.copyWith(theme: theme);
      _notify();
      return true;
    }
    return false;
  }

  void clearError() {
    _setError(null);
  }

  Future<String?> getToken() async {
    final user = _firebaseAuth.currentUser;
    return user?.getIdToken();
  }

  Future<String?> getSessionToken() async {
    return _sessionToken;
  }

  // ─── Socket listeners for the virtual currency ───

  void _onSocketConnectionChanged() {
    if (_socketService != null && _socketService!.connectionState.value) {
      _socketListenersRegistered = false;
      _initSocketListeners();
    } else {
      _socketListenersRegistered = false;
    }
  }

  void _initSocketListeners() {
    if (_socketListenersRegistered || _socketService == null) return;
    _socketListenersRegistered = true;

    _socketService!.on(
      VirtualCurrencySocketEvents.currencyUpdate,
      _onCurrencyUpdate,
    );
  }

  void _onCurrencyUpdate(dynamic data) {
    if (data is Map<String, dynamic>) {
      final newAmount = data['newAmount'] as int?;
      final change = data['change'] as int?;

      if (newAmount != null && _currentProfile != null) {
        _currentProfile = _currentProfile!.copyWith(virtualCurrency: newAmount);
        _lastCurrencyChange = change ?? 0;
        _notify();

        if (kDebugMode) {
          debugPrint('[AuthService] currencyUpdate: newAmount=$newAmount, change=$change');
        }
      }
    }
  }

  @override
  void dispose() {
    if (_isDisposed) {
      return;
    }

    _isDisposed = true;
    _socketService?.connectionState.removeListener(_onSocketConnectionChanged);
    _http.close();
    super.dispose();
  }

  void _setLoading(bool value) {
    if (_isLoading == value) {
      return;
    }

    _isLoading = value;
    _notify();
  }

  void _setError(String? error) {
    if (_errorMessage == error) {
      return;
    }

    _errorMessage = error;
    _notify();
  }

  void _notify() {
    if (_isDisposed) {
      return;
    }

    notifyListeners();
  }

  String _formatError(Object error) {
    final message = error.toString();
    if (message.startsWith('Exception: ')) {
      return message.replaceFirst('Exception: ', '');
    }
    return message;
  }

  /// Nest response (`{ "message": "..." }` or validation array).
  String? _messageFromNestBody(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is! Map<String, dynamic>) return null;
      final m = decoded['message'];
      if (m is String && m.isNotEmpty) return m.trim();
      if (m is List && m.isNotEmpty) {
        final first = m.first;
        if (first is String && first.isNotEmpty) return first.trim();
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// JS utilise `auth/invalid-email` ; Flutter souvent `invalid-email` — on normalise.
  String _normalizeFirebaseAuthCode(String raw) {
    var c = raw.trim();
    if (c.toLowerCase().startsWith('auth/')) {
      c = c.substring(5);
    }
    return c.toLowerCase();
  }

  /// Same `server_msg.*` keys as the web client (`getFirebaseErrorMessage`).
  String _getFirebaseErrorMessage(String code) {
    final c = _normalizeFirebaseAuthCode(code);
    switch (c) {
      case 'invalid-email':
      case 'missing-email':
        return 'server_msg.invalid_email_firebase';
      case 'user-disabled':
        return 'server_msg.user_disabled';
      case 'user-not-found':
        return 'server_msg.user_not_found';
      case 'wrong-password':
      case 'invalid-credential':
        return 'server_msg.wrong_password';
      case 'email-already-in-use':
        return 'server_msg.email_already_in_use';
      case 'weak-password':
      case 'missing-password':
        return 'server_msg.weak_password';
      case 'too-many-requests':
        return 'server_msg.too_many_requests';
      case 'network-request-failed':
        return 'server_msg.network_error';
      default:
        return 'server_msg.generic_error';
    }
  }
}
