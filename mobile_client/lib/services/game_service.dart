import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_client/models/grid_type.dart';
import 'package:mobile_client/services/auth_service.dart';

class GameService with ChangeNotifier {
  final String baseUrl;
  final AuthService authService;

  GameService({required this.baseUrl, required this.authService});

  List<Grid> _games = [];
  bool _isLoading = false;
  String? _error;

  List<Grid> get games => _games;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // ------------------- Headers -------------------
  Future<Map<String, String>> _headers() async {
    final token = await authService.getToken();
    final sessionToken = await authService.getSessionToken();

    debugPrint('[GameService] Token Firebase: $token');
    debugPrint('[GameService] Session token: $sessionToken');

    if (token == null) throw Exception("Token manquant");
    if (sessionToken == null) throw Exception("Session token manquant");

    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer $token",
      "x-session-token": sessionToken,
    };
  }

  // ------------------- Fetch public games -------------------
  /// Fetches all public games available for creating a match.
  /// Equivalent of GET /game?context=creation on the Angular side.
  /// [silent]: like `loadGames({ silent: true })` on the web — no full-screen "loading" state.
  Future<void> fetchPublicGames({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final res = await http.get(
        Uri.parse('$baseUrl/game?context=creation'),
        headers: await _headers(),
      );

      debugPrint('[GameService] GET /game?context=creation status: ${res.statusCode}');
      debugPrint('[GameService] Body: ${res.body}');

      if (res.statusCode == 200) {
        final decoded = jsonDecode(res.body);
        if (decoded is List) {
          _games = decoded.map((e) => Grid.fromJson(e as Map<String, dynamic>)).toList();
        } else {
          _games = [];
        }
        _error = null;
      } else {
        if (!silent) {
          _error = 'Erreur serveur : ${res.statusCode}';
          _games = [];
        }
      }
    } catch (e) {
      debugPrint('[GameService] Error fetchPublicGames: $e');
      if (!silent) {
        _error = 'Impossible de récupérer les jeux.';
        _games = [];
      }
    }

    if (!silent) {
      _isLoading = false;
    }
    notifyListeners();
  }

  /// Checks that the game still exists (GET /game/:id, no auth guard on the server side).
  /// Used before opening the entry-price dialog, like the Angular client.
  Future<bool> verifyGameExists(String gameId) async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/game/$gameId'));
      return res.statusCode == 200;
    } catch (e) {
      debugPrint('[GameService] verifyGameExists: $e');
      return false;
    }
  }
}
