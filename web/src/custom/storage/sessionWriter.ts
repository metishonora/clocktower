import type { CustomWebSessionSnapshot, CustomWebSessionStorageDriver } from './sessionStorage.js';

type Slot = { owner: symbol; tail: Promise<void> };
const slots = new Map<string, Slot>();
/** One write boundary per slot. Revoked leases never enqueue or publish a late save. */
export class CustomSessionWriter<S, P> implements CustomWebSessionStorageDriver<S, P> {
  private readonly token = Symbol('custom session writer');
  private slot?: Slot;
  private expected?: CustomWebSessionSnapshot<S, P>;
  private retired = false;
  error?: string;
  constructor(private readonly id: string, private readonly driver: CustomWebSessionStorageDriver<S, P>, restored?: CustomWebSessionSnapshot<S, P>) {
    this.expected = restored;
  }
  loadSession = () => this.driver.loadSession();
  replaceUnreadableSession = (snapshot: CustomWebSessionSnapshot<S, P>) => this.saveSession(snapshot);
  dispose() { this.retired = true; }
  async saveSession(snapshot: CustomWebSessionSnapshot<S, P>): Promise<void> {
    if (this.retired) throw new Error('종료된 게임의 저장 요청입니다.');
    if (!this.slot) {
      this.slot = slots.get(this.id) ?? { owner: this.token, tail: Promise.resolve() };
      this.slot.owner = this.token;
      slots.set(this.id, this.slot);
    }
    const slot = this.slot;
    const current = () => !this.retired && slot.owner === this.token;
    const next = structuredClone(snapshot);
    const work = slot.tail.then(async () => {
      if (!current()) throw new Error('다른 게임으로 전환되었습니다.');
      if (!this.driver.writeOwnedSession) throw new Error('게임 저장 연결을 사용할 수 없습니다.');
      await this.driver.writeOwnedSession(next, this.expected);
      this.expected = next;
      this.error = undefined;
      if (!current()) throw new Error('다른 게임으로 전환되었습니다.');
    });
    slot.tail = work.catch(() => {});
    try { await work; } catch (error) {
      if (current()) this.error = error instanceof Error ? error.message : '게임을 저장하지 못했습니다.';
      throw error;
    }
  }
}
