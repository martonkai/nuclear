use reqwest::blocking::Client;
use scraper::{Html, Selector};
use serde::Serialize;

#[derive(Debug, Serialize, specta::Type)]
pub struct ChartTrack {
    pub rank: u32,
    pub title: String,
    pub artist: String,
    pub source: String,
}

fn parse_table(html: &str, source: &str) -> Vec<ChartTrack> {
    let document = Html::parse_document(html);
    let row_selector = match Selector::parse("table tbody tr") {
        Ok(selector) => selector,
        Err(_) => return Vec::new(),
    };
    let cell_selector = match Selector::parse("td") {
        Ok(selector) => selector,
        Err(_) => return Vec::new(),
    };

    document
        .select(&row_selector)
        .filter_map(|row| {
            let cells: Vec<String> = row
                .select(&cell_selector)
                .map(|cell| cell.text().collect::<Vec<_>>().join(" ").trim().to_string())
                .filter(|text| !text.is_empty())
                .collect();

            if cells.len() < 3 {
                return None;
            }

            let rank = cells[0]
                .split_whitespace()
                .next()
                .and_then(|value| value.parse::<u32>().ok())?;

            let (title, artist) = cells
                .get(2)
                .and_then(|value| value.split_once(" - "))
                .map(|(artist, title)| (title.trim().to_string(), artist.trim().to_string()))
                .unwrap_or_else(|| {
                    (
                        cells.get(2).cloned().unwrap_or_default(),
                        cells.get(1).cloned().unwrap_or_default(),
                    )
                });

            Some(ChartTrack {
                rank,
                title,
                artist,
                source: source.to_string(),
            })
        })
        .take(100)
        .collect()
}

fn fetch_chart(client: &Client, url: &str, source: &str) -> Result<Vec<ChartTrack>, String> {
    let response = client
        .get(url)
        .send()
        .map_err(|error| format!("chart request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("chart returned HTTP {}", response.status()));
    }

    let html = response
        .text()
        .map_err(|error| format!("unable to read chart: {error}"))?;
    let tracks = parse_table(&html, source);

    if tracks.is_empty() {
        return Err("chart returned no tracks".to_string());
    }

    Ok(tracks)
}

#[tauri::command]
#[specta::specta]
pub fn fetch_charts() -> Result<Vec<ChartTrack>, String> {
    let client = Client::builder()
        .user_agent("Nuclear PowerTools/0.3 (https://github.com/nukeop/nuclear)")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;

    let mut tracks = Vec::new();

    if let Ok(russia) = fetch_chart(
        &client,
        "https://www.top200chart.ru/",
        "VK Music Russia",
    ) {
        tracks.extend(russia);
    }

    if let Ok(global) = fetch_chart(
        &client,
        "https://musicmetrics.net/en/",
        "Global",
    ) {
        tracks.extend(global);
    }

    if tracks.is_empty() {
        return Err("No charts are currently available".to_string());
    }

    Ok(tracks)
}
