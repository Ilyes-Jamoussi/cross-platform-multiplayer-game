/// Playable avatars (aligned with [common/avatar.ts], without Knuckles or shop "featured" avatars).
class GameAvatarData {
  const GameAvatarData({
    required this.name,
    required this.iconAsset,
    required this.animationAsset,
    required this.combatIdleAsset,
    required this.combatAttackAsset,
    this.combatAttackDurationMs = 1600,
  });

  final String name;
  final String iconAsset;
  final String animationAsset;
  /// Combat idle GIF (copied from `client/src/assets/avatar_combat/avatar_idle/`).
  final String combatIdleAsset;
  /// GIF combat attaque (`avatar_combat/avatar_attack/`).
  final String combatAttackAsset;
  final int combatAttackDurationMs;
}

const List<GameAvatarData> kSelectableGameAvatars = [
  GameAvatarData(
    name: 'Archer',
    iconAsset: 'assets/avatar_png/archer.png',
    animationAsset: 'assets/avatar_gif/archer.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/archer.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/archer.gif',
    combatAttackDurationMs: 1610,
  ),
  GameAvatarData(
    name: 'Cubic',
    iconAsset: 'assets/avatar_png/cubic.png',
    animationAsset: 'assets/avatar_gif/cubic.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/cubic.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/cubic.gif',
    combatAttackDurationMs: 2520,
  ),
  GameAvatarData(
    name: 'Golden Punch',
    iconAsset: 'assets/avatar_png/golden_punch.png',
    animationAsset: 'assets/avatar_gif/golden_punch.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/golden_punch.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/golden_punch.gif',
    combatAttackDurationMs: 2069,
  ),
  GameAvatarData(
    name: 'IceWolf',
    iconAsset: 'assets/avatar_png/ice_wolf.png',
    animationAsset: 'assets/avatar_gif/icewolf.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/ice_wolf.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/ice_wolf.gif',
    combatAttackDurationMs: 2520,
  ),
  GameAvatarData(
    name: 'Inferno',
    iconAsset: 'assets/avatar_png/inferno.png',
    animationAsset: 'assets/avatar_gif/inferno.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/inferno.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/inferno.gif',
    combatAttackDurationMs: 2170,
  ),
  GameAvatarData(
    name: 'Phoenix',
    iconAsset: 'assets/avatar_png/phoenix.png',
    animationAsset: 'assets/avatar_gif/phoenix.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/pheonix.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/pheonix.gif',
    combatAttackDurationMs: 2249,
  ),
  GameAvatarData(
    name: 'Rainbow',
    iconAsset: 'assets/avatar_png/rainbow.png',
    animationAsset: 'assets/avatar_gif/rainbow.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/rainbow.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/rainbow.gif',
    combatAttackDurationMs: 2820,
  ),
  GameAvatarData(
    name: 'Ronin',
    iconAsset: 'assets/avatar_png/ronin.png',
    animationAsset: 'assets/avatar_gif/ronin.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/ronin.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/ronin.gif',
    combatAttackDurationMs: 1470,
  ),
  GameAvatarData(
    name: 'Specter',
    iconAsset: 'assets/avatar_png/specter.png',
    animationAsset: 'assets/avatar_gif/specter.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/specter.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/specter.gif',
    combatAttackDurationMs: 1470,
  ),
  GameAvatarData(
    name: 'Titan',
    iconAsset: 'assets/avatar_png/titan.png',
    animationAsset: 'assets/avatar_gif/titan.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/titan.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/titan.gif',
    combatAttackDurationMs: 2040,
  ),
  GameAvatarData(
    name: 'Whiplash',
    iconAsset: 'assets/avatar_png/whiplash.png',
    animationAsset: 'assets/avatar_gif/whiplash.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/whiplash.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/whiplash.gif',
    combatAttackDurationMs: 1610,
  ),
  GameAvatarData(
    name: 'Yang',
    iconAsset: 'assets/avatar_png/yang.png',
    animationAsset: 'assets/avatar_gif/yang.gif',
    combatIdleAsset: 'assets/avatar_combat/avatar_idle/yang.gif',
    combatAttackAsset: 'assets/avatar_combat/avatar_attack/yang.gif',
    combatAttackDurationMs: 3010,
  ),
];

/// Treats "IceWolf", `ice_wolf`, `ice-wolf`, `ice wolf` as the same avatar.
String _normAvatarLookupKey(String raw) {
  return raw
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[\s_\-]+'), '');
}

GameAvatarData? lookupSelectableGameAvatar(String? avatarName) {
  if (avatarName == null || avatarName.isEmpty) return null;
  final lower =
      avatarName.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  for (final a in kSelectableGameAvatars) {
    if (a.name.toLowerCase() == lower) return a;
  }
  // Server or UI variants / labels
  const aliases = <String, String>{
    'ice wolf': 'IceWolf',
    'icewolf': 'IceWolf',
    'golden punch': 'Golden Punch',
    'goldenpunch': 'Golden Punch',
    // Combat files `pheonix.gif` (typo in the assets) — some servers / legacy data.
    'pheonix': 'Phoenix',
  };
  final canon = aliases[lower];
  if (canon != null) {
    for (final a in kSelectableGameAvatars) {
      if (a.name == canon) return a;
    }
  }
  final nk = _normAvatarLookupKey(avatarName);
  if (nk.isNotEmpty) {
    for (final a in kSelectableGameAvatars) {
      if (_normAvatarLookupKey(a.name) == nk) return a;
    }
  }
  return null;
}

String? _featuredCombatSlug(String? avatarName) {
  final n = avatarName ?? '';
  var m = RegExp(r'featured_avatar_(\d)', caseSensitive: false).firstMatch(n);
  if (m != null) return 'featured_avatar_${m.group(1)}';
  m = RegExp(r'featured\s*avatar\s*(\d)', caseSensitive: false).firstMatch(n);
  if (m != null) return 'featured_avatar_${m.group(1)}';
  return null;
}

/// Combat idle: selectable list or featured avatars present in the web assets.
String combatIdleAssetPath(String? avatarName) {
  final a = lookupSelectableGameAvatar(avatarName);
  if (a != null) return a.combatIdleAsset;
  final slug = _featuredCombatSlug(avatarName);
  if (slug != null) return 'assets/avatar_combat/avatar_idle/$slug.gif';
  return 'assets/avatar_combat/avatar_idle/archer.gif';
}

String combatAttackAssetPath(String? avatarName) {
  final a = lookupSelectableGameAvatar(avatarName);
  if (a != null) return a.combatAttackAsset;
  final slug = _featuredCombatSlug(avatarName);
  if (slug != null) return 'assets/avatar_combat/avatar_attack/$slug.gif';
  return 'assets/avatar_combat/avatar_attack/archer.gif';
}

/// `SNACKBAR_TIME` in `common/constants.ts` — used by `startAttackAnimation` on the Angular side.
const int kAngularSnackbarTimeMs = 3000;

GameAvatarData? _lookupAvatarStrictDisplayName(String? avatarName) {
  if (avatarName == null || avatarName.isEmpty) return null;
  final t = avatarName.trim();
  if (t.isEmpty) return null;
  for (final a in kSelectableGameAvatars) {
    if (a.name == t) return a;
  }
  return null;
}

/// Like Angular `getAvatarIdleAnimation`: **exact** match of the AVATARS name, otherwise same resolution as
/// the mobile client for featured / aliases (`combatIdleAssetPath`), not just Archer.
String vsPopUpIdleImgSrc(String? avatarName) {
  final strict = _lookupAvatarStrictDisplayName(avatarName);
  if (strict != null) return strict.combatIdleAsset;
  return combatIdleAssetPath(avatarName);
}

/// Like `getAvatarAttackAnimation`.
String vsPopUpAttackImgSrc(String? avatarName) {
  final strict = _lookupAvatarStrictDisplayName(avatarName);
  if (strict != null) return strict.combatAttackAsset;
  return combatAttackAssetPath(avatarName);
}

int combatAttackDurationMsFor(String? avatarName) {
  return lookupSelectableGameAvatar(avatarName)?.combatAttackDurationMs ??
      kAngularSnackbarTimeMs;
}

/// GIF on the grid (Angular equivalent `getPlayerAvatar` → `idle` / anim; here `avatar_gif`).
String gameMapAvatarGifAsset(String? avatarName) {
  final a = lookupSelectableGameAvatar(avatarName);
  if (a != null) return a.animationAsset;
  final slug = _featuredCombatSlug(avatarName);
  if (slug != null) return 'assets/avatar_gif/$slug.gif';
  return kSelectableGameAvatars.first.animationAsset;
}
