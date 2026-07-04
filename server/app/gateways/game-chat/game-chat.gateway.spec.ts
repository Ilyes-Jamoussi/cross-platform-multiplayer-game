import { GameChatGateway } from '@app/gateways/game-chat/game-chat.gateway';
import { MOCK_PLAYERS } from '@common/constants.spec';
import { GameChatEvents } from '@common/gateway-events';
import { MessagePayload } from '@common/interfaces';
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Server } from 'socket.io';

describe('GameChatGateway', () => {
    let gameChatGateway: GameChatGateway;
    let server: Server;
    let logger: Partial<Logger>;
    const player = MOCK_PLAYERS[0];

    beforeEach(async () => {
        logger = { log: jest.fn(), warn: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [GameChatGateway, { provide: Logger, useValue: logger }],
        }).compile();

        gameChatGateway = module.get<GameChatGateway>(GameChatGateway);
        server = { to: jest.fn().mockReturnThis(), emit: jest.fn() } as unknown as Server;
        gameChatGateway.server = server;
    });

    it('should be defined', () => {
        expect(gameChatGateway).toBeDefined();
    });

    it('should handle sending messages', () => {
        const messagePayload: MessagePayload = {
            message: { player, message: 'Hello', time: new Date().toISOString() },
            roomId: 'room1',
        };

        gameChatGateway.handleSendMessage(messagePayload);

        expect(logger.log).toHaveBeenCalledWith('Message sent by Player 1');
        expect(server.to).toHaveBeenCalledWith('room1');
        expect(server.to('room1').emit).toHaveBeenCalledWith(GameChatEvents.ReceiveMessage, messagePayload);
    });

    it('should handle sending team messages', () => {
        const messagePayload: MessagePayload = {
            message: { player, message: 'Hello team', time: new Date().toISOString() },
            roomId: 'room1-team1',
        };

        gameChatGateway.handleSendMessage(messagePayload);

        expect(server.to).toHaveBeenCalledWith('room1-team1');
        expect(server.to('room1-team1').emit).toHaveBeenCalledWith(GameChatEvents.ReceiveTeamMessage, messagePayload);
    });
});
