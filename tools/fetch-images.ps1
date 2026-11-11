$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$dest = 'C:\Users\MY_PC\Desktop\du_an_nha_thong_minh\assets\img'
if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
$tmp = Join-Path $env:TEMP 'nht_img_dl'
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Path $tmp | Out-Null }

$UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EduProject/1.0'

function Get-CommonsThumb {
  param([string]$FileTitle)
  $u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=' +
       [uri]::EscapeDataString('File:' + $FileTitle) +
       '&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1400'
  $r = Invoke-WebRequest -Uri $u -TimeoutSec 40 -UseBasicParsing -UserAgent $UA
  $j = $r.Content | ConvertFrom-Json
  $page = $j.query.pages.PSObject.Properties.Value | Select-Object -First 1
  $ii = $page.imageinfo[0]
  if (-not $ii) { throw "khong tim thay $FileTitle" }
  return $ii.thumburl
}

function Save-Resized {
  param([string]$Url, [string]$OutPath, [int]$MaxW = 1400, [int]$Quality = 78)
  $raw = Join-Path $tmp ([guid]::NewGuid().ToString() + '.bin')
  Invoke-WebRequest -Uri $Url -OutFile $raw -TimeoutSec 90 -UseBasicParsing -UserAgent $UA
  $img = [System.Drawing.Image]::FromFile($raw)
  try {
    $w = $img.Width; $h = $img.Height
    $scale = [Math]::Min(1.0, $MaxW / $w)
    $nw = [int]($w * $scale); $nh = [int]($h * $scale)
    $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
    $bmp.Save($OutPath, $enc, $ep)
    $bmp.Dispose()
    "{0}  {1}x{2}  {3} KB" -f (Split-Path $OutPath -Leaf), $nw, $nh, [int]((Get-Item $OutPath).Length / 1KB)
  } finally {
    $img.Dispose()
    Remove-Item $raw -ErrorAction SilentlyContinue
  }
}

$items = @(
  @{ f = 'ESP32.jpg';                 out = 'esp32.jpg';      title = 'ESP32.jpg' },
  @{ f = 'ESP32 Dev Board.jpg';       out = 'esp32.jpg';      title = 'ESP32 Dev Board.jpg' },
  @{ f = 'AM2302 (DHT22) digital temperature and humidity sensor module.jpg'; out = 'dht22.jpg'; title = 'AM2302 (DHT22) digital temperature and humidity sensor module.jpg' },
  @{ f = '400 points breadboard.jpg'; out = 'breadboard.jpg'; title = '400 points breadboard.jpg' },
  @{ f = 'Miniature White House (16542003827).jpg'; out = 'model-house.jpg'; title = 'Miniature White House (16542003827).jpg' },
  @{ f = 'Photovoltaic Panels at the Travers Solar Farm.jpg'; out = 'solar.jpg'; title = 'Photovoltaic Panels at the Travers Solar Farm.jpg' }
)

# Chọn ảnh đầu tiên tồn tại cho mỗi output
$done = @{}
foreach ($it in $items) {
  if ($done.ContainsKey($it.out)) { continue }
  try {
    $thumb = Get-CommonsThumb -FileTitle $it.title
    $outPath = Join-Path $dest $it.out
    $res = Save-Resized -Url $thumb -OutPath $outPath
    Write-Output ("OK   " + $res)
    $done[$it.out] = $true
  } catch {
    Write-Output ("FAIL " + $it.title + " : " + $_.Exception.Message)
  }
}
Write-Output "---- ket qua ----"
Get-ChildItem $dest | ForEach-Object { "{0,-20} {1} KB" -f $_.Name, [int]($_.Length / 1KB) }
