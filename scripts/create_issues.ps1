# Creates labels and issues from issues/*.md in the current GitHub repo.
# Usage (inside the cloned repo): powershell -ExecutionPolicy Bypass -File scripts/create_issues.ps1 [-Repo owner/repo]
param([string]$Repo = "")
$ErrorActionPreference = "Stop"
$repoArgs = @()
if ($Repo -ne "") { $repoArgs = @("--repo", $Repo) }

foreach ($l in @("spike","mobile","backend","web","design","research","epic","sync","security","spec","priority:high")) {
  gh label create $l @repoArgs --force | Out-Null
}

Get-ChildItem issues -Filter *.md | Sort-Object Name | ForEach-Object {
  $lines = Get-Content $_.FullName -Encoding UTF8
  $title = $lines[0] -replace '^TITLE: ', ''
  $labels = $lines[1] -replace '^LABELS: ', ''
  $tmp = New-TemporaryFile
  $lines[3..($lines.Length - 1)] | Set-Content $tmp -Encoding UTF8
  gh issue create @repoArgs --title $title --label $labels --body-file $tmp
  Remove-Item $tmp
}
