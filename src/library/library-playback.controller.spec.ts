import { Reflector } from '@nestjs/core';
import { REQUIRES_PARENT_ACCESS_KEY } from 'src/common/constants';
import { LibraryPlaybackController } from './library-playback.controller';

describe('LibraryPlaybackController security contract', () => {
  it('uses the normal JWT guard but does not require the parent access token', () => {
    const reflector = new Reflector();

    for (const handler of [
      LibraryPlaybackController.prototype.start,
      LibraryPlaybackController.prototype.complete,
    ]) {
      expect(
        reflector.getAllAndOverride<boolean>(REQUIRES_PARENT_ACCESS_KEY, [
          handler,
          LibraryPlaybackController,
        ]),
      ).not.toBe(true);
    }
  });
});
