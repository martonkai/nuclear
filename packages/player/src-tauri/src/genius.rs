use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use reqwest::blocking::Client;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct GeniusLyrics {
    pub title: String,
    pub artist: String,
    pub url: String,
    pub text: String,
}

#[tauri::command]
#[specta::specta]
pub fn genius_lyrics(artist: String, title: String) -> Result<GeniusLyrics, String> {
    let client = Client::builder()
        .user_agent("Nuclear PowerTools/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let query = utf8_percent_encode(&format!("{} {}", artist, title), NON_ALPHANUMERIC).to_string();
    let search_url = format!("https://genius.com/api/search/multi?q={query}");
    let search = client.get(search_url).send().map_err(|e| e.to_string())?;
    if !search.status().is_success() {
        return Err(format!("Genius search failed: HTTP {}", search.status()));
    }

    let payload: serde_json::Value = search.json().map_err(|e| e.to_string())?;
    let hits = payload["response"]["sections"]
        .as_array()
        .into_iter()
        .flatten()
        .flat_map(|section| section["hits"].as_array().into_iter().flatten())
        .filter_map(|hit| hit["result"].as_object());

    let target_title = normalize(&title);
    let target_artist = normalize(&artist);
    let mut best: Option<(f64, String, String, String)> = None;

    for result in hits {
        let hit_title = result.get("title").and_then(|v| v.as_str()).unwrap_or_default();
        let hit_artist = result["primary_artist"]["name"].as_str().unwrap_or_default();
        let url = result.get("url").and_then(|v| v.as_str()).unwrap_or_default();
        if url.is_empty() {
            continue;
        }

        let score = similarity(&normalize(hit_title), &target_title) * 0.6
            + similarity(&normalize(hit_artist), &target_artist) * 0.4;
        if best.as_ref().map(|item| score > item.0).unwrap_or(true) {
            best = Some((score, hit_title.to_string(), hit_artist.to_string(), url.to_string()));
        }
    }

    let Some((score, hit_title, hit_artist, url)) = best else {
        return Err("Genius track not found".to_string());
    };
    if score < 0.72 {
        return Err("No sufficiently close Genius match found".to_string());
    }

    let page = client.get(&url).send().map_err(|e| e.to_string())?;
    if !page.status().is_success() {
        return Err(format!("Genius page failed: HTTP {}", page.status()));
    }

    let text = extract_lyrics(&page.text().map_err(|e| e.to_string())?);
    if text.is_empty() {
        return Err("Genius lyrics not found on the page".to_string());
    }

    Ok(GeniusLyrics {
        title: hit_title,
        artist: hit_artist,
        url,
        text,
    })
}

fn normalize(value: &str) -> String {
    value
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn similarity(a: &str, b: &str) -> f64 {
    if a == b {
        return 1.0;
    }
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    let left: std::collections::HashSet<_> = a.split_whitespace().collect();
    let right: std::collections::HashSet<_> = b.split_whitespace().collect();
    let intersection = left.intersection(&right).count() as f64;
    2.0 * intersection / (left.len() + right.len()) as f64
}

fn extract_lyrics(html: &str) -> String {
    let mut result = Vec::new();
    let marker = "data-lyrics-container=\"true\"";
    let mut cursor = html;
    while let Some(start) = cursor.find(marker) {
        let after = &cursor[start..];
        let Some(open_end) = after.find('>') else {
            break;
        };
        let body = &after[open_end + 1..];
        let Some(end) = body.find("</div>") else {
            break;
        };
        let block = strip_html(&body[..end]);
        if !block.is_empty() {
            result.push(block);
        }
        cursor = &body[end + 6..];
    }
    result.join("\n\n")
}

fn strip_html(value: &str) -> String {
    let mut out = value
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("<br>", "\n");
    while let Some(start) = out.find('<') {
        let Some(end_rel) = out[start..].find('>') else {
            break;
        };
        out.replace_range(start..start + end_rel + 1, "");
    }
    out.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .trim()
        .to_string()
}
