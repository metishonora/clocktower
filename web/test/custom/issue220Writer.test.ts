import { expect, it, vi } from 'vitest';
import { CustomSessionWriter } from '../../src/custom/storage/sessionWriter.js';
import { driver, started, stored, deferred, definition } from './issue220Support.js';
import type { GrimoireSetupDraft, GrimoirePresentationState } from '../../src/custom/grimoire/setupController.js';
import type { CustomWebSessionSnapshot } from '../../src/custom/storage/sessionStorage.js';
type Snapshot=CustomWebSessionSnapshot<GrimoireSetupDraft,GrimoirePresentationState>;
it('S1-g: new owner writes after in-flight old write and rejects the old pending/late writes',async()=>{
  const first=await started();const original=await stored();first.app.dispose();const store=driver();const release=deferred<void>();const entered=deferred<void>();
  const old=new CustomSessionWriter(definition.id,{loadSession:()=>store.loadSession(),saveSession:s=>store.saveSession(s),replaceUnreadableSession:s=>store.replaceUnreadableSession(s),writeOwnedSession:async(s,e)=>{entered.resolve();await release.promise;await store.writeOwnedSession(s,e);}},original);
  const delayed={...original,savedAt:'2026-09-11T00:00:01Z'};const writing=old.saveSession(delayed).catch(error=>error);await entered.promise;
  const pending=old.saveSession({...original,savedAt:'2026-09-11T00:00:02Z'}).catch(error=>error);
  old.dispose();const replacement:Snapshot=structuredClone(original);replacement.canonical.game.id='selected-new-game';
  const newer=new CustomSessionWriter(definition.id,store);const adopting=newer.saveSession(replacement);release.resolve();await writing;await pending;await adopting;
  expect((await stored()).canonical.game.id).toBe('selected-new-game');await expect(old.saveSession(original)).rejects.toThrow();expect(await stored()).toEqual(replacement);newer.dispose();
});
it('S1-g: DB comparison rejects a foreign writer even when in-memory ownership is unaware',async()=>{
  const first=await started();const original=await stored();first.app.dispose();const store=driver();const owner=new CustomSessionWriter(definition.id,store,original);
  const foreign=structuredClone(original);foreign.canonical.game.id='foreign-tab';await store.writeOwnedSession(foreign);
  await expect(owner.saveSession({...original,savedAt:'2026-09-11T00:01:00Z'})).rejects.toThrow(/변경/);expect((await stored()).canonical.game.id).toBe('foreign-tab');owner.dispose();
});
it('S1-c: failed atomic activation leaves a readable previous game untouched',async()=>{
  const first=await started();const before=await stored();first.app.dispose();const store=driver();const spy=vi.spyOn(store,'writeOwnedSession').mockRejectedValueOnce(Error('transaction aborted'));
  const writer=new CustomSessionWriter(definition.id,store);const next=structuredClone(before);next.canonical.game.id='next';await expect(writer.saveSession(next)).rejects.toThrow('transaction aborted');expect(await stored()).toEqual(before);
  spy.mockRestore();await writer.saveSession(next);expect((await stored()).canonical.game.id).toBe('next');writer.dispose();
});
