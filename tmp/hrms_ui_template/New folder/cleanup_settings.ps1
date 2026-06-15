n$file = 'c:\Users\admin\Desktop\New folder\attendance.html'
$lines = Get-Content $file
$newLines = $lines[0..2607] + $lines[2688..($lines.Length-1)]
Set-Content $file $newLines -Encoding UTF8NoBOM
Write-Host "Done. New line count: $($newLines.Length)"
