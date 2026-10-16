use std::path::PathBuf;

use crate::fs_utils::is_markdown_path;

pub(crate) fn collect_opened_files_from_args() -> Vec<PathBuf> {
    collect_opened_files(std::env::args().skip(1))
}

/// Collects the Markdown files named on a command line.
///
/// Shared by the startup path and by the single-instance handler, which forwards the arguments of
/// a second launch (an "Open with" click or an association double-click) to the running process.
pub(crate) fn collect_opened_files<I>(args: I) -> Vec<PathBuf>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .filter(|arg| !arg.starts_with('-'))
        .filter_map(|arg| {
            if arg.starts_with("file://") {
                url::Url::parse(&arg).ok()?.to_file_path().ok()
            } else {
                Some(PathBuf::from(arg))
            }
        })
        .filter(|path| is_markdown_path(path))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn keeps_only_markdown_file_arguments() {
        let files = collect_opened_files(arguments(&[
            "C:\\docs\\readme.md",
            "C:\\docs\\notes.txt",
            "C:\\docs\\GUIDE.MARKDOWN",
        ]));

        assert_eq!(
            files,
            vec![
                PathBuf::from("C:\\docs\\readme.md"),
                PathBuf::from("C:\\docs\\GUIDE.MARKDOWN"),
            ]
        );
    }

    #[test]
    fn ignores_option_arguments() {
        assert!(collect_opened_files(arguments(&["--verbose", "-w"])).is_empty());
    }

    #[test]
    fn converts_file_urls_to_paths() {
        let files = collect_opened_files(arguments(&["file:///C:/docs/readme.md"]));

        assert_eq!(files.len(), 1);
        assert!(files[0].ends_with("readme.md"));
    }

    #[test]
    fn skips_file_urls_that_are_not_markdown() {
        assert!(collect_opened_files(arguments(&["file:///C:/docs/notes.txt"])).is_empty());
    }
}
