import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {CustomGrimoireApplication} from '../src/grimoire-custom/CustomGrimoireApplication';
import {rememberCustomSession,activeCustomSessionId,forgetCustomSessionNavigation} from '../src/custom/grimoire/browserSessionNavigation';
import {started,stored,definition} from './custom/issue220Support';
import {IndexedDbCustomWebSessionStorageDriver} from '../src/custom/storage/sessionStorage';
afterEach(()=>{cleanup();forgetCustomSessionNavigation();});
async function open(){const {app}=await started();app.dispose();rememberCustomSession(definition.id);const before=await stored();const view=render(<CustomGrimoireApplication onExit={()=>{}}/>);await screen.findByRole('main',{name:'커스텀 마도서'});return {view,before};}
for(const tab of ['직업','마도서','진행','저장 / 불러오기'])it(`T13 P4 N01/N02: New Scenario next to New Game on ${tab}, cancel preserves saved state`,async()=>{
 const {before}=await open();fireEvent.click(screen.getByRole('button',{name:tab}));
 const button=screen.getByRole('button',{name:'새 시나리오'});
 const buttons=within(button.parentElement!).getAllByRole('button');expect(buttons.indexOf(button)).toBe(buttons.findIndex(b=>b.textContent==='새 게임')+1);
 fireEvent.click(button);const dialog=screen.getByRole('dialog');expect(dialog.textContent).toContain('기존 자동 저장은 유지됩니다.');
 fireEvent.click(within(dialog).getByRole('button',{name:'취소'}));expect(screen.getByRole('main',{name:'커스텀 마도서'})).toBeTruthy();
 expect(await stored()).toEqual(before);expect(activeCustomSessionId()).toBe(definition.id);
});
it('T13 P4 N03/N04/N05: confirm creates blank authoring and remount cannot resurrect the old navigation',async()=>{
 const {view,before}=await open();fireEvent.click(screen.getByRole('button',{name:'새 시나리오'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'새 시나리오 작성'}));
 await waitFor(()=>expect(screen.queryByRole('main',{name:'커스텀 마도서'})).toBeNull());
 expect(screen.getByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeTruthy();expect(activeCustomSessionId()).toBeUndefined();expect(await stored()).toEqual(before);
 view.unmount();render(<CustomGrimoireApplication onExit={()=>{}}/>);
 expect(screen.getByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeTruthy();expect(screen.queryByRole('main',{name:'커스텀 마도서'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'새롭게 작성한다'}));fireEvent.click(screen.getByRole('button',{name:'다음으로'}));
 expect(screen.getByRole('textbox',{name:'시나리오 이름'})).toHaveProperty('value','');expect(await stored()).toEqual(before);
});
it('T13 P4 N06: failed current save cannot be discarded through New Scenario',async()=>{
 const {before}=await open();const spy=vi.spyOn(IndexedDbCustomWebSessionStorageDriver.prototype,'writeOwnedSession').mockRejectedValue(Error('quota'));
 fireEvent.click(screen.getByRole('button',{name:'정보 공개'}));fireEvent.click(await screen.findByRole('button',{name:'확인했으면 눈을 감으세요'}));fireEvent.click(screen.getByRole('button',{name:'다음으로'}));
 await screen.findByRole('button',{name:'저장 다시 시도'});
 const button=screen.getByRole('button',{name:'새 시나리오'});
 if(!(button as HTMLButtonElement).disabled){fireEvent.click(button);fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'새 시나리오 작성'}));}
 expect(screen.getByRole('main',{name:'커스텀 마도서'})).toBeTruthy();expect(screen.getByRole('button',{name:'저장 다시 시도'})).toBeTruthy();expect(await stored()).toEqual(before);spy.mockRestore();
});
it('T13 P4 N07: New Game still keeps this scenario and preserves the previous save before setup confirmation',async()=>{
 const {before}=await open();fireEvent.click(screen.getByRole('button',{name:'새 게임'}));
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'새 게임'}));
 await screen.findByRole('button',{name:'직업 선택 확정'});
 expect(screen.queryByRole('heading',{name:'Ⅰ. 시나리오 선택'})).toBeNull();
 expect(screen.getByText(definition.name,{selector:'h1'})).toBeTruthy();expect(await stored()).toEqual(before);
});
