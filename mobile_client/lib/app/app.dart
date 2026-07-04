import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_lifecycle_logout.dart';
import 'orientation_lock.dart';
import 'router.dart';
import 'server_config.dart';
import '../services/active_game_service.dart';
import '../services/auth_service.dart';
import '../services/character_stats_service.dart';
import '../services/chat_channel_service.dart';
import '../services/chat_service.dart';
import '../services/friends_service.dart';
import '../services/language_service.dart';
import '../services/game_service.dart';
import '../services/lobby_room_service.dart';
import '../services/room_chat_service.dart';
import '../services/game_team_chat_service.dart';
import '../services/cosmetics_service.dart';
import '../services/socket_service.dart';
import '../services/music_service.dart';
import '../services/tutorial_service.dart';
import '../services/theme_service.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key, required this.initialLang});

  final String initialLang;

  @override
  Widget build(BuildContext context) {
    return OrientationLock(
      child: MultiProvider(
      providers: [
        ChangeNotifierProvider<LanguageService>(
          create: (_) => LanguageService(initialLang: initialLang),
        ),
        ChangeNotifierProvider<ThemeService>(
          lazy: false,
          create: (_) {
            final service = ThemeService(initialTheme: AppThemeMode.blue);
            service.loadFromPrefs();
            return service;
          },
        ),
        Provider<SocketService>(
          lazy: false,
          create: (_) => SocketService()..connect(),
          dispose: (_, socketService) => socketService.dispose(),
        ),
        ChangeNotifierProvider<AuthService>(
          lazy: false,
          create: (context) => AuthService(
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<FriendsService>(
          lazy: false,
          create: (context) => FriendsService(
            baseUrl: AppConfig.apiBaseUrl,
            authService: context.read<AuthService>(),
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<GameService>(
          lazy: false,
          create: (context) => GameService(
            baseUrl: AppConfig.apiBaseUrl,
            authService: context.read<AuthService>(),
          ),
        ),
        ChangeNotifierProvider<CharacterStatsService>(
          lazy: false,
          create: (_) => CharacterStatsService(),
        ),
        ChangeNotifierProvider<ChatService>(
          lazy: false,
          create: (context) => ChatService(
            authService: context.read<AuthService>(),
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<ChatChannelService>(
          lazy: false,
          create: (context) => ChatChannelService(
            authService: context.read<AuthService>(),
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<LobbyRoomService>(
          lazy: false,
          create: (context) => LobbyRoomService(
            authService: context.read<AuthService>(),
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<ActiveGameService>(
          lazy: false,
          create: (context) => ActiveGameService(
            socketService: context.read<SocketService>(),
            lobbyRoomService: context.read<LobbyRoomService>(),
          ),
        ),
        ChangeNotifierProvider<RoomChatService>(
          lazy: false,
          create: (context) => RoomChatService(
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<GameTeamChatService>(
          lazy: false,
          create: (context) => GameTeamChatService(
            socketService: context.read<SocketService>(),
          ),
        ),
        ChangeNotifierProvider<CosmeticsService>(
          lazy: false,
          create: (context) => CosmeticsService(
            authService: context.read<AuthService>(),
          ),
        ),
        ChangeNotifierProvider<TutorialService>(
          lazy: false,
          create: (context) => TutorialService(
            authService: context.read<AuthService>(),
          ),
        ),
        ChangeNotifierProvider<MusicService>(
          lazy: false,
          create: (context) => MusicService(
            authService: context.read<AuthService>(),
          ),
        ),
      ],
      child: AppLifecycleLogout(
        child: MaterialApp(
          title: 'PolyRPG',
          debugShowCheckedModeBanner: false,
          initialRoute: AppRoutes.login,
          routes: AppRoutes.routes,
          builder: (context, child) {
            // Rebuild visible route immediately when language changes.
            context.watch<LanguageService>().lang;
            return child ?? const SizedBox.shrink();
          },
        ),
      ),
    ),
    );
  }
}
