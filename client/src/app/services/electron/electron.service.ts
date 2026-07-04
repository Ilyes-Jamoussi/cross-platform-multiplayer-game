import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface ElectronAPI {
    detachChat: () => void;
    closeChatWindow: () => void;
    focusChatWindow: () => void;
    onChatDetached: (callback: () => void) => void;
    onChatReattached: (callback: () => void) => void;
    isChatDetached: () => Promise<boolean>;
    isDetachedWindow: () => Promise<boolean>;
    onAppQuitting: (callback: () => void) => void;
}

@Injectable({ providedIn: 'root' })
export class ElectronService {
    private readonly chatDetached = new BehaviorSubject<boolean>(false);

    constructor(private readonly ngZone: NgZone) {
        if (this.isElectron) {
            const api = this.api;

            api.isChatDetached().then((detached: boolean) => {
                this.ngZone.run(() => this.chatDetached.next(detached));
            });

            api.onChatDetached(() => {
                this.ngZone.run(() => this.chatDetached.next(true));
            });

            api.onChatReattached(() => {
                this.ngZone.run(() => this.chatDetached.next(false));
            });
        }
    }

    get isElectron(): boolean {
        return !!(window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    }

    get chatDetached$(): Observable<boolean> {
        return this.chatDetached.asObservable();
    }

    get isChatDetached(): boolean {
        return this.chatDetached.value;
    }

    private get api(): ElectronAPI {
        return (window as unknown as { electronAPI: ElectronAPI }).electronAPI;
    }

    detachChat(): void {
        if (this.isElectron) {
            this.api.detachChat();
        }
    }

    closeChatWindow(): void {
        if (this.isElectron) {
            this.api.closeChatWindow();
        }
    }

    focusChatWindow(): void {
        if (this.isElectron) {
            this.api.focusChatWindow();
        }
    }

    onAppQuitting(callback: () => void): void {
        if (this.isElectron) {
            this.api.onAppQuitting(() => {
                this.ngZone.run(callback);
            });
        }
    }

    async isDetachedWindow(): Promise<boolean> {
        if (!this.isElectron) return false;
        return this.api.isDetachedWindow();
    }
}
