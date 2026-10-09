# Dot-source this in PowerShell to call the Supabase RPC functions with the public key from ../.env
# Usage:  . C:\Users\A\dev\seaon-app\mobile-web\supabase\api-helpers.ps1 ; Show 'test' (Rpc emp_enter @{p_link='nope'})
# Note: PowerShell variable names ignore case. Don't name test variables $sburl / $sbkey / $sbh.
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$envf = 'C:\Users\A\dev\seaon-app\mobile-web\.env'
$SBURL = (Select-String -Path $envf -Pattern '^VITE_SUPABASE_URL=(.*)').Matches[0].Groups[1].Value.Trim()
$SBKEY = (Select-String -Path $envf -Pattern '^VITE_SUPABASE_ANON_KEY=(.*)').Matches[0].Groups[1].Value.Trim()
$SBH = @{ apikey = $SBKEY; Authorization = "Bearer $SBKEY" }

function Rpc($fn, $body) {
  $json = if ($null -eq $body) { '{}' } else { $body | ConvertTo-Json -Compress -Depth 6 }
  try {
    Invoke-RestMethod -Method Post "$SBURL/rest/v1/rpc/$fn" -Headers $SBH -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json))
  } catch {
    $m = $_.ErrorDetails.Message
    if (-not $m -and $_.Exception.Response) {
      $sr = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream(), [Text.Encoding]::UTF8)
      $m = $sr.ReadToEnd()
    }
    if (-not $m) { $m = $_.Exception.Message }
    try { $m = ($m | ConvertFrom-Json).message } catch {}
    "ERR: $m"
  }
}

function Show($label, $v) { "$label => " + ($(if ($v -is [string]) { $v } else { $v | ConvertTo-Json -Compress -Depth 6 })) }
