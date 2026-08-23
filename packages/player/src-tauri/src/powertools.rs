use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let play = MenuItem::with_id(app, "play", "Play / Pause", true, None::<&str>)?;
    let previous = MenuItem::with_id(app, "previous", "Previous", true, None::<&str>)?;
    let next = MenuItem::with_id(app, "next", "Next", true, None::<&str>)?;
    let shuffle = MenuItem::with_id(app, "shuffle", "Shuffle Favorites", true, None::<&str>)?;
    let wave = MenuItem::with_id(app, "wave", "My Wave", true, None::<&str>)?;
    let lyrics = MenuItem::with_id(app, "lyrics", "Lyrics", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let open = MenuItem::with_id(app, "open", "Open Nuclear", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Exit Nuclear", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&play, &previous, &next, &separator, &shuffle, &wave, &lyrics, &separator, &open, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Nuclear")
        .on_menu_event(|app, event| {
            let event_name = match event.id.as_ref() {
                "play" => Some("powertools:play-toggle"),
                "previous" => Some("powertools:previous"),
                "next" => Some("powertools:next"),
                "shuffle" => Some("powertools:favorite-shuffle"),
                "wave" => Some("powertools:wave"),
                "lyrics" => Some("powertools:lyrics"),
                "open" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                    None
                }
                "quit" => {
                    app.exit(0);
                    None
                }
                _ => None,
            };
            if let Some(name) = event_name {
                let _ = app.emit(name, ());
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}
