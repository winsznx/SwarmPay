# Ensure we are in sync
git pull origin main --quiet

# Get all modified files
$modified = git status --porcelain | Where-Object { $_ -match '^[ MADRC]' } | ForEach-Object { $_.Substring(3).Trim() }

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
        
        # Retry logic for push (remote locking issues)
        $pushed = $false
        for ($i = 1; $i -le 3; $i++) {
            git push origin main --quiet
            if ($LASTEXITCODE -eq 0) {
                $pushed = $true
                break
            }
            Write-Host "  Warning: Push failed, retrying ($i/3)..."
            Start-Sleep -Seconds 3
        }

        if ($pushed) {
            Write-Host "Success: Pushed $f"
        } else {
            Write-Host "Error: Failed to push $f after 3 attempts" -ForegroundColor Red
        }
        
        # Cooling period to avoid remote locking
        Start-Sleep -Seconds 2
    }
}

Write-Host "Finished individual push operation."
