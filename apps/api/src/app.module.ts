import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { ComposeController } from './compose/compose.controller';
import { ComposeService } from './compose/compose.service';
import { SongService } from './compose/song.service';
import { VoiceController } from './voice/voice.controller';
import { VoiceService } from './voice/voice.service';
import { BuddyController } from './buddy/buddy.controller';
import { BuddyService } from './buddy/buddy.service';
import { HealthController } from './health.controller';
import { InfraModule } from './infra/infra.module';
import { InvitesController } from './invites/invites.controller';
import { InvitesService } from './invites/invites.service';
import { MediaController } from './media/media.controller';
import { MediaService } from './media/media.service';
import { SaturnController, SaturnPlazasController, SaturnUsersController } from './saturn/saturn.controller';
import { PlazaService } from './saturn/plaza.service';
import { JupiterController } from './jupiter/jupiter.controller';
import { JupiterService } from './jupiter/jupiter.service';
import { MarsController } from './mars/mars.controller';
import { MarsService } from './mars/mars.service';
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
  controllers: [HealthController, AuthController, UsersController, WalletController, BuddyController, MediaController, SaturnController, SaturnUsersController, SaturnPlazasController, JupiterController, MarsController, InvitesController, LookController, BillingController, ComposeController, VoiceController],
  providers: [AuthGuard, AuthService, UsersService, LedgerService, BuddyService, MediaService, SaturnService, PlazaService, JupiterService, MarsService, InvitesService, LookService, BillingService, ComposeService, SongService, VoiceService],
})
export class AppModule {}
