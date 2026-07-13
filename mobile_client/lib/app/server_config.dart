class AppConfig {
  AppConfig._();

  // Full backend URL (scheme + host, no trailing slash). Takes precedence over
  // SERVER_HOST/SERVER_PORT. Used for production builds:
  //   flutter build apk --dart-define=SERVER_URL=https://poly-arena.onrender.com
  static const String _serverUrl = String.fromEnvironment('SERVER_URL');

  // Host/port pair kept for local development. Android emulator reaching the
  // host machine:
  //   flutter run --dart-define=SERVER_HOST=10.0.2.2
  static const String _defaultServerHost = '10.0.2.2';

  static const String _serverHost = String.fromEnvironment(
    'SERVER_HOST',
    defaultValue: _defaultServerHost,
  );
  static const String _serverPort = String.fromEnvironment(
    'SERVER_PORT',
    defaultValue: '3000',
  );

  static String get host => _serverHost;
  static String get socketBaseUrl =>
      _serverUrl.isNotEmpty ? _serverUrl : 'http://$host:$_serverPort';
  static String get apiBaseUrl => '$socketBaseUrl/api';
}
