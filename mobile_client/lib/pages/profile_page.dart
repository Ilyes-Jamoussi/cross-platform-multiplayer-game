import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../app/i18n.dart';
import '../app/router.dart';
import '../models/account_type.dart';
import '../services/auth_service.dart';
import '../services/tutorial_service.dart';
import '../services/cosmetics_service.dart';
import '../services/language_service.dart';
import '../services/music_service.dart';
import '../services/theme_service.dart';
import '../theme/game_page_overlays.dart';
import '../widget/avatar_card.dart';
import '../widget/coin_icon.dart';
import '../widget/profile_background.dart';
import '../widget/web_game_flow_floating_actions.dart';
import '../widget/web_game_flow_header.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  late String _selectedAvatar;
  bool isEditingAvatar = false;
  String tempSelectedAvatar = '';
  File? takenPhoto;
  String _activeTab = 'backgrounds';

  bool _isEditingUsername = false;
  String _usernameError = '';
  bool _isEditingEmail = false;
  String _emailError = '';
  final TextEditingController _usernameEditController = TextEditingController();
  final TextEditingController _emailEditController = TextEditingController();

  static const List<String> availableAvatars = [
    'avatar-1',
    'avatar-2',
    'avatar-3',
    'avatar-4',
    'avatar-5',
    'avatar-6',
    'avatar-7',
    'avatar-8',
    'avatar-9',
  ];

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthService>().currentUser;
    _selectedAvatar = user?.avatar ?? 'avatar-1';
    tempSelectedAvatar = _selectedAvatar;
  }

  @override
  void dispose() {
    _usernameEditController.dispose();
    _emailEditController.dispose();
    super.dispose();
  }

  /// Back to home clearing the stack (e.g. after a tutorial action).
  void _goHomeReplacingStack() {
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, AppRoutes.home, (_) => false);
  }

  void _toggleEditAvatar() {
    setState(() {
      isEditingAvatar = !isEditingAvatar;
      tempSelectedAvatar = _selectedAvatar;
      takenPhoto = null;
    });
  }

  Future<void> _takePhoto() async {
    final pickedFile = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 88,
    );
    if (pickedFile != null) {
      setState(() {
        takenPhoto = File(pickedFile.path);
        tempSelectedAvatar = pickedFile.path;
      });
    }
  }

  Future<void> _saveAvatar() async {
    final authService = context.read<AuthService>();
    String avatarToSave;

    if (takenPhoto != null) {
      final bytes = await takenPhoto!.readAsBytes();
      avatarToSave = 'data:image/png;base64,${base64Encode(bytes)}';
    } else {
      avatarToSave = tempSelectedAvatar;
    }

    try {
      await authService.updateAvatar(avatarToSave);
      setState(() {
        _selectedAvatar = avatarToSave;
        isEditingAvatar = false;
        takenPhoto = null;
      });
    } catch (e) {
      showGamePageSnackBar(
        context,
        '${I18n().translate('profile_page.avatar_update_failed')}$e',
        kind: GamePageSnackKind.error,
      );
    }
  }

  Future<void> _confirmAndDeleteAccount() async {
    final shouldDelete = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black54,
      builder: (dialogContext) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 520),
          padding: const EdgeInsets.fromLTRB(22, 20, 22, 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF16171F), Color(0xFF0D0E14), Color(0xFF12131A)],
              stops: [0.0, 0.48, 1.0],
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE67E22), width: 3),
            boxShadow: const [
              BoxShadow(
                color: Color.fromRGBO(230, 126, 34, 0.25),
                blurRadius: 20,
                spreadRadius: 1,
              ),
              BoxShadow(
                color: Color.fromRGBO(0, 0, 0, 0.55),
                blurRadius: 24,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color.fromRGBO(230, 126, 34, 0.12),
                  border: Border.all(
                    color: const Color(0xFFE67E22),
                    width: 2.5,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color.fromRGBO(230, 126, 34, 0.20),
                      blurRadius: 10,
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    '?',
                    style: TextStyle(
                      color: Color(0xFFE67E22),
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                I18n().translate('profile_page.delete_dialog_title'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.2,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                I18n().translate('profile_page.delete_dialog_message'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFAAB0BC),
                  fontSize: 13,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 18),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.of(dialogContext).pop(false),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(
                        color: Color.fromRGBO(255, 255, 255, 0.18),
                        width: 2,
                      ),
                      foregroundColor: const Color(0xFFAAB0BC),
                      backgroundColor: const Color.fromRGBO(
                        255,
                        255,
                        255,
                        0.06,
                      ),
                      minimumSize: const Size(120, 42),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    child: Text(
                      I18n().translate('profile_page.annuler'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: () => Navigator.of(dialogContext).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE67E22),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      minimumSize: const Size(120, 42),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                        side: const BorderSide(
                          color: Color(0xFFCF6D17),
                          width: 2,
                        ),
                      ),
                    ),
                    child: Text(
                      I18n().translate('profile_page.confirmer'),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    if (shouldDelete != true) return;

    final authService = context.read<AuthService>();

    try {
      await authService.deleteAccount();
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
    } catch (_) {
      try {
        await authService.logout();
      } catch (_) {}
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (_) => false);
    }
  }

  String getAvatarForPreview() {
    if (takenPhoto != null) return takenPhoto!.path;
    return _selectedAvatar;
  }

  static final _emailSaveRegex = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$');

  /// As after the dev merge: inline field + Save / Cancel (no dialog).
  Widget _buildMergeStyleEditableField({
    required String label,
    required String value,
    required bool isEditing,
    required TextEditingController controller,
    required String error,
    required VoidCallback onToggleEdit,
    required ValueChanged<String> onFieldChanged,
    required Future<void> Function() onSave,
    required double screenH,
    required double scale,
    int? maxLength,
    TextInputType keyboardType = TextInputType.text,
  }) {
    final theme = context.watch<ThemeService>();
    final borderBlue = theme.primaryColor;
    final labelStyle = GoogleFonts.pressStart2p(
      fontSize: (screenH * 0.011 * scale).clamp(7.0, 11.0),
      color: borderBlue,
      fontWeight: FontWeight.bold,
    );
    final valueStyle = GoogleFonts.pressStart2p(
      fontSize: (screenH * 0.012 * scale).clamp(8.0, 12.0),
      color: theme.onPrimarySurfaceColor.withValues(alpha: 0.87),
    );
    final btnH = (28 * scale).clamp(26.0, 36.0);
    final padV = (screenH * 0.008 * scale).clamp(3.0, 8.0);

    Widget bottomDivider() => Divider(
      height: (screenH * 0.02 * scale).clamp(8.0, 20.0),
      color: theme.onPrimarySurfaceColor.withValues(alpha: 0.12),
    );

    if (!isEditing) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(vertical: padV),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: labelStyle),
                      SizedBox(
                        height: (screenH * 0.005 * scale).clamp(2.0, 6.0),
                      ),
                      Text(
                        value,
                        style: valueStyle,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  height: btnH,
                  child: _ProfileFieldPixelButton(
                    label: I18n().translate('profile_page.edit_field'),
                    primary: borderBlue,
                    filled: false,
                    screenH: screenH,
                    scale: scale,
                    onPressed: onToggleEdit,
                  ),
                ),
              ],
            ),
          ),
          bottomDivider(),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(vertical: padV),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: labelStyle),
              SizedBox(height: (screenH * 0.005 * scale).clamp(2.0, 6.0)),
              TextField(
                controller: controller,
                maxLength: maxLength,
                keyboardType: keyboardType,
                textCapitalization: TextCapitalization.none,
                autocorrect: false,
                scrollPadding: const EdgeInsets.only(bottom: 120, top: 80),
                decoration: InputDecoration(
                  border: const OutlineInputBorder(),
                  contentPadding: EdgeInsets.symmetric(
                    vertical: (8 * scale).clamp(6.0, 10.0),
                    horizontal: (10 * scale).clamp(8.0, 12.0),
                  ),
                  isDense: true,
                  counterText: '',
                  errorText: error.isNotEmpty ? error : null,
                  errorStyle: TextStyle(
                    fontSize: (screenH * 0.011 * scale).clamp(9.0, 11.0),
                  ),
                  errorMaxLines: 2,
                ),
                style: GoogleFonts.pressStart2p(
                  fontSize: (screenH * 0.012 * scale).clamp(8.0, 12.0),
                ),
                onChanged: onFieldChanged,
              ),
              SizedBox(height: (screenH * 0.008 * scale).clamp(4.0, 8.0)),
              Row(
                children: [
                  Expanded(
                    child: _ProfileFieldPixelButton(
                      label: I18n().translate('profile_page.annuler'),
                      primary: borderBlue,
                      filled: false,
                      screenH: screenH,
                      scale: scale,
                      onPressed: onToggleEdit,
                    ),
                  ),
                  SizedBox(width: (8 * scale).clamp(6.0, 10.0)),
                  Expanded(
                    child: _ProfileFieldPixelButton(
                      label: I18n().translate('profile_page.enregistrer'),
                      primary: borderBlue,
                      filled: true,
                      screenH: screenH,
                      scale: scale,
                      onPressed: onSave,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        bottomDivider(),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final user = authService.currentUser;

    if (user == null) {
      return Scaffold(
        body: Center(
          child: Text(
            I18n().translate('profile_page.not_logged_in'),
            style: GoogleFonts.pressStart2p(fontSize: 12),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    final theme = context.watch<ThemeService>();
    final borderBlue = theme.primaryColor;
    final mq = MediaQuery.of(context);
    final screenH = mq.size.height;
    final screenW = mq.size.width;
    final lang = context.select<LanguageService, String>((s) => s.lang);
    final topInset = MediaQuery.paddingOf(context).top;

    return Scaffold(
      key: ValueKey<String>(lang),
      resizeToAvoidBottomInset: false,
      body: Stack(
        fit: StackFit.expand,
        children: [
          const ProfileBackground(),
          Column(
            children: [
              WebGameFlowHeader(onMenuPressed: _goHomeReplacingStack),
              // ── Main content ──
              Expanded(
                child: SafeArea(
                  top: false,
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final isPortrait =
                          MediaQuery.of(context).orientation ==
                          Orientation.portrait;
                      final isLandscape = !isPortrait;
                      // Do not use constraints.maxHeight: it shrinks with the keyboard
                      // and crushes the whole UI (compactScale → everything becomes tiny + overflow).
                      final compactScale = isLandscape
                          ? (screenH / 700).clamp(0.72, 1.0)
                          : 1.0;
                      final keyboardBottom = mq.viewInsets.bottom;

                      Widget currencyBanner() => Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: screenW * 0.02,
                          vertical: screenH * 0.015,
                        ),
                        decoration: BoxDecoration(
                          color: theme.primarySurfaceColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: borderBlue, width: 4),
                          boxShadow: [
                            BoxShadow(
                              color: theme.primaryColor,
                              spreadRadius: 2,
                            ),
                            BoxShadow(
                              color: theme.secondaryColor,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            CoinIcon(
                              color: const Color(0xFFE6B830),
                              size: screenH * 0.036,
                            ),
                            SizedBox(width: screenW * 0.02),
                            Text(
                              '${user.virtualCurrency ?? 0}',
                              style: GoogleFonts.pressStart2p(
                                fontSize: screenH * 0.03,
                                color: const Color(0xFFE6B830),
                                shadows: const [
                                  Shadow(
                                    color: Colors.black38,
                                    offset: Offset(2, 2),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );

                      Widget infoCard() => Container(
                        padding: EdgeInsets.all(
                          (screenW * 0.02 * compactScale).clamp(8.0, 16.0),
                        ),
                        decoration: BoxDecoration(
                          color: theme.primarySurfaceColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: borderBlue, width: 4),
                          boxShadow: [
                            BoxShadow(
                              color: theme.primaryColor,
                              spreadRadius: 2,
                            ),
                            BoxShadow(
                              color: theme.secondaryColor,
                              spreadRadius: 4,
                            ),
                          ],
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _buildMergeStyleEditableField(
                              label: I18n().translate('profile_page.pseudo'),
                              value: user.username,
                              isEditing: _isEditingUsername,
                              controller: _usernameEditController,
                              error: _usernameError,
                              screenH: screenH,
                              scale: compactScale,
                              maxLength: 10,
                              onToggleEdit: () {
                                setState(() {
                                  _isEditingUsername = !_isEditingUsername;
                                  _usernameError = '';
                                  if (_isEditingUsername) {
                                    _usernameEditController.text =
                                        user.username;
                                    _usernameEditController.selection =
                                        TextSelection.collapsed(
                                          offset: user.username.length,
                                        );
                                    _isEditingEmail = false;
                                    _emailError = '';
                                  }
                                });
                              },
                              onFieldChanged: (_) =>
                                  setState(() => _usernameError = ''),
                              onSave: () async {
                                final username = _usernameEditController.text
                                    .trim();
                                if (username.isEmpty || username.length > 10) {
                                  setState(() {
                                    _usernameError = I18n().translate(
                                      'profile_page.error_username_length',
                                    );
                                  });
                                  return;
                                }
                                final err = await authService.updateUsername(
                                  username,
                                );
                                if (!mounted) return;
                                setState(() {
                                  if (err == null) {
                                    _isEditingUsername = false;
                                    _usernameError = '';
                                  } else {
                                    _usernameError = I18n().translate(err);
                                  }
                                });
                              },
                            ),
                            _buildMergeStyleEditableField(
                              label: I18n().translate('profile_page.email'),
                              value: user.email,
                              isEditing: _isEditingEmail,
                              controller: _emailEditController,
                              error: _emailError,
                              screenH: screenH,
                              scale: compactScale,
                              keyboardType: TextInputType.emailAddress,
                              onToggleEdit: () {
                                setState(() {
                                  _isEditingEmail = !_isEditingEmail;
                                  _emailError = '';
                                  if (_isEditingEmail) {
                                    _emailEditController.text = user.email;
                                    _emailEditController.selection =
                                        TextSelection.collapsed(
                                          offset: user.email.length,
                                        );
                                    _isEditingUsername = false;
                                    _usernameError = '';
                                  }
                                });
                              },
                              onFieldChanged: (_) =>
                                  setState(() => _emailError = ''),
                              onSave: () async {
                                final email = _emailEditController.text.trim();
                                if (email.isEmpty ||
                                    !_emailSaveRegex.hasMatch(email)) {
                                  setState(() {
                                    _emailError = I18n().translate(
                                      'profile_page.error_email_invalid',
                                    );
                                  });
                                  return;
                                }
                                final err = await authService.updateEmail(
                                  email,
                                );
                                if (!mounted) return;
                                setState(() {
                                  if (err == null) {
                                    _isEditingEmail = false;
                                    _emailError = '';
                                  } else {
                                    _emailError = I18n().translate(err);
                                  }
                                });
                              },
                            ),
                            InfoRow(
                              label: I18n().translate(
                                'profile_page.membre_depuis',
                              ),
                              value:
                                  '${user.createdAt?.day}/${user.createdAt?.month}/${user.createdAt?.year}',
                              screenH: screenH,
                              scale: compactScale,
                            ),
                            SizedBox(
                              height: (screenH * 0.02 * compactScale).clamp(
                                6.0,
                                18.0,
                              ),
                            ),
                            Builder(
                              builder: (ctx) {
                                final tut = ctx.watch<TutorialService>();
                                final fontSize =
                                    (screenH * 0.012 * compactScale).clamp(
                                      9.0,
                                      12.0,
                                    );
                                final vPad = (10 * compactScale).clamp(
                                  8.0,
                                  12.0,
                                );
                                final iconSz = (18 * compactScale).clamp(
                                  16.0,
                                  22.0,
                                );

                                if (tut.isCompleted) {
                                  return ElevatedButton.icon(
                                    onPressed: () async {
                                      await tut.restart();
                                      if (!mounted) return;
                                      _goHomeReplacingStack();
                                    },
                                    icon: Icon(Icons.replay, size: iconSz),
                                    label: Text(
                                      I18n().translate(
                                        'profile_page.replay_tutorial',
                                      ),
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: fontSize,
                                      ),
                                      textAlign: TextAlign.center,
                                    ),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: borderBlue,
                                      foregroundColor: Colors.white,
                                      shape: const RoundedRectangleBorder(
                                        borderRadius: BorderRadius.zero,
                                      ),
                                      padding: EdgeInsets.symmetric(
                                        vertical: vPad,
                                      ),
                                    ),
                                  );
                                }

                                return Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    ElevatedButton.icon(
                                      onPressed: () async {
                                        tut.resumeFromProfile();
                                        if (!mounted) return;
                                        _goHomeReplacingStack();
                                      },
                                      icon: Icon(
                                        Icons.play_arrow,
                                        size: iconSz,
                                      ),
                                      label: Text(
                                        I18n().translate(
                                          'profile_page.continue_tutorial',
                                        ),
                                        style: GoogleFonts.pressStart2p(
                                          fontSize: fontSize,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: borderBlue,
                                        foregroundColor: Colors.white,
                                        shape: const RoundedRectangleBorder(
                                          borderRadius: BorderRadius.zero,
                                        ),
                                        padding: EdgeInsets.symmetric(
                                          vertical: vPad,
                                        ),
                                      ),
                                    ),
                                    SizedBox(
                                      height: (6 * compactScale).clamp(
                                        4.0,
                                        8.0,
                                      ),
                                    ),
                                    OutlinedButton.icon(
                                      onPressed: () async {
                                        await tut.restart();
                                        if (!mounted) return;
                                        _goHomeReplacingStack();
                                      },
                                      icon: Icon(
                                        Icons.restart_alt,
                                        size: iconSz,
                                      ),
                                      label: Text(
                                        I18n().translate(
                                          'profile_page.restart_from_beginning',
                                        ),
                                        style: GoogleFonts.pressStart2p(
                                          fontSize: fontSize,
                                        ),
                                      ),
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: borderBlue,
                                        side: BorderSide(
                                          color: borderBlue,
                                          width: 2,
                                        ),
                                        shape: const RoundedRectangleBorder(
                                          borderRadius: BorderRadius.zero,
                                        ),
                                        padding: EdgeInsets.symmetric(
                                          vertical: vPad,
                                        ),
                                      ),
                                    ),
                                  ],
                                );
                              },
                            ),
                            SizedBox(
                              height: (screenH * 0.02 * compactScale).clamp(
                                6.0,
                                14.0,
                              ),
                            ),
                            Container(
                              padding: EdgeInsets.only(
                                top: (10 * compactScale).clamp(6.0, 10.0),
                              ),
                              decoration: const BoxDecoration(
                                border: Border(
                                  top: BorderSide(
                                    color: Color(0xFFDC3545),
                                    width: 3,
                                  ),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _PixelButton(
                                    label: I18n().translate(
                                      'profile_page.supprimer',
                                    ),
                                    isDanger: true,
                                    screenH: screenH,
                                    scale: compactScale,
                                    onPressed: _confirmAndDeleteAccount,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );

                      Widget avatarCard() => AvatarCard(
                        selectedAvatar: _selectedAvatar,
                        tempSelectedAvatar: tempSelectedAvatar,
                        isEditing: isEditingAvatar,
                        compactMode: isLandscape,
                        takenPhoto: takenPhoto,
                        availableAvatars: availableAvatars,
                        onToggleEdit: _toggleEditAvatar,
                        onPickImage: _takePhoto,
                        onSave: _saveAvatar,
                        onAvatarSelected: (avatar) {
                          setState(() {
                            tempSelectedAvatar = avatar;
                            takenPhoto = null;
                          });
                        },
                        onSelectUploaded: takenPhoto == null
                            ? null
                            : () {
                                setState(() {
                                  tempSelectedAvatar = takenPhoto!.path;
                                });
                              },
                      );

                      final contentPadding = EdgeInsets.symmetric(
                        horizontal: screenW * 0.02,
                        vertical: screenH * 0.01,
                      );

                      if (isPortrait) {
                        return SingleChildScrollView(
                          padding: contentPadding.copyWith(
                            bottom: screenH * 0.01 + 16 + keyboardBottom,
                          ),
                          keyboardDismissBehavior:
                              ScrollViewKeyboardDismissBehavior.onDrag,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              currencyBanner(),
                              SizedBox(height: screenH * 0.015),
                              _CosmeticsPanel(
                                user: user,
                                activeTab: _activeTab,
                                onTabChanged: (tab) =>
                                    setState(() => _activeTab = tab),
                                screenH: screenH,
                                screenW: screenW,
                                expandContent: false,
                              ),
                              SizedBox(height: screenH * 0.015),
                              _StatsCard(user: user, screenH: screenH),
                              SizedBox(height: screenH * 0.015),
                              infoCard(),
                              SizedBox(height: screenH * 0.015),
                              avatarCard(),
                            ],
                          ),
                        );
                      }

                      return Padding(
                        padding: contentPadding,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  currencyBanner(),
                                  SizedBox(height: screenH * 0.015),
                                  Expanded(
                                    flex: 3,
                                    child: _CosmeticsPanel(
                                      user: user,
                                      activeTab: _activeTab,
                                      onTabChanged: (tab) =>
                                          setState(() => _activeTab = tab),
                                      screenH: screenH,
                                      screenW: screenW,
                                      expandContent: true,
                                    ),
                                  ),
                                  SizedBox(height: screenH * 0.015),
                                  Expanded(
                                    flex: 4,
                                    child: _StatsCard(
                                      user: user,
                                      screenH: screenH,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            SizedBox(width: screenW * 0.015),
                            Expanded(
                              child: SingleChildScrollView(
                                padding: EdgeInsets.only(
                                  bottom: 16 + keyboardBottom,
                                ),
                                physics: const ClampingScrollPhysics(),
                                keyboardDismissBehavior:
                                    ScrollViewKeyboardDismissBehavior.onDrag,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    infoCard(),
                                    SizedBox(height: screenH * 0.015),
                                    avatarCard(),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            top: topInset + 12,
            right: 20,
            child: const WebGameFlowFloatingActions(),
          ),
        ],
      ),
    );
  }
}

// ── Widgets ───────────────────────────────────────────────────────────────────

/// 3-column reference + spacing 10; [sizeFactor] shrinks the tile (e.g. 2/3).
const int _kUnlockGridCrossCount = 3;
const double _kUnlockGridSpacing = 10;
const double _kUnlockTileSizeFactor = 2 / 3;

double _unlockTileSide(double gridInnerWidth) {
  if (gridInnerWidth <= 0) return 48 * _kUnlockTileSizeFactor;
  final base =
      (gridInnerWidth - (_kUnlockGridCrossCount - 1) * _kUnlockGridSpacing) /
      _kUnlockGridCrossCount;
  return (base * _kUnlockTileSizeFactor).clamp(16.0, 400.0);
}

class InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final double screenH;
  final double scale;

  const InfoRow({
    required this.label,
    required this.value,
    required this.screenH,
    this.scale = 1.0,
    super.key,
  });

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final primary = themeService.primaryColor;
    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: (screenH * 0.008 * scale).clamp(3.0, 8.0),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.pressStart2p(
              fontSize: (screenH * 0.011 * scale).clamp(7.0, 11.0),
              color: primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: (screenH * 0.005 * scale).clamp(2.0, 6.0)),
          Text(
            value,
            style: GoogleFonts.pressStart2p(
              fontSize: (screenH * 0.012 * scale).clamp(8.0, 12.0),
              color: themeService.onPrimarySurfaceColor.withValues(alpha: 0.87),
            ),
            overflow: TextOverflow.ellipsis,
          ),
          Divider(
            height: (screenH * 0.02 * scale).clamp(8.0, 20.0),
            color: themeService.onPrimarySurfaceColor.withValues(alpha: 0.12),
          ),
        ],
      ),
    );
  }
}

class _PixelButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isDanger;
  final bool isDisabled;
  final double screenH;
  final double scale;

  const _PixelButton({
    required this.label,
    required this.screenH,
    this.onPressed,
    this.isDanger = false,
    this.isDisabled = false,
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final themePrimary = themeService.primaryColor;
    final borderColor = isDanger ? const Color(0xFFDC3545) : themePrimary;
    final textColor = isDanger ? const Color(0xFFDC3545) : themePrimary;

    return LayoutBuilder(
      builder: (context, constraints) {
        final buttonScale = (constraints.maxWidth / 220).clamp(0.72, 1.0);
        final mergedScale = buttonScale * scale;
        return GestureDetector(
          onTap: isDisabled ? null : onPressed,
          child: Container(
            padding: EdgeInsets.symmetric(
              vertical: (screenH * 0.012 * mergedScale).clamp(4.0, 14.0),
              horizontal: (14 * mergedScale).clamp(6.0, 14.0),
            ),
            decoration: BoxDecoration(
              color: isDisabled
                  ? Colors.grey.shade300
                  : themeService.primarySurfaceColor,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: isDisabled ? Colors.grey : borderColor,
                width: 3,
              ),
            ),
            child: Center(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.pressStart2p(
                    fontSize: (screenH * 0.010 * mergedScale).clamp(6.0, 12.0),
                    fontWeight: FontWeight.bold,
                    color: isDisabled ? Colors.grey : textColor,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CosmeticsPanel extends StatelessWidget {
  final AccountType user;
  final String activeTab;
  final ValueChanged<String> onTabChanged;
  final double screenH;
  final double screenW;
  final bool expandContent;

  const _CosmeticsPanel({
    required this.user,
    required this.activeTab,
    required this.onTabChanged,
    required this.screenH,
    required this.screenW,
    required this.expandContent,
  });

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final blue = themeService.primaryColor;
    final tabFont = GoogleFonts.pressStart2p(
      fontSize: (screenH * 0.009).clamp(6.0, 9.0),
    );
    final tabs = ['avatars', 'backgrounds', 'musics'];
    final labels = [
      I18n().translate('profile_page.cosmetics_tab_avatars'),
      I18n().translate('profile_page.cosmetics_tab_backgrounds'),
      I18n().translate('profile_page.cosmetics_tab_musics'),
    ];

    final tabContent = Padding(
      padding: EdgeInsets.only(top: screenH * 0.015),
      child: _OwnedUnlocksGrid(
        user: user,
        activeTab: activeTab,
        screenH: screenH,
        expandInParent: expandContent,
        portraitMaxHeight: screenH * 0.32,
      ),
    );
    return Container(
      padding: EdgeInsets.all(screenW * 0.015),
      decoration: BoxDecoration(
        color: themeService.primarySurfaceColor.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: blue, width: 4),
        boxShadow: [
          BoxShadow(color: themeService.primaryColor, spreadRadius: 2),
          BoxShadow(color: themeService.secondaryColor, spreadRadius: 4),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: List.generate(tabs.length, (i) {
              final isActive = activeTab == tabs[i];
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i < tabs.length - 1 ? 6 : 0),
                  child: GestureDetector(
                    onTap: () => onTabChanged(tabs[i]),
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: screenH * 0.012),
                      decoration: BoxDecoration(
                        color: isActive ? blue : themeService.panelInsetColor,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: blue, width: 3),
                      ),
                      child: Text(
                        labels[i],
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: tabFont.copyWith(
                          color: isActive
                              ? themeService.primaryHoverTextColor
                              : blue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
          if (expandContent) Expanded(child: tabContent) else tabContent,
        ],
      ),
    );
  }
}

/// Dashed outline (equivalent of the Angular profile `border: dashed`).
class _DashedRRectOutlinePainter extends CustomPainter {
  _DashedRRectOutlinePainter({required this.color, this.radius = 6});

  final Color color;
  final double radius;

  static const double _strokeWidth = 2;
  static const double _dash = 5;
  static const double _gap = 3;

  @override
  void paint(Canvas canvas, Size size) {
    final inset = _strokeWidth / 2;
    final rect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        inset,
        inset,
        size.width - _strokeWidth,
        size.height - _strokeWidth,
      ),
      Radius.circular(radius),
    );
    final path = Path()..addRRect(rect);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = _strokeWidth;
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + _dash).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance = end + _gap;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRectOutlinePainter oldDelegate) =>
      color != oldDelegate.color || radius != oldDelegate.radius;
}

/// Card aligned with the Angular profile `.cosmetic-item-mini` / `.cosmetic-thumb`.
class _CosmeticMiniCard extends StatelessWidget {
  const _CosmeticMiniCard({
    required this.selected,
    required this.label,
    required this.onTap,
    required this.screenH,
    required this.thumbChild,
    this.musicOffThumb = false,
    this.layoutScale = 1,
  });

  final bool selected;
  final String label;
  final VoidCallback? onTap;
  final double screenH;
  final Widget thumbChild;
  final bool musicOffThumb;

  /// Shrinks padding / text / borders (e.g. music tab, narrow tiles).
  final double layoutScale;

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final primary = themeService.primaryColor;
    final secondary = themeService.secondaryColor;
    final tertiary = themeService.tertiaryColor;

    final shadows = selected
        ? <BoxShadow>[
            BoxShadow(color: secondary, spreadRadius: 2),
            BoxShadow(color: tertiary, spreadRadius: 4),
            BoxShadow(
              color: themeService.secondaryDisabledColor.withValues(
                alpha: 0.55,
              ),
              blurRadius: 12,
              spreadRadius: 0,
            ),
          ]
        : <BoxShadow>[
            BoxShadow(color: primary, spreadRadius: 2),
            BoxShadow(color: secondary, spreadRadius: 4),
          ];

    final scale = layoutScale.clamp(0.65, 1.0);
    final pad = 10 * scale;
    final borderW = (2 * scale).clamp(1.0, 2.0);
    final rThumb = 6 * scale;
    final rOuter = 8 * scale;
    final thumbRadius = BorderRadius.circular(rThumb);
    final thumb = AspectRatio(
      aspectRatio: 1,
      child: musicOffThumb
          ? ClipRRect(borderRadius: thumbRadius, child: thumbChild)
          : DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(rOuter),
                border: Border.all(color: primary, width: borderW),
              ),
              child: ClipRRect(borderRadius: thumbRadius, child: thumbChild),
            ),
    );

    final baseFont = (screenH * 0.0085).clamp(6.0, 9.0) * scale;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(pad),
        decoration: BoxDecoration(
          color: themeService.panelInsetOnPrimaryOpaque,
          borderRadius: BorderRadius.circular(12 * scale),
          boxShadow: shadows,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            thumb,
            SizedBox(height: screenH * 0.008 * scale),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.topCenter,
              child: Text(
                label,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.pressStart2p(
                  fontSize: baseFont.clamp(5.0, 9.0),
                  color: themeService.onPrimarySurfaceColor,
                  height: 1.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Preview grid (avatars / backgrounds / music) like on the web profile.
class _OwnedUnlocksGrid extends StatelessWidget {
  final AccountType user;
  final String activeTab;
  final double screenH;
  final bool expandInParent;
  final double portraitMaxHeight;

  const _OwnedUnlocksGrid({
    required this.user,
    required this.activeTab,
    required this.screenH,
    required this.expandInParent,
    required this.portraitMaxHeight,
  });

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final cosmetics = context.watch<CosmeticsService>();

    final List<dynamic> items;
    final String Function(dynamic) getPreview;
    final void Function(dynamic)? onTap;
    String? selectedId;
    String Function(dynamic)? getId;

    final includeMusicOffSlot = activeTab == 'musics';

    switch (activeTab) {
      case 'avatars':
        items = cosmetics.getOwnedAvatars(user.ownedAvatars);
        getPreview = (item) {
          final a = item as FeaturedAvatar;
          return a.animation ?? a.icon;
        };
        onTap = null;
        break;
      case 'backgrounds':
        items = cosmetics.getOwnedBackgrounds(user.ownedBackgrounds);
        getPreview = (item) =>
            (item as CosmeticBackground).assetForTheme(themeService.isBlue);
        selectedId = user.selectedBackground;
        getId = (item) => (item as CosmeticBackground).id;
        onTap = (item) async {
          final bg = item as CosmeticBackground;
          await context.read<AuthService>().updateSelectedBackground(bg.id);
        };
        break;
      case 'musics':
        items = cosmetics.getOwnedMusics(user.ownedMusics);
        getPreview = (item) => (item as CosmeticMusic).cover;
        selectedId = user.selectedMusic;
        getId = (item) => (item as CosmeticMusic).id;
        onTap = (item) async {
          final m = item as CosmeticMusic;
          await context.read<MusicService>().changeMusic(m.id);
        };
        break;
      default:
        items = [];
        getPreview = (_) => '';
        onTap = null;
    }

    if (items.isEmpty && !includeMusicOffSlot) {
      return Padding(
        padding: EdgeInsets.symmetric(vertical: screenH * 0.02),
        child: Center(
          child: Text(
            I18n().translate('profile_page.cosmetics_empty'),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ),
      );
    }

    final musicOffLead = includeMusicOffSlot ? 1 : 0;
    final itemCount = items.length + musicOffLead;

    String unlockCellLabel(int index) {
      if (includeMusicOffSlot && index == 0) {
        return I18n().translate('profile_page.music_off');
      }
      final item = items[index - musicOffLead];
      if (item is FeaturedAvatar) return I18n().cosmeticLabel(item.name);
      if (item is CosmeticBackground) return I18n().cosmeticLabel(item.name);
      if (item is CosmeticMusic) return I18n().cosmeticLabel(item.name);
      return '';
    }

    Widget unlockTile(int index, double layoutScale) {
      if (includeMusicOffSlot && index == 0) {
        final isOffSelected = user.selectedMusic == musicOffId;
        final iconSize = (28 * layoutScale).clamp(18.0, 28.0);
        final dashR = (6 * layoutScale).clamp(4.0, 6.0);
        return _CosmeticMiniCard(
          selected: isOffSelected,
          label: unlockCellLabel(index),
          onTap: () => context.read<MusicService>().changeMusic(musicOffId),
          screenH: screenH,
          musicOffThumb: true,
          layoutScale: layoutScale,
          thumbChild: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: themeService.panelInsetOnPrimaryOpaque),
              Center(
                child: Icon(
                  Icons.music_off,
                  size: iconSize,
                  color: const Color(0xFF999999),
                ),
              ),
              CustomPaint(
                painter: _DashedRRectOutlinePainter(
                  color: themeService.textMutedColor,
                  radius: dashR,
                ),
                child: const SizedBox.expand(),
              ),
            ],
          ),
        );
      }

      final item = items[index - musicOffLead];
      final preview = getPreview(item);
      final idGetter = getId;
      final isSelected =
          selectedId != null &&
          idGetter != null &&
          idGetter(item) == selectedId;
      final tapHandler = onTap;

      return _CosmeticMiniCard(
        selected: isSelected,
        label: unlockCellLabel(index),
        onTap: tapHandler != null ? () => tapHandler(item) : null,
        screenH: screenH,
        layoutScale: layoutScale,
        thumbChild: SizedBox.expand(
          child: Image.asset(
            preview,
            fit: BoxFit.cover,
            alignment: Alignment.center,
            filterQuality: FilterQuality.none,
          ),
        ),
      );
    }

    Widget unlockWrapForWidth(double maxWidth) {
      final side = _unlockTileSide(maxWidth);
      final musicScale = activeTab == 'musics'
          ? (side / 76).clamp(0.72, 1.0)
          : 1.0;
      return SingleChildScrollView(
        physics: const ClampingScrollPhysics(),
        child: Wrap(
          spacing: _kUnlockGridSpacing,
          runSpacing: _kUnlockGridSpacing + 2,
          alignment: WrapAlignment.start,
          children: List.generate(
            itemCount,
            (i) => SizedBox(width: side, child: unlockTile(i, musicScale)),
          ),
        ),
      );
    }

    if (expandInParent) {
      return LayoutBuilder(
        builder: (context, constraints) =>
            unlockWrapForWidth(constraints.maxWidth),
      );
    }

    return SizedBox(
      height: portraitMaxHeight.clamp(140.0, 360.0),
      child: LayoutBuilder(
        builder: (context, constraints) =>
            unlockWrapForWidth(constraints.maxWidth),
      ),
    );
  }
}

class _StatsCard extends StatelessWidget {
  final dynamic user;
  final double screenH;

  const _StatsCard({required this.user, required this.screenH});

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    final primary = themeService.primaryColor;
    final rows = [
      (
        I18n().translate('profile_page.stats_games_classic'),
        '${user.gamesPlayedClassic ?? 0}',
      ),
      (
        I18n().translate('profile_page.stats_games_ctf'),
        '${user.gamesPlayedCTF ?? 0}',
      ),
      (
        I18n().translate('profile_page.stats_games_won'),
        '${user.gamesWon ?? 0}',
      ),
      (
        I18n().translate('profile_page.stats_avg_time'),
        () {
          final totalGames =
              (user.gamesPlayedClassic ?? 0) + (user.gamesPlayedCTF ?? 0);
          if (totalGames == 0 || (user.totalGameTime ?? 0) == 0)
            return '0m 00s';
          final avgMs = (user.totalGameTime ?? 0) / totalGames;
          final totalSeconds = (avgMs / 1000).floor();
          final minutes = totalSeconds ~/ 60;
          final seconds = totalSeconds % 60;
          return '${minutes}m ${seconds.toString().padLeft(2, '0')}s';
        }(),
      ),
    ];

    return Container(
      padding: EdgeInsets.all(screenH * 0.02),
      decoration: BoxDecoration(
        color: themeService.primarySurfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: primary, width: 4),
        boxShadow: [
          BoxShadow(color: themeService.primaryColor, spreadRadius: 2),
          BoxShadow(color: themeService.secondaryColor, spreadRadius: 4),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          Text(
            I18n().translate('profile_page.statistiques'),
            style: GoogleFonts.pressStart2p(
              fontSize: (screenH * 0.014).clamp(9.0, 14.0),
              color: themeService.onPrimarySurfaceColor,
              fontWeight: FontWeight.bold,
            ),
          ),
          ...rows.map(
            (r) => Container(
              padding: EdgeInsets.symmetric(
                horizontal: screenH * 0.015,
                vertical: screenH * 0.012,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      r.$1,
                      style: GoogleFonts.pressStart2p(
                        fontSize: (screenH * 0.009).clamp(6.0, 10.0),
                        color: themeService.onPrimarySurfaceColor.withValues(
                          alpha: 0.7,
                        ),
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    r.$2,
                    style: GoogleFonts.pressStart2p(
                      fontSize: (screenH * 0.012).clamp(8.0, 14.0),
                      color: themeService.secondaryColor,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pixel button (filled or outlined) for the username / email fields.
class _ProfileFieldPixelButton extends StatelessWidget {
  const _ProfileFieldPixelButton({
    required this.label,
    required this.primary,
    required this.filled,
    required this.screenH,
    required this.scale,
    required this.onPressed,
  });

  final String label;
  final Color primary;
  final bool filled;
  final double screenH;
  final double scale;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final themeService = context.watch<ThemeService>();
    return Material(
      color: filled ? primary : themeService.primarySurfaceColor,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onPressed,
        child: Container(
          constraints: const BoxConstraints(minHeight: 28),
          padding: EdgeInsets.symmetric(
            horizontal: (6 * scale).clamp(4.0, 12.0),
            vertical: (6 * scale).clamp(4.0, 10.0),
          ),
          decoration: BoxDecoration(
            color: filled ? primary : themeService.primarySurfaceColor,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: primary, width: 3),
          ),
          alignment: Alignment.center,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: (screenH * 0.010 * scale).clamp(6.0, 10.0),
                color: filled ? themeService.primaryHoverTextColor : primary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
