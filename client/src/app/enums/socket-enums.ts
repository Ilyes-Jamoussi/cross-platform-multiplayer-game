export enum SocketListen {
    Disconnect = 'disconnect',
    WebSocket = 'websocket',
    Connect = 'connect',
    ConnectError = 'connect_error',
}

export enum FriendSocketEvents {
    RequestNotification = 'requestNotification',
    RequestReply = 'requestReply',
    RegisterFriendSocket = 'registerFriendSocket',
    StatusUpdate = 'statusUpdate',
}
