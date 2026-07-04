import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:mobile_client/services/auth_service.dart';
import 'package:mobile_client/widget/tutorial_steps_data.dart';

/// Nombre total d'etapes du tutoriel (0-indexed: 0..totalSteps-1).
/// Derived from the step list defined in [kTutorialSteps].
final int kTutorialTotalSteps = kTutorialSteps.length;

/// Sentinel value indicating the tutorial has been completed.
const int kTutorialCompleted = -1;

class TutorialService extends ChangeNotifier {
  TutorialService({required AuthService authService, http.Client? httpClient})
      : _auth = authService,
        _http = httpClient ?? http.Client();

  final AuthService _auth;
  final http.Client _http;

  /// Etape actuelle (0 = jamais commence, 1..N = en cours, -1 = termine).
  int _currentStep = 0;
  int get currentStep => _currentStep;

  bool _loaded = false;
  bool get loaded => _loaded;

  /// True if the tutorial was manually closed for this session.
  bool _dismissedThisSession = false;

  /// True if the tutorial should be shown (first login or resume).
  bool get shouldShowTutorial =>
      _loaded &&
      !_dismissedThisSession &&
      _currentStep >= 0 &&
      _currentStep < kTutorialTotalSteps;

  /// True if the tutorial has been completed at least once.
  bool get isCompleted => _currentStep == kTutorialCompleted;

  // ── API serveur ──

  Future<void> fetchProgress() async {
    try {
      final headers = await _auth.buildProtectedHeaders();
      final res = await _http.get(
        Uri.parse('${AuthService.authUrl}/tutorial'),
        headers: headers,
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        _currentStep = (data['step'] as num?)?.toInt() ?? 0;
      }
    } catch (e) {
      debugPrint('[TutorialService] fetchProgress error: $e');
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> _saveProgress(int step) async {
    _currentStep = step;
    notifyListeners();
    try {
      final headers = await _auth.buildProtectedHeaders();
      await _http.put(
        Uri.parse('${AuthService.authUrl}/tutorial'),
        headers: headers,
        body: jsonEncode({'step': step}),
      );
    } catch (e) {
      debugPrint('[TutorialService] _saveProgress error: $e');
    }
  }

  /// Advances one step. If it is the last step, marks as completed.
  Future<void> nextStep() async {
    if (_currentStep < 0) return;
    final next = _currentStep + 1;
    if (next >= kTutorialTotalSteps) {
      await _saveProgress(kTutorialCompleted);
    } else {
      await _saveProgress(next);
    }
  }

  /// Closes the tutorial while saving the current progress.
  /// Hides the overlay until the next resume from the profile (or logical restart).
  Future<void> dismiss() async {
    _dismissedThisSession = true;
    notifyListeners();
    // Same step on the server side: resume possible from the profile.
    await _saveProgress(_currentStep);
  }

  /// To be called from the profile when the user picks "Resume tutorial".
  void resumeFromProfile() {
    _dismissedThisSession = false;
    notifyListeners();
  }

  /// Marks the tutorial as finished (closed for good).
  Future<void> complete() async {
    await _saveProgress(kTutorialCompleted);
  }

  /// Restarts the tutorial from the beginning.
  Future<void> restart() async {
    _dismissedThisSession = false;
    await _saveProgress(0);
  }

  void reset() {
    _currentStep = 0;
    _loaded = false;
    _dismissedThisSession = false;
    notifyListeners();
  }
}
