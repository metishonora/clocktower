import { SetupInformationInput } from '../shared-ui/InformationInputPresentation';
import { taskPresentationModel } from './taskPresentationModel';
import type { FirstNightController } from '../custom/grimoire/firstNightController';
export function CustomSetupInformationInputs({controller,location="progress"}:{controller:FirstNightController;location?:"board"|"progress"}) {
 const state=controller.getSnapshot(),d=state.inputDraft,model=taskPresentationModel(controller);
 if(model.editor.kind!=='setup')return null;
 const editor=model.editor;
 return <>{location==="progress"&&(editor.characters.length>0||editor.zeroAllowed)&&<SetupInformationInput value={d.zero?'__zero_outsiders__':d.characterIds[0]??''} options={editor.characters} zeroAllowed={editor.zeroAllowed} disabled={state.busy} onChange={id=>controller.updateInput({zero:id==='__zero_outsiders__',characterIds:id&&id!=='__zero_outsiders__'?[id]:[],correct:'',judgments:[]})}/>}
 </>;
}
