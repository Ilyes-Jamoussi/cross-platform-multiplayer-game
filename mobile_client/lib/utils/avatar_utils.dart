String getAvatarPath(String? avatarName) {
  if (avatarName == null || avatarName.isEmpty) {
    return 'assets/avatar-1.png';
  }
  
  // If it is already a full path, return it as is (backward compatibility)
  if (avatarName.contains('/')) {
    return avatarName;
  }
  
  // Otherwise, build the path
  return 'assets/$avatarName.png';
}
