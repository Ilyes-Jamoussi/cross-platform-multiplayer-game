import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import '../utils/avatar_utils.dart';

enum AvatarShape { circle, square }

/// Image source for an avatar identifier (assets, file, data URL).
ImageProvider avatarImageProvider(String avatar) {
  if (avatar.startsWith('data:image')) {
    final base64Str = avatar.split(',').last;
    final bytes = base64Decode(base64Str);
    return MemoryImage(bytes);
  }

  if (File(avatar).existsSync()) {
    return FileImage(File(avatar));
  }

  return AssetImage(getAvatarPath(avatar));
}

class AppAvatar extends StatelessWidget {
  final String avatar;
  final double size;
  final AvatarShape shape;
  final bool isSelected;

  const AppAvatar({
    super.key,
    required this.avatar,
    this.size = 40,
    this.shape = AvatarShape.circle,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final image = avatarImageProvider(avatar);

    if (shape == AvatarShape.circle) {
      return CircleAvatar(radius: size / 2, backgroundImage: image);
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        border: Border.all(
          color: isSelected ? Colors.blue : Colors.transparent,
          width: 3,
        ),
        borderRadius: BorderRadius.circular(4),
        image: DecorationImage(image: image, fit: BoxFit.cover),
      ),
    );
  }
}
