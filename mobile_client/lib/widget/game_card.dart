import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_client/app/i18n.dart';
import 'package:mobile_client/models/grid_type.dart';
import 'package:mobile_client/services/theme_service.dart';
import 'package:mobile_client/utils/game_creation_helpers.dart';
import 'package:mobile_client/widget/coin_icon.dart';
import 'package:mobile_client/theme/game_page_overlays.dart';
import 'package:provider/provider.dart';

/// Background under the card image (visually unchanged in the blue theme).
const Color _kCardFill = Color(0xFFd9e3f0);

class GameCard extends StatefulWidget {
  const GameCard({
    super.key,
    required this.game,
    required this.userCurrency,
    required this.onRefreshList,
    required this.validateGame,
    required this.activeOverlayGameId,
    required this.onOverlayGameIdChanged,
    this.onConfirmCreate,
  });

  final Grid game;
  final int userCurrency;
  final VoidCallback onRefreshList;
  final Future<bool> Function(String gameId) validateGame;
  final String? activeOverlayGameId;
  final ValueChanged<String?> onOverlayGameIdChanged;
  final Future<void> Function(String gameId, int entryFee)? onConfirmCreate;

  @override
  State<GameCard> createState() => _GameCardState();
}

class _GameCardState extends State<GameCard> {
  bool _checkingGame = false;
  final TextEditingController _feeController = TextEditingController(text: '0');

  @override
  void dispose() {
    _feeController.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant GameCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final id = widget.game.id;
    final wasOpen = oldWidget.activeOverlayGameId == id;
    final isOpen = widget.activeOverlayGameId == id;
    if (wasOpen && !isOpen) {
      _feeController.text = '0';
    }
    if (!wasOpen && isOpen) {
      _feeController.text = '0';
    }
  }

  int get _maxPlayers => maxPlayersForGridSize(widget.game.gridSize);

  bool get _isOverlayVisible => widget.activeOverlayGameId == widget.game.id;

  bool get _isEntryFeeValid {
    final fee = int.tryParse(_feeController.text.trim());
    if (fee == null) return false;
    return fee >= 0 && fee <= widget.userCurrency;
  }

  Future<void> _onCardTap() async {
    if (_checkingGame || _isOverlayVisible) return;
    setState(() => _checkingGame = true);
    final exists = await widget.validateGame(widget.game.id);
    if (!mounted) return;
    setState(() => _checkingGame = false);
    if (!exists) {
      widget.onRefreshList();
      showGamePageSnackBar(context, I18n().translate('game_creation.game_not_found'), kind: GamePageSnackKind.error);
      return;
    }
    _feeController.text = '0';
    widget.onOverlayGameIdChanged(widget.game.id);
  }

  Future<void> _confirmFee() async {
    if (!_isEntryFeeValid) return;
    final fee = int.parse(_feeController.text.trim());
    widget.onOverlayGameIdChanged(null);
    if (widget.onConfirmCreate != null) {
      await widget.onConfirmCreate!(widget.game.id, fee);
    } else {
      if (!mounted) return;
      showGamePageSnackBar(context, I18n().translate('game_creation.create_pending'), kind: GamePageSnackKind.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final themeSvc = context.watch<ThemeService>();
    final primary = themeSvc.primaryColor;
    final secondary = themeSvc.secondaryColor;
    final tertiary = themeSvc.tertiaryColor;
    final secondaryHover = themeSvc.secondaryHoverColor;
    final modeAsset = gameModeImageAsset(widget.game.gameMode);
    final vMin = MediaQuery.sizeOf(context).shortestSide / 100;

    return Tooltip(
      message: widget.game.description.isEmpty ? widget.game.name : widget.game.description,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _checkingGame ? null : _onCardTap,
              borderRadius: BorderRadius.circular(6),
              child: _TripleBorderCard(
                primary: primary,
                secondary: secondary,
                tertiary: tertiary,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Positioned.fill(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: DecoratedBox(
                          decoration: const BoxDecoration(color: _kCardFill),
                          child: Image.asset(
                            'assets/game_creation/creation_cards_back_ground.png',
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(8 * vMin / 2.5, 10, 8 * vMin / 2.5, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            height: 40,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Positioned(
                                  left: -4,
                                  top: 0,
                                  child: Image.asset(
                                    modeAsset,
                                    height: widget.game.gameMode == 'Classic' ? 40 : 36,
                                    width: widget.game.gameMode == 'Classic' ? 56 : 48,
                                    fit: BoxFit.contain,
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  top: 4,
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        '0/$_maxPlayers',
                                        style: GoogleFonts.pressStart2p(
                                          fontSize: (1.5 * vMin).clamp(7.0, 11.0),
                                          height: 1.1,
                                          color: Colors.black,
                                        ),
                                      ),
                                      SizedBox(width: 2 * vMin / 2.5),
                                      Image.asset(
                                        'assets/game_creation/players.png',
                                        height: (4 * vMin).clamp(22.0, 32.0),
                                        fit: BoxFit.contain,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(height: 2 * vMin / 2.5),
                          SizedBox(
                            height: (10 * vMin).clamp(48.0, 88.0),
                            child: Center(
                              child: Text(
                                widget.game.name,
                                maxLines: 4,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: GoogleFonts.pressStart2p(
                                  fontSize: (3 * vMin).clamp(9.0, 14.0),
                                  height: 1.2,
                                  color: Colors.black,
                                ),
                              ),
                            ),
                          ),
                          SizedBox(height: 2 * vMin / 2.5),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: _MapPreview(imagePayload: widget.game.imagePayload),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_checkingGame)
            Positioned.fill(
              child: Container(
                color: Colors.black26,
                child: const Center(
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
            ),
          if (_isOverlayVisible)
            _buildFeeOverlay(
              context,
              vMin,
              primary: primary,
              secondary: secondary,
              secondaryHover: secondaryHover,
            ),
        ],
      ),
    );
  }

  Widget _buildFeeOverlay(
    BuildContext context,
    double vMin, {
    required Color primary,
    required Color secondary,
    required Color secondaryHover,
  }) {
    final fee = int.tryParse(_feeController.text.trim());
    final insufficient = fee != null && fee > widget.userCurrency;
    final newBalance = widget.userCurrency - (fee ?? 0);
    final fs = (1.2 * vMin).clamp(8.0, 12.0);
    final fsSmall = (1 * vMin).clamp(7.0, 10.0);
    final fsH3 = (1.5 * vMin).clamp(9.0, 13.0);

    return Positioned.fill(
      child: GestureDetector(
        onTap: () {},
        behavior: HitTestBehavior.opaque,
        child: Material(
          color: Colors.black.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(6),
          child: Padding(
            padding: EdgeInsets.all(2 * vMin),
            child: Center(
              child: SingleChildScrollView(
                child: Align(
                  child: Container(
                    width: math.min(MediaQuery.sizeOf(context).width * 0.85, 320),
                    padding: EdgeInsets.all(2 * vMin),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: primary, width: 3),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          I18n().translate('game_creation.card.price'),
                          textAlign: TextAlign.center,
                          style: GoogleFonts.pressStart2p(
                            fontSize: fsH3,
                            height: 1.3,
                            color: primary,
                          ),
                        ),
                        SizedBox(height: 1.5 * vMin),
                        TextField(
                          controller: _feeController,
                          keyboardType: TextInputType.number,
                          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                          onChanged: (_) => setState(() {}),
                          style: GoogleFonts.pressStart2p(fontSize: fs, height: 1.2),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(
                              horizontal: 1 * vMin,
                              vertical: 1 * vMin,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(color: primary, width: 2),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(color: primary, width: 2),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(4),
                              borderSide: BorderSide(color: secondary, width: 2),
                            ),
                          ),
                        ),
                        if (insufficient) ...[
                          SizedBox(height: 1 * vMin),
                          Text(
                            I18n().translate('game_creation.card.insufficient'),
                            textAlign: TextAlign.center,
                            style: GoogleFonts.pressStart2p(
                              fontSize: fsSmall,
                              height: 1.3,
                              color: const Color(0xFFDC3545),
                            ),
                          ),
                        ],
                        SizedBox(height: 1.5 * vMin),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            gradient: LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [secondary, secondaryHover],
                            ),
                          ),
                          child: Padding(
                            padding: EdgeInsets.all(1 * vMin),
                            child: Column(
                              children: [
                                Text(
                                  I18n().translate('game_creation.card.new_balance'),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.pressStart2p(
                                    fontSize: fsSmall,
                                    height: 1.4,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(height: 0.5 * vMin),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      '$newBalance ',
                                      style: GoogleFonts.pressStart2p(
                                        fontSize: fs * 1.05,
                                        height: 1.2,
                                        color: Colors.white,
                                      ),
                                    ),
                                    CoinIcon(
                                      color: Colors.white,
                                      size: (fs * 1.2).clamp(14.0, 22.0),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(height: 1.5 * vMin),
                        Center(
                          child: _PixelPrimaryButton(
                            primary: primary,
                            label: I18n().translate('game_creation.card.create'),
                            enabled: _isEntryFeeValid,
                            fontSize: fsSmall,
                            onPressed: _confirmFee,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PixelPrimaryButton extends StatelessWidget {
  const _PixelPrimaryButton({
    required this.primary,
    required this.label,
    required this.enabled,
    required this.fontSize,
    required this.onPressed,
  });

  final Color primary;
  final String label;
  final bool enabled;
  final double fontSize;
  final Future<void> Function() onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: enabled ? primary : const Color(0xFFCCCCCC),
      borderRadius: BorderRadius.circular(2),
      child: InkWell(
        onTap: enabled
            ? () async {
                await onPressed();
              }
            : null,
        borderRadius: BorderRadius.circular(2),
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 2 * fontSize, vertical: fontSize * 0.9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(2),
            border: Border.all(
              color: enabled ? primary : const Color(0xFF999999),
              width: 2,
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.pressStart2p(
              fontSize: fontSize,
              height: 1.2,
              color: enabled ? Colors.white : const Color(0xFF666666),
            ),
          ),
        ),
      ),
    );
  }
}

class _TripleBorderCard extends StatelessWidget {
  const _TripleBorderCard({
    required this.primary,
    required this.secondary,
    required this.tertiary,
    required this.child,
  });

  final Color primary;
  final Color secondary;
  final Color tertiary;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2.5),
      decoration: BoxDecoration(
        color: primary,
        borderRadius: BorderRadius.circular(6),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Container(
        padding: const EdgeInsets.all(2.5),
        decoration: BoxDecoration(
          color: secondary,
          borderRadius: BorderRadius.circular(5),
        ),
        child: Container(
          padding: const EdgeInsets.all(2.5),
          decoration: BoxDecoration(
            color: tertiary,
            borderRadius: BorderRadius.circular(4),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _MapPreview extends StatelessWidget {
  const _MapPreview({required this.imagePayload});

  final String imagePayload;

  @override
  Widget build(BuildContext context) {
    if (imagePayload.isEmpty) {
      return ColoredBox(color: Colors.grey.shade400, child: const SizedBox.expand());
    }
    try {
      final bytes = base64Decode(imagePayload);
      return Image.memory(
        bytes,
        fit: BoxFit.cover,
        gaplessPlayback: true,
        errorBuilder: (context, error, stackTrace) =>
            ColoredBox(color: Colors.grey.shade400, child: const SizedBox.expand()),
      );
    } catch (_) {
      return ColoredBox(color: Colors.grey.shade400, child: const SizedBox.expand());
    }
  }
}
