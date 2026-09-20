//! Public scenario-pool projection. It cannot inspect players, events or live effects.
use crate::{
    boundary::to_json,
    characters::registry::resolve_custom_script_ids,
    error::{CoreError, ErrorKind},
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    character_ids: Vec<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Translation {
    reason_ko: String,
    source_character_id: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScenarioJinx {
    id: String,
    character_ids: [String; 2],
    reason_ko: String,
    source_character_id: String,
    source_revision: &'static str,
}
pub(crate) fn query_json(request: &str) -> String {
    to_json(query(request))
}
fn query(request: &str) -> Result<Vec<ScenarioJinx>, CoreError> {
    let request: Request =
        serde_json::from_str(request).map_err(|_| ErrorKind::MalformedRequest.into_error())?;
    let context = resolve_custom_script_ids(&request.character_ids)?;
    let translations: BTreeMap<String, Translation> =
        serde_json::from_str(include_str!("../resources/jinxes.ko.json"))
            .map_err(|_| ErrorKind::JinxRegistrationInvalid.into_error())?;
    context
        .related_jinxes()
        .iter()
        .map(|metadata| {
            let localized = translations
                .get(&metadata.id)
                .filter(|t| {
                    !t.reason_ko.trim().is_empty()
                        && metadata.character_ids.contains(&t.source_character_id)
                })
                .ok_or_else(|| ErrorKind::JinxRegistrationInvalid.into_error())?;
            // Keep the linked character on the right, as in the approved reference layout.
            let mut ids = metadata.character_ids.clone();
            if ids[0] == localized.source_character_id {
                ids.swap(0, 1);
            }
            Ok(ScenarioJinx {
                id: metadata.id.clone(),
                character_ids: ids,
                reason_ko: localized.reason_ko.clone(),
                source_character_id: localized.source_character_id.clone(),
                source_revision: metadata.source_revision,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn full_pool_projection_matches_registry_without_game_state() {
        let ids = crate::characters::custom_script_catalog()
            .iter()
            .map(|c| c.id.to_string())
            .collect::<Vec<_>>();
        let result = query(&serde_json::json!({"characterIds": ids}).to_string()).unwrap();
        let registered = crate::jinxes::production().unwrap().related(&ids);
        assert_eq!(result.len(), registered.len());
        assert_eq!(result.len(), 6);
        for entry in result {
            assert!(!entry.reason_ko.is_empty());
            assert_eq!(entry.source_revision, crate::jinxes::SOURCE_REVISION);
        }
    }
    #[test]
    fn requires_both_members_and_rejects_invalid_requests() {
        assert!(query(r#"{"characterIds":["drunk"]}"#).unwrap().is_empty());
        assert_eq!(
            query(r#"{"characterIds":["drunk","mathematician"]}"#)
                .unwrap()
                .len(),
            1
        );
        assert!(query(r#"{"characterIds":[]}"#).unwrap().is_empty());
        for request in [
            r#"{"characterIds":["unknown"]}"#,
            r#"{"characterIds":["drunk","drunk"]}"#,
            r#"{"characterIds":[],"players":[]}"#,
            "null",
        ] {
            assert!(query(request).is_err(), "{request}");
        }
    }
}
