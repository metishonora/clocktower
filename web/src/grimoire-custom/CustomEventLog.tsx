import {eventPresentation} from '../custom/grimoire/eventPresentation';
import { EventHistoryList } from '../shared-ui/EventHistoryList';
import type { GameFileV4 } from '../custom/core/types.js';
export function CustomEventLog({ file }: { file: GameFileV4 }) {
  return <EventHistoryList events={file.game.events.map(event=>({id:event.id,summary:eventPresentation(file,event)}))}/>;
}
