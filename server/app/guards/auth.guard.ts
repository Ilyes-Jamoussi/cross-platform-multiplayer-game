import { BEARER_PREFIX } from '@app/constants/auth-constants';
import { AUTH_MESSAGES } from '@app/constants/messages';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '@app/services/auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        const sessionToken = request.headers['x-session-token'];

        if (!authHeader || !authHeader.startsWith(BEARER_PREFIX)) {
            throw new UnauthorizedException(AUTH_MESSAGES.noToken);
        }

        if (!sessionToken) {
            throw new UnauthorizedException(AUTH_MESSAGES.noSessionToken);
        }

        const token = authHeader.split(BEARER_PREFIX)[1];

        try {
            const decodedToken = await this.authService.verifyToken(token);
            const user = await this.authService.findByFirebaseUid(decodedToken.uid);

            if (!user) {
                throw new UnauthorizedException(AUTH_MESSAGES.userNotFound);
            }

            const isValidSession = await this.authService.validateSession(decodedToken.uid, sessionToken);
            if (!isValidSession) {
                throw new UnauthorizedException(AUTH_MESSAGES.invalidSession);
            }

            request.user = user;
            return true;
        } catch (error) {
            throw new UnauthorizedException(AUTH_MESSAGES.invalidToken);
        }
    }
}
