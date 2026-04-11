Write-Host "Running Expo Prebuild..." -ForegroundColor Cyan
npx expo prebuild --platform android

Write-Host "Starting Gradle Release Build..." -ForegroundColor Cyan
cd android
$env:JAVA_HOME="D:\Android\Android Studio\jbr"
.\gradlew assembleRelease

cd ..
Write-Host "Build finished successfully!" -ForegroundColor Green