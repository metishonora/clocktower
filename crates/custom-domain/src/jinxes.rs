//! Official metadata and typed character-owned rule registrations.
//! Related script pairs are a read-only projection, never an effectiveness gate.
use crate::{
    error::{CoreError, ErrorKind},
    model::{AbilityUseRef, RegistrationJudgment},
    state::{ActionOccurrence, CustomGameFacts},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::OnceLock,
};

pub(crate) const SOURCE_REVISION: &str = "f10cd02e3401af227ce406287eaae7bb99a06a42";
pub(crate) const SOURCE_URL: &str = "https://github.com/ThePandemoniumInstitute/botc-release/blob/f10cd02e3401af227ce406287eaae7bb99a06a42/resources/data/jinxes.json";
#[derive(Deserialize)]
pub(crate) struct OfficialGroup {
    pub id: String,
    pub jinx: Vec<OfficialPair>,
}
#[derive(Deserialize)]
pub(crate) struct OfficialPair {
    pub id: String,
    pub reason: String,
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JinxMetadata {
    pub id: String,
    pub character_ids: [String; 2],
    pub reason: String,
    pub source_url: &'static str,
    pub source_revision: &'static str,
}

pub(crate) struct RegistrationContext<'a> {
    pub facts: &'a CustomGameFacts,
    pub observer: &'a ActionOccurrence,
    pub target_id: &'a str,
}
pub(crate) struct SuccessionContext<'a> {
    pub before: &'a CustomGameFacts,
    pub after: &'a CustomGameFacts,
    pub dead_id: &'a str,
    pub successor: &'a AbilityUseRef,
}
/// These are the existing consumers, not a closed classification of all official Jinxes.
/// A future consumer adds a typed seam here and owns when it calls that seam.
#[derive(Clone, Copy)]
pub(crate) enum Rule {
    ShownSetupAbility(fn(&str, &str) -> Option<&'static str>),
    ForbidGrantedAbility(fn(&str, &str) -> bool),
    Registration(fn(&RegistrationContext<'_>) -> Option<RegistrationJudgment>),
    PreventSuccession(fn(&SuccessionContext<'_>) -> bool),
    SimulationCause(fn(&ActionOccurrence) -> Option<AbilityUseRef>),
}
#[derive(Clone)]
pub(crate) struct RegisteredJinx {
    pub id: &'static str,
    pub characters: [&'static str; 2],
    pub evidence: &'static [&'static str],
    pub rules: Vec<Rule>,
}
pub(crate) struct JinxRegistry {
    entries: BTreeMap<String, (JinxMetadata, RegisteredJinx)>,
}
fn pair_key(a: &str, b: &str) -> String {
    let mut ids = [a.to_ascii_lowercase(), b.to_ascii_lowercase()];
    ids.sort();
    ids.join("--")
}
impl JinxRegistry {
    pub(crate) fn shown_setup_abilities(&self, actual: &str, shown: &str) -> Vec<&'static str> {
        self.entries
            .values()
            .flat_map(|(_, r)| &r.rules)
            .filter_map(|r| match r {
                Rule::ShownSetupAbility(run) => run(actual, shown),
                _ => None,
            })
            .collect()
    }
    pub(crate) fn forbids_granted_ability(&self, source: &str, ability: &str) -> bool {
        self.entries
            .values()
            .flat_map(|(_, r)| &r.rules)
            .any(|r| match r {
                Rule::ForbidGrantedAbility(run) => run(source, ability),
                _ => false,
            })
    }
    /// Check the whole published character catalog, not just one game's selected pair.
    /// Missing metadata, an empty implementation, unknown or duplicate bindings fail closed.
    pub(crate) fn new(
        source: &[OfficialGroup],
        supported: &[&str],
        registrations: Vec<RegisteredJinx>,
    ) -> Result<Self, ErrorKind> {
        let invalid = ErrorKind::JinxRegistrationInvalid;
        let mut ids = BTreeMap::new();
        for id in supported {
            if id.is_empty() || ids.insert(id.to_ascii_lowercase(), *id).is_some() {
                return Err(invalid);
            }
        }
        let mut seen = BTreeSet::new();
        let mut expected = BTreeMap::new();
        for group in source {
            for pair in &group.jinx {
                let key = pair_key(&group.id, &pair.id);
                if group.id.is_empty()
                    || pair.id.is_empty()
                    || group.id == pair.id
                    || pair.reason.trim().is_empty()
                    || !seen.insert(key.clone())
                {
                    return Err(invalid);
                }
                if let (Some(a), Some(b)) = (ids.get(&group.id), ids.get(&pair.id)) {
                    let mut characters = [a.to_string(), b.to_string()];
                    characters.sort();
                    expected.insert(
                        key.clone(),
                        JinxMetadata {
                            id: key,
                            character_ids: characters,
                            reason: pair.reason.clone(),
                            source_url: SOURCE_URL,
                            source_revision: SOURCE_REVISION,
                        },
                    );
                }
            }
        }
        let mut entries = BTreeMap::new();
        for registration in registrations {
            let key = pair_key(registration.characters[0], registration.characters[1]);
            let metadata = expected.remove(&key).ok_or(invalid)?;
            if registration.id != key
                || registration.rules.is_empty()
                || registration.evidence.is_empty()
                || registration.evidence.iter().any(|e| e.trim().is_empty())
                || registration
                    .characters
                    .iter()
                    .any(|id| !supported.contains(id))
            {
                return Err(invalid);
            }
            let mut kinds = BTreeSet::new();
            for rule in &registration.rules {
                let kind = match rule {
                    Rule::ShownSetupAbility(_) => 4,
                    Rule::ForbidGrantedAbility(_) => 3,
                    Rule::Registration(_) => 0,
                    Rule::PreventSuccession(_) => 1,
                    Rule::SimulationCause(_) => 2,
                };
                if !kinds.insert(kind) {
                    return Err(invalid);
                }
            }
            entries.insert(key, (metadata, registration));
        }
        if !expected.is_empty() {
            return Err(invalid);
        }
        Ok(Self { entries })
    }
    pub(crate) fn related(&self, character_ids: &[String]) -> Vec<JinxMetadata> {
        self.entries
            .values()
            .filter(|(m, _)| m.character_ids.iter().all(|id| character_ids.contains(id)))
            .map(|(m, _)| m.clone())
            .collect()
    }
    pub(crate) fn registrations(
        &self,
        context: &RegistrationContext<'_>,
    ) -> Vec<RegistrationJudgment> {
        self.entries
            .values()
            .flat_map(|(_, r)| &r.rules)
            .filter_map(|rule| match rule {
                Rule::Registration(run) => run(context),
                _ => None,
            })
            .collect()
    }
    pub(crate) fn prevents_succession(&self, context: &SuccessionContext<'_>) -> bool {
        self.entries
            .values()
            .flat_map(|(_, r)| &r.rules)
            .any(|rule| match rule {
                Rule::PreventSuccession(run) => run(context),
                _ => false,
            })
    }
    pub(crate) fn simulation_causes(&self, occurrence: &ActionOccurrence) -> Vec<AbilityUseRef> {
        self.entries
            .values()
            .flat_map(|(_, r)| &r.rules)
            .filter_map(|rule| match rule {
                Rule::SimulationCause(run) => run(occurrence),
                _ => None,
            })
            .collect()
    }
}
pub(crate) fn character_registrations() -> Vec<RegisteredJinx> {
    crate::characters::trouble_brewing::jinx_registrations()
        .into_iter()
        .chain(crate::characters::sects_and_violets::jinx_registrations())
        .chain(crate::characters::carousel::jinx_registrations())
        .collect()
}
pub(crate) fn production() -> Result<&'static JinxRegistry, CoreError> {
    static REGISTRY: OnceLock<Result<JinxRegistry, ErrorKind>> = OnceLock::new();
    REGISTRY
        .get_or_init(|| {
            let source: Vec<OfficialGroup> =
                serde_json::from_str(include_str!("../resources/jinxes.json"))
                    .map_err(|_| ErrorKind::JinxRegistrationInvalid)?;
            let supported = crate::characters::custom_script_catalog()
                .iter()
                .map(|c| c.id)
                .collect::<Vec<_>>();
            JinxRegistry::new(&source, &supported, character_registrations())
        })
        .as_ref()
        .map_err(|e| e.into_error())
}
