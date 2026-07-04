class AppConfig {
  AppConfig._();

  // Default backend host. Override at launch time:
  //   flutter run --dart-define=SERVER_HOST=localhost
  // Android emulator reaching the host machine:
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
  static String get socketBaseUrl => 'http://$host:$_serverPort';
  static String get apiBaseUrl => '$socketBaseUrl/api';
}
