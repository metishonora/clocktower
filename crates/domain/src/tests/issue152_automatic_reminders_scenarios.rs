use super::support::*;
use crate::characters::automatic_reminders;
use crate::contracts::{GameEvent, GameEventKind};
use crate::model::Player;
use crate::setup::player_from_setup_input;
use crate::*;
use serde_json::{json, Value};

#[test]
fn setup_information_places_canonical_pair_until_first_to_day() {
    let events = json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-3", "seat": 3, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-3", "player-2"], "characterId": "soldier" })
        )
    ]);
    let before_day: Value =
        serde_json::from_str(&replay_json(&game_with_events(events.clone()).to_string()))
            .expect("replay JSON");
    assert_eq!(before_day["ok"], true, "{before_day:#}");
    let reminders = before_day["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .expect("automatic reminders");
    assert!(
        reminders.iter().any(|reminder| {
            reminder["playerId"] == "player-2"
                && reminder["characterId"] == "washerwoman"
                && reminder["tokenId"] == "townsfolk"
                && reminder["label"] == "주민"
        }),
        "correct reminder missing: {reminders:#?}"
    );
    assert!(
        reminders.iter().any(|reminder| {
            reminder["playerId"] == "player-3"
                && reminder["characterId"] == "washerwoman"
                && reminder["tokenId"] == "wrong"
                && reminder["label"] == "오답"
        }),
        "wrong reminder missing: {reminders:#?}"
    );

    let mut to_day_events = events;
    to_day_events.as_array_mut().expect("event array").extend([
        phase_event("phaseStepSkipped", "firstNight:spy"),
        phase_event("phaseStepConfirmed", "firstNight:toDay"),
    ]);
    let after_day: Value =
        serde_json::from_str(&replay_json(&game_with_events(to_day_events).to_string()))
            .expect("replay JSON");
    assert_eq!(after_day["ok"], true, "{after_day:#}");
    assert!(after_day["value"]["ruleState"]["automaticReminders"]
        .as_array()
        .is_none_or(|reminders| {
            reminders
                .iter()
                .all(|reminder| reminder["characterId"] != "washerwoman")
        }));
}

#[test]
fn spy_information_contains_the_same_canonical_reminders_without_annotations() {
    let game = game_with_events(json!([
        setup_event_with_players(json!([
            { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
            { "id": "player-2", "seat": 2, "name": "Soldier", "actualCharacter": "soldier", "shownCharacter": "soldier" },
            { "id": "player-3", "seat": 3, "name": "Saint", "actualCharacter": "saint", "shownCharacter": "saint" },
            { "id": "player-4", "seat": 4, "name": "Spy", "actualCharacter": "spy", "shownCharacter": "spy" },
            { "id": "player-5", "seat": 5, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
        ])),
        phase_event("phaseStepConfirmed", "firstNight:minionInfo"),
        phase_event("phaseStepConfirmed", "firstNight:demonInfo"),
        phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-3", "player-2"], "characterId": "soldier" })
        )
    ]));
    let command = json!({
        "type": "confirmStep",
        "payload": { "stepId": "firstNight:spy" }
    });
    let actual: Value =
        serde_json::from_str(&propose_json(&game.to_string(), &command.to_string())).unwrap();
    assert_eq!(actual["ok"], true, "{actual:#}");
    let players = actual["value"]["revealPayload"]["players"]
        .as_array()
        .expect("Spy reveal players");
    assert!(
        players.iter().any(|player| {
            player["playerId"] == "player-2"
                && player["automaticReminders"]
                    .as_array()
                    .is_some_and(|reminders| {
                        reminders
                            .iter()
                            .any(|reminder| reminder["tokenId"] == "townsfolk")
                    })
        }),
        "Spy did not receive canonical reminder data: {players:#?}"
    );
    assert!(players.iter().all(|player| {
        player.get("notes").is_none()
            && player.get("scriptTokens").is_none()
            && player["automaticReminders"].is_array()
    }));
}

#[test]
fn official_tb_reminders_cover_effects_deaths_identity_and_spent_abilities() {
    let setup = setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Butler", "actualCharacter": "butler", "shownCharacter": "butler" },
        { "id": "player-2", "seat": 2, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-4", "seat": 4, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" },
        { "id": "player-5", "seat": 5, "name": "Investigator", "actualCharacter": "investigator", "shownCharacter": "investigator" },
        { "id": "player-6", "seat": 6, "name": "Librarian", "actualCharacter": "librarian", "shownCharacter": "librarian" },
        { "id": "player-7", "seat": 7, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
        { "id": "player-8", "seat": 8, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-9", "seat": 9, "name": "Scarlet", "actualCharacter": "scarletWoman", "shownCharacter": "scarletWoman" },
        { "id": "player-10", "seat": 10, "name": "Slayer", "actualCharacter": "slayer", "shownCharacter": "slayer" },
        { "id": "player-11", "seat": 11, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
        { "id": "player-12", "seat": 12, "name": "Virgin", "actualCharacter": "virgin", "shownCharacter": "virgin" },
        { "id": "player-13", "seat": 13, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-14", "seat": 14, "name": "Chef", "actualCharacter": "chef", "shownCharacter": "chef" }
    ]));
    let setup_event = parsed_event(setup.clone());
    let mut players = players_from_setup(setup_event.clone());
    // Replay has already applied the canonical Scarlet Woman succession by the
    // time this projection is rendered; the reminder must retain its source
    // character even though the current identity is Imp.
    players[8].actual_character = "imp".into();
    players[8].shown_character = "imp".into();

    let mut events = vec![
        setup_event,
        json_event(phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:butler",
            json!({ "playerIds": ["player-14"] }),
        )),
        json_event(phase_event("phaseStepConfirmed", "firstNight:toDay")),
        json_event(phase_event("phaseStepConfirmed", "day:toNight")),
        night_effect_event("night:poisoner", "player-8", "poison", "player-14"),
        night_effect_event("night:monk", "player-7", "monkProtection", "player-14"),
        night_imp_death_event("night:imp", "player-4", "player-14"),
        json_event(json!({
            "id": "execution-death",
            "type": "deathConfirmed",
            "phase": "day",
            "payload": { "playerId": "player-13", "stepId": "day:executionDeath" },
            "summary": "처형 사망",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })),
        json_event(json!({
            "id": "scarlet-succession",
            "type": "demonSuccessionConfirmed",
            "phase": "night",
            "payload": {
                "triggerImpDeathEventId": "night-imp",
                "deathCause": "impSelfKill",
                "previousImpPlayerId": "player-4",
                "successorPlayerId": "player-9",
                "successorPreviousActualCharacter": "scarletWoman",
                "newCharacter": "imp",
                "source": "scarletWoman"
            },
            "summary": "악마 승계",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })),
        json_event(json!({
            "id": "slayer-used",
            "type": "slayerAbilityUsed",
            "phase": "day",
            "payload": {
                "discussionStepId": "day:discussion",
                "actorPlayerId": "player-10",
                "targetPlayerId": "player-4",
                "impairmentContext": { "kind": "healthy" },
                "registrationContext": { "kind": "canonical", "registeredAsDemon": true },
                "outcome": { "kind": "noEffect", "reason": "targetAlreadyDead" }
            },
            "summary": "처단자 능력",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })),
        json_event(json!({
            "id": "virgin-used",
            "type": "nominationStarted",
            "phase": "day",
            "payload": {
                "stepId": "day:nomination:1",
                "nominatorId": "player-10",
                "nomineeId": "player-12",
                "registrationJudgments": [],
                "virginResolution": {
                    "kind": "spentNoExecution",
                    "virginPlayerId": "player-12",
                    "impairmentContext": { "kind": "healthy" }
                }
            },
            "summary": "성결자 능력",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })),
        json_event(json!({
            "id": "red-herring",
            "type": "redHerringAssigned",
            "phase": "firstNight",
            "payload": { "stepId": "firstNight:fortuneTellerRedHerring", "playerId": "player-13", "registrationJudgments": [] },
            "summary": "레드 헤링",
            "createdAt": "2026-01-01T00:00:00.000Z"
        })),
    ];
    // The setup markers intentionally expire at first ToDay, while all other
    // official tokens above remain derivable from the active event prefix.
    let day_reminders = automatic_reminders(&players, &events[..3]);
    assert!(day_reminders.iter().any(|reminder| {
        reminder.player_id == "player-14"
            && reminder.character_id == "butler"
            && reminder.token_id == "master"
            && reminder.label == "주인"
    }));
    let reminders = automatic_reminders(&players, &events);
    let token_pairs = reminders
        .iter()
        .map(|reminder| {
            (
                reminder.player_id.as_str(),
                reminder.character_id.as_str(),
                reminder.token_id.as_str(),
                reminder.label.as_str(),
            )
        })
        .collect::<Vec<_>>();
    for expected in [
        ("player-14", "poisoner", "poisoned", "중독"),
        ("player-14", "monk", "safe", "안전"),
        ("player-14", "imp", "dead", "사망"),
        ("player-13", "undertaker", "diedToday", "오늘 사망"),
        ("player-10", "slayer", "noAbility", "능력 없음"),
        ("player-12", "virgin", "noAbility", "능력 없음"),
        ("player-2", "drunk", "isTheDrunk", "주정뱅이임"),
        ("player-13", "fortuneTeller", "redHerring", "오답 대상"),
        ("player-9", "scarletWoman", "isTheDemon", "악마임"),
    ] {
        assert!(
            token_pairs.contains(&expected),
            "missing {expected:?}: {token_pairs:?}"
        );
    }
    assert!(reminders.iter().all(|reminder| reminder.count.is_none()));

    events.push(json_event(json!({
        "id": "night-deaths-announced",
        "type": "nightDeathsAnnounced",
        "phase": "night",
        "payload": { "stepId": "night:announceDeaths", "playerIds": ["player-14"] },
        "summary": "밤 사망 공개",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })));
    assert!(automatic_reminders(&players, &events)
        .iter()
        .all(|reminder| !(reminder.player_id == "player-14" && reminder.character_id == "imp")));
}

#[test]
fn automatic_reminders_undo_and_source_loss_remove_effective_tokens() {
    let setup = setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Fortune", "actualCharacter": "fortuneTeller", "shownCharacter": "fortuneTeller" },
        { "id": "player-2", "seat": 2, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-3", "seat": 3, "name": "Monk", "actualCharacter": "monk", "shownCharacter": "monk" },
        { "id": "player-4", "seat": 4, "name": "Undertaker", "actualCharacter": "undertaker", "shownCharacter": "undertaker" },
        { "id": "player-5", "seat": 5, "name": "Target", "actualCharacter": "soldier", "shownCharacter": "soldier" },
        { "id": "player-6", "seat": 6, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]));
    let setup_event = parsed_event(setup.clone());
    let players = players_from_setup(setup_event.clone());
    let mut events = vec![
        setup_event,
        json_event(phase_event("phaseStepConfirmed", "firstNight:toDay")),
        json_event(phase_event("phaseStepConfirmed", "day:toNight")),
    ];
    let no_effects = automatic_reminders(&players, &events);
    assert!(no_effects.iter().all(|reminder| {
        !matches!(
            (reminder.character_id.as_str(), reminder.token_id.as_str()),
            ("poisoner", "poisoned")
                | ("monk", "safe")
                | ("fortuneTeller", "redHerring")
                | ("undertaker", "diedToday")
        )
    }));

    events.push(night_effect_event(
        "night:poisoner",
        "player-2",
        "poison",
        "player-5",
    ));
    events.push(night_effect_event(
        "night:monk",
        "player-3",
        "monkProtection",
        "player-5",
    ));
    events.push(json_event(json!({
        "id": "red-herring-source-loss",
        "type": "redHerringAssigned",
        "phase": "firstNight",
        "payload": { "stepId": "firstNight:fortuneTellerRedHerring", "playerId": "player-5", "registrationJudgments": [] },
        "summary": "레드 헤링",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })));
    events.push(json_event(json!({
        "id": "execution-source-loss",
        "type": "deathConfirmed",
        "phase": "day",
        "payload": { "playerId": "player-5", "stepId": "day:executionDeath" },
        "summary": "처형 사망",
        "createdAt": "2026-01-01T00:00:00.000Z"
    })));
    let active = automatic_reminders(&players, &events);
    assert!(active
        .iter()
        .any(|reminder| reminder.character_id == "poisoner" && reminder.token_id == "poisoned"));
    assert!(active
        .iter()
        .any(|reminder| reminder.character_id == "monk" && reminder.token_id == "safe"));
    assert!(active
        .iter()
        .any(|reminder| reminder.character_id == "fortuneTeller"
            && reminder.token_id == "redHerring"));
    assert!(active
        .iter()
        .any(|reminder| reminder.character_id == "undertaker" && reminder.token_id == "diedToday"));

    let without_last_event = automatic_reminders(&players, &events[..events.len() - 1]);
    assert!(without_last_event.iter().all(|reminder| {
        !(reminder.character_id == "undertaker" && reminder.token_id == "diedToday")
    }));

    let mut dead_poisoner = players.clone();
    dead_poisoner[1].alive = false;
    dead_poisoner[2].actual_character = "soldier".into();
    dead_poisoner[0].actual_character = "drunk".into();
    dead_poisoner[4].alive = false;
    dead_poisoner[3].actual_character = "soldier".into();
    let source_lost = automatic_reminders(&dead_poisoner, &events);
    assert!(source_lost.iter().all(|reminder| {
        !matches!(
            (reminder.character_id.as_str(), reminder.token_id.as_str()),
            ("poisoner", "poisoned")
                | ("monk", "safe")
                | ("fortuneTeller", "redHerring")
                | ("undertaker", "diedToday")
        )
    }));
}

#[test]
fn setup_reminders_use_the_delivered_candidate_order_for_all_three_information_roles() {
    let setup = setup_event_with_players(json!([
        { "id": "player-1", "seat": 1, "name": "Washer", "actualCharacter": "washerwoman", "shownCharacter": "washerwoman" },
        { "id": "player-2", "seat": 2, "name": "Drunk", "actualCharacter": "drunk", "shownCharacter": "chef" },
        { "id": "player-3", "seat": 3, "name": "Librarian", "actualCharacter": "librarian", "shownCharacter": "librarian" },
        { "id": "player-4", "seat": 4, "name": "Investigator", "actualCharacter": "investigator", "shownCharacter": "investigator" },
        { "id": "player-5", "seat": 5, "name": "Poisoner", "actualCharacter": "poisoner", "shownCharacter": "poisoner" },
        { "id": "player-6", "seat": 6, "name": "Imp", "actualCharacter": "imp", "shownCharacter": "imp" }
    ]));
    let setup_event = parsed_event(setup.clone());
    let players = players_from_setup(setup_event.clone());
    let events = vec![
        setup_event,
        json_event(phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:washerwoman",
            json!({ "playerIds": ["player-6", "player-2"], "characterId": "chef" }),
        )),
        json_event(phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:librarian",
            json!({ "playerIds": ["player-6", "player-2"], "characterId": "drunk" }),
        )),
        json_event(phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:investigator",
            json!({ "playerIds": ["player-1", "player-5"], "characterId": "poisoner" }),
        )),
    ];
    let reminders = automatic_reminders(&players, &events);
    for expected in [
        ("player-2", "washerwoman", "townsfolk", "주민"),
        ("player-6", "washerwoman", "wrong", "오답"),
        ("player-2", "librarian", "outsider", "외지인"),
        ("player-6", "librarian", "wrong", "오답"),
        ("player-5", "investigator", "minion", "하수인"),
        ("player-1", "investigator", "wrong", "오답"),
    ] {
        assert!(
            reminders.iter().any(|reminder| {
                reminder.player_id == expected.0
                    && reminder.character_id == expected.1
                    && reminder.token_id == expected.2
                    && reminder.label == expected.3
            }),
            "missing {expected:?}: {reminders:?}"
        );
    }

    let zero_librarian = vec![
        events[0].clone(),
        json_event(phase_event_with_input(
            "phaseStepConfirmed",
            "firstNight:librarian",
            json!({ "zeroOutsiders": true }),
        )),
    ];
    assert!(automatic_reminders(&players, &zero_librarian)
        .iter()
        .all(|reminder| reminder.character_id != "librarian"));
}

fn json_event(value: Value) -> GameEvent {
    serde_json::from_value(value).expect("valid event fixture")
}

fn parsed_event(value: Value) -> GameEvent {
    json_event(value)
}

fn players_from_setup(event: GameEvent) -> Vec<Player> {
    let GameEventKind::SetupConfirmed { payload } = event.kind else {
        panic!("setup event expected")
    };
    payload
        .players
        .iter()
        .map(player_from_setup_input)
        .collect::<Result<Vec<_>, _>>()
        .expect("valid players")
}

fn night_effect_event(
    step_id: &str,
    actor_player_id: &str,
    kind: &str,
    target_player_id: &str,
) -> GameEvent {
    json_event(json!({
        "id": format!("effect-{step_id}"),
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": { "kind": kind, "targetPlayerId": target_player_id, "applied": true }
        },
        "summary": step_id,
        "createdAt": "2026-01-01T00:00:00.000Z"
    }))
}

fn night_imp_death_event(
    step_id: &str,
    actor_player_id: &str,
    target_player_id: &str,
) -> GameEvent {
    json_event(json!({
        "id": "night-imp",
        "type": "nightActionResolved",
        "phase": "night",
        "payload": {
            "stepId": step_id,
            "actorPlayerId": actor_player_id,
            "resolution": {
                "kind": "impAttack",
                "targetPlayerId": target_player_id,
                "mayorContext": { "kind": "notApplicable" },
                "outcome": { "kind": "death", "playerId": target_player_id }
            }
        },
        "summary": step_id,
        "createdAt": "2026-01-01T00:00:00.000Z"
    }))
}
