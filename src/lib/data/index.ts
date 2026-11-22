import { env } from '@/lib/env';
import { demoRepo } from './demo';
import { remoteRepo } from './remote';
import type { AcademyRepo } from './types';

/**
 * One switch, two implementations. The screens never know which one they have.
 */
export const repo: AcademyRepo = env.dataMode === 'remote' ? remoteRepo : demoRepo;

export type { AcademyRepo } from './types';
