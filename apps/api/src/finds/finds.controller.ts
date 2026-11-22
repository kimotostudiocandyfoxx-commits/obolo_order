import { Body, Controller, Get, HttpCode, Post, Put, Query, UseGuards } from '@nestjs/common';
import { FindTalksQuery, FindWorksQuery, MarkNamesBody, SetItemMarkBody } from '@obolo/shared';
import { AuthGuard, UserId } from '../auth/auth.guard';
import { parseBody } from '../common/validate';
import { FindsService } from './finds.service';

/** M-R236 / M-R237: ★ and marks, their names, and finding works and past talks again (only your own) */
@Controller('finds')
@UseGuards(AuthGuard)
export class FindsController {
  constructor(private readonly finds: FindsService) {}

  @Get('marks')
  marks(@UserId() userId: string) {
    return this.finds.marks(userId);
  }

  @Post('marks')
  @HttpCode(200)
  setMark(@UserId() userId: string, @Body() body: unknown) {
    return this.finds.setMark(userId, parseBody(SetItemMarkBody, body));
  }

  @Put('mark-names')
  setNames(@UserId() userId: string, @Body() body: unknown) {
    return this.finds.setNames(userId, parseBody(MarkNamesBody, body));
  }

  /** ?planet=saturn|…&star=1&mark=spade&q=words */
  @Get('works')
  works(@UserId() userId: string, @Query() query: unknown) {
    return this.finds.works(userId, parseBody(FindWorksQuery, query));
  }

  /** ?thread=bati|<dachi thread>&star=1&mark=heart&q=words */
  @Get('talks')
  talks(@UserId() userId: string, @Query() query: unknown) {
    return this.finds.talkDays(userId, parseBody(FindTalksQuery, query));
  }
}
