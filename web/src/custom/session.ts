import type { CoreAdapter } from "./core/coreAdapter.js";
import {
  CanonicalSessionController,
  type CanonicalReplaySnapshot,
  type ExecutedCanonicalCommand,
  type UndoneCanonicalUnit,
} from "./core/canonicalSessionController.js";
import { customGameCanResumeWithDefinition } from "./core/scriptIdentity.js";
import type {
  Command,
  CoreResult,
  CustomScriptDefinition,
} from "./core/types.js";
import {
  CoalescingCustomSessionAutosaveQueue,
  createCustomGameFile,
  createCustomWebSessionSnapshot,
  type CustomWebSessionSnapshot,
  type CustomWebSessionStorageDriver,
} from "./storage/sessionStorage.js";

export type CustomCanonicalSessionLoadResult<SetupDraft, Presentation> =
  | { status: "missing" }
  | { status: "unreadable"; error: Error }
  | { status: "replayFailed"; error: { code: string; messageKo: string } }
  | { status: "loaded"; session: CustomCanonicalSession<SetupDraft, Presentation> };

type CustomCanonicalSessionOptions<SetupDraft, Presentation> = {
  definition: CustomScriptDefinition;
  core: CoreAdapter;
  storage: CustomWebSessionStorageDriver<SetupDraft, Presentation>;
  setupDraft: SetupDraft;
  presentation: Presentation;
  gameId?: string;
  now?: Date;
};

type CustomCanonicalSessionLoadOptions<SetupDraft, Presentation> = {
  core: CoreAdapter;
  storage: CustomWebSessionStorageDriver<SetupDraft, Presentation>;
};

export type CustomCanonicalExecution = ExecutedCanonicalCommand & {
  autosave: Promise<boolean>;
};

export type CustomCanonicalUndo = UndoneCanonicalUnit & {
  autosave: Promise<boolean>;
};

export class CustomCanonicalSession<SetupDraft, Presentation> {
  private readonly autosave: CoalescingCustomSessionAutosaveQueue<
    CustomWebSessionSnapshot<SetupDraft, Presentation>
  >;

  private constructor(
    private currentSnapshot: CustomWebSessionSnapshot<SetupDraft, Presentation>,
    private replayState: CanonicalReplaySnapshot | undefined,
    private controller: CanonicalSessionController,
    private readonly storage: CustomWebSessionStorageDriver<SetupDraft, Presentation>,
  ) {
    this.autosave = new CoalescingCustomSessionAutosaveQueue(
      (snapshot) => this.storage.saveSession(snapshot),
    );
  }

  static create<SetupDraft, Presentation>(
    options: CustomCanonicalSessionOptions<SetupDraft, Presentation>,
  ): CustomCanonicalSession<SetupDraft, Presentation> {
    const canonical = createCustomGameFile(options.definition, options.gameId, options.now);
    const snapshot = createCustomWebSessionSnapshot(
      canonical,
      options.setupDraft,
      options.presentation,
      options.now?.toISOString(),
    );
    return new CustomCanonicalSession(
      snapshot,
      undefined,
      new CanonicalSessionController(canonical.game.script, options.core),
      options.storage,
    );
  }

  static async load<SetupDraft, Presentation>(
    options: CustomCanonicalSessionLoadOptions<SetupDraft, Presentation>,
  ): Promise<CustomCanonicalSessionLoadResult<SetupDraft, Presentation>> {
    const loaded = await options.storage.loadSession();
    if (loaded.status !== "loaded") return loaded;
    const { canonical } = loaded.snapshot;
    if (canonical.game.script.type !== "custom") {
      return { status: "unreadable", error: new Error("커스텀 게임 세션이 아닙니다.") };
    }
    const controller = new CanonicalSessionController(canonical.game.script, options.core);
    const replayed = await controller.replay(canonical);
    if (!replayed.ok) return { status: "replayFailed", error: replayed.error };
    return {
      status: "loaded",
      session: new CustomCanonicalSession(
        loaded.snapshot,
        replayed.value,
        controller,
        options.storage,
      ),
    };
  }

  static async recoverWithNewGame<SetupDraft, Presentation>(
    options: CustomCanonicalSessionOptions<SetupDraft, Presentation>,
  ): Promise<CoreResult<CustomCanonicalSession<SetupDraft, Presentation>>> {
    const session = CustomCanonicalSession.create(options);
    try {
      await options.storage.replaceUnreadableSession(session.currentSnapshot);
      return { ok: true, value: session };
    } catch (error) {
      return storageFailure(error);
    }
  }

  get snapshot(): CustomWebSessionSnapshot<SetupDraft, Presentation> {
    return structuredClone(this.currentSnapshot);
  }

  canResumeWith(definition: CustomScriptDefinition): boolean {
    return customGameCanResumeWithDefinition(this.currentSnapshot.canonical, definition);
  }

  updatePresentation(presentation: Presentation): void {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      presentation: structuredClone(presentation),
    };
  }

  saveDraft(setupDraft: SetupDraft): Promise<boolean> {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      savedAt: new Date().toISOString(),
      setupDraft: structuredClone(setupDraft),
    };
    return this.autosave.enqueue(this.currentSnapshot);
  }

  async execute(command: Command): Promise<CoreResult<CustomCanonicalExecution>> {
    const executed = await this.controller.execute(
      this.currentSnapshot.canonical,
      this.replayState,
      command,
    );
    if (!executed.ok) return executed;
    this.commitCanonical(executed.value.gameFile, executed.value.replayState);
    return {
      ok: true,
      value: {
        ...executed.value,
        autosave: this.autosave.enqueue(this.currentSnapshot),
      },
    };
  }

  async confirmSetup(command: Command): Promise<CoreResult<ExecutedCanonicalCommand>> {
    const executed = await this.execute(command);
    if (!executed.ok) return executed;
    if (!await executed.value.autosave) return storageFailure();
    const { autosave: _autosave, ...durable } = executed.value;
    return { ok: true, value: durable };
  }

  async undo(expectedUnitId: string): Promise<CoreResult<CustomCanonicalUndo>> {
    const undone = await this.controller.undo(
      this.currentSnapshot.canonical,
      this.replayState,
      expectedUnitId,
    );
    if (!undone.ok) return undone;
    this.commitCanonical(undone.value.gameFile, undone.value.replayState);
    return {
      ok: true,
      value: {
        ...undone.value,
        autosave: this.autosave.enqueue(this.currentSnapshot),
      },
    };
  }

  private commitCanonical(
    gameFile: ExecutedCanonicalCommand["gameFile"],
    replayState: CanonicalReplaySnapshot,
  ): void {
    this.currentSnapshot = {
      ...this.currentSnapshot,
      savedAt: new Date().toISOString(),
      canonical: gameFile.schemaVersion === 4
        ? structuredClone(gameFile)
        : createCustomGameFileFromUnexpectedLegacy(gameFile),
    };
    this.replayState = replayState;
  }
}

function createCustomGameFileFromUnexpectedLegacy(
  _gameFile: ExecutedCanonicalCommand["gameFile"],
): never {
  throw new Error("커스텀 canonical session은 schema v4 GameFile만 지원합니다.");
}

function storageFailure<T>(cause?: unknown): CoreResult<T> {
  return {
    ok: false,
    error: {
      code: "STORAGE_WRITE_FAILED",
      messageKo: cause instanceof Error ? cause.message : "게임을 저장하지 못했습니다.",
    },
  };
}
