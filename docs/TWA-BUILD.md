# TWA 빌드 — 이 환경에서 다시 하는 방법 (2026-09-07)

`bubblewrap` 은 대화형 프롬프트를 전제로 만들어져 있어서, TTY 가 없는 곳에서
그냥 실행하면 질문을 띄우다 `ERR_USE_AFTER_CLOSE` 로 죽는다. 아래는 프롬프트를
한 번도 만나지 않고 AAB 까지 가는 경로다. sudo 는 쓰지 않는다.

## 1. JDK 17 · Android SDK (홈 디렉터리, sudo 불필요)

```bash
mkdir -p ~/android-tools && cd ~/android-tools
curl -sL -o jdk17.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
tar xzf jdk17.tar.gz                      # → jdk-17.x.y+z
curl -sL -o cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
mkdir -p sdk/cmdline-tools && unzip -q cmdline-tools.zip -d sdk/cmdline-tools
mv sdk/cmdline-tools/cmdline-tools sdk/cmdline-tools/latest
export JAVA_HOME=~/android-tools/jdk-17.0.20.1+1
yes | sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=~/android-tools/sdk --licenses
sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=~/android-tools/sdk \
  "platform-tools" "platforms;android-34" "build-tools;36.1.0"
```

**build-tools 버전은 찍지 말고 확인해서 맞춘다.** bubblewrap 이 쓰는 버전이
소스에 박혀 있다. 다르면 zipalign 을 못 찾는다.

```bash
grep "BUILD_TOOLS_VERSION =" \
  $(npm root -g)/@bubblewrap/cli/node_modules/@bubblewrap/core/dist/lib/androidSdk/AndroidSdkTools.js
```

**`sdk/bin` 심볼릭 링크가 필요하다.** bubblewrap 의 `validatePath` 는 SDK 루트에
`tools/` 나 `bin/` 이 있는지로 경로를 판정한다. 요즘 sdkmanager 레이아웃에는
둘 다 없어서, 멀쩡한 SDK 를 두고 "androidSdkPath isn't correct" 가 난다.

```bash
ln -sfn ~/android-tools/sdk/cmdline-tools/latest/bin ~/android-tools/sdk/bin
```

## 2. 프롬프트 건너뛰기

첫 실행 질문("JDK 를 설치할까요?")은 **설정 파일을 먼저 써 두면** 나오지 않는다.

```bash
mkdir -p ~/.bubblewrap
cat > ~/.bubblewrap/config.json <<'JSON'
{ "jdkPath": "/home/user/android-tools/jdk-17.0.20.1+1",
  "androidSdkPath": "/home/user/android-tools/sdk" }
JSON
bubblewrap doctor     # "Your jdkpath and androidSdkPath are valid." 가 나와야 한다
```

`bubblewrap init` 은 질문이 많아서 쓰지 않는다. `twa/twa-manifest.json` 을 직접
쓰고 **`bubblewrap update`** 로 안드로이드 프로젝트를 생성한다 — 이 명령은
아무것도 묻지 않는다. (`build` 를 바로 부르면 "프로젝트를 다시 만들까요?"
프롬프트에서 죽는다.)

## 3. 서명 키 — 비밀번호를 명령줄에 쓰지 않는다

```bash
mkdir -p ~/meogja-signing && chmod 700 ~/meogja-signing && cd ~/meogja-signing
python3 -c "import secrets,string;print(''.join(secrets.choice(string.ascii_letters+string.digits) for _ in range(28)))" > store.pass
chmod 600 store.pass
$JAVA_HOME/bin/keytool -genkeypair -alias meogja-upload \
  -keyalg RSA -keysize 2048 -validity 10950 -keystore meogja-upload.jks -storetype JKS \
  -dname "CN=dalgonacrunch, OU=meogja, O=dalgonacrunch, L=Seoul, C=KR" \
  -storepass:file store.pass -keypass:file store.pass
```

`-storepass:file` 을 쓴다. `-storepass <값>` 은 비밀번호가 프로세스 목록과
셸 히스토리에 남는다. 키스토어는 **저장소 밖**에 둔다(`.gitignore` 에
`*.jks`·`*.keystore` 도 넣어 뒀지만, 애초에 안에 두지 않는 것이 낫다).

## 4. 빌드

```bash
cd twa
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat ~/meogja-signing/store.pass)"
export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
bubblewrap build --skipPwaValidation
```

환경변수로 주면 비밀번호를 묻지 않는다. `$(cat …)` 으로 읽어 값이 명령줄에
남지 않게 한다. 산출물: `app-release-bundle.aab`(스토어 업로드용),
`app-release-signed.apk`(기기에 직접 넣어 확인용).

첫 빌드는 Gradle 이 의존성을 받느라 몇 분 걸리고 `~/.gradle` 이 3GB 가 된다.

## 5. 확인

```bash
SDK=~/android-tools/sdk
$SDK/build-tools/36.1.0/apksigner verify --print-certs app-release-signed.apk
$SDK/cmdline-tools/latest/bin/apkanalyzer manifest print app-release-signed.apk | head -20
```

2026-09-07 빌드 결과: `com.dalgonacrunch.meogja`, versionCode 1, versionName
1.0.0, minSdk 23, targetSdk 36, 서명 지문이 업로드 키와 일치.
