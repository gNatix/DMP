# Production Build Script
# Builds with production environment variables baked in

Write-Host "Building DM Planner for production..." -ForegroundColor Cyan

# Set environment variables for build
$env:VITE_SUPABASE_URL = "https://mbjrmynikxbnijpcsiaz.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ianJteW5pa3hibmlqcGNzaWF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MjAzMzksImV4cCI6MjA4MTA5NjMzOX0.k4wc7MQQUSQ1QoVQVRvYiSFsT7uTUYZwqW81aWlvhbI"

# Run build
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nBuild successful! ✅" -ForegroundColor Green
    Write-Host "Output in: dist/" -ForegroundColor Yellow
    Write-Host "`nYou can now deploy the dist/ folder to your server." -ForegroundColor Cyan
} else {
    Write-Host "`nBuild failed! ❌" -ForegroundColor Red
    exit 1
}
