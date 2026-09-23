import {troubleBrewingCharacterDetail,sectsAndVioletsCharacterDetail,type CharacterDetail} from '../characterDetails';
import {characterPresentation,kindLabels} from '../custom/authoring/characterPresentation';

// Korean summaries of every example in each official wiki's Examples section.
// Keep the source characters and outcomes, including characters not yet supported by the app.
const officialExamples = {
 preacher: [
  '기술자인 알렉스를 선택하면 아무 일도 일어나지 않습니다.',
  '세레노버스인 라클런을 선택하면 라클런에게 전도사가 선택했음을 알립니다. 라클런은 자신의 능력을 쓰기 위해 깨어나지 않습니다.',
  '전도사 더그가 마귀할멈 마리안나를 선택하여 능력을 없앱니다. 다음 밤 독살범이 더그를 중독시키면 마리안나는 다시 능력을 사용합니다.',
 ],
 chambermaid: [
  '퇴마사와 여관주인을 선택하면 2를 받습니다. 다음 밤 퇴마사가 샤발로스를 막은 뒤 샤발로스와 바보를 선택하면 0을 받습니다. 샤발로스가 퇴마사의 통지를 받으려고 깨어난 것은 세지 않습니다.',
  '둘째 밤 할머니와 악한 깡패를 선택합니다. 실제로 깨어나는 사람은 깡패뿐이지만, 객실 청소부가 취했으므로 2를 받을 수 있습니다.',
  '첫날 밤 암살자와 달의 아이를 선택하면 0입니다. 다음 밤 암살자와 험담꾼을 선택하면 1입니다. 암살자는 깨어나 사용하지 않기로 했고, 험담꾼은 능력이 작동해도 깨어나지 않았습니다.',
 ],
 balloonist: [
  '첫 세 밤에 재상인 압달라 → 대사제인 루이스 → 정치인인 사라를 차례로 알게 됩니다. 하수인 → 주민 → 외지인으로, 연속해서 알려준 두 플레이어의 유형이 서로 다릅니다.',
  '첫날 야경꾼 줄리언을 본 뒤, 둘째 밤 독살범에게 중독되어 같은 주민 유형인 선원 알렉스를 봅니다. 셋째 밤 건강해지면 직전의 알렉스와 유형이 다른 외지인, 퍼즐 달인 라클런을 봅니다.',
 ],
 nightwatchman: [
  '야경꾼 라클런이 압달라를 선택하면, 압달라는 라클런이 야경꾼이라는 정보를 받습니다.',
  '취한 야경꾼 마리안나가 에이미를 선택해도 능력은 작동하지 않습니다. 에이미를 깨우거나 야경꾼 정보를 전달하지 않습니다.',
  '보르톡스가 있는 게임에서 야경꾼 벤이 사라를 선택합니다. 사라에게는 벤이 아닌 루이스가 야경꾼이라고 알려주어, 야경꾼 능력에서 나온 정보를 거짓으로 만듭니다.',
 ],
 pixie: [
  '세탁부를 알게 된 픽시 에이미는 사흘 동안 자신이 세탁부이며 실제 세탁부의 주장은 거짓이라고 내세웁니다. 세탁부가 처형되면 능력을 얻어, 그날 밤 두 후보 중 한 명이 수도사라는 정보를 받습니다.',
  '취한 픽시 더그에게는 게임에 없는 늑대인간을 알려줍니다. 늑대인간으로 블러핑하던 하수인이 죽은 뒤에도 더그는 밤마다 공격 대상을 고르지만, 실제 능력이 없으므로 선택한 플레이어는 죽지 않습니다.',
  '첫날 군인이라고 주장한 픽시가 진짜 군인의 같은 주장에는 반박하지 않습니다. 이야기꾼이 충분히 군인인 척하지 않았다고 판단하면, 군인이 사망해도 능력을 얻지 못합니다.',
 ],
 zealot: [
  '생존자가 7명일 때 광신자는 알사히르·소환사·오우거·밴시 지명에 모두 투표합니다. 다음 날 5명일 때도 야가바블·대사제에게 모두 투표하지만, 3명으로 줄어들면 야가바블에게만 투표하고 대사제에게는 기권할 수 있습니다.',
  '생존자가 9명이어도 이미 죽은 광신자는 투표를 강제받지 않습니다. 사흘 동안 기권하다가 생존자 3명이 남았을 때 농부에게 마지막 투표 토큰을 쓸 수 있습니다.',
 ],
 boffin: [
  '성결자 능력을 받은 임프를 알사히르가 지명합니다. 임프에게 부여된 능력이 작동하여 지명자인 알사히르가 즉시 처형됩니다.',
  '객실 청소부 능력을 받은 티폰의 군주는 밤마다 두 플레이어를 골라 그중 오늘 밤 깨어난 인원수를 알아냅니다. 넷째 밤 과학자가 취하면 이 추가 능력을 잃으므로, 객실 청소부 차례에는 깨우지 않습니다.',
  '밴시 능력을 받은 카잘리가 밤에 죽고, 탕녀가 새 카잘리가 됩니다. 죽은 이전 카잘리는 밴시 능력으로 매일 두 번씩 지명하고 투표할 수 있습니다.',
 ],
 marionette: [
  '장의사라고 믿는 꼭두각시 마리안나는 처형된 캐릭터 정보를 밤마다 받지만, 그 내용은 자주 틀립니다. 게임 도중 악마가 마리안나에게 꼭두각시라는 사실을 알려줍니다.',
  '악마 라클런은 사라에게 꼭두각시라고 말하지만, 실제로는 게임에 꼭두각시가 없습니다. 악마가 정체에 관해 거짓말하는 사례입니다.',
  '점쟁이라고 믿는 꼭두각시 벤에게 악마가 진짜 정체를 알려줍니다. 벤은 그 말을 믿지 않고 악마를 처형하는 데 앞장서며, 결국 선한 팀이 승리합니다.',
 ],
} satisfies Record<string, readonly [string, ...string[]]>;

const carousel:Record<string,{rulings:string[];howToRun:string[];reminders:{label:string;count:number;description:string}[]}>= {
 preacher:{rulings:['하수인을 선택하면 그 하수인에게만 전도사가 선택했음을 알립니다. 전도사에게 성공 여부는 알려주지 않으며, 하수인에게 전도사 플레이어의 신원은 공개하지 않습니다.','전도사가 취하거나 중독되면 기존 효과가 잠시 멈추고, 회복하면 다시 적용됩니다. 취함·중독 중의 새 선택에는 효과가 없습니다.','전도사가 죽거나 직업이 변경되면 효과가 해제됩니다. 대상의 직업이 변경되어도 해당 효과는 끝납니다.','죽은 플레이어와 자신도 선택할 수 있습니다.'],howToRun:['마도서에서 대상을 선택합니다. 하수인에게 통지가 필요하면 공개 버튼을 눌러 전도사 직업만 보여줍니다.','공개를 닫으면 적용 결과를 확인하고 진행으로 돌아갑니다.'],reminders:[{label:'능력 없음',count:3,description:'선택한 하수인 · 전도사의 효과가 멈추면 X 표시'}]},
 chambermaid:{rulings:['자신을 제외한 서로 다른 생존자 두 명을 고릅니다. 선택 가능한 생존자가 두 명보다 적으면 깨우지 않습니다.','자신의 능력을 사용하려고 깨어났다면 취함·중독 또는 사용 거절 여부와 무관하게 셉니다.','악팀 초기 정보, 다른 능력의 통지, 직업·진영 변경 안내만 받은 경우는 세지 않습니다.','수학자가 오늘 밤 깨어날 예정인 경우도 징크스에 따라 셉니다.'],howToRun:['두 명을 선택하면 진실과 읽기 전용 판정 근거가 표시됩니다.','취함·중독 또는 보르톡스 상태에서는 전달할 숫자를 입력합니다. 보르톡스일 때 진실은 선택할 수 없습니다.','플레이어에게는 선택한 두 명과 깨어난 인원수만 공개합니다.'],reminders:[]},
 balloonist:{rulings:['매일 밤 지난번에 알려준 플레이어와 다른 유형의 플레이어를 알게 됩니다. 첫 정보에는 이전 유형 제한이 없습니다.','죽은 플레이어도 알려줄 수 있습니다.'],howToRun:['알려줄 플레이어를 선택합니다. 등록 판단이 필요하면 유형을 선택합니다.'],reminders:[{label:'알고 있음',count:1,description:'최근에 알려준 플레이어'}]},
 nightwatchman:{rulings:['능력을 사용하면 선택한 플레이어에게 야경꾼이 누구인지 알립니다.','취함·중독 중 사용해도 사용 기회는 소모됩니다.'],howToRun:['오늘 사용하지 않으면 즉시 다음 단계로 진행합니다.','사용한다면 대상을 정한 뒤 해당 플레이어에게만 정보를 공개합니다.'],reminders:[{label:'능력 사용함',count:1,description:'게임당 한 번 능력 사용'}]},
 pixie:{rulings:['첫 정보는 직업만 전달하며 그 직업의 플레이어는 알려주지 않습니다.','대상이 죽을 때 충분히 집착했고 픽시의 능력이 유효하면 처음 알려준 능력을 즉시 얻습니다.'],howToRun:['집착 대상과 알려줄 직업을 선택합니다.','자유 행동에서 충분히 집착했는지 판단합니다. 사망 시점의 판단으로 능력 획득을 처리합니다.'],reminders:[{label:'집착',count:1,description:'집착 대상'}, {label:'능력 가짐',count:1,description:'대상 사망으로 능력을 얻음'}]},
 zealot:{rulings:['살아 있는 플레이어가 5명 이상일 때 모든 지명에 투표해야 합니다.','취함·중독 또는 사망으로 능력이 작동하지 않으면 강제 투표가 해제됩니다.'],howToRun:['강제 투표는 투표 화면에서 선택된 채 고정됩니다.'],reminders:[]},
 boffin:{rulings:['악마는 기존 능력과 별도로, 시나리오에 있지만 게임에는 없는 선한 캐릭터의 능력을 얻습니다.','부여된 능력은 악마 자신의 취함·중독과 분리됩니다. 과학자의 능력이 비활성화되면 부여한 능력도 멈춥니다.','주정뱅이 능력은 징크스로 부여할 수 없습니다.'],howToRun:['초기 직업 선택에서 부여할 능력을 정합니다. 새 악마에게는 진행 화면에서 지정합니다.','능력 정보는 과학자와 대상 악마에게 각각 공개합니다.'],reminders:[{label:'부여한 능력',count:1,description:'악마의 토큰 상세에 능력 아이콘과 과학자 출처 표시'}]},
 marionette:{rulings:['실제로는 하수인이지만 자신을 선한 캐릭터라고 생각합니다. 가장 직업의 실제 능력은 없습니다.','게임 시작 시 악마의 이웃이어야 합니다. 다른 하수인은 꼭두각시를 알지 못하며, 꼭두각시도 악팀 정보를 받지 않습니다.','보르톡스의 거짓 정보 의무는 꼭두각시에게 적용되지 않습니다.'],howToRun:['보여줄 선한 직업을 드롭다운으로 선택합니다.','게임 중 생성되면 본인에게 가장 직업을 공개한 뒤 악마에게 꼭두각시를 알립니다.'],reminders:[{label:'꼭두각시',count:1,description:'가장 직업과 별도로 실제 꼭두각시 표시'}]},
};
export function customCharacterDetail(id?:string):CharacterDetail|undefined {
 const role=id?characterPresentation(id):undefined;if(!role)return undefined;
 if(role.source==='troubleBrewing')return troubleBrewingCharacterDetail(id);
 if(role.source==='sectsAndViolets')return sectsAndVioletsCharacterDetail(id);
 const extra=carousel[role.id];if(!extra || !(role.id in officialExamples))return undefined;
 const examples=officialExamples[role.id as keyof typeof officialExamples]
  .map((text,index)=>({id:`${role.id}-example-${index+1}`,text}));
 return {id:role.id,label:role.label,kindLabel:kindLabels[role.kind],iconSrc:role.image,ability:role.ability,...extra,examples,sourceUrl:`https://wiki.bloodontheclocktower.com/${role.englishLabel}`};
}
