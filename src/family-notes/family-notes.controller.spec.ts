import { ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_PARENT_ACCESS_KEY } from 'src/common/constants';
import { ParentAccessGuard } from 'src/common/guards/parent-access.guard';
import { ParentAccessTokenService } from 'src/parent-access/parent-access-token.service';
import { CreateFamilyNoteDto } from './dto/family-note.dto';
import { FamilyNotesController } from './family-notes.controller';

describe('FamilyNotesController security contract', () => {
  it('marks every endpoint in the controller as requiring parent access', () => {
    const reflector = new Reflector();
    expect(
      reflector.getAllAndOverride<boolean>(REQUIRES_PARENT_ACCESS_KEY, [
        FamilyNotesController.prototype.list,
        FamilyNotesController,
      ]),
    ).toBe(true);
  });

  it('rejects the endpoint when the normal JWT has no parent access token', async () => {
    const reflector = new Reflector();
    const tokens = { verify: jest.fn() };
    const guard = new ParentAccessGuard(reflector, tokens as unknown as ParentAccessTokenService);
    const context = {
      getHandler: () => FamilyNotesController.prototype.list,
      getClass: () => FamilyNotesController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {}, user: { id: 'responsible-1' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokens.verify).not.toHaveBeenCalled();
  });

  it('forbids responsibleId supplied by the client body', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        {
          text: 'Momento',
          clientRequestId: '11111111-1111-4111-8111-111111111111',
          responsibleId: 'responsible-2',
        },
        { type: 'body', metatype: CreateFamilyNoteDto },
      ),
    ).rejects.toThrow();
  });
});
