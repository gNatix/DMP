# ==============================================
# DM PLANNER - COMPLETE DEPLOY SCRIPT
# Uploads assets AND PHP files to FTP
# ==============================================

$FTP_HOST = "ftp.natixlabs.com"
$FTP_USER = "u647298325.dmpAdmin"
$FTP_PASS = "DMP-admin1"
$FTP_ASSETS_PATH = "/public_html/assets"
$FTP_ROOT_PATH = "/public_html"
$LOCAL_ASSETS_PATH = "d:\IT projekter\DM planner\assets"
$LOCAL_SERVER_PATH = "d:\IT projekter\DM planner\server"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DM PLANNER - COMPLETE DEPLOY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Test FTP connection
Write-Host "[1/3] Testing FTP connection..." -ForegroundColor Yellow
try {
    $testRequest = [System.Net.WebRequest]::Create("ftp://$FTP_HOST/")
    $testRequest.Credentials = New-Object System.Net.NetworkCredential($FTP_USER, $FTP_PASS)
    $testRequest.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
    $response = $testRequest.GetResponse()
    Write-Host "      FTP connection successful!" -ForegroundColor Green
    $response.Close()
}
catch {
    Write-Host "      FTP connection failed: $_" -ForegroundColor Red
    exit 1
}

# Helper functions
function Upload-File {
    param([string]$LocalFile, [string]$RemotePath)
    try {
        $webclient = New-Object System.Net.WebClient
        $webclient.Credentials = New-Object System.Net.NetworkCredential($FTP_USER, $FTP_PASS)
        $uri = "ftp://$FTP_HOST$RemotePath"
        $webclient.UploadFile($uri, $LocalFile)
        return $true
    }
    catch {
        return $false
    }
}

function Create-FTPDirectory {
    param([string]$RemotePath)
    try {
        $makeDirectory = [System.Net.WebRequest]::Create("ftp://$FTP_HOST$RemotePath")
        $makeDirectory.Credentials = New-Object System.Net.NetworkCredential($FTP_USER, $FTP_PASS)
        $makeDirectory.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $makeDirectory.GetResponse() | Out-Null
    }
    catch {
        # Directory already exists - that's fine
    }
}

function Ensure-FTPPath {
    param([string]$RemotePath)
    $parts = $RemotePath.Split('/') | Where-Object { $_ -ne '' }
    $currentPath = ""
    foreach ($part in $parts) {
        $currentPath = "$currentPath/$part"
        Create-FTPDirectory $currentPath
    }
}

# ==============================================
# STEP 2: Upload PHP files
# ==============================================
Write-Host ""
Write-Host "[2/3] Uploading PHP files..." -ForegroundColor Yellow

$phpFiles = @(
    @{ Local = "$LOCAL_SERVER_PATH\list-files.php"; Remote = "$FTP_ROOT_PATH/list-files.php" }
)

$phpSuccess = 0
$phpFailed = 0

foreach ($file in $phpFiles) {
    if (Test-Path $file.Local) {
        Write-Host "      Uploading: $($file.Local)" -ForegroundColor Cyan
        $result = Upload-File -LocalFile $file.Local -RemotePath $file.Remote
        if ($result) {
            Write-Host "      -> Success" -ForegroundColor Green
            $phpSuccess++
        } else {
            Write-Host "      -> Failed" -ForegroundColor Red
            $phpFailed++
        }
    } else {
        Write-Host "      File not found: $($file.Local)" -ForegroundColor Red
        $phpFailed++
    }
}

# ==============================================
# STEP 3: Upload Assets
# ==============================================
Write-Host ""
Write-Host "[3/3] Uploading assets..." -ForegroundColor Yellow

$assetFolders = @('maps', 'tokens', 'room-elements', 'terrain brushes', 'backgrounds', 'masks')
$assetSuccess = 0
$assetFailed = 0

foreach ($folder in $assetFolders) {
    $localFolder = "$LOCAL_ASSETS_PATH\$folder"
    if (!(Test-Path $localFolder)) {
        continue
    }
    
    # Create all directories first
    $directories = Get-ChildItem -Path $localFolder -Recurse -Directory -ErrorAction SilentlyContinue
    foreach ($dir in $directories) {
        $relativePath = $dir.FullName.Substring($LOCAL_ASSETS_PATH.Length).Replace('\', '/')
        Ensure-FTPPath "$FTP_ASSETS_PATH$relativePath"
    }
    
    # Upload all files
    $files = Get-ChildItem -Path $localFolder -Recurse -File -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($LOCAL_ASSETS_PATH.Length).Replace('\', '/')
        Write-Host "      $($file.Name)" -ForegroundColor Gray -NoNewline
        $result = Upload-File -LocalFile $file.FullName -RemotePath "$FTP_ASSETS_PATH$relativePath"
        if ($result) {
            Write-Host " [OK]" -ForegroundColor Green
            $assetSuccess++
        } else {
            Write-Host " [FAIL]" -ForegroundColor Red
            $assetFailed++
        }
    }
}

# ==============================================
# SUMMARY
# ==============================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DEPLOY COMPLETE" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  PHP Files:    $phpSuccess uploaded" -ForegroundColor $(if ($phpFailed -eq 0) { "Green" } else { "Yellow" })
if ($phpFailed -gt 0) {
    Write-Host "                $phpFailed failed" -ForegroundColor Red
}
Write-Host "  Asset Files:  $assetSuccess uploaded" -ForegroundColor $(if ($assetFailed -eq 0) { "Green" } else { "Yellow" })
if ($assetFailed -gt 0) {
    Write-Host "                $assetFailed failed" -ForegroundColor Red
}
Write-Host ""

if ($phpFailed -eq 0 -and $assetFailed -eq 0) {
    Write-Host "  All files deployed successfully!" -ForegroundColor Green
} else {
    Write-Host "  Some files failed to upload. Check above for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "  Test the API: https://dmp.natixlabs.com/list-files.php?path=tokens/monsters" -ForegroundColor Cyan
Write-Host ""
