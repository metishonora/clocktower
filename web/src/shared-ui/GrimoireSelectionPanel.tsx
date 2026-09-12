import './styles/playPresentation.css';
import type { ReactNode } from 'react';
export function GrimoireSelectionPanel({title,reset,children,action,completed=false}:{title:ReactNode;reset?:ReactNode;children:ReactNode;action:ReactNode;completed?:boolean}) {
  return <aside className={`issue116SelectionPanel${completed?' snvSelectionCompletePanel':''}`} aria-label="현재 마도서 작업"><header className="issue116SelectionHeader"><h2>{title}</h2>{reset}</header>{children}{action}</aside>;
}
