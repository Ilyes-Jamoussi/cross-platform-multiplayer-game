import 'package:flutter/painting.dart';

/// Visual annotation overlaid on a tutorial screenshot.
/// [target] is the relative position (0..1) of the numbered badge's center.
/// [labelKey] is the i18n key of the matching caption text.
class TutorialAnnotation {
  const TutorialAnnotation({required this.target, required this.labelKey});

  final Offset target;
  final String labelKey;
}

/// Definition of a tutorial step.
/// If [imagePath] is null, the step shows the default logo.
class TutorialStepData {
  const TutorialStepData({
    required this.titleKey,
    required this.bodyKey,
    this.imagePath,
    this.imageAspectRatio,
    this.annotations = const <TutorialAnnotation>[],
  });

  final String titleKey;
  final String bodyKey;
  final String? imagePath;

  /// Width / height ratio of the original image. Used to size the
  /// display area without distortion, and to place the annotations.
  final double? imageAspectRatio;

  final List<TutorialAnnotation> annotations;
}

/// Ordered list of tutorial steps. The index matches the server-side
/// `step` field.
const List<TutorialStepData> kTutorialSteps = <TutorialStepData>[
  // s0 — Bienvenue
  TutorialStepData(
    titleKey: 'tutorial.s0_title',
    bodyKey: 'tutorial.s0_body',
  ),

  // s1 — Menu principal
  TutorialStepData(
    titleKey: 'tutorial.s1_title',
    bodyKey: 'tutorial.s1_body',
    imagePath: 'assets/tutorial/main_menu.webp',
    imageAspectRatio: 1.611,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.82, 0.09), labelKey: 'tutorial.a1_coins'),
      TutorialAnnotation(target: Offset(0.90, 0.10), labelKey: 'tutorial.a1_stats'),
      TutorialAnnotation(target: Offset(0.935, 0.10), labelKey: 'tutorial.a1_chat'),
      TutorialAnnotation(target: Offset(0.965, 0.10), labelKey: 'tutorial.a1_profile'),
      TutorialAnnotation(target: Offset(0.50, 0.70), labelKey: 'tutorial.a1_join'),
      TutorialAnnotation(target: Offset(0.50, 0.81), labelKey: 'tutorial.a1_create'),
    ],
  ),

  // s2 — Menu profil (popup)
  TutorialStepData(
    titleKey: 'tutorial.s2_title',
    bodyKey: 'tutorial.s2_body',
    imagePath: 'assets/tutorial/profile_menu.webp',
    imageAspectRatio: 0.984,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.16, 0.11), labelKey: 'tutorial.a2_avatar'),
      TutorialAnnotation(target: Offset(0.55, 0.11), labelKey: 'tutorial.a2_email'),
      TutorialAnnotation(target: Offset(0.95, 0.29), labelKey: 'tutorial.a2_friends'),
      TutorialAnnotation(target: Offset(0.75, 0.50), labelKey: 'tutorial.a2_language'),
      TutorialAnnotation(target: Offset(0.75, 0.72), labelKey: 'tutorial.a2_theme'),
      TutorialAnnotation(target: Offset(0.50, 0.94), labelKey: 'tutorial.a2_logout'),
    ],
  ),

  // s3 — Page profil
  TutorialStepData(
    titleKey: 'tutorial.s3_title',
    bodyKey: 'tutorial.s3_body',
    imagePath: 'assets/tutorial/profile_page.webp',
    imageAspectRatio: 1.732,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.12, 0.15), labelKey: 'tutorial.a3_coins'),
      TutorialAnnotation(target: Offset(0.26, 0.27), labelKey: 'tutorial.a3_inventory'),
      TutorialAnnotation(target: Offset(0.22, 0.75), labelKey: 'tutorial.a3_stats'),
      TutorialAnnotation(target: Offset(0.72, 0.43), labelKey: 'tutorial.a3_resume'),
      TutorialAnnotation(target: Offset(0.72, 0.51), labelKey: 'tutorial.a3_restart'),
      TutorialAnnotation(target: Offset(0.72, 0.60), labelKey: 'tutorial.a3_delete'),
      TutorialAnnotation(target: Offset(0.74, 0.85), labelKey: 'tutorial.a3_avatar'),
    ],
  ),

  // s4 — Amis
  TutorialStepData(
    titleKey: 'tutorial.s4_title',
    bodyKey: 'tutorial.s4_body',
    imagePath: 'assets/tutorial/friends_menu.webp',
    imageAspectRatio: 0.604,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.40, 0.14), labelKey: 'tutorial.a4_search'),
      TutorialAnnotation(target: Offset(0.25, 0.25), labelKey: 'tutorial.a4_incoming'),
      TutorialAnnotation(target: Offset(0.27, 0.47), labelKey: 'tutorial.a4_sent'),
      TutorialAnnotation(target: Offset(0.15, 0.69), labelKey: 'tutorial.a4_list'),
    ],
  ),

  // s5 — Chat global
  TutorialStepData(
    titleKey: 'tutorial.s5_title',
    bodyKey: 'tutorial.s5_body',
    imagePath: 'assets/tutorial/chat_global.webp',
    imageAspectRatio: 0.586,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.22, 0.045), labelKey: 'tutorial.a5_tab_global'),
      TutorialAnnotation(target: Offset(0.62, 0.045), labelKey: 'tutorial.a5_tab_channels'),
      TutorialAnnotation(target: Offset(0.50, 0.45), labelKey: 'tutorial.a5_messages'),
      TutorialAnnotation(target: Offset(0.50, 0.82), labelKey: 'tutorial.a5_emojis'),
      TutorialAnnotation(target: Offset(0.45, 0.92), labelKey: 'tutorial.a5_input'),
    ],
  ),

  // s6 — Canaux
  TutorialStepData(
    titleKey: 'tutorial.s6_title',
    bodyKey: 'tutorial.s6_body',
    imagePath: 'assets/tutorial/chat_channels.webp',
    imageAspectRatio: 0.584,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.62, 0.045), labelKey: 'tutorial.a6_tab_channels'),
      TutorialAnnotation(target: Offset(0.40, 0.17), labelKey: 'tutorial.a6_filter'),
      TutorialAnnotation(target: Offset(0.92, 0.17), labelKey: 'tutorial.a6_create'),
      TutorialAnnotation(target: Offset(0.50, 0.45), labelKey: 'tutorial.a6_list'),
    ],
  ),

  // s7 — Boutique : Personnages
  TutorialStepData(
    titleKey: 'tutorial.s7_title',
    bodyKey: 'tutorial.s7_body',
    imagePath: 'assets/tutorial/shop_characters.webp',
    imageAspectRatio: 1.589,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.20, 0.21), labelKey: 'tutorial.a7_tab'),
      TutorialAnnotation(target: Offset(0.38, 0.40), labelKey: 'tutorial.a7_card'),
      TutorialAnnotation(target: Offset(0.12, 0.62), labelKey: 'tutorial.a7_price'),
      TutorialAnnotation(target: Offset(0.30, 0.65), labelKey: 'tutorial.a7_buy'),
      TutorialAnnotation(target: Offset(0.90, 0.66), labelKey: 'tutorial.a7_locked'),
    ],
  ),

  // s8 — Shop: Backgrounds
  TutorialStepData(
    titleKey: 'tutorial.s8_title',
    bodyKey: 'tutorial.s8_body',
    imagePath: 'assets/tutorial/shop_backgrounds.webp',
    imageAspectRatio: 1.610,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.50, 0.21), labelKey: 'tutorial.a8_tab'),
      TutorialAnnotation(target: Offset(0.37, 0.45), labelKey: 'tutorial.a8_card'),
      TutorialAnnotation(target: Offset(0.15, 0.63), labelKey: 'tutorial.a8_price'),
      TutorialAnnotation(target: Offset(0.28, 0.66), labelKey: 'tutorial.a8_buy'),
    ],
  ),

  // s9 — Boutique : Musiques
  TutorialStepData(
    titleKey: 'tutorial.s9_title',
    bodyKey: 'tutorial.s9_body',
    imagePath: 'assets/tutorial/shop_music.webp',
    imageAspectRatio: 1.602,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.82, 0.21), labelKey: 'tutorial.a9_tab'),
      TutorialAnnotation(target: Offset(0.37, 0.45), labelKey: 'tutorial.a9_card'),
      TutorialAnnotation(target: Offset(0.15, 0.63), labelKey: 'tutorial.a9_price'),
      TutorialAnnotation(target: Offset(0.28, 0.66), labelKey: 'tutorial.a9_buy'),
    ],
  ),

  // s10 — Create a game
  TutorialStepData(
    titleKey: 'tutorial.s10_title',
    bodyKey: 'tutorial.s10_body',
    imagePath: 'assets/tutorial/create_game.webp',
    imageAspectRatio: 1.605,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.22, 0.33), labelKey: 'tutorial.a10_price'),
      TutorialAnnotation(target: Offset(0.22, 0.45), labelKey: 'tutorial.a10_balance'),
      TutorialAnnotation(target: Offset(0.49, 0.40), labelKey: 'tutorial.a10_map1'),
      TutorialAnnotation(target: Offset(0.76, 0.40), labelKey: 'tutorial.a10_map2'),
      TutorialAnnotation(target: Offset(0.22, 0.57), labelKey: 'tutorial.a10_create'),
    ],
  ),

  // s11 — Join a game
  TutorialStepData(
    titleKey: 'tutorial.s11_title',
    bodyKey: 'tutorial.s11_body',
    imagePath: 'assets/tutorial/join_game.png',
    imageAspectRatio: 1.656,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.50, 0.17), labelKey: 'tutorial.a11_private'),
      TutorialAnnotation(target: Offset(0.50, 0.24), labelKey: 'tutorial.a11_public_title'),
      TutorialAnnotation(target: Offset(0.14, 0.34), labelKey: 'tutorial.a11_game_code'),
      TutorialAnnotation(target: Offset(0.14, 0.47), labelKey: 'tutorial.a11_game_preview'),
      TutorialAnnotation(target: Offset(0.14, 0.62), labelKey: 'tutorial.a11_game_status'),
    ],
  ),

  // s12 — Character selection
  TutorialStepData(
    titleKey: 'tutorial.s12_title',
    bodyKey: 'tutorial.s12_body',
    imagePath: 'assets/tutorial/character_selection.webp',
    imageAspectRatio: 1.602,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.18, 0.45), labelKey: 'tutorial.a12_grid'),
      TutorialAnnotation(target: Offset(0.50, 0.40), labelKey: 'tutorial.a12_preview'),
      TutorialAnnotation(target: Offset(0.55, 0.72), labelKey: 'tutorial.a12_stats'),
      TutorialAnnotation(target: Offset(0.92, 0.92), labelKey: 'tutorial.a12_confirm'),
    ],
  ),

  // s13 — Salle d'attente
  TutorialStepData(
    titleKey: 'tutorial.s13_title',
    bodyKey: 'tutorial.s13_body',
    imagePath: 'assets/tutorial/waiting_room.webp',
    imageAspectRatio: 1.811,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.11, 0.13), labelKey: 'tutorial.a13_code'),
      TutorialAnnotation(target: Offset(0.11, 0.20), labelKey: 'tutorial.a13_players'),
      TutorialAnnotation(target: Offset(0.11, 0.30), labelKey: 'tutorial.a13_mode'),
      TutorialAnnotation(target: Offset(0.48, 0.38), labelKey: 'tutorial.a13_lobby'),
      TutorialAnnotation(target: Offset(0.82, 0.45), labelKey: 'tutorial.a13_chat'),
      TutorialAnnotation(target: Offset(0.11, 0.83), labelKey: 'tutorial.a13_lock'),
      TutorialAnnotation(target: Offset(0.11, 0.92), labelKey: 'tutorial.a13_fog'),
      TutorialAnnotation(target: Offset(0.82, 0.88), labelKey: 'tutorial.a13_start'),
      TutorialAnnotation(target: Offset(0.82, 0.96), labelKey: 'tutorial.a13_leave'),
    ],
  ),

  // s14 — Partie en cours
  TutorialStepData(
    titleKey: 'tutorial.s14_title',
    bodyKey: 'tutorial.s14_body',
    imagePath: 'assets/tutorial/active_game.webp',
    imageAspectRatio: 1.601,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.46, 0.40), labelKey: 'tutorial.a14_board'),
      TutorialAnnotation(target: Offset(0.13, 0.40), labelKey: 'tutorial.a14_panel'),
      TutorialAnnotation(target: Offset(0.85, 0.30), labelKey: 'tutorial.a14_chat'),
      TutorialAnnotation(target: Offset(0.85, 0.80), labelKey: 'tutorial.a14_actions'),
    ],
  ),

  // s15 — Fin de partie
  TutorialStepData(
    titleKey: 'tutorial.s15_title',
    bodyKey: 'tutorial.s15_body',
    imagePath: 'assets/tutorial/end_stats.webp',
    imageAspectRatio: 1.811,
    annotations: <TutorialAnnotation>[
      TutorialAnnotation(target: Offset(0.35, 0.10), labelKey: 'tutorial.a15_title'),
      TutorialAnnotation(target: Offset(0.16, 0.22), labelKey: 'tutorial.a15_balance'),
      TutorialAnnotation(target: Offset(0.42, 0.22), labelKey: 'tutorial.a15_duration'),
      TutorialAnnotation(target: Offset(0.25, 0.42), labelKey: 'tutorial.a15_table'),
    ],
  ),
];
