import { communityContentLogoUrl } from "../characterAssets";
import "./communityContentNotice.css";

export function CommunityContentNotice() {
  return (
    <footer className="communityContentNotice" aria-label="Community Created Content 안내">
      <img src={communityContentLogoUrl()} alt="Community Created Content" />
      <div>
        <strong>비공식 · 비상업 · 개인용 Storyteller 도구</strong>
        <span>The Pandemonium Institute의 공식 제품이 아닙니다.</span>
      </div>
      <a href="https://bloodontheclocktower.com/pages/community-created-content-policy">콘텐츠 정책</a>
    </footer>
  );
}
