import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { AdminMediaR2Controller } from './admin/media-r2.controller';
import { AdminReportsController } from './admin/reports.controller';
import { CommsController } from './comms/comms.controller';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';
import { CommsService } from './comms/comms.service';
import { ComposeController } from './compose/compose.controller';
import { ComposeService } from './compose/compose.service';
import { SongService } from './compose/song.service';
import { SongTweakService } from './compose/song-tweak.service';
import { SongVoiceService } from './compose/song-voice.service';
import { SongTitleVoiceService } from './compose/song-title-voice.service';
import { TitleVoiceBackfillController } from './compose/title-voice-backfill.controller';
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
import { MicDiagController } from './diag/mic-diag.controller';
import { DachiController } from './dachi/dachi.controller';
import { DachiService } from './dachi/dachi.service';
import { DachiLinkService } from './dachi/dachi-link.service';
import { DachiVoiceService } from './dachi/dachi-voice.service';
import { DachiVoiceDraftService } from './dachi/voice-draft.service';
import { FindsController } from './finds/finds.controller';
import { FindsService } from './finds/finds.service';
import { MoonWorksController } from './moon/moon-works.controller';
import { MoonWorksService } from './moon/moon-works.service';
import { SpellController } from './moon/spell.controller';
import { SpellService } from './moon/spell.service';
import { IncantService } from './moon/incant.service';
import { LyricsService } from './moon/lyrics.service';
import { ArtTitleService } from './moon/art-title.service';
import { SpellToolsController } from './moon/spell-tools.controller';
import { SpellBookService } from './moon/spell-book.service';
import { MoonCompassService } from './moon/moon-compass.service';
import { CraftController } from './craft/craft.controller';
import { GameService } from './craft/game.service';
import { GoodsService } from './craft/goods.service';
import { NovelService } from './craft/novel.service';
import { InfraModule } from './infra/infra.module';
import { LinksController } from './links/links.controller';
import { LinksService } from './links/links.service';
import { InvitesController } from './invites/invites.controller';
import { InvitesService } from './invites/invites.service';
import { MediaController } from './media/media.controller';
import { FilesController } from './media/files.controller';
import { FilesService } from './media/files.service';
import { MediaService } from './media/media.service';
import { R2MoveService } from './media/r2-move.service';
import { SaturnController, SaturnPlazasController, SaturnUsersController } from './saturn/saturn.controller';
import { PlazaService } from './saturn/plaza.service';
import { JupiterController } from './jupiter/jupiter.controller';
import { JupiterService } from './jupiter/jupiter.service';
import { MarsController } from './mars/mars.controller';
import { PlanetPostsController } from './planets/planet-posts.controller';
import { PlanetPostsService } from './planets/planet-posts.service';
import { OshiController, PlanetHomeController } from './planets/planet-home.controller';
import { ChangeablesController } from './planets/changeables.controller';
import { PlanetHomeService } from './planets/planet-home.service';
import { WorkSafetyController } from './planets/work-safety.controller';
import { WorkSafetyService } from './planets/work-safety.service';
import { ContinentsController, PlanetSongsController, PlanetWorksAdminController, PlanetWorksController } from './planets/continents.controller';
import { PlanetSongsService } from './planets/planet-songs.service';
import { ContinentsService } from './planets/continents.service';
import { PlanetWorksService } from './planets/planet-works.service';
import { AdminRadioController, BluenaController, RadioController } from './radio/radio.controller';
import { RadioService } from './radio/radio.service';
import { MarsService } from './mars/mars.service';
import { InternalJobsController, JobsController } from './jobs/jobs.controller';
import { JobsService } from './jobs/jobs.service';
import { MvController } from './mv/mv.controller';
import { MvService } from './mv/mv.service';
import { SaturnService } from './saturn/saturn.service';
import { LookController } from './look/look.controller';
import { ChibiBackfillController } from './look/chibi-backfill.controller';
import { LookService } from './look/look.service';
import { LookStepsService } from './look/steps.service';
import { PlanetFiguresService } from './look/figures.service';
import { BatiMemoryService } from './look/memory.service';
import { UsersController } from './users/users.controller';
import { TesterController } from './users/tester.controller';
import { TesterService } from './users/tester.service';
import { UsersService } from './users/users.service';
import { LedgerService } from './wallet/ledger.service';
import { ManaAdminController } from './wallet/mana-admin.controller';
import { ManaCheckService } from './wallet/mana-check.service';
import { CostService } from './wallet/cost.service';
import { AccessService, SpendGate } from './wallet/access.service';
import { ManaPricesController } from './wallet/mana-prices.controller';
import { WalletController } from './wallet/wallet.controller';

import { StorageController } from './storage/storage.controller';
import { StorageGate, StorageService } from './storage/storage.service';
import { StorageWorksService } from './storage/storage-works.service';

/** One module for the demo; split per planet (spec §4.3) as the surface grows. */
@Module({
  imports: [InfraModule],
  controllers: [
    HealthController,
    MicDiagController,
    AuthController,
    UsersController,
    TesterController,
    WalletController,
    ManaAdminController,
    BuddyController,
    // before MediaController: GET /media/files must not be read as GET /media/:id
    FilesController,
    MediaController,
    SaturnController,
    SaturnUsersController,
    SaturnPlazasController,
    JupiterController,
    MarsController,
    PlanetPostsController,
    WorkSafetyController,
    ContinentsController,
    PlanetWorksController,
    PlanetSongsController,
    PlanetWorksAdminController,
    PlanetHomeController,
    ChangeablesController,
    OshiController,
    RadioController,
    BluenaController,
    AdminRadioController,
    InvitesController,
    LookController,
    ChibiBackfillController,
    TitleVoiceBackfillController,
    BillingController,
    ComposeController,
    VoiceController,
    CommsController,
    AdminMediaR2Controller,
    AdminReportsController,
    PushController,
    MvController,
    JobsController,
    InternalJobsController,
    DachiController,
    FindsController,
    MoonWorksController,
    SpellController,
    SpellToolsController,
    CraftController,
    LinksController,
    ManaPricesController,
    StorageController,
  ],
  providers: [
    AuthGuard,
    AuthService,
    UsersService,
    TesterService,
    LedgerService,
    ManaCheckService,
    CostService,
    AccessService,
    // R18: the making-side requests of a non-member at 0 mana stop (after the guards: the member is known)
    { provide: APP_INTERCEPTOR, useClass: SpendGate },
    // R18: Bluena's room (ふくろの魔法); a full Bluena stops the making-side writes
    StorageService,
    StorageWorksService,
    { provide: APP_INTERCEPTOR, useClass: StorageGate },
    BuddyService,
    PictureService,
    CompassService,
    StoryService,
    MediaService,
    FilesService,
    // Bunny → R2: the background copy (R2_MIGRATE) and its admin endpoints
    R2MoveService,
    SaturnService,
    PlazaService,
    JupiterService,
    MarsService,
    PlanetPostsService,
    WorkSafetyService,
    PlanetWorksService,
    ContinentsService,
    PlanetSongsService,
    PlanetHomeService,
    RadioService,
    InvitesService,
    LookService,
    LookStepsService,
    PlanetFiguresService,
    BatiMemoryService,
    BillingService,
    ComposeService,
    SongService,
    SongTweakService,
    SongVoiceService,
    SongTitleVoiceService,
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
    DachiVoiceDraftService,
    FindsService,
    MoonWorksService,
    SpellService,
    IncantService,
    LyricsService,
    ArtTitleService,
    SpellBookService,
    MoonCompassService,
    NovelService,
    GameService,
    GoodsService,
    LinksService,
  ],
})
export class AppModule {}
