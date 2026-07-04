import 'package:flutter/foundation.dart';
import 'package:mobile_client/services/auth_service.dart';

class CosmeticBackground {
  final String id;
  final String name;
  /// Blue theme variant (aligned with the Angular `blueValue`).
  final String blueAssetPath;
  /// Red theme variant (Angular `redValue`).
  final String redAssetPath;
  final int price;

  const CosmeticBackground({
    required this.id,
    required this.name,
    required this.blueAssetPath,
    required this.redAssetPath,
    required this.price,
  });

  String assetForTheme(bool isBlue) =>
      isBlue ? blueAssetPath : redAssetPath;
}

class FeaturedAvatar {
  final String id;
  final String name;
  final int price;
  final String icon;
  final String? animation;

  const FeaturedAvatar({
    required this.id,
    required this.name,
    required this.price,
    required this.icon,
    this.animation,
  });
}

class CosmeticMusic {
  final String id;
  final String name;
  final String cover;
  final int price;

  const CosmeticMusic({
    required this.id,
    required this.name,
    required this.cover,
    required this.price,
  });
}

class CosmeticsService extends ChangeNotifier {
  final AuthService authService;

  CosmeticsService({required this.authService});

  static const List<CosmeticBackground> backgrounds = [
    CosmeticBackground(
      id: 'background-default',
      name: 'shop_page.background.default',
      blueAssetPath: 'assets/backgrounds/background-default.png',
      redAssetPath: 'assets/backgrounds/background-default.png',
      price: 0,
    ),
    CosmeticBackground(
      id: 'background-1',
      name: 'shop_page.background.background_1',
      blueAssetPath: 'assets/backgrounds/eggcited_blue.gif',
      redAssetPath: 'assets/backgrounds/eggcited_red.gif',
      price: 400,
    ),
    CosmeticBackground(
      id: 'background-2',
      name: 'shop_page.background.background_2',
      blueAssetPath: 'assets/backgrounds/zero-duck-given_blue.gif',
      redAssetPath: 'assets/backgrounds/zero-duck-given_red.gif',
      price: 600,
    ),
    CosmeticBackground(
      id: 'background-3',
      name: 'shop_page.background.background_3',
      blueAssetPath: 'assets/backgrounds/champions-brew_blue.gif',
      redAssetPath: 'assets/backgrounds/champions-brew_red.gif',
      price: 800,
    ),
  ];

  static const List<FeaturedAvatar> featuredAvatars = [
    FeaturedAvatar(
      id: 'specter',
      name: 'Specter',
      price: 500,
      icon: 'assets/avatar_icon/specter_icon.png',
      animation: 'assets/avatar_gif/specter.gif',
    ),
    FeaturedAvatar(
      id: 'titan',
      name: 'Titan',
      price: 750,
      icon: 'assets/avatar_icon/titan_icon.png',
      animation: 'assets/avatar_gif/titan.gif',
    ),
    FeaturedAvatar(
      id: 'whiplash',
      name: 'Whiplash',
      price: 1000,
      icon: 'assets/avatar_icon/whiplash_icon.png',
      animation: 'assets/avatar_gif/whiplash.gif',
    ),
    FeaturedAvatar(
      id: 'yang',
      name: 'Yang',
      price: 1500,
      icon: 'assets/avatar_icon/yang_icon.png',
      animation: 'assets/avatar_gif/yang.gif',
    ),
  ];

  static const List<CosmeticMusic> musics = [
    CosmeticMusic(
      id: 'music-default',
      name: 'music_name.main_theme',
      cover: 'assets/music-covers/music-default.png',
      price: 0,
    ),
    CosmeticMusic(
      id: 'music-1',
      name: 'music_name.epic',
      cover: 'assets/music-covers/music-1.png',
      price: 300,
    ),
    CosmeticMusic(
      id: 'music-2',
      name: 'music_name.adventure',
      cover: 'assets/music-covers/music-2.png',
      price: 500,
    ),
    CosmeticMusic(
      id: 'music-3',
      name: 'music_name.mystic',
      cover: 'assets/music-covers/music-3.png',
      price: 700,
    ),
  ];

  List<CosmeticBackground> get shopBackgrounds =>
      backgrounds.where((b) => b.id != 'background-default').toList();

  List<FeaturedAvatar> get shopAvatars => featuredAvatars;

  List<CosmeticMusic> get shopMusics =>
      musics.where((m) => m.id != 'music-default').toList();

  List<CosmeticBackground> getOwnedBackgrounds(List<String> ownedIds) {
    return backgrounds.where((b) => ownedIds.contains(b.id)).toList();
  }

  List<FeaturedAvatar> getOwnedAvatars(List<String> ownedNames) {
    return featuredAvatars
        .where((a) => ownedNames.contains(a.name) || ownedNames.contains(a.id))
        .toList();
  }

  List<CosmeticMusic> getOwnedMusics(List<String> ownedIds) {
    return musics.where((m) => ownedIds.contains(m.id)).toList();
  }

  bool isBackgroundOwned(String bgId) {
    final user = authService.currentUser;
    return user?.ownedBackgrounds.contains(bgId) ?? (bgId == 'background-default');
  }

  bool isAvatarOwned(String avatarName) {
    final user = authService.currentUser;
    return user?.ownedAvatars.contains(avatarName) ?? false;
  }

  bool isMusicOwned(String musicId) {
    final user = authService.currentUser;
    return user?.ownedMusics.contains(musicId) ?? (musicId == 'music-default');
  }

  bool canAfford(int price) {
    return (authService.currentUser?.virtualCurrency ?? 0) >= price;
  }

  int get userCurrency => authService.currentUser?.virtualCurrency ?? 0;

  Future<bool> purchaseBackground(CosmeticBackground bg) async {
    if (isBackgroundOwned(bg.id) || !canAfford(bg.price)) return false;
    final result = await authService.purchaseBackground(bg.id, bg.price);
    if (result) notifyListeners();
    return result;
  }

  Future<bool> purchaseAvatar(FeaturedAvatar avatar) async {
    if (isAvatarOwned(avatar.name) || !canAfford(avatar.price)) return false;
    final result = await authService.purchaseAvatar(avatar.name, avatar.price);
    if (result) notifyListeners();
    return result;
  }

  Future<bool> purchaseMusic(CosmeticMusic music) async {
    if (isMusicOwned(music.id) || !canAfford(music.price)) return false;
    final result = await authService.purchaseMusic(music.id, music.price);
    if (result) notifyListeners();
    return result;
  }
}
