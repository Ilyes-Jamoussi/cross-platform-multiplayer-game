import 'package:flutter/material.dart';

import '../pages/create_game_page.dart';
import '../pages/home_page.dart';
import '../pages/join_game_page.dart';
import '../pages/game_page.dart';
import '../pages/loading_room_page.dart';
import '../pages/stats_page.dart';
import '../pages/login_page.dart';
import '../pages/profile_page.dart';
import '../pages/end_game_page.dart';
import '../pages/register_page.dart';
import '../pages/shop_page.dart';
import '../pages/game_creation_no_maps_help_page.dart';

class AppRoutes {
  static const login = '/login';
  static const register = '/register';
  static const home = '/home';
  static const profile = '/profile';
  static const createGame = '/create-game';
  static const joinGame = '/join-game';
  static const stats = '/stats';
  static const loadingRoom = '/loading-room';
  static const game = '/game';
  static const endGame = '/end-game';
  static const shop = '/shop';
  static const gameCreationNoMapsHelp = '/game-creation-no-maps-help';

  static Map<String, WidgetBuilder> get routes => {
    login: (_) => const LoginPage(),
    register: (_) => const RegisterPage(),
    home: (context) {
      final raw = ModalRoute.of(context)?.settings.arguments;
      final pendingReward = raw is int ? raw : null;
      return HomePage(pendingRewardDelta: pendingReward);
    },
    profile: (_) => const ProfilePage(),
    createGame: (_) => const CreateGamePage(),
    joinGame: (_) => const JoinGamePage(),
    stats: (_) => const StatsPage(),
    loadingRoom: (_) => const LoadingRoomPage(),
    game: (_) => const GamePage(),
    endGame: (_) => const EndGamePage(),
    shop: (_) => const ShopPage(),
    gameCreationNoMapsHelp: (_) => const GameCreationNoMapsHelpPage(),
  };
}
