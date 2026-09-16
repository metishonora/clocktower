//! Production assignments preserve Player targets across a reachable identity swap.
use super::issue207_acquisition::{confirm, propose, replay};
use super::issue207_relationships::game;
use serde_json::{json, Value};
#[test]
fn witch_target_survives_identity_swap_and_day() {
    let mut game = game("witch");
    assert_eq!(replay(&game)["currentStep"]["character"], "witch");
    let event = confirm(&mut game, json!({"playerIds":["p1"]}));
    assert_eq!(event["payload"]["result"]["effective"], true);
    confirm(&mut game, json!({"playerIds":["p7"]}));
    confirm(&mut game, Value::Null);
    let state = replay(&game);
    assert_eq!(state["phase"], "day");
    assert_eq!(state["ruleState"]["witchCurses"][0]["targetPlayerId"], "p1");
    assert_eq!(state["ruleState"]["witchCurses"][0]["effective"], true);
    assert_eq!(state["ruleState"]["witchCurses"][0]["day"], 1);
}
#[test]
fn cerenovus_delivers_only_instruction_and_rejects_invalid_character() {
    let mut game = game("cerenovus");
    for character in ["imp", "dreamer"] {
        assert_eq!(
            propose(&game, json!({"playerIds":["p1"],"characterId":character}))["ok"],
            false
        );
    }
    let proposal = propose(&game, json!({"playerIds":["p1"],"characterId":"artist"}));
    assert_eq!(
        proposal["value"]["revealPayload"],
        json!({"kind":"madnessAssignment","playerId":"p1","characterId":"artist"})
    );
    confirm(
        &mut game,
        json!({"playerIds":["p1"],"characterId":"artist"}),
    );
    confirm(&mut game, json!({"playerIds":["p7"]}));
    confirm(&mut game, Value::Null);
    let state = replay(&game);
    assert_eq!(state["madnessAssignments"][0]["characterId"], "artist");
    assert_eq!(state["madnessAssignments"][0]["effective"], true);
    assert!(state["players"]
        .as_array()
        .unwrap()
        .iter()
        .all(|p| p["alive"] == true));
}

#[test]
fn bounded_multiple_sources_keep_independent_effects_and_original_instructions() {
    use super::issue207_impairments::{facts, source};
    use crate::{
        characters::sects_and_violets::resolve_effects,
        contracts::{MadnessAssignment, WitchCurse},
    };
    let (context, mut facts) =
        facts(&["witch", "witch", "cerenovus", "cerenovus", "artist", "imp"]);
    for i in 0..2 {
        facts.witch_curses.push(WitchCurse {
            source_event_id: format!("curse{i}"),
            ability_use: source(&facts, i),
            target_player_id: "p5".into(),
            day: 1,
            initially_effective: true,
            effective: true,
        });
    }
    for i in 2..4 {
        facts.madness_assignments.push(MadnessAssignment {
            source_event_id: format!("madness{i}"),
            ability_use: source(&facts, i),
            target_player_id: "p5".into(),
            character_id: "artist".into(),
            day: 1,
            initially_effective: true,
            effective: true,
        });
    }
    resolve_effects(&context, &mut facts).unwrap();
    assert!(facts.witch_curses.iter().all(|r| r.effective));
    assert!(facts.madness_assignments.iter().all(|r| r.effective));
    facts.players[0].alive = false;
    facts.players[2].alive = false;
    resolve_effects(&context, &mut facts).unwrap();
    assert!(!facts.witch_curses[0].effective);
    assert!(facts.witch_curses[1].effective);
    assert!(!facts.madness_assignments[0].effective);
    assert!(facts.madness_assignments[1].effective);
    assert!(facts
        .madness_assignments
        .iter()
        .all(|r| r.character_id == "artist" && r.initially_effective));
    facts.players[4].alive = false;
    resolve_effects(&context, &mut facts).unwrap();
    assert!(facts.witch_curses.iter().all(|r| !r.effective));
    assert!(facts.madness_assignments[1].effective);
}

#[test]
fn bounded_impaired_cerenovus_keeps_instruction_without_effect_and_accepts_dead_target() {
    use super::issue207_impairments::facts;
    use crate::{
        characters::sects_and_violets::{registrations, resolve_effects},
        contracts::{ActiveImpairment, ImpairmentExpiry, ImpairmentKind},
        first_night::{ActionContext, ActionInput},
        model::StepInputFields,
        rules::CustomRuleService,
        state::ActionOccurrence,
    };
    let (definition, mut facts) = facts(&["cerenovus", "artist", "imp"]);
    facts.players[1].alive = false;
    facts.active_impairments.push(ActiveImpairment {
        kind: ImpairmentKind::Poisoned,
        player_id: "p1".into(),
        source_event_id: "bounded-poison".into(),
        source_character_id: "snakeCharmer".into(),
        expires: ImpairmentExpiry::Never,
    });
    resolve_effects(&definition, &mut facts).unwrap();
    let rules = CustomRuleService::new(&definition, &facts);
    let context = ActionContext {
        rule_service: &rules,
        event_id: "assignment",
    };
    let action=registrations().into_iter().find(|r| matches!(&r.spec.action_ref,crate::contracts::FirstNightActionRef::Character{character_id,..} if character_id=="cerenovus")).unwrap();
    let steps = action.handler.project(&action.spec, &context).unwrap();
    assert!(steps[0]
        .required_input
        .allowed_player_ids
        .as_ref()
        .unwrap()
        .contains(&"p2".into()));
    let draft = action
        .handler
        .propose_input(
            &action.spec,
            &context,
            &ActionOccurrence::from_step(&steps[0]).unwrap(),
            &ActionInput {
                input: Some(StepInputFields {
                    player_ids: Some(vec!["p2".into()]),
                    character_id: Some("artist".into()),
                    ..Default::default()
                }),
                delivered_result: None,
                registration_judgments: vec![],
            },
        )
        .unwrap();
    let crate::first_night::ActionEventDraft::Custom(draft) = draft else {
        panic!("custom")
    };
    assert!(matches!(
        draft.result,
        crate::contracts::CustomActionResult::Cerenovus {
            effective: false,
            ..
        }
    ));
}
