import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CustomReveal} from '../src/grimoire-custom/CustomReveal';
afterEach(cleanup);
it('V04: custom Washerwoman renders its approved public payload without an execution error',()=>{
 render(<CustomReveal payload={{kind:'setupInformation',characterId:'washerwoman',candidatePlayers:[{playerId:'p1',seat:1,name:'A'},{playerId:'p2',seat:2,name:'B'}],revealedCharacterId:'monk',zeroOutsiders:false}} onClose={()=>{}}/>);
 expect(screen.getByRole('dialog',{name:'플레이어 정보'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'확인했으면 눈을 감으세요'})).toBeTruthy();
 expect(screen.getByText('수도사')).toBeTruthy();
});
