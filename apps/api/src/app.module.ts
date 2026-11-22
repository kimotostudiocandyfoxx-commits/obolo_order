import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { AdminReportsController } from './admin/reports.controller';
import { CommsController } from './comms/comms.controller';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { CommsService } from './comms/comms.service';
import { ComposeController } from './compose/compose.controller';
import { ComposeService } from './compose/compose.service';
import { SongService } from './compose/song.service';
import { VoiceController } from './voice/voice.controller';
import { LineVoiceService } from './voice/line-voice.service';
import { VoiceService } from './voice/voice.service';
import { BatiVoiceService } from './voice/bati-voice.service';
import { fishVoiceModels, VOICE_MODELS } from './voice/voice-models';
import { AppConfig, CONFIG } from './config';
import { BuddyController } from './buddy/buddy.controller';
import { BuddyService } from './buddy/buddy.service';
import { CompassService } from './buddy/compass.service';
import { StoryService } from './buddy/story.service';
import { PictureService } from './buddy/picture.service';
import { HealthController } from './health.controller';
import { DachiController } from './dachi/dachi.controller';
import { DachiService } from './dachi/dachi.service';
import { DachiLinkService } from './dachi/dachi-link.service';
import { DachiVoiceService } from './dachi/dachi-voice.service';
import { FindsController } from './finds/finds.controller';
import { FindsService } from './finds/finds.service';
import { MoonWorksController } from './moon/moon-works.controller';
import { MoonWorksService } from './moon/moon-works.service';
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
import { PlanetPostsController } from './planets/planet-posts.controller';
import { PlanetPostsService } from './planets/planet-posts.service';
import { WorkSafetyController } from './planets/work-safety.controller';
import { WorkSafetyService } from './planets/work-safety.service';
import { AdminRadioController, BluenaController, RadioController } from './radio/radio.controller';
import { RadioService } from './radio/radio.service';
import { MarsService } from './mars/mars.service';
import { InternalJobsController, JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { MvController } from './mv/mv.controller';
import { MvService } from './mv/mv.service';
import { SaturnService } from './saturn/saturn.service';
import { LookController } from './look/look.controller';
import { LookService } from './look/look.service';
import { BatiMemoryService } from './look/memory.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { LedgerService } from './wallet/ledger.service';
import { ManaAdminController } from './wallet/mana-admin.controller';
import { ManaCheckService } from './wallet/mana-check.service';
import { WalletController } from './wallet/wallet.controller';

/** One module for the demo; split per planet (spec §4.3) as the surface grows. */
@Module({
  imports: [InfraModule],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    WalletController,
    ManaAdminController,
    BuddyController,
    MediaController,
    SaturnController,
    SaturnUsersController,
    SaturnPlazasController,
    JupiterController,
    MarsController,
    PlanetPostsController,
    WorkSafetyController,
    RadioController,
    BluenaController,
    AdminRadioController,
    InvitesController,
    LookController,
    BillingController,
    ComposeController,
    VoiceController,
    CommsController,
    AdminReportsController,
    PushController,
    MvController,
    JobsController,
    InternalJobsController,
    DachiController,
    FindsController,
    MoonWorksController,
  ],
  providers: [
    AuthGuard,
    AuthService,
    UsersService,
    LedgerService,
    ManaCheckService,
    BuddyService,
    PictureService,
    CompassService,
    StoryService,
    MediaService,
    SaturnService,
    PlazaService,
    JupiterService,
    MarsService,
    PlanetPostsService,
    WorkSafetyService,
    RadioService,
    InvitesService,
    LookService,
    BatiMemoryService,
    BillingService,
    ComposeService,
    SongService,
    VoiceService,
    LineVoiceService,
    BatiVoiceService,
    { provide: VOICE_MODELS, inject: [CONFIG], useFactory: (c: AppConfig) => fishVoiceModels(c) },
    CommsService,
    PushService,
    MvService,
    JobsService,
    DachiService,
    DachiLinkService,
    DachiVoiceService,
    FindsService,
    MoonWorksService,
  ],
})
export class AppModule {}
