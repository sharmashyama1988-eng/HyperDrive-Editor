use git2::{Repository, DiffOptions};

#[tauri::command]
pub async fn git_diff_summary(repo_path: String) -> Result<String, String> {
    let repo = Repository::discover(repo_path).map_err(|e| e.to_string())?;
    
    let head = repo.head().and_then(|h| h.peel_to_tree()).ok();
    let mut opts = DiffOptions::new();
    opts.context_lines(0);

    let diff = repo.diff_tree_to_workdir_with_index(head.as_ref(), Some(&mut opts))
        .map_err(|e| e.to_string())?;

    let mut added = 0;
    let mut deleted = 0;
    let mut modified = 0;

    diff.foreach(
        &mut |_, _| true,
        None,
        None,
        Some(&mut |_, _, line| {
            match line.origin() {
                '+' => added += 1,
                '-' => deleted += 1,
                'M' => modified += 1,
                _ => {}
            }
            true
        }),
    ).map_err(|e| e.to_string())?;

    Ok(format!("+{},-{},~{}", added, deleted, modified))
}
