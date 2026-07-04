import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SocketService } from '@app/services/socket/socket.service';
import { VirtualCurrencyEvents } from '@common/gateway-events';
import { AccountType, CurrencyUpdate } from '@common/types';
import { User, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { firebaseAuth } from './firebase.config';

@Injectable({
    providedIn: 'root',
})
export class AuthService {
    currentUser$: Observable<User | null>;
    userProfile$: Observable<AccountType | null>;
    currencyChange$: Observable<number>;

    private readonly currentUserSubject = new BehaviorSubject<User | null>(null);
    private readonly userProfileSubject = new BehaviorSubject<AccountType | null>(null);
    private readonly currencyChangeSubject = new BehaviorSubject<number>(0);
    private readonly apiUrl = environment.serverUrl + '/auth';
    private readonly http = inject(HttpClient);
    private readonly socketService = inject(SocketService);
    private sessionToken: string | null = null;

    constructor() {
        this.currentUser$ = this.currentUserSubject.asObservable();
        this.userProfile$ = this.userProfileSubject.asObservable();
        this.currencyChange$ = this.currencyChangeSubject.asObservable();
        this.listenForCurrencyUpdates();

        onAuthStateChanged(firebaseAuth, (user) => {
            this.currentUserSubject.next(user);
            if (user) {
                user.getIdToken()
                    .then((token) => {
                        localStorage.setItem('firebaseToken', token);
                    })
                    .catch(() => {
                        // Token retrieval failed
                    });
                if (!this.sessionToken) {
                    this.sessionToken = localStorage.getItem('sessionToken');
                }
                void this.loadUserProfile();
            } else {
                this.userProfileSubject.next(null);
                this.clearCurrencyChangeIndicator();
                this.clearSession();
            }
        });
    }

    get currentUserProfile(): AccountType | null {
        return this.userProfileSubject.value;
    }

    async getToken(): Promise<string | null> {
        const user = firebaseAuth.currentUser;
        if (user) {
            return user.getIdToken();
        }
        return null;
    }

    getFirebaseUid(): string | null {
        return this.currentUserSubject.value?.uid || null;
    }

    getSessionToken(): string | null {
        return this.sessionToken;
    }

    async handleLogin(email: string, password: string): Promise<{ user?: User; error?: string }> {
        try {
            const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
            const loginResponse = await this.http
                .post<{ user: AccountType; sessionToken: string }>(`${this.apiUrl}/login`, { uid: credential.user.uid })
                .toPromise();

            if (loginResponse) {
                this.sessionToken = loginResponse.sessionToken;
                localStorage.setItem('sessionToken', this.sessionToken);
                this.clearCurrencyChangeIndicator();
                this.userProfileSubject.next(loginResponse.user);
            }

            return { user: credential.user };
        } catch (error: unknown) {
            await firebaseAuth.signOut();

            const httpError = error as { error?: { message?: string } };
            if (httpError.error?.message) {
                return { error: httpError.error.message };
            }
            return { error: this.getFirebaseErrorMessage(error) };
        }
    }

    async register(username: string, password: string, email: string, avatar: string): Promise<{ user?: User; error?: string }> {
        try {
            const checkResponse = await this.http.post<{ available: boolean }>(`${this.apiUrl}/check-username`, { username }).toPromise();

            if (!checkResponse?.available) {
                return { error: 'server_msg.username_taken' };
            }

            const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
            const response = await this.http
                .post<{ user: AccountType; sessionToken: string }>(`${this.apiUrl}`, {
                    uid: credential.user.uid,
                    username,
                    email,
                    avatar,
                })
                .toPromise();

            if (response) {
                this.sessionToken = response.sessionToken;
                localStorage.setItem('sessionToken', this.sessionToken);
                this.clearCurrencyChangeIndicator();
                this.userProfileSubject.next(response.user);
            }

            return { user: credential.user };
        } catch (error: unknown) {
            await firebaseAuth.signOut();

            const httpError = error as { error?: { message?: string } };
            if (httpError.error?.message) {
                return { error: httpError.error.message };
            }
            return { error: this.getFirebaseErrorMessage(error) };
        }
    }

    async handleLogout(): Promise<void> {
        if (this.sessionToken) {
            try {
                await this.http.post(`${this.apiUrl}/logout`, {}).toPromise();
            } catch {
                // Invalid session or unreachable server, continue anyway
            }
        }
        await this.clearSessionAndSignOut();
    }

    sendLogoutBeacon(): void {
        if (!this.sessionToken || !firebaseAuth.currentUser) {
            return;
        }

        const token = localStorage.getItem('firebaseToken');
        if (token) {
            const headers = new Headers();
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${token}`);
            headers.append('x-session-token', this.sessionToken);

            fetch(`${this.apiUrl}/logout`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
                keepalive: true,
            }).catch(() => {
                // Logout beacon failed
            });
        }
        this.clearSession();
    }

    async clearSessionAndSignOut(): Promise<void> {
        this.clearSession();
        await firebaseAuth.signOut();
    }

    updateAccountMongoDB(updates: {
        username?: string;
        email?: string;
        avatar?: string;
        selectedBackground?: string;
        selectedMusic?: string;
    }): Observable<AccountType> {
        return this.http.put<AccountType>(`${this.apiUrl}`, updates);
    }

    checkEmailAvailability(email: string): Observable<{ available: boolean }> {
        return this.http.post<{ available: boolean }>(`${this.apiUrl}/check-email`, { email });
    }

    deleteAccount(): Observable<unknown> {
        return this.http.delete(`${this.apiUrl}`);
    }

    purchaseBackground(backgroundId: string, price: number): Observable<AccountType> {
        return this.http.post<AccountType>(`${this.apiUrl}/purchase-background`, { backgroundId, price });
    }

    purchaseAvatar(avatarName: string, price: number): Observable<AccountType> {
        return this.http.post<AccountType>(`${this.apiUrl}/purchase-avatar`, { avatarName, price });
    }

    purchaseMusic(musicId: string, price: number): Observable<AccountType> {
        return this.http.post<AccountType>(`${this.apiUrl}/purchase-music`, { musicId, price });
    }

    updateTheme(theme: string): Observable<AccountType> {
        return this.http.post<AccountType>(`${this.apiUrl}/change-theme`, { theme });
    }
    updateLang(language: string): Observable<AccountType> {
        return this.http.post<AccountType>(`${this.apiUrl}/change-language`, { language });
    }

    refreshUserProfile(profile: AccountType) {
        this.userProfileSubject.next(profile);
    }

    /** Resets the last currency delta shown in the shop header so it is not replayed on the next subscription (e.g. returning to home). */
    clearCurrencyChangeIndicator(): void {
        this.currencyChangeSubject.next(0);
    }

    loadUserProfile() {
        this.http.get<AccountType>(`${this.apiUrl}`).subscribe({
            next: (profile) => this.userProfileSubject.next(profile),
            error: () => {
                if (!this.userProfileSubject.value) {
                    this.userProfileSubject.next(null);
                }
            },
        });
    }

    private clearSession(): void {
        this.sessionToken = null;
        localStorage.removeItem('firebaseToken');
        localStorage.removeItem('sessionToken');
    }

    private getFirebaseErrorMessage(error: unknown): string {
        const firebaseError = error as { code?: string };
        switch (firebaseError.code) {
            case 'auth/invalid-email':
                return 'server_msg.invalid_email_firebase';
            case 'auth/user-disabled':
                return 'server_msg.user_disabled';
            case 'auth/user-not-found':
                return 'server_msg.user_not_found';
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'server_msg.wrong_password';
            case 'auth/email-already-in-use':
                return 'server_msg.email_already_in_use';
            case 'auth/weak-password':
                return 'server_msg.weak_password';
            case 'auth/too-many-requests':
                return 'server_msg.too_many_requests';
            case 'auth/network-request-failed':
                return 'server_msg.network_error';
            default:
                return 'server_msg.generic_error';
        }
    }

    private listenForCurrencyUpdates() {
        this.socketService.on<CurrencyUpdate>(VirtualCurrencyEvents.CurrencyUpdate, (data) => {
            const currentProfile = this.userProfileSubject.value;
            if (currentProfile) {
                this.userProfileSubject.next({ ...currentProfile, virtualCurrency: data.newAmount });
            }
            this.currencyChangeSubject.next(data.change);
        });
    }
}
