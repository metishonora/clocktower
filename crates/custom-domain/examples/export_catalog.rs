fn main() {
    let catalog = if std::env::args().any(|arg| arg == "--reference-only") {
        clocktower_custom_domain::custom_reference_character_catalog_json()
    } else {
        clocktower_custom_domain::custom_script_catalog_json()
    };
    println!("{catalog}");
}
