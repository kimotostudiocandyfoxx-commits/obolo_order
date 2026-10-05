import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BuddyController } from './buddy/buddy.controller';
import { BuddyService } from './buddy/buddy.service';
import { HealthController } from './health.controller';
import { InfraModule } from './infra/infra.module';
import { InvitesController } from './invites/invites.controller';
import { InvitesService } from './invites/invites.service';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { SaturnController } from './saturn/saturn.controller';
import { SaturnService } from './saturn/saturn.service';
import { LookController } from './look/look.controller';
import { LookService } from './look/look.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { LedgerService } from './wallet/ledger.service';
import { WalletController } from './wallet/wallet.controller';

/** One module for the demo; split per planet (spec §4.3) as the surface grows. */
@Module({
  imports: [InfraModule],
  controllers: [HealthController, AuthController, UsersController, WalletController, BuddyController, MediaController, SaturnController, InvitesController, LookController],
  providers: [AuthGuard, AuthService, UsersService, LedgerService, BuddyService, MediaService, SaturnService, InvitesService, LookService],
})
export class AppModule {}
