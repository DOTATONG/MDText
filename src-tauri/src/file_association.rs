//! Per-user Windows file associations for Markdown documents.
//!
//! The MSI installer registers machine-wide associations. Portable and development builds have no
//! installer at all, so this module writes the same ProgIDs under the current user instead, which
//! needs no elevation. It deliberately only adds MDText to the "Open with" list; it never writes
//! the default handler of `.md`, because Windows 10 and later pin that choice to a per-user hash
//! that applications cannot legitimately replace.

use serde::Serialize;

#[cfg(target_os = "windows")]
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

/// ProgID for `.md`. Mirrors `src-tauri/windows/file-associations.wxs` so both entry points agree.
#[cfg(target_os = "windows")]
const MARKDOWN_PROG_ID: &str = "MDText.md";
/// ProgID for `.markdown`.
#[cfg(target_os = "windows")]
const MARKDOWN_LONG_PROG_ID: &str = "MDText.markdown";
#[cfg(target_os = "windows")]
const FRIENDLY_NAME: &str = "MDText";
#[cfg(target_os = "windows")]
const TYPE_DESCRIPTION: &str = "Markdown text document";
#[cfg(target_os = "windows")]
const CAPABILITIES_KEY: &str = r"Software\MDText\Capabilities";
#[cfg(target_os = "windows")]
const REGISTERED_APPLICATIONS_KEY: &str = r"Software\RegisteredApplications";
#[cfg(target_os = "windows")]
const CLASSES_KEY: &str = r"Software\Classes";

/// Only reached on platforms without a registry to write to.
#[cfg(not(target_os = "windows"))]
const UNSUPPORTED: &str = "File associations can only be registered on Windows.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileAssociationStatus {
    /// Whether this build can register associations at all.
    supported: bool,
    /// Whether this executable is already registered for the current user.
    registered: bool,
    /// The executable an association would launch.
    executable_path: String,
}

#[cfg(target_os = "windows")]
#[derive(Debug, PartialEq, Eq)]
struct AssociationValue {
    key: String,
    name: String,
    value: String,
}

#[cfg(target_os = "windows")]
impl AssociationValue {
    fn new(key: &str, name: &str, value: &str) -> Self {
        Self {
            key: key.to_string(),
            name: name.to_string(),
            value: value.to_string(),
        }
    }

    fn describe(&self) -> String {
        describe(&self.key, &self.name)
    }
}

/// A value written into a key that other applications also own, so it must be removed by name
/// rather than by deleting the key.
#[cfg(target_os = "windows")]
struct BorrowedValue {
    key: String,
    name: String,
}

#[cfg(target_os = "windows")]
impl BorrowedValue {
    fn describe(&self) -> String {
        describe(&self.key, &self.name)
    }
}

#[tauri::command]
pub(crate) fn get_markdown_file_association_status() -> FileAssociationStatus {
    status()
}

#[tauri::command]
pub(crate) fn register_markdown_file_association() -> Result<FileAssociationStatus, String> {
    register()?;
    Ok(status())
}

#[tauri::command]
pub(crate) fn unregister_markdown_file_association() -> Result<FileAssociationStatus, String> {
    unregister()?;
    Ok(status())
}

#[cfg(target_os = "windows")]
fn status() -> FileAssociationStatus {
    let Ok((path, name)) = executable_information() else {
        return unsupported_status();
    };
    let executable_path = path.to_string_lossy().to_string();
    let registered = read_open_command(&application_key(&name))
        .is_some_and(|command| command.eq_ignore_ascii_case(&open_command(&executable_path)));

    FileAssociationStatus {
        supported: true,
        registered,
        executable_path,
    }
}

#[cfg(not(target_os = "windows"))]
fn status() -> FileAssociationStatus {
    unsupported_status()
}

#[cfg(target_os = "windows")]
fn register() -> Result<(), String> {
    let (path, name) = executable_information()?;
    let executable_path = path.to_string_lossy().to_string();
    let classes = RegKey::predef(HKEY_CURRENT_USER);

    for entry in association_values(&executable_path, &name) {
        let (key, _) = classes
            .create_subkey(&entry.key)
            .map_err(|error| format!("Failed to create the registry key {}: {error}", entry.key))?;
        key.set_value(&entry.name, &entry.value)
            .map_err(|error| format!("Failed to write {}: {error}", entry.describe()))?;
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn register() -> Result<(), String> {
    Err(UNSUPPORTED.to_string())
}

#[cfg(target_os = "windows")]
fn unregister() -> Result<(), String> {
    let (_, name) = executable_information()?;
    let classes = RegKey::predef(HKEY_CURRENT_USER);

    for entry in borrowed_values() {
        let Ok(key) = classes.open_subkey(&entry.key) else {
            continue;
        };
        if let Err(error) = key.delete_value(&entry.name) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Failed to remove {}: {error}", entry.describe()));
            }
        }
    }

    for key_path in owned_keys(&name) {
        if let Err(error) = classes.delete_subkey_all(&key_path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Failed to remove the registry key {key_path}: {error}"));
            }
        }
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn unregister() -> Result<(), String> {
    Err(UNSUPPORTED.to_string())
}

fn unsupported_status() -> FileAssociationStatus {
    FileAssociationStatus {
        supported: false,
        registered: false,
        executable_path: String::new(),
    }
}

/// The executable name and path, without canonicalizing: `canonicalize` yields the `\\?\` prefixed
/// form on Windows, which a shell command value cannot launch.
#[cfg(target_os = "windows")]
fn executable_information() -> Result<(PathBuf, String), String> {
    let path = std::env::current_exe()
        .map_err(|error| format!("Failed to locate the MDText executable: {error}"))?;
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .ok_or_else(|| "The MDText executable has no file name.".to_string())?;

    Ok((path, name))
}

#[cfg(target_os = "windows")]
fn application_key(executable_name: &str) -> String {
    format!(r"{CLASSES_KEY}\Applications\{executable_name}")
}

#[cfg(target_os = "windows")]
fn prog_id_key(prog_id: &str) -> String {
    format!(r"{CLASSES_KEY}\{prog_id}")
}

/// `%1` is the quoted path Windows substitutes for the clicked file.
#[cfg(target_os = "windows")]
fn open_command(executable_path: &str) -> String {
    format!("\"{executable_path}\" \"%1\"")
}

#[cfg(target_os = "windows")]
fn association_values(executable_path: &str, executable_name: &str) -> Vec<AssociationValue> {
    let command = open_command(executable_path);
    let icon = format!("{executable_path},0");
    let application = application_key(executable_name);
    let mut values = vec![
        AssociationValue::new(&application, "FriendlyAppName", FRIENDLY_NAME),
        AssociationValue::new(&application, "ApplicationIcon", &icon),
        AssociationValue::new(&format!(r"{application}\shell\open"), "", "Open with MDText"),
        AssociationValue::new(&format!(r"{application}\shell\open\command"), "", &command),
        // `SupportedTypes` is what makes a bare executable appear in the "Open with" chooser.
        AssociationValue::new(&format!(r"{application}\SupportedTypes"), ".md", ""),
        AssociationValue::new(&format!(r"{application}\SupportedTypes"), ".markdown", ""),
    ];

    for (prog_id, extension) in [
        (MARKDOWN_PROG_ID, ".md"),
        (MARKDOWN_LONG_PROG_ID, ".markdown"),
    ] {
        let key = prog_id_key(prog_id);
        values.push(AssociationValue::new(&key, "", TYPE_DESCRIPTION));
        values.push(AssociationValue::new(
            &key,
            "FriendlyTypeName",
            TYPE_DESCRIPTION,
        ));
        values.push(AssociationValue::new(&format!(r"{key}\DefaultIcon"), "", &icon));
        values.push(AssociationValue::new(
            &format!(r"{key}\shell\open"),
            "",
            "Open with MDText",
        ));
        values.push(AssociationValue::new(
            &format!(r"{key}\shell\open\command"),
            "",
            &command,
        ));
        // `OpenWithProgids` is the documented way to join the right-click "Open with" list while
        // leaving the user's current default application untouched.
        values.push(AssociationValue::new(
            &format!(r"{CLASSES_KEY}\{extension}\OpenWithProgids"),
            prog_id,
            "",
        ));
    }

    values.push(AssociationValue::new(
        CAPABILITIES_KEY,
        "ApplicationName",
        FRIENDLY_NAME,
    ));
    values.push(AssociationValue::new(
        CAPABILITIES_KEY,
        "ApplicationDescription",
        "Lightweight Markdown viewer and source editor.",
    ));
    values.push(AssociationValue::new(
        &format!(r"{CAPABILITIES_KEY}\FileAssociations"),
        ".md",
        MARKDOWN_PROG_ID,
    ));
    values.push(AssociationValue::new(
        &format!(r"{CAPABILITIES_KEY}\FileAssociations"),
        ".markdown",
        MARKDOWN_LONG_PROG_ID,
    ));
    values.push(AssociationValue::new(
        REGISTERED_APPLICATIONS_KEY,
        FRIENDLY_NAME,
        CAPABILITIES_KEY,
    ));

    values
}

/// Keys created exclusively by MDText, safe to delete whole.
#[cfg(target_os = "windows")]
fn owned_keys(executable_name: &str) -> Vec<String> {
    vec![
        application_key(executable_name),
        prog_id_key(MARKDOWN_PROG_ID),
        prog_id_key(MARKDOWN_LONG_PROG_ID),
        r"Software\MDText".to_string(),
    ]
}

/// Shared keys where only MDText's own value may be removed.
#[cfg(target_os = "windows")]
fn borrowed_values() -> Vec<BorrowedValue> {
    vec![
        BorrowedValue {
            key: format!(r"{CLASSES_KEY}\.md\OpenWithProgids"),
            name: MARKDOWN_PROG_ID.to_string(),
        },
        BorrowedValue {
            key: format!(r"{CLASSES_KEY}\.markdown\OpenWithProgids"),
            name: MARKDOWN_LONG_PROG_ID.to_string(),
        },
        BorrowedValue {
            key: REGISTERED_APPLICATIONS_KEY.to_string(),
            name: FRIENDLY_NAME.to_string(),
        },
    ]
}

#[cfg(target_os = "windows")]
fn read_open_command(key_path: &str) -> Option<String> {
    let classes = RegKey::predef(HKEY_CURRENT_USER);
    let key = classes
        .open_subkey(format!(r"{key_path}\shell\open\command"))
        .ok()?;

    key.get_value::<String, _>("").ok()
}

#[cfg(target_os = "windows")]
fn describe(key: &str, name: &str) -> String {
    if name.is_empty() {
        format!("the default value of {key}")
    } else {
        format!("{key}\\{name}")
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;

    const EXECUTABLE: &str = r"C:\Tools\MDText.exe";
    const EXECUTABLE_NAME: &str = "MDText.exe";

    fn values() -> Vec<AssociationValue> {
        association_values(EXECUTABLE, EXECUTABLE_NAME)
    }

    fn value_named(key: &str, name: &str) -> Option<String> {
        values()
            .into_iter()
            .find(|entry| entry.key == key && entry.name == name)
            .map(|entry| entry.value)
    }

    #[test]
    fn quotes_the_executable_and_the_file_placeholder() {
        assert_eq!(
            open_command(EXECUTABLE),
            "\"C:\\Tools\\MDText.exe\" \"%1\"".to_string()
        );
    }

    #[test]
    fn registers_an_open_command_for_both_prog_ids() {
        let command = open_command(EXECUTABLE);

        for prog_id in [MARKDOWN_PROG_ID, MARKDOWN_LONG_PROG_ID] {
            let key = prog_id_key(prog_id);
            assert_eq!(value_named(&key, "").as_deref(), Some(TYPE_DESCRIPTION));
            assert_eq!(
                value_named(&format!(r"{key}\shell\open\command"), "").as_deref(),
                Some(command.as_str())
            );
        }
    }

    #[test]
    fn joins_the_open_with_list_for_both_extensions() {
        assert_eq!(
            value_named(&format!(r"{CLASSES_KEY}\.md\OpenWithProgids"), MARKDOWN_PROG_ID)
                .as_deref(),
            Some("")
        );
        assert_eq!(
            value_named(
                &format!(r"{CLASSES_KEY}\.markdown\OpenWithProgids"),
                MARKDOWN_LONG_PROG_ID
            )
            .as_deref(),
            Some("")
        );
        assert_eq!(
            value_named(
                &format!(r"{CLASSES_KEY}\Applications\{EXECUTABLE_NAME}\SupportedTypes"),
                ".md"
            )
            .as_deref(),
            Some("")
        );
    }

    /// Becoming the default handler needs a per-user hash that Windows refuses to accept from an
    /// application, so the association must never write the extension keys themselves.
    #[test]
    fn never_writes_the_default_handler_of_an_extension() {
        for entry in values() {
            assert_ne!(entry.key, format!(r"{CLASSES_KEY}\.md"));
            assert_ne!(entry.key, format!(r"{CLASSES_KEY}\.markdown"));
        }
    }

    #[test]
    fn advertises_capabilities_for_windows_default_apps() {
        assert_eq!(
            value_named(REGISTERED_APPLICATIONS_KEY, FRIENDLY_NAME).as_deref(),
            Some(CAPABILITIES_KEY)
        );
        assert_eq!(
            value_named(
                &format!(r"{CAPABILITIES_KEY}\FileAssociations"),
                ".md"
            )
            .as_deref(),
            Some(MARKDOWN_PROG_ID)
        );
    }

    /// Guards the removal path: every value written must be reachable by either deleting an owned
    /// key outright or deleting one named value out of a key shared with other applications.
    #[test]
    fn every_written_value_can_be_removed_again() {
        let owned = owned_keys(EXECUTABLE_NAME);
        let borrowed = borrowed_values();

        for entry in values() {
            let is_owned = owned.iter().any(|key| {
                entry.key == *key || entry.key.starts_with(&format!("{key}\\"))
            });
            let is_borrowed = borrowed
                .iter()
                .any(|value| value.key == entry.key && value.name == entry.name);

            assert!(
                is_owned || is_borrowed,
                "{} would survive unregistering",
                entry.describe()
            );
        }
    }
}
