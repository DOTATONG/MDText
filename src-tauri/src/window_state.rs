//! Remembers the geometry of the last window the user worked with.
//!
//! The saved size, position and maximized/fullscreen state are reused both when a new window is
//! opened and when the application starts again, so a new window looks like the one before it.

use std::{
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{utils::config::WindowConfig, AppHandle, Manager, WebviewWindow, WindowEvent};

const WINDOW_STATE_FILENAME: &str = "window-state.json";
/// Resize and move events arrive continuously while the user drags a window, so persistence is
/// rate-limited. Closing a window always writes immediately.
const SAVE_INTERVAL_MILLIS: u64 = 750;
/// Mirrors `minWidth`/`minHeight` in `tauri.conf.json` so a corrupt or stale file cannot shrink a
/// window below what the layout supports.
const MIN_WIDTH: f64 = 760.0;
const MIN_HEIGHT: f64 = 520.0;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    width: f64,
    height: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    x: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    y: Option<f64>,
    #[serde(default)]
    maximized: bool,
    #[serde(default)]
    fullscreen: bool,
}

/// The last geometry captured from a live window. A maximized or fullscreen window reports the
/// size of the screen, so this cached value supplies the size to restore to.
static LAST_KNOWN: Mutex<Option<WindowState>> = Mutex::new(None);
static LAST_SAVE_MILLIS: AtomicU64 = AtomicU64::new(0);

impl WindowState {
    fn clamped(mut self) -> Self {
        self.width = self.width.max(MIN_WIDTH);
        self.height = self.height.max(MIN_HEIGHT);
        self
    }
}

/// Loads the persisted state, if there is a readable one.
pub fn load(app: &AppHandle) -> Option<WindowState> {
    let content = fs::read_to_string(state_path(app)).ok()?;
    let state = serde_json::from_str::<WindowState>(&content)
        .ok()?
        .clamped();
    remember(&state);
    Some(state)
}

/// Captures the geometry of `window` in the form to restore later.
pub fn capture(app: &AppHandle, window: &WebviewWindow) -> Option<WindowState> {
    let maximized = window.is_maximized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    let scale_factor = window.scale_factor().ok().filter(|value| *value > 0.0)?;
    let size = window.inner_size().ok()?;
    let position = window.outer_position().ok();

    let mut state = WindowState {
        width: size.width as f64 / scale_factor,
        height: size.height as f64 / scale_factor,
        x: position.map(|position| position.x as f64 / scale_factor),
        y: position.map(|position| position.y as f64 / scale_factor),
        maximized,
        fullscreen,
    };

    // Maximized/fullscreen windows report the screen size rather than the geometry to return to.
    if maximized || fullscreen {
        if let Some(previous) = cached_state(app) {
            state.width = previous.width;
            state.height = previous.height;
            state.x = previous.x;
            state.y = previous.y;
        }
    }

    let state = state.clamped();
    remember(&state);
    Some(state)
}

/// Keeps the persisted state in sync with the windows the user is working in.
pub fn handle_window_event(app: &AppHandle, label: &str, event: &WindowEvent) {
    match event {
        WindowEvent::Resized(_) | WindowEvent::Moved(_) => {
            if save_is_due() {
                record(app, label);
            }
        }
        WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => record(app, label),
        _ => {}
    }
}

/// Applies the saved geometry to the configuration of a window that is about to be created.
pub fn apply_to_config(config: &mut WindowConfig, state: &WindowState) {
    config.width = state.width;
    config.height = state.height;
    config.x = state.x;
    config.y = state.y;
    config.maximized = state.maximized;
    config.fullscreen = state.fullscreen;
}

/// Drops a saved position that no longer intersects a connected display, so disconnecting a
/// monitor cannot leave the window off-screen.
pub fn visible_on_screen(app: &AppHandle, state: &WindowState) -> WindowState {
    let mut state = state.clone();
    let (Some(x), Some(y)) = (state.x, state.y) else {
        return state;
    };
    let Ok(monitors) = app.available_monitors() else {
        return state;
    };
    if monitors.is_empty() {
        return state;
    }

    let intersects = monitors.iter().any(|monitor| {
        let scale_factor = monitor.scale_factor();
        let position = monitor.position().to_logical::<f64>(scale_factor);
        let size = monitor.size().to_logical::<f64>(scale_factor);
        x < position.x + size.width
            && x + state.width > position.x
            && y < position.y + size.height
            && y + state.height > position.y
    });

    if !intersects {
        state.x = None;
        state.y = None;
    }
    state
}

fn record(app: &AppHandle, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    let Some(state) = capture(app, &window) else {
        return;
    };
    persist(app, &state);
}

fn persist(app: &AppHandle, state: &WindowState) {
    let path = state_path(app);
    if let Some(parent) = path.parent() {
        if fs::create_dir_all(parent).is_err() {
            return;
        }
    }
    if let Ok(content) = serde_json::to_string_pretty(state) {
        let _ = fs::write(path, content);
    }
}

fn state_path(app: &AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(WINDOW_STATE_FILENAME)
}

fn cached_state(app: &AppHandle) -> Option<WindowState> {
    if let Ok(cached) = LAST_KNOWN.lock() {
        if cached.is_some() {
            return cached.clone();
        }
    }
    load(app)
}

fn remember(state: &WindowState) {
    if let Ok(mut cached) = LAST_KNOWN.lock() {
        *cached = Some(state.clone());
    }
}

fn save_is_due() -> bool {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0);
    let last = LAST_SAVE_MILLIS.load(Ordering::Relaxed);
    if now.saturating_sub(last) < SAVE_INTERVAL_MILLIS {
        return false;
    }
    LAST_SAVE_MILLIS.store(now, Ordering::Relaxed);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state(width: f64, height: f64) -> WindowState {
        WindowState {
            width,
            height,
            x: Some(10.0),
            y: Some(20.0),
            maximized: false,
            fullscreen: false,
        }
    }

    #[test]
    fn clamps_sizes_to_the_supported_minimums() {
        let state = state(10.0, 10.0).clamped();

        assert_eq!(state.width, MIN_WIDTH);
        assert_eq!(state.height, MIN_HEIGHT);
    }

    #[test]
    fn keeps_sizes_above_the_minimums() {
        let state = state(1280.0, 800.0).clamped();

        assert_eq!(state.width, 1280.0);
        assert_eq!(state.height, 800.0);
    }

    #[test]
    fn round_trips_through_json() {
        let original = WindowState {
            maximized: true,
            ..state(1280.0, 800.0)
        };

        let json = serde_json::to_string(&original).unwrap();
        let restored: WindowState = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.width, 1280.0);
        assert_eq!(restored.height, 800.0);
        assert_eq!(restored.x, Some(10.0));
        assert_eq!(restored.y, Some(20.0));
        assert!(restored.maximized);
        assert!(!restored.fullscreen);
    }

    #[test]
    fn accepts_a_file_without_position_or_state_flags() {
        let restored: WindowState = serde_json::from_str(r#"{"width":1000,"height":700}"#).unwrap();

        assert_eq!(restored.x, None);
        assert_eq!(restored.y, None);
        assert!(!restored.maximized);
        assert!(!restored.fullscreen);
    }
}
