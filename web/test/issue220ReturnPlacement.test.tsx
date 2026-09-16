import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {preparedRole,setupCases} from './custom/issue220T10TestSupport';
import {CustomGrimoirePlay} from '../src/grimoire-custom/CustomGrimoirePlay';
afterEach(cleanup);
it('placement return is available on ordinary board, hidden during selection, restored after cancel, and confirmed before restart',async()=>{
 const {app}=await preparedRole(setupCases[0]);const restart=vi.fn();try{
 const p=app.play!;render(<CustomGrimoirePlay controller={p} onNewGame={()=>{}} onImport={()=>{}} onRestart={restart}/>);
 fireEvent.click(screen.getByRole('button',{name:'마도서'}));fireEvent.click(screen.getByRole('button',{name:'배치로 돌아가기'}));
 fireEvent.click(screen.getByRole('button',{name:'취소'}));expect(restart).not.toHaveBeenCalled();
 await act(async()=>p.beginSelection());expect(screen.queryByRole('button',{name:'배치로 돌아가기'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'취소'}));fireEvent.click(screen.getByRole('button',{name:'마도서'}));
 fireEvent.click(screen.getByRole('button',{name:'배치로 돌아가기'}));fireEvent.click(screen.getByRole('button',{name:'초기화하고 돌아가기'}));expect(restart).toHaveBeenCalledOnce();
 }finally{app.dispose();}
});
