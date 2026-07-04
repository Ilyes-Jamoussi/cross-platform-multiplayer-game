import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../app/i18n.dart';
import '../services/theme_service.dart';
import 'avatar_preview.dart';

/// Profile avatar card — edit mode aligned with the Angular `profile-page`:
/// title, 3×N grid, centered upload row (+ / image), upload button,
/// puis Annuler / Enregistrer.
class AvatarCard extends StatelessWidget {
  const AvatarCard({
    super.key,
    required this.selectedAvatar,
    required this.tempSelectedAvatar,
    required this.isEditing,
    required this.takenPhoto,
    required this.availableAvatars,
    required this.onToggleEdit,
    required this.onPickImage,
    required this.onSave,
    this.onAvatarSelected,
    this.onSelectUploaded,
    this.compactMode = false,
  });

  final String selectedAvatar;
  final String tempSelectedAvatar;
  final bool isEditing;
  final File? takenPhoto;
  final List<String> availableAvatars;
  final VoidCallback onToggleEdit;
  final VoidCallback onPickImage;
  final VoidCallback onSave;
  final ValueChanged<String>? onAvatarSelected;
  final VoidCallback? onSelectUploaded;
  final bool compactMode;

  @override
  Widget build(BuildContext context) {
    final theme = context.watch<ThemeService>();
    final primary = theme.primaryColor;
    final secondary = theme.secondaryColor;
    final muted = theme.textMutedColor;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            constraints.maxWidth.isFinite ? constraints.maxWidth : 320.0;
        final scale = compactMode ? 0.92 : 1.0;
        final pad = (12.0 * scale).clamp(10.0, 16.0);
        final gapGrid = (8.0 * scale).clamp(6.0, 10.0);
        final gapSection = (10.0 * scale).clamp(8.0, 12.0);
        final innerW = (width - pad * 2).clamp(120.0, 800.0);
        final cell =
            ((innerW - 2 * gapGrid) / 3).clamp(44.0, 56.0);
        final gridW = math.min(cell * 3 + 2 * gapGrid, innerW);
        final tileSide = ((gridW - 2 * gapGrid) / 3).clamp(32.0, 72.0);
        final profileAvatarSize = ((tileSide * 12 / 7).clamp(
          72.0,
          math.min(120.0, innerW * 0.42),
        )).toDouble();
        final buttonFont = (8.0 * scale).clamp(6.0, 9.0);
        final buttonVP = (7.0 * scale).clamp(4.0, 9.0);

        return Container(
          width: double.infinity,
          padding: EdgeInsets.all(pad),
          decoration: BoxDecoration(
            color: theme.primarySurfaceColor,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: primary, width: 4),
            boxShadow: [
              BoxShadow(color: theme.primaryColor, spreadRadius: 2),
              BoxShadow(color: theme.secondaryColor, spreadRadius: 4),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!isEditing) ...[
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: secondary, width: 3),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: theme.secondaryDisabledColor,
                        blurRadius: 8,
                        spreadRadius: 0,
                      ),
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(9),
                    child: AppAvatar(
                      avatar: takenPhoto?.path ?? tempSelectedAvatar,
                      size: profileAvatarSize,
                      shape: AvatarShape.square,
                    ),
                  ),
                ),
                SizedBox(height: gapSection),
                _PixelAvatarButton(
                  primary: primary,
                  surface: theme.primarySurfaceColor,
                  hoverText: theme.primaryHoverTextColor,
                  label: I18n().translate('profile_page.modifier_avatar'),
                  filled: false,
                  fontSize: buttonFont,
                  verticalPadding: buttonVP,
                  onTap: onToggleEdit,
                ),
              ],
              if (isEditing) ...[
                Text(
                  I18n().translate('profile_page.choisir_avatar'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.pressStart2p(
                    fontSize: (9.0 * scale).clamp(7.0, 11.0),
                    color: secondary,
                    fontWeight: FontWeight.bold,
                    height: 1.3,
                  ),
                ),
                SizedBox(height: gapSection),
                _AvatarPickerGrid(
                  availableAvatars: availableAvatars,
                  tempSelectedAvatar: tempSelectedAvatar,
                  takenPhoto: takenPhoto,
                  gridW: gridW,
                  tileSide: tileSide,
                  gap: gapGrid,
                  innerWidth: innerW,
                  primary: primary,
                  secondary: secondary,
                  onAvatarSelected: onAvatarSelected,
                ),
                SizedBox(height: gapGrid),
                _UploadSlot(
                  takenPhoto: takenPhoto,
                  cell: tileSide,
                  primary: primary,
                  secondary: secondary,
                  muted: muted,
                  panelInset: theme.panelInsetColor,
                  tempSelectedAvatar: tempSelectedAvatar,
                  onPickImage: onPickImage,
                  onSelectUploaded: onSelectUploaded,
                ),
                SizedBox(height: gapSection),
                _PixelAvatarButton(
                  primary: primary,
                  surface: theme.primarySurfaceColor,
                  hoverText: theme.primaryHoverTextColor,
                  label: takenPhoto != null
                      ? I18n().translate('profile_page.retake_photo')
                      : I18n().translate('profile_page.take_photo'),
                  filled: false,
                  fontSize: (buttonFont - 0.5).clamp(6.0, 8.0),
                  verticalPadding: (buttonVP - 1).clamp(3.0, 8.0),
                  isSmall: true,
                  onTap: onPickImage,
                ),
                SizedBox(height: gapSection),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _PixelAvatarButton(
                      primary: primary,
                      surface: theme.primarySurfaceColor,
                      hoverText: theme.primaryHoverTextColor,
                      label: I18n().translate('profile_page.annuler'),
                      filled: false,
                      fontSize: buttonFont,
                      verticalPadding: buttonVP,
                      minWidth: compactMode ? 110 : 130,
                      onTap: onToggleEdit,
                    ),
                    SizedBox(width: compactMode ? 8 : 10),
                    _PixelAvatarButton(
                      primary: primary,
                      surface: theme.primarySurfaceColor,
                      hoverText: theme.primaryHoverTextColor,
                      label: I18n().translate('profile_page.enregistrer'),
                      filled: true,
                      fontSize: buttonFont,
                      verticalPadding: buttonVP,
                      minWidth: compactMode ? 110 : 130,
                      onTap: onSave,
                    ),
                  ],
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _AvatarPickerGrid extends StatelessWidget {
  const _AvatarPickerGrid({
    required this.availableAvatars,
    required this.tempSelectedAvatar,
    required this.takenPhoto,
    required this.gridW,
    required this.tileSide,
    required this.gap,
    required this.innerWidth,
    required this.primary,
    required this.secondary,
    required this.onAvatarSelected,
  });

  final List<String> availableAvatars;
  final String tempSelectedAvatar;
  final File? takenPhoto;
  final double gridW;
  final double tileSide;
  final double gap;
  final double innerWidth;
  final Color primary;
  final Color secondary;
  final ValueChanged<String>? onAvatarSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: innerWidth,
      child: Align(
        alignment: Alignment.topCenter,
        child: SizedBox(
          width: gridW,
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              mainAxisSpacing: gap,
              crossAxisSpacing: gap,
              childAspectRatio: 1,
            ),
            itemCount: availableAvatars.length,
            itemBuilder: (context, index) {
              final avatar = availableAvatars[index];
              final isSelected =
                  tempSelectedAvatar == avatar && takenPhoto == null;
              final borderW = isSelected ? 3.0 : 2.0;
              final avatarDraw = math.max(tileSide - 2 * borderW - 2, 16.0);
              return GestureDetector(
                onTap: () => onAvatarSelected?.call(avatar),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: isSelected ? secondary : primary,
                      width: borderW,
                    ),
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: secondary.withValues(alpha: 0.45),
                              blurRadius: 6,
                            ),
                          ]
                        : null,
                  ),
                  clipBehavior: Clip.hardEdge,
                  child: Center(
                    child: AppAvatar(
                      avatar: avatar,
                      size: avatarDraw,
                      shape: AvatarShape.square,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _UploadSlot extends StatelessWidget {
  const _UploadSlot({
    required this.takenPhoto,
    required this.cell,
    required this.primary,
    required this.secondary,
    required this.muted,
    required this.panelInset,
    required this.tempSelectedAvatar,
    required this.onPickImage,
    required this.onSelectUploaded,
  });

  final File? takenPhoto;
  final double cell;
  final Color primary;
  final Color secondary;
  final Color muted;
  final Color panelInset;
  final String tempSelectedAvatar;
  final VoidCallback onPickImage;
  final VoidCallback? onSelectUploaded;

  @override
  Widget build(BuildContext context) {
    final hasFile = takenPhoto != null;
    final uploadedSelected =
        hasFile && tempSelectedAvatar == takenPhoto!.path;

    if (hasFile) {
      return Center(
        child: GestureDetector(
          onTap: onSelectUploaded,
          child: AnimatedOpacity(
            opacity: uploadedSelected ? 1.0 : 0.7,
            duration: const Duration(milliseconds: 150),
            child: Container(
              width: cell,
              height: cell,
              decoration: BoxDecoration(
                border: Border.all(
                  color: uploadedSelected ? secondary : primary,
                  width: uploadedSelected ? 3 : 2,
                ),
                borderRadius: BorderRadius.circular(8),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.file(takenPhoto!, fit: BoxFit.cover),
              ),
            ),
          ),
        ),
      );
    }

    return Center(
      child: GestureDetector(
        onTap: onPickImage,
        child: Container(
          width: cell,
          height: cell,
          decoration: BoxDecoration(
            color: panelInset,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: muted, width: 2),
          ),
          child: Center(
            child: Text(
              '+',
              style: GoogleFonts.pressStart2p(
                fontSize: (cell * 0.35).clamp(18.0, 28.0),
                color: secondary,
                height: 1,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PixelAvatarButton extends StatelessWidget {
  const _PixelAvatarButton({
    required this.primary,
    required this.surface,
    required this.hoverText,
    required this.label,
    required this.filled,
    required this.fontSize,
    required this.verticalPadding,
    required this.onTap,
    this.isSmall = false,
    this.minWidth,
  });

  final Color primary;
  final Color surface;
  final Color hoverText;
  final String label;
  final bool filled;
  final double fontSize;
  final double verticalPadding;
  final VoidCallback onTap;
  final bool isSmall;
  final double? minWidth;

  @override
  Widget build(BuildContext context) {
    final bg = filled ? primary : surface;
    final fg = filled ? hoverText : primary;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: BoxConstraints(minWidth: minWidth ?? 0),
        padding: EdgeInsets.symmetric(
          vertical: isSmall ? (verticalPadding - 1).clamp(3.0, 8.0) : verticalPadding,
          horizontal: isSmall ? 8 : 10,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: primary, width: 3),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: GoogleFonts.pressStart2p(
            fontSize: fontSize,
            fontWeight: FontWeight.bold,
            color: fg,
            height: 1.2,
          ),
        ),
      ),
    );
  }
}
