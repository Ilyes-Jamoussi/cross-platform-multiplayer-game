import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../app/i18n.dart';
import '../app/router.dart';
import '../services/auth_service.dart';
import '../services/cosmetics_service.dart';
import '../services/theme_service.dart';
import '../widget/coin_icon.dart';
import '../theme/game_page_overlays.dart';
import '../widget/poly_arena_confirm_popup.dart';
import '../widget/poly_arena_message_popup.dart';
import '../widget/web_game_flow_floating_actions.dart';
import '../widget/web_game_flow_header.dart';

/// 1 CSS `vmin` ≈ 1% of the smallest side (like the Angular client).
double _shopVmin(BuildContext context) =>
    MediaQuery.sizeOf(context).shortestSide * 0.01;

/// Triple halo like the SCSS (without `BoxShadow` or padding that shrinks the card).
/// **Tangent** rings: stroke center at `ring*(i+0.5)`, thickness `ring`.
class _ShopCardTripleRingsPainter extends CustomPainter {
  _ShopCardTripleRingsPainter({
    required this.cardR,
    required this.ring,
    required this.colorsOuterToInner,
  });

  final double cardR;
  final double ring;
  final List<Color> colorsOuterToInner;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.width <= 0 || size.height <= 0) return;
    for (var i = 0; i < 3; i++) {
      final inset = ring * (i + 0.5);
      if (inset * 2 >= size.width - 1 || inset * 2 >= size.height - 1) {
        continue;
      }
      final rr = RRect.fromRectAndRadius(
        Rect.fromLTWH(
          inset,
          inset,
          size.width - 2 * inset,
          size.height - 2 * inset,
        ),
        Radius.circular(math.max(0, cardR - inset)),
      );
      canvas.drawRRect(
        rr,
        Paint()
          ..color = colorsOuterToInner[i]
          ..style = PaintingStyle.stroke
          ..strokeWidth = ring
          ..strokeJoin = StrokeJoin.round
          ..isAntiAlias = true,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _ShopCardTripleRingsPainter oldDelegate) =>
      oldDelegate.cardR != cardR ||
      oldDelegate.ring != ring ||
      oldDelegate.colorsOuterToInner[0] != colorsOuterToInner[0] ||
      oldDelegate.colorsOuterToInner[1] != colorsOuterToInner[1] ||
      oldDelegate.colorsOuterToInner[2] != colorsOuterToInner[2];
}

/// Idle loop like `getAvatarDetailAnimation` on the Angular side; the web
/// `avatar_idle` assets are not in the app — we reuse the packaged combat idle GIF.
String _shopAvatarDetailAnimation(FeaturedAvatar avatar) =>
    'assets/avatar_combat/avatar_idle/${avatar.id}.gif';

String _avatarStoryTranslationKey(FeaturedAvatar avatar) {
  final key = 'shop_page.avatar_detail.stories.${avatar.id}';
  return I18n().translate(key) == key
      ? 'shop_page.avatar_detail.story_fallback'
      : key;
}

class ShopPage extends StatefulWidget {
  const ShopPage({super.key});

  @override
  State<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends State<ShopPage> {
  String _selectedCategory = 'backgrounds';
  FeaturedAvatar? _previewAvatar;

  void _goHomeReplacingStack() {
    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(context, AppRoutes.home, (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthService>();
    final cosmetics = context.watch<CosmeticsService>();
    final theme = context.watch<ThemeService>();
    final user = authService.currentUser;
    final primary = theme.primaryColor;
    final secondary = theme.secondaryColor;
    final tertiary = theme.tertiaryColor;

    if (user == null) {
      return Scaffold(
        body: Center(
          child: Text(
            I18n().translate('profile_page.not_logged_in'),
            style: GoogleFonts.pressStart2p(fontSize: 10),
          ),
        ),
      );
    }

    final topInset = MediaQuery.paddingOf(context).top;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        fit: StackFit.expand,
        children: [
          Column(
            children: [
              WebGameFlowHeader(onMenuPressed: _goHomeReplacingStack),
              Expanded(
                child: SafeArea(
                  top: false,
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: ColoredBox(
                          color: Colors.black,
                          child: Image.asset(
                            theme.bgImageAsset,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          children: [
                            _buildShopTitle(context, primary),
                            SizedBox(height: _shopVmin(context) * 2.5),
                            _buildCategoryTabs(
                              context,
                              primary,
                              secondary,
                              theme.secondaryDisabledColor,
                            ),
                            SizedBox(height: _shopVmin(context) * 3),
                            Expanded(
                              child: _buildItemsGrid(
                                context,
                                cosmetics,
                                primary,
                                secondary,
                                tertiary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_previewAvatar != null)
                        _buildAvatarDetailOverlay(
                          cosmetics: cosmetics,
                          currency: user.virtualCurrency ?? 0,
                          primary: primary,
                          secondary: secondary,
                          tertiary: tertiary,
                          secondaryDisabled: theme.secondaryDisabledColor,
                        ),
                    ],
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

  /// Angular `.shop-title`: centered, primary shadow, no frame.
  Widget _buildShopTitle(BuildContext context, Color primary) {
    final vmin = _shopVmin(context);
    return Text(
      I18n().translate('shop_page.title'),
      textAlign: TextAlign.center,
      style: GoogleFonts.pressStart2p(
        color: Colors.white,
        fontSize: (vmin * 3).clamp(12.0, 26.0),
        height: 1.2,
        shadows: [
          Shadow(
            offset: Offset(vmin * 0.25, vmin * 0.25),
            color: primary,
          ),
        ],
      ),
    );
  }

  /// `.category-tabs` / `.tab-button` Angular.
  Widget _buildCategoryTabs(
    BuildContext context,
    Color primary,
    Color secondary,
    Color secondaryDisabled,
  ) {
    final vmin = _shopVmin(context);
    final gap = vmin * 2;
    final borderW = math.max(2.0, vmin * 0.4);

    Widget tab(String labelKey, String id) {
      final isActive = _selectedCategory == id;
      return Expanded(
        child: GestureDetector(
          onTap: () => setState(() => _selectedCategory = id),
          child: Container(
            padding: EdgeInsets.symmetric(
              vertical: vmin * 1.5,
              horizontal: vmin * 2,
            ),
            decoration: BoxDecoration(
              color: isActive
                  ? primary
                  : Colors.black.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: isActive ? secondary : primary,
                width: borderW,
              ),
              boxShadow: isActive
                  ? [
                      BoxShadow(
                        color: secondaryDisabled,
                        blurRadius: vmin * 1.5,
                        spreadRadius: 0,
                      ),
                    ]
                  : null,
            ),
            child: Text(
              I18n().translate(labelKey),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.pressStart2p(
                fontSize: (vmin * 1.5).clamp(7.0, 14.0),
                color: isActive
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.6),
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        tab('shop_page.avatars', 'avatars'),
        SizedBox(width: gap),
        tab('shop_page.backgrounds', 'backgrounds'),
        SizedBox(width: gap),
        tab('shop_page.musics', 'music'),
      ],
    );
  }

  static const double _kShopPreviewHeight = 200;

  Widget _buildItemsGrid(
    BuildContext context,
    CosmeticsService cosmetics,
    Color primary,
    Color secondary,
    Color tertiary,
  ) {
    final List<dynamic> items;
    if (_selectedCategory == 'backgrounds') {
      items = cosmetics.shopBackgrounds;
    } else if (_selectedCategory == 'avatars') {
      items = cosmetics.shopAvatars;
    } else {
      items = cosmetics.shopMusics;
    }

    final vmin = _shopVmin(context);
    final gridPad = vmin * 1.5;
    final gap = vmin * 5;
    const minCol = 250.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        final innerW = math.max(0.0, constraints.maxWidth - 2 * gridPad);
        final n = math.max(
          1,
          ((innerW + gap) / (minCol + gap)).floor(),
        );
        final tileW = n > 0 ? (innerW - (n - 1) * gap) / n : innerW;
        final infoH = (vmin * 11.0).clamp(96.0, 122.0);
        final cardR = vmin * 2;

        return GridView.builder(
          padding: EdgeInsets.fromLTRB(gridPad, 0, gridPad, gridPad + 8),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: n,
            mainAxisSpacing: gap,
            crossAxisSpacing: gap,
            mainAxisExtent: _kShopPreviewHeight + infoH,
          ),
          itemCount: items.length,
          itemBuilder: (context, index) {
            final theme = context.watch<ThemeService>();
            final secondaryDisabled = theme.secondaryDisabledColor;
            final item = items[index];
            final bool owned;
            final int price;
            final String name;
            final VoidCallback? onPreviewTap;
            final Future<bool> Function() onBuy;

            if (item is FeaturedAvatar) {
              owned = cosmetics.isAvatarOwned(item.name);
              price = item.price;
              name = I18n().cosmeticLabel(item.name);
              onPreviewTap = () => setState(() => _previewAvatar = item);
              onBuy = () => cosmetics.purchaseAvatar(item);
            } else if (item is CosmeticBackground) {
              owned = cosmetics.isBackgroundOwned(item.id);
              price = item.price;
              name = I18n().cosmeticLabel(item.name);
              onPreviewTap = null;
              onBuy = () => cosmetics.purchaseBackground(item);
            } else {
              final m = item as CosmeticMusic;
              owned = cosmetics.isMusicOwned(m.id);
              price = m.price;
              name = I18n().cosmeticLabel(m.name);
              onPreviewTap = null;
              onBuy = () => cosmetics.purchaseMusic(m);
            }

            final canBuy = cosmetics.canAfford(price);

            /// Thickness of one ring (~0.3vmin SCSS), painted stroke (full tile).
            final ring = math.max(1.25, vmin * 0.26);

            final s = (tileW / 250).clamp(0.68, 1.0);
            final titleFs = (vmin * 1.2).clamp(7.0, 12.0) * s;
            final priceFs = (vmin * 1.2).clamp(7.0, 12.0) * s;
            final buyFs = (vmin * 0.75).clamp(5.0, 9.0) * s;
            /// The strokes of the 3 rings reach ~`2*ring` from the edge: keep the
            /// content further inside so it does not "stick" to the halo.
            final infoPadV = math.max(5.0, vmin * 0.62);
            final infoPadH = 2.0 * ring + math.max(6.0, vmin * 0.58);
            final h3Margin = math.max(4.0, vmin * 1.5);
            final priceGap = math.max(3.0, vmin * 0.5);
            final priceToBuyGap = math.max(8.0, vmin * 0.9);

            late final Widget preview;
            if (item is FeaturedAvatar) {
              preview = Container(
                width: double.infinity,
                height: _kShopPreviewHeight,
                color: Colors.black.withValues(alpha: 0.1),
                alignment: Alignment.center,
                child: FractionallySizedBox(
                  widthFactor: 0.8,
                  heightFactor: 0.8,
                  child: Image.asset(
                    item.animation ?? item.icon,
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.none,
                    errorBuilder: (_, _, _) => Image.asset(
                      item.icon,
                      fit: BoxFit.contain,
                      filterQuality: FilterQuality.none,
                    ),
                  ),
                ),
              );
            } else if (item is CosmeticBackground) {
              preview = Container(
                width: double.infinity,
                height: _kShopPreviewHeight,
                color: Colors.black,
                alignment: Alignment.center,
                child: Image.asset(
                  item.assetForTheme(theme.isBlue),
                  fit: BoxFit.contain,
                  filterQuality: FilterQuality.none,
                ),
              );
            } else {
              final m = item as CosmeticMusic;
              preview = SizedBox(
                width: double.infinity,
                height: _kShopPreviewHeight,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ColoredBox(color: Colors.black.withValues(alpha: 0.3)),
                    Opacity(
                      opacity: 0.5,
                      child: Image.asset(
                        m.cover,
                        fit: BoxFit.cover,
                        width: double.infinity,
                        height: _kShopPreviewHeight,
                        alignment: Alignment.center,
                        filterQuality: FilterQuality.none,
                      ),
                    ),
                    Center(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '♫',
                          style: GoogleFonts.pressStart2p(
                            fontSize: 48,
                            height: 1,
                            color: owned
                                ? const Color(0xFF27AE60)
                                : secondary,
                            shadows: [
                              Shadow(
                                color: owned
                                    ? const Color(0xFF27AE60)
                                        .withValues(alpha: 0.4)
                                    : secondaryDisabled,
                                blurRadius: 12,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }

            final ringColors = owned
                ? [
                    const Color(0xFF27AE60).withValues(alpha: 0.4),
                    const Color(0xFF27AE60),
                    const Color(0xFF1E8449),
                  ]
                : [tertiary, secondary, primary];

            return Stack(
              clipBehavior: Clip.none,
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(cardR),
                  child: Container(
                    color: const Color(0x99000000),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        GestureDetector(
                          onTap: onPreviewTap,
                          child: preview,
                        ),
                        Expanded(
                          child: Container(
                            width: double.infinity,
                            color: const Color(0x66000000),
                            padding: EdgeInsets.fromLTRB(
                              infoPadH,
                              infoPadV,
                              infoPadH,
                              infoPadV,
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.pressStart2p(
                                    color: Colors.white,
                                    fontSize: titleFs,
                                    height: 1.35,
                                    shadows: [
                                      Shadow(
                                        offset: Offset(
                                          vmin * 0.15,
                                          vmin * 0.15,
                                        ),
                                        color: primary,
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(height: h3Margin),
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    Expanded(
                                      child: Row(
                                        children: [
                                          CoinIcon(
                                            color: const Color(0xFFE6B830),
                                            size:
                                                (vmin * 1.15).clamp(10.0, 16.0) *
                                                    s,
                                          ),
                                          SizedBox(width: priceGap),
                                          Flexible(
                                            child: Text(
                                              '$price',
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: GoogleFonts.pressStart2p(
                                                color: const Color(0xFFE6B830),
                                                fontSize: priceFs,
                                                fontWeight: FontWeight.bold,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    SizedBox(width: priceToBuyGap),
                                    _buildBuyButton(
                                      owned: owned,
                                      canBuy: canBuy,
                                      primary: primary,
                                      secondaryDisabled:
                                          theme.secondaryDisabledColor,
                                      vmin: vmin * s,
                                      buyFontSize: buyFs,
                                      onBuy: () =>
                                          _confirmPurchase(name, price, onBuy),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _ShopCardTripleRingsPainter(
                        cardR: cardR,
                        ring: ring,
                        colorsOuterToInner: ringColors,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  /// `.buy-button` Angular (bordure 0.4vmin, rayon 5vmin, tailles en vmin).
  Widget _buildBuyButton({
    required bool owned,
    required bool canBuy,
    required Color primary,
    required Color secondaryDisabled,
    required double vmin,
    required double buyFontSize,
    required VoidCallback onBuy,
  }) {
    final borderW = math.max(2.0, vmin * 0.4);
    final hPad = math.max(6.0, vmin * 1.5);
    final vPad = math.max(5.0, vmin * 1.0);
    final style = GoogleFonts.pressStart2p(
      color: Colors.white,
      fontSize: buyFontSize,
    );

    if (owned) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
        decoration: BoxDecoration(
          color: const Color(0xFF27AE60),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: const Color(0xFF1E8449),
            width: borderW,
          ),
        ),
        child: Text(I18n().translate('shop_page.owned'), style: style),
      );
    }
    if (!canBuy) {
      return Opacity(
        opacity: 0.7,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
          decoration: BoxDecoration(
            color: primary,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: primary, width: borderW),
          ),
          child: Text(
            I18n().translate('shop_page.insufficient'),
            style: style,
          ),
        ),
      );
    }
    return GestureDetector(
      onTap: onBuy,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
        decoration: BoxDecoration(
          color: primary,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: primary, width: borderW),
          boxShadow: [
            BoxShadow(
              color: secondaryDisabled,
              blurRadius: math.max(4.0, vmin * 1),
              spreadRadius: 0,
            ),
          ],
        ),
        child: Text(I18n().translate('shop_page.buy'), style: style),
      ),
    );
  }

  Widget _buildAvatarDetailOverlay({
    required CosmeticsService cosmetics,
    required int currency,
    required Color primary,
    required Color secondary,
    required Color tertiary,
    required Color secondaryDisabled,
  }) {
    final avatar = _previewAvatar!;
    final owned = cosmetics.isAvatarOwned(avatar.name);
    final canBuy = cosmetics.canAfford(avatar.price);
    final progress = avatar.price <= 0
        ? 1.0
        : (currency / avatar.price).clamp(0.0, 1.0);
    final storyKey = _avatarStoryTranslationKey(avatar);
    final mq = MediaQuery.sizeOf(context);
    /// Shorter than the web's ~92vh: avoids the "full screen" card.
    final maxCardH = (mq.height * 0.72).clamp(360.0, 560.0);
    final maxCardW = math.min(680.0, mq.width - 32);

    return GestureDetector(
      onTap: () => setState(() => _previewAvatar = null),
      child: Container(
        color: Colors.black.withValues(alpha: 0.72),
        padding: const EdgeInsets.all(16),
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              constraints: BoxConstraints(
                maxWidth: maxCardW,
                maxHeight: maxCardH,
              ),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(color: primary, spreadRadius: 2),
                  BoxShadow(color: secondary, spreadRadius: 4),
                  BoxShadow(color: tertiary, spreadRadius: 6),
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.55),
                    offset: const Offset(0, 24),
                    blurRadius: 56,
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Align(
                    alignment: Alignment.centerRight,
                    child: IconButton(
                      tooltip: I18n()
                          .translate('shop_page.avatar_detail.close_alt'),
                      onPressed: () => setState(() => _previewAvatar = null),
                      icon: const Icon(Icons.close, color: Colors.white70),
                    ),
                  ),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, c) {
                        final wide = c.maxWidth > 620;
                        final left = Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              I18n().cosmeticLabel(avatar.name),
                              style: GoogleFonts.pressStart2p(
                                color: Colors.white,
                                fontSize: 11,
                                shadows: [
                                  Shadow(
                                    color: primary,
                                    offset: const Offset(2, 2),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            Expanded(
                              child: Container(
                                width: double.infinity,
                                decoration: BoxDecoration(
                                  border: Border.all(
                                    color: primary,
                                    width: 3,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                  color: Colors.black.withValues(alpha: 0.25),
                                ),
                                child: Stack(
                                  children: [
                                    if (owned)
                                      Positioned(
                                        top: 10,
                                        left: 10,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 5,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF27AE60),
                                            borderRadius: BorderRadius.circular(6),
                                            border: Border.all(
                                              color: const Color(0xFF1E8449),
                                              width: 2,
                                            ),
                                          ),
                                          child: Text(
                                            I18n().translate(
                                              'shop_page.avatar_detail.owned_badge',
                                            ),
                                            style: GoogleFonts.pressStart2p(
                                              color: Colors.white,
                                              fontSize: 6.5,
                                            ),
                                          ),
                                        ),
                                      ),
                                    Center(
                                      child: Image.asset(
                                        _shopAvatarDetailAnimation(avatar),
                                        fit: BoxFit.contain,
                                        filterQuality: FilterQuality.none,
                                        errorBuilder: (_, _, _) => Image.asset(
                                          avatar.animation ?? avatar.icon,
                                          fit: BoxFit.contain,
                                          filterQuality: FilterQuality.none,
                                          errorBuilder: (_, _, _) => Image.asset(
                                            avatar.icon,
                                            fit: BoxFit.contain,
                                            filterQuality: FilterQuality.none,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );

                        final right = LayoutBuilder(
                          builder: (context, constraints) {
                            final buyControl = GestureDetector(
                              onTap: canBuy
                                  ? () => _confirmPurchase(
                                        I18n().cosmeticLabel(avatar.name),
                                        avatar.price,
                                        () async {
                                          final ok =
                                              await cosmetics.purchaseAvatar(
                                            avatar,
                                          );
                                          if (ok && mounted) {
                                            setState(
                                              () => _previewAvatar = null,
                                            );
                                          }
                                          return ok;
                                        },
                                      )
                                  : null,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                decoration: BoxDecoration(
                                  color: canBuy
                                      ? primary
                                      : Colors.black.withValues(alpha: 0.4),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: canBuy
                                        ? secondary
                                        : Colors.white
                                            .withValues(alpha: 0.15),
                                    width: 3,
                                  ),
                                  boxShadow: canBuy
                                      ? [
                                          BoxShadow(
                                            color: secondaryDisabled,
                                            blurRadius: 8,
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Text(
                                  I18n().translate(
                                    canBuy
                                        ? 'shop_page.buy'
                                        : 'shop_page.insufficient',
                                  ),
                                  textAlign: TextAlign.center,
                                  style: GoogleFonts.pressStart2p(
                                    color: canBuy
                                        ? Colors.white
                                        : Colors.white
                                            .withValues(alpha: 0.5),
                                    fontSize: 8.5,
                                  ),
                                ),
                              ),
                            );

                            return SingleChildScrollView(
                              child: ConstrainedBox(
                                constraints: BoxConstraints(
                                  minHeight: constraints.maxHeight,
                                ),
                                child: Column(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        Text(
                                          I18n().translate(
                                            'shop_page.avatar_detail.story_heading',
                                          ),
                                          style: GoogleFonts.pressStart2p(
                                            color: secondary,
                                            fontSize: 7.5,
                                            height: 1.6,
                                            letterSpacing: 1.1,
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        Text(
                                          I18n().translate(storyKey),
                                          style: GoogleFonts.pressStart2p(
                                            color: Colors.white
                                                .withValues(alpha: 0.8),
                                            fontSize: 7.5,
                                            height: 2,
                                          ),
                                        ),
                                        const SizedBox(height: 16),
                                        if (owned)
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 16,
                                              vertical: 12,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF27AE60)
                                                  .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(12),
                                              border: Border.all(
                                                color: const Color(0xFF27AE60)
                                                    .withValues(alpha: 0.45),
                                                width: 2,
                                              ),
                                            ),
                                            child: Text(
                                              I18n().translate(
                                                'shop_page.avatar_detail.in_collection',
                                              ),
                                              style: GoogleFonts.pressStart2p(
                                                color: const Color(0xFFA9DFBF),
                                                fontSize: 7.5,
                                                height: 2,
                                              ),
                                            ),
                                          )
                                        else
                                          Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: canBuy
                                                  ? const Color(0xFF1e8449)
                                                      .withValues(alpha: 0.12)
                                                  : const Color(0xFFa04000)
                                                      .withValues(alpha: 0.12),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              border: Border.all(
                                                color: canBuy
                                                    ? const Color(0xFF1e8449)
                                                    : const Color(0xFFa04000),
                                                width: 2,
                                              ),
                                            ),
                                            child: Column(
                                              children: [
                                                Text(
                                                  '$currency / ${avatar.price}',
                                                  style:
                                                      GoogleFonts.pressStart2p(
                                                    color: canBuy
                                                        ? const Color(
                                                            0xFFa9dfbf,
                                                          )
                                                        : const Color(
                                                            0xFFf39c12,
                                                          ),
                                                    fontSize: 8,
                                                  ),
                                                ),
                                                const SizedBox(height: 10),
                                                Row(
                                                  children: [
                                                    CoinIcon(
                                                      color: canBuy
                                                          ? const Color(
                                                              0xFFa9dfbf,
                                                            )
                                                          : const Color(
                                                              0xFFf39c12,
                                                            ),
                                                      size: 14,
                                                    ),
                                                    const SizedBox(width: 6),
                                                    Expanded(
                                                      child: Semantics(
                                                        label: I18n()
                                                            .translateWithParams(
                                                          'shop_page.avatar_detail.progress_a11y',
                                                          {
                                                            'have': currency
                                                                .toString(),
                                                            'need': avatar.price
                                                                .toString(),
                                                          },
                                                        ),
                                                        value:
                                                            '${(progress * 100).round()}%',
                                                        child: Container(
                                                          height: 14,
                                                          decoration:
                                                              BoxDecoration(
                                                            color: Colors.black
                                                                .withValues(
                                                              alpha: 0.5,
                                                            ),
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                              8,
                                                            ),
                                                            border: Border.all(
                                                              color: Colors
                                                                  .white
                                                                  .withValues(
                                                                alpha: 0.1,
                                                              ),
                                                              width: 2,
                                                            ),
                                                          ),
                                                          child: Align(
                                                            alignment: Alignment
                                                                .centerLeft,
                                                            child:
                                                                FractionallySizedBox(
                                                              widthFactor:
                                                                  progress,
                                                              child: Container(
                                                                margin:
                                                                    const EdgeInsets
                                                                        .all(
                                                                  1,
                                                                ),
                                                                decoration:
                                                                    BoxDecoration(
                                                                  borderRadius:
                                                                      BorderRadius
                                                                          .circular(
                                                                    6,
                                                                  ),
                                                                  gradient:
                                                                      LinearGradient(
                                                                    colors: canBuy
                                                                        ? const [
                                                                            Color(
                                                                              0xFF1e8449,
                                                                            ),
                                                                            Color(
                                                                              0xFF58d68d,
                                                                            ),
                                                                          ]
                                                                        : const [
                                                                            Color(
                                                                              0xFFa04000,
                                                                            ),
                                                                            Color(
                                                                              0xFFf39c12,
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
                                                  ],
                                                ),
                                              ],
                                            ),
                                          ),
                                      ],
                                    ),
                                    if (!owned) ...[
                                      const SizedBox(height: 16),
                                      buyControl,
                                    ],
                                  ],
                                ),
                              ),
                            );
                          },
                        );

                        if (wide) {
                          return Row(
                            children: [
                              Expanded(child: left),
                              const SizedBox(width: 20),
                              Expanded(child: right),
                            ],
                          );
                        }
                        return Column(
                          children: [
                            Expanded(flex: 6, child: left),
                            const SizedBox(height: 14),
                            Expanded(flex: 5, child: right),
                          ],
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _confirmPurchase(
    String itemName,
    int price,
    Future<bool> Function() doPurchase,
  ) async {
    final confirmed = await showPolyArenaConfirmDialog(
      context: context,
      titleKey: 'popup.shop_confirm_title',
      messageKey: 'popup.shop_confirm_item',
      messageParams: {
        'item': itemName,
        'price': price.toString(),
      },
    );

    if (confirmed) {
      final ok = await doPurchase();
      if (!mounted) return;
      if (ok) {
        await showPolyArenaMessageDialog(
          context: context,
          kind: PolyArenaMessageKind.success,
          title: I18n().translate('popup.shop_success_title'),
          message: I18n().translate('popup.shop_success_message'),
          okLabel: I18n().translate('common.ok'),
        );
      } else {
        showGamePageSnackBar(context, I18n().translate('popup.error_title'), kind: GamePageSnackKind.error);
      }
    }
  }
}
