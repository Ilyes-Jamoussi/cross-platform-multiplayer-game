import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

typedef ShakeCallback = void Function();

class ShakeService {
  ShakeService({
    this.threshold = 15.0,
    this.cooldown = const Duration(milliseconds: 500),
  });

  final double threshold;
  final Duration cooldown;

  ShakeCallback? onVerticalShake;
  ShakeCallback? onHorizontalShake;

  double _lastX = 0;
  double _lastY = 0;

  DateTime? _lastVerticalShakeTime;
  DateTime? _lastHorizontalShakeTime;

  StreamSubscription<AccelerometerEvent>? _sub;

  void start() {
    if (_sub != null) {
      return;
    }

    try {
      _sub = accelerometerEvents.listen(
        (event) {
          final now = DateTime.now();

          final deltaX = event.x - _lastX;
          final deltaY = event.y - _lastY;

          _lastX = event.x;
          _lastY = event.y;

          if (deltaY.abs() > threshold && deltaY.abs() > deltaX.abs()) {
            if (_lastVerticalShakeTime == null ||
                now.difference(_lastVerticalShakeTime!) >= cooldown) {
              _lastVerticalShakeTime = now;
              onVerticalShake?.call();
            }
          } else if (deltaX.abs() > threshold && deltaX.abs() > deltaY.abs()) {
            if (_lastHorizontalShakeTime == null ||
                now.difference(_lastHorizontalShakeTime!) >= cooldown) {
              _lastHorizontalShakeTime = now;
              onHorizontalShake?.call();
            }
          }
        },
        onError: (Object error, StackTrace stackTrace) {
          _sub?.cancel();
          _sub = null;
          if (kDebugMode) {
            debugPrint('ShakeService disabled (stream error): $error');
          }
        },
        cancelOnError: true,
      );
    } on MissingPluginException catch (error) {
      if (kDebugMode) {
        debugPrint('ShakeService disabled (missing plugin): $error');
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint('ShakeService disabled (unexpected error): $error');
      }
    }
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }
}
