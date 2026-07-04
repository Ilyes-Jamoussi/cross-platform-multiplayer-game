import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// SVGs aligned with `chat-external-page`, `chat-message-list`, `chat-channel-list` (Angular).
abstract final class PolyArenaChatIcons {
  static const _xmlns = 'xmlns="http://www.w3.org/2000/svg"';

  static Widget _mono(String inner, double size, Color color) {
    return SvgPicture.string(
      '<svg $_xmlns width="24" height="24" viewBox="0 0 24 24" fill="none">'
      '$inner'
      '</svg>',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }

  /// Onglet chat global (globe).
  static Widget globe(double size, Color color) => _mono(
        '<circle cx="12" cy="12" r="10" fill="none" stroke="black" stroke-width="2"/>'
        '<path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2z" stroke="black" stroke-width="2"/>',
        size,
        color,
      );

  /// Onglet canaux (lignes).
  static Widget channelsTab(double size, Color color) => _mono(
        '<path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        size,
        color,
      );

  /// Bouton retour canal.
  static Widget backChevron(double size, Color color) => _mono(
        '<polyline points="15 18 9 12 15 6" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
        size,
        color,
      );

  /// Supprimer canal / corbeille.
  static Widget trash(double size, Color color) => _mono(
        '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        '<line x1="10" y1="11" x2="10" y2="17" stroke="black" stroke-width="2" stroke-linecap="round"/>'
        '<line x1="14" y1="11" x2="14" y2="17" stroke="black" stroke-width="2" stroke-linecap="round"/>',
        size,
        color,
      );

  /// Leave the channel.
  static Widget leaveDoor(double size, Color color) => _mono(
        '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        '<polyline points="16 17 21 12 16 7" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        '<line x1="21" y1="12" x2="9" y2="12" stroke="black" stroke-width="2" stroke-linecap="round"/>',
        size,
        color,
      );

  /// Envoyer message.
  static Widget sendPlane(double size, Color color) => _mono(
        '<path d="M22 2L11 13" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
        size,
        color,
      );

  /// Liste vide messages (bulle + points).
  static Widget emptyChatBubble(double size, Color color) => _mono(
        '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
        '<circle cx="8" cy="10" r="1" fill="black"/>'
        '<circle cx="12" cy="10" r="1" fill="black"/>'
        '<circle cx="16" cy="10" r="1" fill="black"/>',
        size,
        color,
      );

  /// Owner crown (fixed colors like Angular).
  static Widget ownerCrown(double size) {
    return SvgPicture.string(
      '<svg $_xmlns width="24" height="24" viewBox="0 0 24 24" fill="none">'
      '<path d="M2 20h20V10l-4 4-6-8-6 8-4-4v10z" fill="#ffd700" stroke="#b8960c" stroke-width="1.5" stroke-linejoin="round"/>'
      '<circle cx="12" cy="6" r="1.5" fill="#ffd700" stroke="#b8960c" stroke-width="1"/>'
      '<circle cx="2" cy="10" r="1.5" fill="#ffd700" stroke="#b8960c" stroke-width="1"/>'
      '<circle cx="22" cy="10" r="1.5" fill="#ffd700" stroke="#b8960c" stroke-width="1"/>'
      '</svg>',
      width: size,
      height: size,
    );
  }
}
