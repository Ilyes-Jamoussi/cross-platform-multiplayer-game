import { TestBed } from '@angular/core/testing';
import { SocketService } from './socket.service';
import { Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';

describe('SocketService', () => {
    let service: SocketService;
    let mockSocket: jasmine.SpyObj<Socket>;

    beforeEach(() => {
        mockSocket = jasmine.createSpyObj('Socket', ['connect', 'disconnect', 'on', 'off', 'emit', 'once']);
        mockSocket.connected = false;
        mockSocket.id = 'test-socket-id';

        TestBed.configureTestingModule({
            providers: [SocketService, { provide: 'io', useValue: jasmine.createSpy('io').and.returnValue(mockSocket) }],
        });

        service = TestBed.inject(SocketService);
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).socket = mockSocket;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should connect if not already connected', () => {
        service.connect();
        expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should not connect if already connected', () => {
        mockSocket.connected = true;
        service.connect();
        expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it('should disconnect', () => {
        service.disconnect();
        expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should return connection status observable', (done) => {
        service.isConnected().subscribe((status) => {
            expect(status).toBeFalse();
            done();
        });
    });

    it('should add event listener', () => {
        const callback = jasmine.createSpy('callback');
        service.on('test-event', callback);
        expect(mockSocket.on).toHaveBeenCalledWith('test-event', callback);
    });

    it('should remove event listener', () => {
        const callback = jasmine.createSpy('callback');
        service.off('test-event', callback);
        expect(mockSocket.off).toHaveBeenCalledWith('test-event', callback);
    });

    it('should send message immediately when connected', () => {
        mockSocket.connected = true;
        service.sendMessage('test-event', { data: 'test' });
        expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should defer emit until connect when not connected', () => {
        mockSocket.connected = false;
        service.sendMessage('test-event', { data: 'test' });
        expect(mockSocket.connect).toHaveBeenCalled();
        expect(mockSocket.once).toHaveBeenCalledWith('connect', jasmine.any(Function));
        expect(mockSocket.emit).not.toHaveBeenCalled();

        const onceCallback = mockSocket.once.calls.argsFor(0)[1] as () => void;
        onceCallback();
        expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should get socket id', () => {
        expect(service.getSocketId()).toBe('test-socket-id');
    });

    it('should setup socket listeners', () => {
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).setupSocketListeners();
        expect(mockSocket.on).toHaveBeenCalledWith('connect', jasmine.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', jasmine.any(Function));
        expect(mockSocket.on).toHaveBeenCalledWith('connect_error', jasmine.any(Function));
    });

    it('should update connection status on connect', () => {
        const connectionStatus = new BehaviorSubject<boolean>(false);
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).connectionStatus = connectionStatus;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).setupSocketListeners();

        const connectCallback = mockSocket.on.calls.argsFor(0)[1];
        connectCallback();

        expect(connectionStatus.value).toBeTrue();
    });

    it('should update connection status on disconnect', () => {
        const connectionStatus = new BehaviorSubject<boolean>(true);
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).connectionStatus = connectionStatus;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).setupSocketListeners();

        const disconnectCallback = mockSocket.on.calls.argsFor(1)[1];
        disconnectCallback();

        expect(connectionStatus.value).toBeFalse();
    });

    it('should update connection status on connect error', () => {
        const connectionStatus = new BehaviorSubject<boolean>(true);
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).connectionStatus = connectionStatus;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        (service as any).setupSocketListeners();

        const errorCallback = mockSocket.on.calls.argsFor(2)[1];
        errorCallback();

        expect(connectionStatus.value).toBeFalse();
    });
});
