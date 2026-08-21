import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants';

/**
 * Marks a route (or controller) as public — bypasses the global JWT guard.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
