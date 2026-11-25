import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StorageExpandBody, StorageToldBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { StorageWorksService } from './storage-works.service';
import { StorageService } from './storage.service';

/** R18: Bluena's room and 保存の魔法 (docs/マナの値段.md 13.) */
@Controller('storage')
@UseGuards(AuthGuard)
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly works: StorageWorksService,
  ) {}

  /** the calm bar (used / room), the tiers and their mana, the plan, a notice for {bati} to say once */
  @Get()
  status(@UserId() userId: string) {
    return this.storage.status(userId);
  }

  /** the yes to a tier (a full month now, then at the start of each month) */
  @Post('expand')
  expand(@UserId() userId: string, @Body() body: unknown) {
    return this.storage.expand(userId, parseBody(StorageExpandBody, body));
  }

  /** 「保存の魔法をやめて」: ends at the month's end */
  @Post('cancel')
  cancel(@UserId() userId: string) {
    return this.storage.cancel(userId);
  }

  /** {bati} said the notice */
  @Post('told')
  async told(@UserId() userId: string, @Body() body: unknown) {
    await this.storage.told(userId, parseBody(StorageToldBody, body).what);
    return { ok: true };
  }

  /** Bluena's 〔消す〕: the work, its tries and its files (the room comes back) */
  @Delete('works/:kind/:id')
  remove(@UserId() userId: string, @Param('kind') kind: string, @Param('id') id: string) {
    return this.works.remove(userId, kind, id);
  }
}
