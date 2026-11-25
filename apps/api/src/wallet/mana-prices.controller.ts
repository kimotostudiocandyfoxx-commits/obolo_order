import { Controller, Get } from '@nestjs/common';
import type { ManaPrices } from '@obolo/shared';
import { CostService } from './cost.service';

/**
 * GET /mana/prices — the mana of each making now (the confirm card shows exactly this, and exactly this is charged).
 * Public numbers (no login): nothing about a member.
 */
@Controller('mana')
export class ManaPricesController {
  constructor(private readonly costs: CostService) {}

  @Get('prices')
  async prices(): Promise<{ prices: ManaPrices }> {
    // R17: the secret spell is not in the public list (its price comes only with a member's passphrase: POST /moon/incant)
    const { songPremium: _hidden, ...open } = await this.costs.prices();
    return { prices: open as ManaPrices };
  }
}
