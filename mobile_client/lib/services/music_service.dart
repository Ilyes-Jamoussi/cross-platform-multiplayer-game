import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/services/cosmetics_service.dart';

const String musicOffId = 'music-off';
const String musicDefaultId = 'music-default';

class MusicService with ChangeNotifier {
  final AuthService authService;

  MusicService({required this.authService}) {
    _init();
  }

  AudioPlayer? _player;
  String _currentMusicId = musicDefaultId;
  bool _isPlaying = false;
  bool _initialized = false;

  String get currentMusicId => _currentMusicId;
  bool get isPlaying => _isPlaying;
  bool get isMuted => _currentMusicId == musicOffId || !_isPlaying;

  /// Map music IDs to asset paths
  static const Map<String, String> _musicPaths = {
    'music-default': 'audio/main-theme.mp3',
    'music-1': 'audio/music-1.mp3',
    'music-2': 'audio/music-2.mp3',
    'music-3': 'audio/music-3.mp3',
  };

  void _init() {
    // Listen to auth changes to pick up selectedMusic from profile
    authService.addListener(_onAuthChanged);
  }

  void _onAuthChanged() {
    final user = authService.currentUser;
    if (user == null) {
      // Logged out -> stop music
      stop();
      return;
    }
    if (!_initialized) {
      _initialized = true;
      final selected = user.selectedMusic;
      _currentMusicId = selected;
      if (selected != musicOffId) {
        _playMusic(selected);
      }
    }
  }

  /// Start playing the selected music from user profile.
  /// Call this after login / when home page loads.
  void startFromProfile() {
    final user = authService.currentUser;
    if (user == null) return;
    final selected = user.selectedMusic;
    _currentMusicId = selected;
    if (selected != musicOffId) {
      _playMusic(selected);
    } else {
      _isPlaying = false;
      // Do not notify during the build phase (e.g. didChangeDependencies).
      Future<void>.microtask(() => notifyListeners());
    }
  }

  /// Change to a specific music track
  Future<void> changeMusic(String musicId) async {
    _currentMusicId = musicId;

    if (musicId == musicOffId) {
      await _disposePlayer();
      _isPlaying = false;
      notifyListeners();
      // Save preference to server
      await authService.updateSelectedMusic(musicId);
      return;
    }

    await _playMusic(musicId);
    // Save preference to server
    await authService.updateSelectedMusic(musicId);
  }

  /// Toggle music on/off
  Future<void> toggle() async {
    if (_isPlaying) {
      // Mute -> set to music-off
      await changeMusic(musicOffId);
    } else {
      // Unmute -> play last selected or default
      final user = authService.currentUser;
      final musicToPlay = (user?.selectedMusic != null &&
              user!.selectedMusic != musicOffId)
          ? user.selectedMusic
          : musicDefaultId;
      await changeMusic(musicToPlay);
    }
  }

  Future<void> _playMusic(String musicId) async {
    final path = _musicPaths[musicId];
    if (path == null) return;

    await _disposePlayer();

    _player = AudioPlayer();
    _player!.setReleaseMode(ReleaseMode.loop);

    try {
      await _player!.play(AssetSource(path));
      _isPlaying = true;
    } catch (e) {
      debugPrint('Error playing music: $e');
      _isPlaying = false;
    }
    notifyListeners();
  }

  Future<void> stop() async {
    await _disposePlayer();
    _isPlaying = false;
    _initialized = false;
    _currentMusicId = musicDefaultId;
    notifyListeners();
  }

  Future<void> _disposePlayer() async {
    try {
      await _player?.stop();
      await _player?.dispose();
    } catch (_) {}
    _player = null;
  }

  /// Get the list of owned music for the music menu
  List<CosmeticMusic> getOwnedMusics() {
    final user = authService.currentUser;
    if (user == null) return [];
    return CosmeticsService.musics
        .where((m) => user.ownedMusics.contains(m.id))
        .toList();
  }

  @override
  void dispose() {
    authService.removeListener(_onAuthChanged);
    _disposePlayer();
    super.dispose();
  }
}
