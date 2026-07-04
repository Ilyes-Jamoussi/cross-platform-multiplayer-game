import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/pages/home_page.dart';
import 'package:mobile_client/services/language_service.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/theme_service.dart';

const Color _kLoginBodyFallback = Color(0xFF000116);
const Color _kLoginError = Color(0xFFFF4444);
const Color _kFooterOrange = Color(0xFFFFA500);

const double _kFooterClearanceLogin = 112;
const double _kFooterClearanceRegister = 120;

/// Login + account creation on a **single** page (like `isRegistering` on the Angular side).
/// [initialRegistering] : route `/register` ou lien direct.
class LoginPage extends StatefulWidget {
  const LoginPage({
    super.key,
    this.initialRegistering = false,
  });

  final bool initialRegistering;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> with WidgetsBindingObserver {
  late bool _isRegistering;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameController = TextEditingController();

  final _scrollController = ScrollController();
  final _formCardKey = GlobalKey();

  late final FocusNode _emailFocus;
  late final FocusNode _passwordFocus;
  late final FocusNode _usernameFocus;

  int _selectedAvatar = 1;
  /// Last photo taken (always visible in the last slot, like the web).
  Uint8List? _lastPhotoBytes;
  /// If true, registration sends the photo; otherwise a predefined avatar [1–9].
  bool _usePhotoAsAvatar = false;
  String _localRegisterError = '';
  String _localLoginError = '';

  final ImagePicker _picker = ImagePicker();

  void _scrollFormCardIntoView() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = _formCardKey.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
        alignment: 1,
      );
    });
  }

  void _onTextFieldFocusChanged() {
    if (!_emailFocus.hasFocus &&
        !_passwordFocus.hasFocus &&
        !_usernameFocus.hasFocus) {
      return;
    }
    _scrollFormCardIntoView();
    Future<void>.delayed(const Duration(milliseconds: 320), () {
      if (mounted) _scrollFormCardIntoView();
    });
  }

  @override
  void initState() {
    super.initState();
    _isRegistering = widget.initialRegistering;
    WidgetsBinding.instance.addObserver(this);
    _emailFocus = FocusNode();
    _passwordFocus = FocusNode();
    _usernameFocus = FocusNode();
    _emailFocus.addListener(_onTextFieldFocusChanged);
    _passwordFocus.addListener(_onTextFieldFocusChanged);
    _usernameFocus.addListener(_onTextFieldFocusChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final auth = context.read<AuthService>();
      final themeService = context.read<ThemeService>();
      if (auth.currentUser == null && themeService.theme != AppThemeMode.blue) {
        themeService.setTheme(AppThemeMode.blue);
      }
    });
  }

  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    if (!mounted) return;
    _scrollFormCardIntoView();
    Future<void>.delayed(const Duration(milliseconds: 100), () {
      if (mounted) _scrollFormCardIntoView();
    });
  }

  void _openRegister() {
    FocusScope.of(context).unfocus();
    context.read<AuthService>().clearError();
    setState(() {
      _isRegistering = true;
      _localRegisterError = '';
      _localLoginError = '';
    });
  }

  void _switchToLogin() {
    FocusScope.of(context).unfocus();
    context.read<AuthService>().clearError();
    setState(() {
      _isRegistering = false;
      _localRegisterError = '';
      _localLoginError = '';
    });
  }

  Future<void> _handleLogin() async {
    final authService = context.read<AuthService>();
    authService.clearError();
    setState(() {
      _localLoginError = '';
    });

    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _localLoginError = 'server_msg.invalid_email_firebase';
      });
      return;
    }

    await authService.login(email, password);

    if (!mounted) return;

    if (authService.currentUser != null && authService.errorMessage == null) {
      final themeService = context.read<ThemeService>();
      final userTheme = authService.currentUser?.theme ?? 'blue-theme';
      final nextTheme = userTheme == 'red-theme'
          ? AppThemeMode.red
          : AppThemeMode.blue;
      await themeService.setTheme(nextTheme);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute<void>(builder: (_) => const HomePage()),
      );
    }
  }

  static String _normalizeUsername(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return trimmed;
    return trimmed.replaceAll(RegExp(r'\s+'), ' ');
  }

  /// Rare case (paste): the web truncates to 10 characters on input.
  String? _validateUsernameKey(String raw) {
    final normalized = _normalizeUsername(raw);
    if (normalized.length > 10) {
      return 'login_page.erreur_pseudo_long';
    }
    return null;
  }

  void _applyUsernameRules(String value) {
    var v = value;
    if (v.startsWith(' ')) v = v.trimLeft();
    v = v.replaceAll(RegExp(r'\s{2,}'), ' ').replaceAll('.', '');
    if (v.length > 10) v = v.substring(0, 10);
    if (v != _usernameController.text) {
      _usernameController.value = TextEditingValue(
        text: v,
        selection: TextSelection.collapsed(offset: v.length),
      );
    }
  }

  Future<void> _handleRegister() async {
    final authService = context.read<AuthService>();
    authService.clearError();

    setState(() {
      _localRegisterError = '';
    });

    final rawUsername = _usernameController.text;

    if (_emailController.text.trim().isEmpty ||
        _passwordController.text.isEmpty ||
        rawUsername.trim().isEmpty) {
      setState(() {
        _localRegisterError = 'server_msg.invalid_email_firebase';
      });
      return;
    }

    final usernameErrorKey = _validateUsernameKey(rawUsername);
    if (usernameErrorKey != null) {
      setState(() {
        _localRegisterError = usernameErrorKey;
      });
      return;
    }

    final normalizedUsername = _normalizeUsername(rawUsername);

    final String avatarValue;
    if (_usePhotoAsAvatar && _lastPhotoBytes != null) {
      avatarValue =
          'data:image/png;base64,${base64Encode(_lastPhotoBytes!)}';
    } else {
      avatarValue = 'avatar-$_selectedAvatar';
    }

    await authService.register(
      username: normalizedUsername,
      email: _emailController.text.trim(),
      password: _passwordController.text,
      avatar: avatarValue,
    );

    if (!mounted) return;

    if (authService.currentUser != null && authService.errorMessage == null) {
      final themeService = context.read<ThemeService>();
      final userTheme = authService.currentUser?.theme ?? 'blue-theme';
      final nextTheme = userTheme == 'red-theme'
          ? AppThemeMode.red
          : AppThemeMode.blue;
      await themeService.setTheme(nextTheme);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute<void>(builder: (_) => const HomePage()),
      );
    }
  }

  Future<void> _takePhoto() async {
    final picked = await _picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 80,
    );
    if (picked != null) {
      late final Uint8List bytes;
      if (kIsWeb) {
        bytes = await picked.readAsBytes();
      } else {
        bytes = await File(picked.path).readAsBytes();
      }
      const maxBytes = 1024 * 1024;
      if (bytes.length > maxBytes) {
        if (!mounted) return;
        context.read<AuthService>().clearError();
        setState(() {
          _localRegisterError = 'login_page.image_too_large';
        });
        return;
      }
      if (!mounted) return;
      setState(() {
        _localRegisterError = '';
        _lastPhotoBytes = bytes;
        _usePhotoAsAvatar = true;
      });
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emailFocus.removeListener(_onTextFieldFocusChanged);
    _passwordFocus.removeListener(_onTextFieldFocusChanged);
    _usernameFocus.removeListener(_onTextFieldFocusChanged);
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _usernameFocus.dispose();
    _scrollController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _usernameController.dispose();
    super.dispose();
  }

  InputDecoration _fieldDecoration(String hint, ThemeService theme) {
    final primary = theme.primaryColor;
    final surface = theme.primarySurfaceColor;
    final hintColor = theme.isBlue ? Colors.black45 : Colors.white38;
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.pressStart2p(
        fontSize: 10,
        height: 1.35,
        color: hintColor,
      ),
      isDense: true,
      filled: true,
      fillColor: surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 18,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(5),
        borderSide: BorderSide(color: primary, width: 3),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(5),
        borderSide: BorderSide(color: primary, width: 3),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(5),
        borderSide: const BorderSide(color: _kFooterOrange, width: 4),
      ),
      disabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(5),
        borderSide: BorderSide(color: primary.withValues(alpha: 0.4)),
      ),
    );
  }

  /// Keys `auth_errors.*`, `login_page.*`, `server_msg.*` or raw text (API).
  String _resolveAuthError(I18n i18n, String? raw) {
    if (raw == null || raw.isEmpty) return '';
    var key = raw.contains('|') ? raw.split('|').first : raw;
    if (key.startsWith('auth_errors.') ||
        key.startsWith('login_page.') ||
        key.startsWith('server_msg.')) {
      return i18n.translate(key);
    }
    final t = i18n.translate(key);
    if (t != key) return t;
    return key;
  }

  Widget _errorBoxBelowFields(I18n i18n, String rawMessage) {
    final text = _resolveAuthError(i18n, rawMessage);
    if (text.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kLoginError.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: _kLoginError, width: 2),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: GoogleFonts.pressStart2p(
          fontSize: 9,
          height: 1.4,
          color: _kLoginError,
        ),
      ),
    );
  }

  Widget _registerInputsColumn({
    required I18n i18n,
    required String lang,
    required bool isLoading,
    required TextStyle fieldStyle,
    required String? serverError,
    required ThemeService theme,
  }) {
    final rawError = _localRegisterError.isNotEmpty
        ? _localRegisterError
        : (serverError ?? '');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: ValueKey<String>('auth_email_$lang'),
          controller: _emailController,
          focusNode: _emailFocus,
          keyboardType: TextInputType.emailAddress,
          enabled: !isLoading,
          style: fieldStyle,
          decoration: _fieldDecoration(i18n.translate('login_page.email'), theme),
        ),
        const SizedBox(height: 10),
        TextField(
          key: ValueKey<String>('auth_user_$lang'),
          controller: _usernameController,
          focusNode: _usernameFocus,
          enabled: !isLoading,
          style: fieldStyle,
          maxLength: 10,
          buildCounter: (
            context, {
            required currentLength,
            required isFocused,
            maxLength,
          }) =>
              const SizedBox.shrink(),
          inputFormatters: [
            FilteringTextInputFormatter.deny(RegExp(r'\.')),
          ],
          onChanged: _applyUsernameRules,
          decoration: _fieldDecoration(
            i18n.translate('login_page.pseudonyme'), theme,
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          key: ValueKey<String>('auth_pass_reg_$lang'),
          controller: _passwordController,
          focusNode: _passwordFocus,
          obscureText: true,
          enabled: !isLoading,
          style: fieldStyle,
          decoration: _fieldDecoration(
            i18n.translate('login_page.mot_de_passe'), theme,
          ),
        ),
        if (rawError.isNotEmpty) _errorBoxBelowFields(i18n, rawError),
      ],
    );
  }

  Widget _avatarSection({
    required I18n i18n,
    required double gridWidth,
    required bool isLoading,
    required ThemeService theme,
  }) {
    const gap = 8.0;
    const cols = 5;
    final cell = ((gridWidth - gap * (cols - 1)) / cols).clamp(40.0, 62.0);
    final primary = theme.primaryColor;
    final fg = theme.onPrimarySurfaceColor;
    final bg = theme.primarySurfaceColor;

    Widget presetTile(int index) {
      final selected = !_usePhotoAsAvatar && _selectedAvatar == index;
      return GestureDetector(
        onTap: isLoading
            ? null
            : () => setState(() {
                  _selectedAvatar = index;
                  _usePhotoAsAvatar = false;
                }),
        child: Container(
          width: cell,
          height: cell,
          decoration: BoxDecoration(
            border: Border.all(
              color: selected ? primary : Colors.transparent,
              width: 3,
            ),
          ),
          clipBehavior: Clip.hardEdge,
          child: Image.asset(
            'assets/avatar-$index.png',
            fit: BoxFit.cover,
            errorBuilder: (context, error, stackTrace) => ColoredBox(
              color: Colors.grey.shade300,
              child: Icon(
                Icons.person,
                size: cell * 0.5,
                color: primary,
              ),
            ),
          ),
        ),
      );
    }

    Widget photoSlot() {
      if (_lastPhotoBytes != null) {
        return GestureDetector(
          onTap: isLoading
              ? null
              : () => setState(() {
                    _usePhotoAsAvatar = true;
                  }),
          child: CustomPaint(
            foregroundPainter: !_usePhotoAsAvatar
                ? _DashedBorderPainter(color: primary)
                : null,
            child: Container(
              width: cell,
              height: cell,
              decoration: _usePhotoAsAvatar
                  ? BoxDecoration(
                      border: Border.all(color: primary, width: 3),
                    )
                  : const BoxDecoration(),
              clipBehavior: Clip.hardEdge,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Image.memory(_lastPhotoBytes!, fit: BoxFit.cover),
                  Positioned(
                    bottom: 2,
                    right: 2,
                    child: Icon(
                      Icons.photo_camera,
                      size: cell * 0.28,
                      color: Colors.white,
                      shadows: const [
                        Shadow(blurRadius: 4, color: Colors.black54),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }
      return CustomPaint(
        foregroundPainter: _DashedBorderPainter(color: primary),
        child: GestureDetector(
          onTap: isLoading ? null : _takePhoto,
          child: Container(
            width: cell,
            height: cell,
            color: primary.withValues(alpha: 0.05),
            alignment: Alignment.center,
            child: Text(
              '+',
              style: TextStyle(
                fontSize: cell * 0.45,
                color: primary,
                height: 1,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          i18n.translate('login_page.choisir_avatar'),
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            fontSize: 10,
            height: 1.4,
            color: fg,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: gridWidth,
          child: Wrap(
            spacing: gap,
            runSpacing: gap,
            alignment: WrapAlignment.center,
            children: [
              for (var i = 1; i <= 9; i++) presetTile(i),
              photoSlot(),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: isLoading ? null : _takePhoto,
            style: OutlinedButton.styleFrom(
              foregroundColor: fg,
              backgroundColor: bg,
              side: BorderSide(color: primary, width: 4),
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(999),
              ),
            ),
            child: Text(
              i18n.translate('login_page.prendre_photo'),
              textAlign: TextAlign.center,
              style: GoogleFonts.pressStart2p(
                fontSize: 8,
                height: 1.35,
                color: fg,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRegisterCard({
    required I18n i18n,
    required String lang,
    required bool isLoading,
    required TextStyle fieldStyle,
    required String? serverError,
    required ThemeService theme,
  }) {
    final wide = MediaQuery.sizeOf(context).width >= 640;
    final primary = theme.primaryColor;
    final fg = theme.onPrimarySurfaceColor;
    final bg = theme.primarySurfaceColor;

    return LayoutBuilder(
      builder: (context, c) {
        final innerW = c.maxWidth;
        if (wide) {
          final half = (innerW - 20) / 2;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: half,
                    child: _registerInputsColumn(
                      i18n: i18n,
                      lang: lang,
                      isLoading: isLoading,
                      fieldStyle: fieldStyle,
                      serverError: serverError,
                      theme: theme,
                    ),
                  ),
                  const SizedBox(width: 20),
                  SizedBox(
                    width: half,
                    child: _avatarSection(
                      i18n: i18n,
                      gridWidth: half.clamp(200.0, 320.0),
                      isLoading: isLoading,
                      theme: theme,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              OutlinedButton(
                key: ValueKey<String>('auth_reg_submit_$lang'),
                onPressed: isLoading ? null : _handleRegister,
                style: OutlinedButton.styleFrom(
                  foregroundColor: fg,
                  backgroundColor: bg,
                  side: BorderSide(color: primary, width: 4),
                  padding: const EdgeInsets.symmetric(
                    vertical: 18,
                    horizontal: 16,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                child: Text(
                  isLoading
                      ? i18n.translate('login_page.loading')
                      : i18n.translate('login_page.creer_compte'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.pressStart2p(
                    fontSize: isLoading ? 9 : 10,
                    height: 1.35,
                    color: fg,
                  ),
                ),
              ),
              const SizedBox(height: 14),
              Center(
                child: GestureDetector(
                  onTap: _switchToLogin,
                  child: Text(
                    i18n.translate('login_page.deja_compte'),
                    textAlign: TextAlign.center,
                    style: GoogleFonts.pressStart2p(
                      fontSize: 8,
                      height: 1.45,
                      color: fg,
                      decoration: TextDecoration.underline,
                      decorationColor: fg,
                    ),
                  ),
                ),
              ),
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _registerInputsColumn(
              i18n: i18n,
              lang: lang,
              isLoading: isLoading,
              fieldStyle: fieldStyle,
              serverError: serverError,
              theme: theme,
            ),
            const SizedBox(height: 22),
            _avatarSection(
              i18n: i18n,
              gridWidth: innerW,
              isLoading: isLoading,
              theme: theme,
            ),
            const SizedBox(height: 22),
            OutlinedButton(
              key: ValueKey<String>('auth_reg_submit_narrow_$lang'),
              onPressed: isLoading ? null : _handleRegister,
              style: OutlinedButton.styleFrom(
                foregroundColor: fg,
                backgroundColor: bg,
                side: BorderSide(color: primary, width: 4),
                padding: const EdgeInsets.symmetric(
                  vertical: 18,
                  horizontal: 16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              child: Text(
                isLoading
                    ? i18n.translate('login_page.loading')
                    : i18n.translate('login_page.creer_compte'),
                textAlign: TextAlign.center,
                style: GoogleFonts.pressStart2p(
                  fontSize: isLoading ? 9 : 10,
                  height: 1.35,
                  color: fg,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Center(
              child: GestureDetector(
                onTap: _switchToLogin,
                child: Text(
                  i18n.translate('login_page.deja_compte'),
                  textAlign: TextAlign.center,
                  style: GoogleFonts.pressStart2p(
                    fontSize: 8,
                    height: 1.45,
                    color: fg,
                    decoration: TextDecoration.underline,
                    decorationColor: fg,
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildLoginCard({
    required I18n i18n,
    required String lang,
    required bool isLoading,
    required TextStyle fieldStyle,
    required String rawError,
    required ThemeService theme,
  }) {
    final primary = theme.primaryColor;
    final fg = theme.onPrimarySurfaceColor;
    final bg = theme.primarySurfaceColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: ValueKey<String>('auth_email_login_$lang'),
          controller: _emailController,
          focusNode: _emailFocus,
          keyboardType: TextInputType.emailAddress,
          enabled: !isLoading,
          style: fieldStyle,
          decoration: _fieldDecoration(i18n.translate('login_page.email'), theme),
        ),
        const SizedBox(height: 12),
        TextField(
          key: ValueKey<String>('auth_pass_login_$lang'),
          controller: _passwordController,
          focusNode: _passwordFocus,
          obscureText: true,
          enabled: !isLoading,
          style: fieldStyle,
          onSubmitted: (_) => _handleLogin(),
          decoration: _fieldDecoration(
            i18n.translate('login_page.mot_de_passe'), theme,
          ),
        ),
        if (rawError.isNotEmpty) _errorBoxBelowFields(i18n, rawError),
        const SizedBox(height: 22),
        OutlinedButton(
          key: ValueKey<String>('auth_login_btn_$lang'),
          onPressed: isLoading ? null : _handleLogin,
          style: OutlinedButton.styleFrom(
            foregroundColor: fg,
            backgroundColor: bg,
            side: BorderSide(color: primary, width: 4),
            padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          child: Text(
            isLoading
                ? i18n.translate('login_page.loading')
                : i18n.translate('login_page.se_connecter'),
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: isLoading ? 9 : 10,
              height: 1.35,
              color: fg,
            ),
          ),
        ),
        const SizedBox(height: 16),
        GestureDetector(
          onTap: _openRegister,
          child: Text(
            i18n.translate('login_page.nouveau'),
            textAlign: TextAlign.center,
            style: GoogleFonts.pressStart2p(
              fontSize: 9,
              height: 1.45,
              color: fg,
              decoration: TextDecoration.underline,
              decorationColor: fg,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthService>();
    final lang = context.watch<LanguageService>().lang;
    final theme = context.watch<ThemeService>();
    final isLoading = authState.isLoading;
    final i18n = I18n();
    final mq = MediaQuery.sizeOf(context);
    final viewInsetsBottom = MediaQuery.viewInsetsOf(context).bottom;
    final paddingBottom = MediaQuery.paddingOf(context).bottom;
    final keyboardOpen = viewInsetsBottom > 0;
    final scrollBottomPad = keyboardOpen
        ? 20.0
        : (_isRegistering ? _kFooterClearanceRegister : _kFooterClearanceLogin);
    final cardMaxW =
        (mq.width - 40).clamp(280.0, _isRegistering ? 720.0 : 520.0);
    final logoWidth =
        (mq.shortestSide * (_isRegistering ? 0.26 : 0.30)).clamp(140.0, 280.0);

    final fieldTextStyle = GoogleFonts.pressStart2p(
      fontSize: 11,
      height: 1.35,
      color: theme.onPrimarySurfaceColor,
    );

    final loginRawError = _localLoginError.isNotEmpty
        ? _localLoginError
        : (authState.errorMessage ?? '');

    final footer = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${i18n.translate('home_page.equipe')} 206',
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            fontSize: 9,
            height: 1.5,
            color: _kFooterOrange,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Brière Simon, Faraoni William, '
          'Chauret-Decoste Scotty, Jaures Kanga, '
          'Rafai Adam, Jamoussi Ilyes',
          textAlign: TextAlign.center,
          style: GoogleFonts.pressStart2p(
            fontSize: 7,
            height: 1.5,
            color: _kFooterOrange,
          ),
        ),
      ],
    );

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: Image.asset(
              theme.bgImageAsset,
              fit: BoxFit.cover,
              alignment: Alignment.center,
              errorBuilder: (context, error, stackTrace) => const ColoredBox(
                color: _kLoginBodyFallback,
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: EdgeInsets.only(bottom: viewInsetsBottom),
              child: SafeArea(
                bottom: false,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(4, 4, 12, 0),
                      child: Row(
                        children: [
                          if (_isRegistering)
                            IconButton(
                              icon: const Icon(Icons.arrow_back),
                              color: Colors.white,
                              iconSize: 26,
                              style: IconButton.styleFrom(
                                backgroundColor:
                                    Colors.black.withValues(alpha: 0.45),
                              ),
                              onPressed: _switchToLogin,
                            ),
                          const Spacer(),
                          _LoginLangButton(
                            isFr: lang == 'fr',
                            onToggle: () async {
                              final next = lang == 'fr' ? 'en' : 'fr';
                              await context
                                  .read<LanguageService>()
                                  .setLang(next);
                            },
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          return SingleChildScrollView(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 12,
                            ),
                            keyboardDismissBehavior:
                                ScrollViewKeyboardDismissBehavior.onDrag,
                            child: ConstrainedBox(
                              constraints: BoxConstraints(
                                minHeight: constraints.maxHeight,
                              ),
                              child: Padding(
                                padding: EdgeInsets.only(bottom: scrollBottomPad),
                                child: Align(
                                  alignment: keyboardOpen
                                      ? Alignment.topCenter
                                      : Alignment.center,
                                  child: ConstrainedBox(
                                    constraints: BoxConstraints(
                                      maxWidth: cardMaxW,
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        Image.asset(
                                          'assets/logo.png',
                                          width: logoWidth,
                                          fit: BoxFit.contain,
                                        ),
                                        SizedBox(height: mq.height * 0.035),
                                        Container(
                                          key: _formCardKey,
                                          width: double.infinity,
                                          padding: EdgeInsets.all(
                                            _isRegistering ? 20 : 22,
                                          ),
                                          decoration: BoxDecoration(
                                            color: theme.primarySurfaceColor
                                                .withValues(alpha: 0.9),
                                            borderRadius:
                                                BorderRadius.circular(10),
                                            border: Border.all(
                                              color: theme.primaryColor,
                                              width: 4,
                                            ),
                                          ),
                                          child: _isRegistering
                                              ? _buildRegisterCard(
                                                  i18n: i18n,
                                                  lang: lang,
                                                  isLoading: isLoading,
                                                  fieldStyle: fieldTextStyle,
                                                  serverError:
                                                      authState.errorMessage,
                                                  theme: theme,
                                                )
                                              : _buildLoginCard(
                                                  i18n: i18n,
                                                  lang: lang,
                                                  isLoading: isLoading,
                                                  fieldStyle: fieldTextStyle,
                                                  rawError: loginRawError,
                                                  theme: theme,
                                                ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 14 + paddingBottom),
              child: footer,
            ),
          ),
        ],
      ),
    );
  }
}

class _LoginLangButton extends StatelessWidget {
  const _LoginLangButton({
    required this.isFr,
    required this.onToggle,
  });

  final bool isFr;
  final Future<void> Function() onToggle;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.black.withValues(alpha: 0.5),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => onToggle(),
        child: SizedBox(
          width: 46,
          height: 46,
          child: Center(
            child: Text(
              isFr ? 'FR' : 'EN',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color});

  final Color color;

  static void _strokeDashedLine(
    Canvas canvas,
    Offset a,
    Offset b,
    Paint paint,
  ) {
    final dir = b - a;
    final len = dir.distance;
    if (len <= 0) return;
    final u = dir / len;
    var t = 0.0;
    while (t < len) {
      final end = (t + 5).clamp(0.0, len);
      canvas.drawLine(a + u * t, a + u * end, paint);
      t += 5 + 4;
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke;
    const inset = 1.5;
    final rect = Rect.fromLTWH(
      inset,
      inset,
      size.width - 2 * inset,
      size.height - 2 * inset,
    );
    _strokeDashedLine(canvas, rect.topLeft, rect.topRight, paint);
    _strokeDashedLine(canvas, rect.topRight, rect.bottomRight, paint);
    _strokeDashedLine(canvas, rect.bottomRight, rect.bottomLeft, paint);
    _strokeDashedLine(canvas, rect.bottomLeft, rect.topLeft, paint);
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) =>
      oldDelegate.color != color;
}
