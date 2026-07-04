import 'package:mobile_client/models/game_avatar.dart';

/// Returns an icon asset for the player avatar (like the Angular `AVATARS`).
String? gameAvatarIconAsset(String? avatarName) {
  if (avatarName == null || avatarName.isEmpty) return null;
  for (final a in kSelectableGameAvatars) {
    if (a.name == avatarName) return a.iconAsset;
  }
  return kSelectableGameAvatars.first.iconAsset;
}
