use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Serialize, specta::Type)]
pub struct LyricsResult {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub url: String,
    pub text: String,
    pub synced: Option<String>,
    pub source: String,
}

fn lyrically_request(
    client: &Client,
    provider: &str,
    artist: &str,
    title: &str,
) -> Result<LyricsResult, String> {
    let artist_q = utf8_percent_encode(artist, NON_ALPHANUMERIC).to_string();
    let title_q = utf8_percent_encode(title, NON_ALPHANUMERIC).to_string();
    let url = format!(
        "https://lyrics.paxsenix.org/{provider}/lyrics?artist={artist_q}&title={title_q}"
    );

    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Lyrically {provider} request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Lyrically {provider} returned HTTP {}",
            response.status()
        ));
    }

    let payload: Value = response
        .json()
        .map_err(|e| format!("Invalid Lyrically {provider} response: {e}"))?;

    let text = payload
        .pointer("/lyrics")
        .and_then(Value::as_str)
        .or_else(|| payload.pointer("/data/lyrics").and_then(Value::as_str))
        .or_else(|| payload.pointer("/result/lyrics").and_then(Value::as_str))
        .or_else(|| payload.pointer("/data/plainLyrics").and_then(Value::as_str))
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err(format!("Lyrically {provider} returned empty lyrics"));
    }

    let synced = payload
        .pointer("/syncedLyrics")
        .and_then(Value::as_str)
        .or_else(|| payload.pointer("/data/syncedLyrics").and_then(Value::as_str))
        .map(str::to_string);

    Ok(LyricsResult {
        title: title.to_string(),
        artist: artist.to_string(),
        album: String::new(),
        url: "https://lyrics.paxsenix.org/".to_string(),
        text,
        synced,
        source: format!("Lyrically / {provider}"),
    })
}

fn genius_fallback(client: &Client, artist: &str, title: &str) -> Result<LyricsResult, String> {
    let query = utf8_percent_encode(&format!("{artist} {title}"), NON_ALPHANUMERIC).to_string();
    let search_url = format!("https://genius.com/api/search/multi?per_page=10&q={query}");
    let response = client
        .get(search_url)
        .send()
        .map_err(|e| format!("Genius search failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Genius search returned HTTP {}", response.status()));
    }

    let payload: Value = response
        .json()
        .map_err(|e| format!("Invalid Genius response: {e}"))?;

    let wanted_title = title.to_lowercase();
    let wanted_artist = artist.to_lowercase();
    let mut candidates: Vec<(String, String, String, i32)> = Vec::new();

    if let Some(sections) = payload["response"]["sections"].as_array() {
        for section in sections {
            if let Some(hits) = section["hits"].as_array() {
                for hit in hits {
                    let result = &hit["result"];
                    let url = result["url"].as_str().unwrap_or_default();
                    let candidate_title = result["title"].as_str().unwrap_or(title);
                    let candidate_artist = result["primary_artist"]["name"]
                        .as_str()
                        .unwrap_or(artist);

                    if url.is_empty() {
                        continue;
                    }

                    let mut score = 0;
                    if candidate_title.to_lowercase() == wanted_title {
                        score += 10;
                    }
                    if candidate_artist.to_lowercase() == wanted_artist {
                        score += 10;
                    }
                    candidates.push((
                        url.to_string(),
                        candidate_title.to_string(),
                        candidate_artist.to_string(),
                        score,
                    ));
                }
            }
        }
    }

    candidates.sort_by(|a, b| b.3.cmp(&a.3));
    let (url, matched_title, matched_artist, _) = candidates
        .into_iter()
        .next()
        .ok_or_else(|| "Genius song not found".to_string())?;

    let page = client
        .get(&url)
        .send()
        .map_err(|e| format!("Genius page request failed: {e}"))?;

    if !page.status().is_success() {
        return Err(format!("Genius page returned HTTP {}", page.status()));
    }

    let html = page
        .text()
        .map_err(|e| format!("Unable to read Genius page: {e}"))?;
    let document = Html::parse_document(&html);
    let selector = Selector::parse("[data-lyrics-container=\"true\"]")
        .map_err(|e| format!("Invalid Genius lyrics selector: {e}"))?;

    let blocks: Vec<String> = document
        .select(&selector)
        .map(|element| element.text().collect::<Vec<_>>().join("\n"))
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .collect();

    if blocks.is_empty() {
        return Err("Genius page contains no lyrics".to_string());
    }

    Ok(LyricsResult {
        title: matched_title,
        artist: matched_artist,
        album: String::new(),
        url,
        text: blocks.join("\n\n"),
        synced: None,
        source: "Genius".to_string(),
    })
}

#[tauri::command]
#[specta::specta]
pub fn genius_lyrics(artist: String, title: String) -> Result<LyricsResult, String> {
    let client = Client::builder()
        .user_agent("Nuclear PowerTools/0.3 (https://github.com/nukeop/nuclear)")
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let mut errors = Vec::new();

    for provider in ["kugou", "genius"] {
        match lyrically_request(&client, provider, &artist, &title) {
            Ok(result) => return Ok(result),
            Err(error) => errors.push(error),
        }
    }

    match genius_fallback(&client, &artist, &title) {
        Ok(result) => Ok(result),
        Err(error) => {
            errors.push(format!("direct Genius fallback failed: {error}"));
            Err(errors.join("; "))
        }
    }
}
