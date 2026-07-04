import 'package:flutter/material.dart';

import 'login_page.dart';

/// Route alias: same screen as login, registration mode (Angular `isRegistering`).
class RegisterPage extends StatelessWidget {
  const RegisterPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const LoginPage(initialRegistering: true);
  }
}
