import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing service built on Argon2id.
 * Centralises parameters so they can be tuned in one place.
 */
@Injectable()
export class PasswordHasher {
  private readonly opts: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456, // ~19 MiB
    timeCost: 2,
    parallelism: 1,
  };

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.opts);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
