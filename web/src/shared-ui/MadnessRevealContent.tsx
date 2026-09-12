import type {ReactNode} from "react";
import "../features/madness/cerenovusMadnessReveal.css";
export function MadnessRevealContent({characterName,icon}:{characterName:string;icon:ReactNode}){return (      <div className="cerenovusMadnessRevealIdentity">
        <p className="cerenovusMadnessRevealLead">세레노버스가 당신을 선택했습니다.</p>
        <h1>{`내일 ${characterName}${quotationParticle(characterName)} 집착해야 합니다.`}</h1>
        {icon}
      </div>);}
function quotationParticle(value: string): "라고" | "이라고" {
  const lastCodePoint = value.codePointAt(value.length - 1);
  if (lastCodePoint === undefined || lastCodePoint < 0xac00 || lastCodePoint > 0xd7a3) return "라고";
  return (lastCodePoint - 0xac00) % 28 === 0 ? "라고" : "이라고";
}
