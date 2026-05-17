Add-Type -AssemblyName System.Drawing

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$assetsDir = Join-Path $projectRoot 'assets'

function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function New-Canvas {
    param(
        [int]$Width,
        [int]$Height,
        [bool]$Transparent = $true
    )

    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    if ($Transparent) {
        $bitmap.MakeTransparent()
    }

    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    return [pscustomobject]@{
        Bitmap = $bitmap
        Graphics = $graphics
    }
}

function Save-Canvas {
    param(
        $Canvas,
        [string]$Path
    )

    Ensure-Directory (Split-Path $Path -Parent)
    $Canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $Canvas.Graphics.Dispose()
    $Canvas.Bitmap.Dispose()
}

function Scale-Int {
    param(
        [int]$Value,
        [int]$Size
    )

    return [int][math]::Round($Value * $Size / 1024.0)
}

function New-PointArray {
    param(
        [int]$CenterX,
        [int]$CenterY,
        [int]$Size,
        [int]$Top,
        [int]$Side,
        [int]$Bottom,
        [int]$InsetTop,
        [int]$InsetSide,
        [int]$InsetBottom
    )

    $points = [System.Drawing.Point[]]::new(6)
    $points[0] = [System.Drawing.Point]::new($CenterX, $CenterY - (Scale-Int -Value $Top -Size $Size))
    $points[1] = [System.Drawing.Point]::new($CenterX + (Scale-Int -Value $Side -Size $Size), $CenterY - (Scale-Int -Value $InsetTop -Size $Size))
    $points[2] = [System.Drawing.Point]::new($CenterX + (Scale-Int -Value ($Side - 30) -Size $Size), $CenterY + (Scale-Int -Value $InsetSide -Size $Size))
    $points[3] = [System.Drawing.Point]::new($CenterX, $CenterY + (Scale-Int -Value $Bottom -Size $Size))
    $points[4] = [System.Drawing.Point]::new($CenterX - (Scale-Int -Value ($Side - 30) -Size $Size), $CenterY + (Scale-Int -Value $InsetSide -Size $Size))
    $points[5] = [System.Drawing.Point]::new($CenterX - (Scale-Int -Value $Side -Size $Size), $CenterY - (Scale-Int -Value $InsetTop -Size $Size))

    return $points
}

function Draw-GlowCircle {
    param(
        [System.Drawing.Graphics]$Graphics,
        [int]$CenterX,
        [int]$CenterY,
        [int]$Radius,
        [System.Drawing.Color]$Color,
        [int]$Alpha
    )

    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($Alpha, $Color.R, $Color.G, $Color.B))
    try {
        $Graphics.FillEllipse($brush, $CenterX - $Radius, $CenterY - $Radius, $Radius * 2, $Radius * 2)
    }
    finally {
        $brush.Dispose()
    }
}

function Draw-Grid {
    param(
        [System.Drawing.Graphics]$Graphics,
        [int]$Width,
        [int]$Height,
        [int]$Spacing,
        [System.Drawing.Color]$Color
    )

    $pen = [System.Drawing.Pen]::new($Color, 2)
    try {
        for ($x = 0; $x -le $Width; $x += $Spacing) {
            $Graphics.DrawLine($pen, $x, 0, $x, $Height)
        }

        for ($y = 0; $y -le $Height; $y += $Spacing) {
            $Graphics.DrawLine($pen, 0, $y, $Width, $y)
        }
    }
    finally {
        $pen.Dispose()
    }
}

function Draw-ShieldEmblem {
    param(
        [System.Drawing.Graphics]$Graphics,
        [int]$CenterX,
        [int]$CenterY,
        [int]$Size
    )

    $outerBounds = [System.Drawing.Rectangle]::new($CenterX - (Scale-Int -Value 200 -Size $Size), $CenterY - (Scale-Int -Value 240 -Size $Size), (Scale-Int -Value 400 -Size $Size), (Scale-Int -Value 520 -Size $Size))
    $innerBounds = [System.Drawing.Rectangle]::new($CenterX - (Scale-Int -Value 150 -Size $Size), $CenterY - (Scale-Int -Value 170 -Size $Size), (Scale-Int -Value 300 -Size $Size), (Scale-Int -Value 350 -Size $Size))

    $outerBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($outerBounds, [System.Drawing.Color]::FromArgb(89, 217, 255), [System.Drawing.Color]::FromArgb(27, 230, 176), 45)
    $innerBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($innerBounds, [System.Drawing.Color]::FromArgb(11, 17, 31), [System.Drawing.Color]::FromArgb(16, 36, 64), 45)
    $outlinePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 255, 255, 255), [math]::Max(3, [int]($Size / 256)))
    $wavePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 102, 192, 255), [math]::Max(2, [int]($Size / 320)))

    try {
        $shadowBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(75, 0, 0, 0))
        try {
            $shadowPoints = New-PointArray -CenterX ($CenterX + (Scale-Int -Value 18 -Size $Size)) -CenterY ($CenterY + (Scale-Int -Value 18 -Size $Size)) -Size $Size -Top 160 -Side 190 -Bottom 320 -InsetTop 90 -InsetSide 130 -InsetBottom 0
            $Graphics.FillPolygon($shadowBrush, $shadowPoints)
        }
        finally {
            $shadowBrush.Dispose()
        }

        $shieldPoints = New-PointArray -CenterX $CenterX -CenterY $CenterY -Size $Size -Top 160 -Side 190 -Bottom 320 -InsetTop 90 -InsetSide 130 -InsetBottom 0
        $innerPoints = New-PointArray -CenterX $CenterX -CenterY $CenterY -Size $Size -Top 118 -Side 140 -Bottom 244 -InsetTop 66 -InsetSide 96 -InsetBottom 0

        $Graphics.FillPolygon($outerBrush, $shieldPoints)
        $Graphics.FillPolygon($innerBrush, $innerPoints)
        $Graphics.DrawPolygon($outlinePen, $shieldPoints)

        $ring1 = [System.Drawing.Rectangle]::new($CenterX - (Scale-Int -Value 150 -Size $Size), $CenterY - (Scale-Int -Value 108 -Size $Size), (Scale-Int -Value 300 -Size $Size), (Scale-Int -Value 216 -Size $Size))
        $ring2 = [System.Drawing.Rectangle]::new($CenterX - (Scale-Int -Value 205 -Size $Size), $CenterY - (Scale-Int -Value 160 -Size $Size), (Scale-Int -Value 410 -Size $Size), (Scale-Int -Value 320 -Size $Size))
        $Graphics.DrawArc($wavePen, $ring2, 200, 140)
        $Graphics.DrawArc($wavePen, $ring1, 190, 160)
        $Graphics.DrawEllipse($outlinePen, $ring1)

        $pulseBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(120, 255, 255, 255))
        $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
        try {
            $Graphics.FillEllipse($pulseBrush, $CenterX - (Scale-Int -Value 18 -Size $Size), $CenterY - (Scale-Int -Value 18 -Size $Size), (Scale-Int -Value 36 -Size $Size), (Scale-Int -Value 36 -Size $Size))
            $Graphics.FillEllipse($dotBrush, $CenterX - (Scale-Int -Value 8 -Size $Size), $CenterY - (Scale-Int -Value 8 -Size $Size), (Scale-Int -Value 16 -Size $Size), (Scale-Int -Value 16 -Size $Size))
        }
        finally {
            $pulseBrush.Dispose()
            $dotBrush.Dispose()
        }
    }
    finally {
        $outerBrush.Dispose()
        $innerBrush.Dispose()
        $outlinePen.Dispose()
        $wavePen.Dispose()
    }
}

function Draw-IconOnly {
    param(
        [string]$Path,
        [bool]$WithBackground = $false
    )

    $canvas = New-Canvas -Width 1024 -Height 1024 -Transparent:(-not $WithBackground)
    try {
        $graphics = $canvas.Graphics
        if ($WithBackground) {
            $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
                ([System.Drawing.Rectangle]::new(0, 0, 1024, 1024)),
                [System.Drawing.Color]::FromArgb(9, 17, 31),
                [System.Drawing.Color]::FromArgb(16, 27, 45),
                90
            )
            try {
                $graphics.FillRectangle($bgBrush, 0, 0, 1024, 1024)
            }
            finally {
                $bgBrush.Dispose()
            }

            Draw-Grid -Graphics $graphics -Width 1024 -Height 1024 -Spacing 128 -Color ([System.Drawing.Color]::FromArgb(18, 89, 217, 255))
        }

        Draw-GlowCircle -Graphics $graphics -CenterX 512 -CenterY 512 -Radius 360 -Color ([System.Drawing.Color]::FromArgb(89, 217, 255)) -Alpha 28
        Draw-GlowCircle -Graphics $graphics -CenterX 512 -CenterY 512 -Radius 250 -Color ([System.Drawing.Color]::FromArgb(27, 230, 176)) -Alpha 18
        Draw-ShieldEmblem -Graphics $graphics -CenterX 512 -CenterY 448 -Size 1024
        Save-Canvas -Canvas $canvas -Path $Path
    }
    catch {
        $canvas.Graphics.Dispose()
        $canvas.Bitmap.Dispose()
        throw
    }
}

function Draw-Splash {
    param(
        [string]$Path,
        [bool]$DarkVariant = $false
    )

    $canvas = New-Canvas -Width 2732 -Height 2732 -Transparent:$false
    try {
        $graphics = $canvas.Graphics
        $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
            ([System.Drawing.Rectangle]::new(0, 0, 2732, 2732)),
            [System.Drawing.Color]::FromArgb(9, 17, 31),
            [System.Drawing.Color]::FromArgb(19, 28, 48),
            90
        )
        try {
            $graphics.FillRectangle($bgBrush, 0, 0, 2732, 2732)
        }
        finally {
            $bgBrush.Dispose()
        }

        Draw-Grid -Graphics $graphics -Width 2732 -Height 2732 -Spacing 140 -Color ([System.Drawing.Color]::FromArgb(22, 89, 217, 255))
        Draw-GlowCircle -Graphics $graphics -CenterX 760 -CenterY 840 -Radius 420 -Color ([System.Drawing.Color]::FromArgb(89, 217, 255)) -Alpha 28
        Draw-GlowCircle -Graphics $graphics -CenterX 1960 -CenterY 760 -Radius 320 -Color ([System.Drawing.Color]::FromArgb(27, 230, 176)) -Alpha 20

        if ($DarkVariant) {
            $overlayBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(48, 2, 6, 16))
            try {
                $graphics.FillRectangle($overlayBrush, 0, 0, 2732, 2732)
            }
            finally {
                $overlayBrush.Dispose()
            }
        }

        Draw-ShieldEmblem -Graphics $graphics -CenterX 1366 -CenterY 1000 -Size 1800

        $titleFont = [System.Drawing.Font]::new('Segoe UI Semibold', 120, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subtitleFont = [System.Drawing.Font]::new('Segoe UI', 44, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(245, 245, 248, 255))
        $subtitleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(190, 208, 216, 230))
        try {
            $title = 'SecureSense'
            $subtitle = 'Smart IoT Security Monitoring'
            $titleSize = $graphics.MeasureString($title, $titleFont)
            $subtitleSize = $graphics.MeasureString($subtitle, $subtitleFont)
            $titleX = [int](1366 - ($titleSize.Width / 2))
            $subtitleX = [int](1366 - ($subtitleSize.Width / 2))

            $graphics.DrawString($title, $titleFont, $titleBrush, $titleX, 1810)
            $graphics.DrawString($subtitle, $subtitleFont, $subtitleBrush, $subtitleX, 1950)
        }
        finally {
            $titleFont.Dispose()
            $subtitleFont.Dispose()
            $titleBrush.Dispose()
            $subtitleBrush.Dispose()
        }

        Save-Canvas -Canvas $canvas -Path $Path
    }
    catch {
        $canvas.Graphics.Dispose()
        $canvas.Bitmap.Dispose()
        throw
    }
}

Ensure-Directory $assetsDir

$iconOnly = Join-Path $assetsDir 'icon-only.png'
$iconForeground = Join-Path $assetsDir 'icon-foreground.png'
$iconBackground = Join-Path $assetsDir 'icon-background.png'
$splash = Join-Path $assetsDir 'splash.png'
$splashDark = Join-Path $assetsDir 'splash-dark.png'

Draw-IconOnly -Path $iconOnly
Copy-Item $iconOnly $iconForeground -Force
Draw-IconOnly -Path $iconBackground -WithBackground $true
Draw-Splash -Path $splash
Draw-Splash -Path $splashDark -DarkVariant $true

$androidRes = Join-Path $projectRoot 'android/app/src/main/res'
$androidIconTargets = @(
    'mipmap-mdpi/ic_launcher.png',
    'mipmap-mdpi/ic_launcher_round.png',
    'mipmap-mdpi/ic_launcher_foreground.png',
    'mipmap-hdpi/ic_launcher.png',
    'mipmap-hdpi/ic_launcher_round.png',
    'mipmap-hdpi/ic_launcher_foreground.png',
    'mipmap-xhdpi/ic_launcher.png',
    'mipmap-xhdpi/ic_launcher_round.png',
    'mipmap-xhdpi/ic_launcher_foreground.png',
    'mipmap-xxhdpi/ic_launcher.png',
    'mipmap-xxhdpi/ic_launcher_round.png',
    'mipmap-xxhdpi/ic_launcher_foreground.png',
    'mipmap-xxxhdpi/ic_launcher.png',
    'mipmap-xxxhdpi/ic_launcher_round.png',
    'mipmap-xxxhdpi/ic_launcher_foreground.png'
)

foreach ($relativePath in $androidIconTargets) {
    Copy-Item $iconOnly (Join-Path $androidRes $relativePath) -Force
}

$androidSplashTargets = @(
    'drawable/splash.png',
    'drawable-port-mdpi/splash.png',
    'drawable-port-hdpi/splash.png',
    'drawable-port-xhdpi/splash.png',
    'drawable-port-xxhdpi/splash.png',
    'drawable-port-xxxhdpi/splash.png',
    'drawable-land-mdpi/splash.png',
    'drawable-land-hdpi/splash.png',
    'drawable-land-xhdpi/splash.png',
    'drawable-land-xxhdpi/splash.png',
    'drawable-land-xxxhdpi/splash.png'
)

foreach ($relativePath in $androidSplashTargets) {
    Copy-Item $splash (Join-Path $androidRes $relativePath) -Force
}

$iosRoot = Join-Path $projectRoot 'ios/App/App/Assets.xcassets'
Copy-Item $iconOnly (Join-Path $iosRoot 'AppIcon.appiconset/AppIcon-512@2x.png') -Force
Copy-Item $splash (Join-Path $iosRoot 'Splash.imageset/splash-2732x2732.png') -Force
Copy-Item $splash (Join-Path $iosRoot 'Splash.imageset/splash-2732x2732-1.png') -Force
Copy-Item $splashDark (Join-Path $iosRoot 'Splash.imageset/splash-2732x2732-2.png') -Force

Write-Host "Brand assets generated in $assetsDir"
