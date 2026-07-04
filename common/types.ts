export type Game = {
    _id: string;
    name: string;
    description: string;
    gameMode: string;
    state: string;
    owner: string;
    ownerName: string;
    gridSize: number;
    nbActions: number;
    imagePayload: string;
    lastModified: string;
};

export type Position = {
    x: number;
    y: number;
};

export type AccountType = {
    username: string;
    email: string;
    avatar: string;
    uid: string;
    virtualCurrency?: number;
    ownedBackgrounds?: string[];
    selectedBackground?: string;
    ownedAvatars?: string[];
    ownedMusics?: string[];
    selectedMusic?: string;
    createdAt?: Date;
    lastLoginAt?: Date;
    status?: string;
    theme?: string;
    language?: string;
    gamesPlayedClassic?: number;
    gamesPlayedCTF?: number;
    gamesWon?: number;
    totalGameTime?: number;
    friendList?: string[];
};

export type AuthResult = {
    user?: User;
    error?: string;
};

export type User = {
    uid: string;
    email: string | null;
    displayName?: string | null;
};

export type ChatChannelMessage = {
    channelId: string;
    username: string;
    content: string;
    timestamp: string;
};

export type ChatChannelInfo = {
    _id: string;
    name: string;
    type: 'global' | 'custom';
    createdBy?: string;
    owner?: string;
}

export type ChannelDeletedPayload = {
    channelId: string;
    channelName: string;
    deletedBy: string;
}

export type TradeState = {
    roomId: string;
    playerAId: string;
    playerBId: string;
    playerAItemId?: string;
    playerBItemId?: string;
    playerAAccepted: boolean;
    playerBAccepted: boolean;
};

export type CurrencyUpdate = {
    newAmount: number;
    change: number;
};
