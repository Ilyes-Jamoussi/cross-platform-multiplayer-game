import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/language_service.dart';
import '../services/theme_service.dart';

class LanguageDropdown extends StatelessWidget {
  const LanguageDropdown({
    super.key,
    this.width = 120,
  });

  final double width;

  static const _languages = <String, String>{
    'fr': 'FR',
    'en': 'EN',
  };

  @override
  Widget build(BuildContext context) {
    final lang = context.select<LanguageService, String>((s) => s.lang);
    final outline = context.watch<ThemeService>().primaryColor;

    return SizedBox(
      width: width,
      height: 36,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.35),
          border: Border.all(color: outline, width: 2),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: lang,
            dropdownColor: const Color(0xFF1a1a2e),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
            icon: const Icon(Icons.language, color: Colors.white70, size: 18),
            items: _languages.entries
                .map(
                  (e) => DropdownMenuItem<String>(
                    value: e.key,
                    child: Text(e.value),
                  ),
                )
                .toList(),
            onChanged: (next) {
              if (next == null) return;
              context.read<LanguageService>().setLang(next);
            },
          ),
        ),
      ),
    );
  }
}

