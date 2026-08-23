use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::blocking::Client;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct LyricsResult {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub url: String,
    pub text: String,
    pub synced: Option<String>,
}

#[tauri::command]
#[specta::specta]
pub fn genius_lyrics(artist: String, title: String) -> Result<LyricsResult, String> {
    let client = Client::builder()
        .user_agent("Nuclear PowerTools/0.1 (https://github.com/martonkai/nuclear)")
        .build()
        .map_err(|e| e.to_string())?;

    let artist_q = utf8_percent_encode(&artist, NON_ALPHANUMERIC).to_string();
    let title_q = utf8_percent_encode(&title, NON_ALPHANUMERIC).to_string();
    let url = format!(
        "https://lrclib.net/api/get?artist_name={artist_q}&track_name={title_q}"
    );

    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("LRCLIB request failed: {e}"))?;

    if response.status().as_u16() == 404 {
        return Err("Lyrics not found in LRCLIB".to_string());
    }
    if !response.status().is_success() {
        return Err(format!("LRCLIB returned HTTP {}", response.status()));
    }

    let payload: serde_json::Value = response
        .json()
        .map_err(|e| format!("Invalid LRCLIB response: {e}"))?;

    let track_title = payload["trackName"]
        .as_str()
        .or_else(|| payload["name"].as_str())
        .unwrap_or(&title)
        .to_string();
    let track_artist = payload["artistName"]
        .as_str()
        .unwrap_or(&artist)
        .to_string();
    let album = payload["albumName"].as_str().unwrap_or_default().to_string();
    let plain = payload["plainLyrics"].as_str().unwrap_or_default().to_string();
    let synced = payload["syncedLyrics"].as_str().map(ToString::to_string);

    if plain.trim().is_empty() && synced.as_deref().unwrap_or("").trim().is_empty() {
        return Err("LRCLIB returned no lyrics for this track".to_string());
    }

    let text = if plain.trim().is_empty() {
        synced.clone().unwrap_or_default()
    } else {
        plain
    };

    Ok(LyricsResult {
        title: track_title,
        artist: track_artist,
        album,
        url: "https://lrclib.net/".to_string(),
        text,
        synced,
    })
}
