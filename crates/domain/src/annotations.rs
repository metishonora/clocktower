use std::collections::HashSet;

use crate::{
    characters::is_valid_script_token,
    error::{CoreError, ErrorKind},
    model::{Player, ScriptTokenRef, SystemTokenId},
};

pub(crate) fn validate_player_annotations(
    players: &[Player],
    player_id: &str,
    system_token_ids: &[SystemTokenId],
    script_tokens: &[ScriptTokenRef],
    notes: &str,
) -> Result<(), CoreError> {
    if !players.iter().any(|player| player.id == player_id)
        || notes.chars().count() > 1_000
        || system_token_ids.iter().collect::<HashSet<_>>().len() != system_token_ids.len()
        || script_tokens.iter().collect::<HashSet<_>>().len() != script_tokens.len()
        || script_tokens
            .iter()
            .any(|token| !is_valid_script_token(&token.character_id, &token.token_id))
    {
        return Err(ErrorKind::InvalidPlayerAnnotations.into_error());
    }
    Ok(())
}
