import 'package:flutter/foundation.dart';

/// Character stats logic aligned with the Angular client (`character-stats.component`).
class CharacterStatsService extends ChangeNotifier {
  static const int baseStat = 4;
  static const int maxStat = 6;
  static const int boost = 2;

  int _life = baseStat;
  int _speed = baseStat;
  int _attack = baseStat;
  int _defense = baseStat;

  int get life => _life;
  int get speed => _speed;
  int get attack => _attack;
  int get defense => _defense;
  int get maxSpeed => _speed;

  bool get isValid => isLifeOrSpeedMax && isAttackOrDefenseMax;

  bool get isLifeOrSpeedMax => _life == maxStat || _speed == maxStat;
  bool get isAttackOrDefenseMax => _attack == maxStat || _defense == maxStat;

  void reset() {
    _life = baseStat;
    _speed = baseStat;
    _attack = baseStat;
    _defense = baseStat;
    notifyListeners();
  }

  void toggleLife() => _boostLifeSpeed(isLife: true);
  void toggleSpeed() => _boostLifeSpeed(isLife: false);
  void toggleAttack() => _boostAttackDefense(isAttack: true);
  void toggleDefense() => _boostAttackDefense(isAttack: false);

  void _boostLifeSpeed({required bool isLife}) {
    _boostPair(
      getCurrent: () => isLife ? _life : _speed,
      setCurrent: (v) {
        if (isLife) {
          _life = v;
        } else {
          _speed = v;
        }
      },
      getOpposite: () => isLife ? _speed : _life,
      setOpposite: (v) {
        if (isLife) {
          _speed = v;
        } else {
          _life = v;
        }
      },
    );
  }

  void _boostAttackDefense({required bool isAttack}) {
    _boostPair(
      getCurrent: () => isAttack ? _attack : _defense,
      setCurrent: (v) {
        if (isAttack) {
          _attack = v;
        } else {
          _defense = v;
        }
      },
      getOpposite: () => isAttack ? _defense : _attack,
      setOpposite: (v) {
        if (isAttack) {
          _defense = v;
        } else {
          _attack = v;
        }
      },
    );
  }

  /// Equivalent of `boostStat` / `toggleStat` on the Angular side.
  void _boostPair({
    required int Function() getCurrent,
    required void Function(int) setCurrent,
    required int Function() getOpposite,
    required void Function(int) setOpposite,
  }) {
    final currentStat = getCurrent();
    if (currentStat >= maxStat) return;

    var next = currentStat + boost;
    if (next > maxStat) next = maxStat;
    setCurrent(next);

    if (getCurrent() == maxStat) {
      setOpposite(baseStat);
    }
    notifyListeners();
  }
}
