import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guards POST /auth/login using the email+password local strategy. */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
