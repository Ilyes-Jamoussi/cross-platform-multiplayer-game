import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';

/// Automatically logs the user out when the application is closed.
class AppLifecycleLogout extends StatefulWidget {
  const AppLifecycleLogout({super.key, required this.child});

  final Widget child;

  @override
  State<AppLifecycleLogout> createState() => _AppLifecycleLogoutState();
}

class _AppLifecycleLogoutState extends State<AppLifecycleLogout>
    with WidgetsBindingObserver {
  AuthService? _authService;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _authService = context.read<AuthService>();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.detached) {
      final authService = _authService;
      if (authService != null && authService.sessionToken != null) {
        authService.logout().catchError((_) {});
      }
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
