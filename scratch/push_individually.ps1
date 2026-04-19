# Get all modified files
$modified = git status --porcelain | Where-Object { $_ -match '^[ MADRC]' } | ForEach-Object { $_.Substring(3) }

# Get all untracked files
$untracked = git ls-files --others --exclude-standard

# Combine and unique
$allFiles = ($modified + $untracked) | Select-Object -Unique | Where-Object { $_ -ne "" }

Write-Host "Starting individual push for $($allFiles.Count) files..."

foreach ($f in $allFiles) {
    if (Test-Path $f) {
        Write-Host "Pushing: $f"
        git add "$f"
        git commit -m "chore: Synchronize $f - UI icon migration and system stabilization" --quiet
        git push origin main --quiet
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to push $f" -ForegroundColor Red
        } else {
            Write-Host "Successfully pushed $f" -ForegroundColor Green
        }
    }
}

Write-Host "Finished individual push operation."
