param([int]$Port = 8770)
# 로컬 미리보기용 정적 파일 서버 (PC에 Node/Python이 없어도 됨)
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.svg' = 'image/svg+xml' }
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "SchoolFPS: http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  # 개발용: 브라우저에서 만든 데이터를 tools/blender 폴더에 저장 (POST /__save?file=이름.json)
  if ($ctx.Request.HttpMethod -eq 'POST' -and $rel -eq '__save') {
    $name = [IO.Path]::GetFileName($ctx.Request.QueryString['file'])
    $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
    [IO.File]::WriteAllText((Join-Path $root "tools\blender\$name"), $reader.ReadToEnd(), (New-Object Text.UTF8Encoding $false))
    $ctx.Response.StatusCode = 204; $ctx.Response.Close(); continue
  }
  if ($rel -eq '') { $rel = 'index.html' }
  $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($full)
    $ct = $types[[IO.Path]::GetExtension($full).ToLower()]
    if (-not $ct) { $ct = 'application/octet-stream' }
    $ctx.Response.ContentType = $ct
    $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
  }
  $ctx.Response.Close()
}
