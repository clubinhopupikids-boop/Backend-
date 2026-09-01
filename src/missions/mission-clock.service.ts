import { Injectable } from '@nestjs/common';

@Injectable()
export class MissionClock {
  now(): Date {
    return new Date();
  }
}
