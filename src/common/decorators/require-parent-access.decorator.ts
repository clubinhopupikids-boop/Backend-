import { SetMetadata } from '@nestjs/common';
import { REQUIRES_PARENT_ACCESS_KEY } from '../constants';

/** Marks a route as requiring the short-lived parental authorization ticket. */
export const RequireParentAccess = () => SetMetadata(REQUIRES_PARENT_ACCESS_KEY, true);
