import { UserDocument } from '@app/model/database/user';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const currentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): UserDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
});
