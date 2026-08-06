use crate::error::{CoreError, ErrorKind};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct EventId(String);

impl EventId {
    pub(crate) fn parse(value: &str) -> Result<Self, CoreError> {
        if value.trim().is_empty() {
            return Err(ErrorKind::MalformedEvent.into_error());
        }
        Ok(Self(value.to_owned()))
    }
}
