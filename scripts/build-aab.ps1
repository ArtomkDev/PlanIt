Write-Host "Clearing bundler cache..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "node_modules\.cache\metro" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "node_modules\.cache\babel-loader" -ErrorAction SilentlyContinue

Write-Host "Starting Gradle AAB (App Bundle) Build..." -ForegroundColor Cyan
cd android
$env:JAVA_HOME="D:\Android\Android Studio\jbr"
.\gradlew bundleRelease

cd ..
Write-Host "AAB Build finished successfully! Ready for Google Play." -ForegroundColor Green