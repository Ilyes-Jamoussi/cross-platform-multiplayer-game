import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import 'package:mobile_client/app/server_config.dart';

typedef SocketCallback = void Function(dynamic data);

class SocketService {
  SocketService({String? url})
      : _baseUrl = (url == null || url.isEmpty) ? _defaultUrl : url;

  static String get _defaultUrl => AppConfig.socketBaseUrl;

  final String _baseUrl;
  io.Socket? _socket;
  bool _isDisposed = false;
  final ValueNotifier<bool> connectionState = ValueNotifier<bool>(false);

  bool get isConnected => _socket?.connected ?? false;

  /// Socket.IO client identifier (equivalent of `socket.id` in the Angular `PlayerService`).
  String? get socketId => _socket?.id;

  Future<void> connect() async {
    if (_isDisposed) return;

    if (_socket == null) {
      _socket = io.io(
        _baseUrl,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .disableAutoConnect()
            .build(),
      );

      _socket!.onConnect((_) {
        _setConnectionState(true);
        if (kDebugMode) {
          debugPrint('Socket connected');
        }
      });

      _socket!.onDisconnect((_) {
        _setConnectionState(false);
        if (kDebugMode) {
          debugPrint('Socket disconnected');
        }
      });

      _socket!.onConnectError((error) {
        _setConnectionState(false);
        if (kDebugMode) {
          debugPrint('Socket connect error: $error');
        }
      });
    }

    if (!isConnected) {
      _socket!.connect();
    }

    _setConnectionState(isConnected);
  }

  void emit(String event, dynamic data) {
    if (_isDisposed) return;
    _socket?.emit(event, data);
  }

  void on(String event, SocketCallback callback) {
    if (_isDisposed) return;
    _socket?.on(event, callback);
  }

  void off(String event, SocketCallback callback) {
    if (_isDisposed) return;
    _socket?.off(event, callback);
  }

  /// Removes all listeners for this event.
  void offAll(String event) {
    if (_isDisposed) return;
    _socket?.off(event);
  }

  void disconnect() {
    if (_isDisposed) return;
    _socket?.disconnect();
    _setConnectionState(false);
  }

  void dispose() {
    if (_isDisposed) return;

    _setConnectionState(false);
    _isDisposed = true;

    _socket?.dispose();
    _socket = null;
    connectionState.dispose();
  }

  void _setConnectionState(bool value) {
    if (_isDisposed) return;
    connectionState.value = value;
  }
}
