Write-Host "Running Expo Prebuild..." -ForegroundColor Cyan
npx expo prebuild --platform android

Write-Host "Starting Gradle AAB (App Bundle) Build..." -ForegroundColor Cyan
cd android
$env:JAVA_HOME="D:\Android\Android Studio\jbr"
.\gradlew bundleRelease

cd ..
Write-Host "AAB Build finished successfully! Ready for Google Play." -ForegroundColor Green