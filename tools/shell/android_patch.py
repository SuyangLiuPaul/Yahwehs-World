#!/usr/bin/env python3
"""Idempotent patch of the generated Android project (src-tauri/gen/android).

gen/ is gitignored and rewritten by `cargo tauri android init`, so everything that must survive lives here and is re-applied on
every build by tools/build_android.sh and tools/build_apk.sh. It touches only files under the directory it is given.

What it sets:
  1. applicationId from the Gradle property `ywAppId` (default com.yahwehword.world, the id of the stores). The GitHub APK passes
     ywAppId=com.yahwehsworld.globe, the id v0.1.1 to v0.1.9 were distributed under, so installed copies keep updating. `namespace`
     (the Kotlin package) stays com.yahwehword.world either way; the two are independent in Gradle.
  2. versionCode from versionName with Words' formula (major*1e6 + minor*1e3 + patch, times 10, plus a build number 1-9 from the
     Gradle property `ywBuildNumber`, default 1), so the same visible version can be uploaded twice.
  3. release signing, read from Gradle properties and environment variable NAMES only. This script never reads a keystore:
        -PywKeystorePath=/path/to/upload-keystore.jks   (or ORG_GRADLE_PROJECT_ywKeystorePath)
        -PywKeyAlias=<alias>                            (or ORG_GRADLE_PROJECT_ywKeyAlias)
        YW_KEYSTORE_PASSWORD, YW_KEY_PASSWORD           environment variables (the key password defaults to the store password)
     The legacy key.properties file (tools/build_apk.sh, GitHub APK) is still honoured when present. With none of these set the
     release build is simply unsigned.
  4. the name under the icon in English, 简, 繁 (zh-TW, zh-HK, zh-MO and the script qualifier) and Russian, and the launch theme colour.
  5. light status-bar and navigation-bar icons. The app draws edge to edge under bars that sit on the navy header and tab bar; the
     template's enableEdgeToEdge() picks the icon colour from the PHONE's day/night mode, so on a phone in the light theme the clock
     and battery came out dark on navy and nearly invisible. MainActivity.kt now asks for SystemBarStyle.dark (light icons) and
     also sets isAppearanceLightStatusBars/NavigationBars = false.
"""
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1])
gradle = root / "app/build.gradle.kts"
text = gradle.read_text()

MARK = "// yw-shell-patch v1"
if MARK not in text:
    # --- header: signing properties -------------------------------------------------------------------------------
    loader = f'''{MARK}
val ywLegacyKeys = Properties().apply {{
    val f = rootProject.file("key.properties")
    if (f.exists()) f.inputStream().use {{ load(it) }}
}}
val ywKeystorePath: String? = (project.findProperty("ywKeystorePath") as String?) ?: ywLegacyKeys.getProperty("storeFile")
val ywStorePassword: String? = System.getenv("YW_KEYSTORE_PASSWORD") ?: ywLegacyKeys.getProperty("password")
'''
    anchor = "android {"
    assert anchor in text, "no android block"
    text = text.replace(anchor, loader + "\n" + anchor, 1)

    # --- applicationId ----------------------------------------------------------------------------------------------
    m = re.search(r'applicationId = "([^"]+)"', text)
    assert m, "no applicationId"
    text = text.replace(m.group(0), f'applicationId = (project.findProperty("ywAppId") as String?) ?: "{m.group(1)}"', 1)

    # --- versionCode ------------------------------------------------------------------------------------------------
    old = re.search(r'versionCode = [^\n]+', text)
    assert old, "no versionCode"
    new = '''versionCode = (project.findProperty("ywVersionCode") as String?)?.toIntOrNull()
            ?: tauriProperties.getProperty("tauri.android.versionName", "1.0").split(".").map { it.toIntOrNull() ?: 0 }.let { p ->
                val build = ((project.findProperty("ywBuildNumber") as String?)?.toIntOrNull() ?: 1).coerceIn(1, 9)
                (p.getOrElse(0) { 0 } * 1_000_000 + p.getOrElse(1) { 0 } * 1_000 + p.getOrElse(2) { 0 }) * 10 + build
            }'''
    text = text.replace(old.group(0), new, 1)

    # --- signing ----------------------------------------------------------------------------------------------------
    signing = '''    signingConfigs {
        create("ywRelease") {
            if (ywKeystorePath != null) {
                storeFile = file(ywKeystorePath)
                storePassword = ywStorePassword
                keyAlias = (project.findProperty("ywKeyAlias") as String?) ?: ywLegacyKeys.getProperty("keyAlias")
                keyPassword = System.getenv("YW_KEY_PASSWORD") ?: ywStorePassword
            }
        }
    }
'''
    assert "    buildTypes {" in text, "no buildTypes"
    text = text.replace("    buildTypes {", signing + "    buildTypes {", 1)
    rel = '        getByName("release") {\n            isMinifyEnabled = true'
    assert rel in text, "no release build type"
    text = text.replace(rel, '        getByName("release") {\n            if (ywKeystorePath != null) signingConfig = signingConfigs.getByName("ywRelease")\n            isMinifyEnabled = true', 1)
    gradle.write_text(text)
    print("   app/build.gradle.kts patched")
else:
    print("   app/build.gradle.kts already patched")

# --- the name under the icon ----------------------------------------------------------------------------------------
res = root / "app/src/main/res"
# A string resource carries a literal apostrophe inside double quotes (&apos; is valid XML and AAPT still refuses it).
NAMES = [
    ("values", '"Yahweh\'s World"'),
    ("values-zh", '"雅偉之界"'),
    ("values-zh-rTW", '"雅偉之界"'),
    ("values-zh-rHK", '"雅偉之界"'),
    ("values-zh-rMO", '"雅偉之界"'),
    ("values-b+zh+Hant", '"雅偉之界"'),
    ("values-ru", '"Мир Яхве"'),
]
for values, label in NAMES:
    d = res / values
    d.mkdir(parents=True, exist_ok=True)
    f = d / "strings.xml"
    if f.exists():
        new = f.read_text()
        for key in ("app_name", "main_activity_title"):
            if f'name="{key}"' in new:
                new = re.sub(rf'(<string name="{key}">).*?(</string>)', lambda mm: mm.group(1) + label + mm.group(2), new)
            else:
                new = new.replace("</resources>", f'    <string name="{key}">{label}</string>\n</resources>')
        f.write_text(new)
    else:
        f.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                     f'    <string name="app_name">{label}</string>\n'
                     f'    <string name="main_activity_title">{label}</string>\n</resources>\n')
    print(f"   {values}/strings.xml -> {label}")

# --- the launch screen: the site's ground colour instead of a white flash (src/tokens.css --ground) -----------------
GROUND = "#060d16"
(res / "values").mkdir(parents=True, exist_ok=True)
(res / "values/colors.xml").write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                                        f'    <color name="ground">{GROUND}</color>\n</resources>\n')
ITEMS = ('        <item name="android:windowBackground">@color/ground</item>\n'
         '        <item name="android:statusBarColor">@color/ground</item>\n'
         '        <item name="android:navigationBarColor">@color/ground</item>\n'
         '        <item name="android:windowLightStatusBar">false</item>\n')
STYLE = re.compile(r'(<style name="Theme\.app"[^>]*>\n)')
for values in ("values", "values-night"):
    f = res / values / "themes.xml"
    if not f.exists():
        continue
    t = f.read_text()
    if "android:windowBackground" in t:
        print(f"   {values}/themes.xml already carries it")
        continue
    new, n = STYLE.subn(lambda mm: mm.group(1) + ITEMS, t, count=1)
    if n == 0:
        print(f"   !! could not find Theme.app in {values}/themes.xml", file=sys.stderr)
        continue
    f.write_text(new)
    print(f"   {values}/themes.xml -> windowBackground {GROUND}")

# --- MainActivity: light status/navigation icons whatever the phone's day/night mode ---------------------------------
activity = next(iter((root / "app/src/main/java").rglob("MainActivity.kt")), None)
if activity is None:
    print("   !! no MainActivity.kt found: status-bar icons not patched", file=sys.stderr)
else:
    src = activity.read_text()
    if "SystemBarStyle.dark" in src:
        print("   MainActivity.kt already asks for light status-bar icons")
    elif "enableEdgeToEdge()" not in src:
        print("   !! MainActivity.kt has no enableEdgeToEdge() call to replace", file=sys.stderr)
    else:
        src = src.replace("enableEdgeToEdge()",
                          "enableEdgeToEdge(\n"
                          "      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),\n"
                          "      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT)\n"
                          "    )", 1)
        src = src.replace("    super.onCreate(savedInstanceState)\n",
                          "    super.onCreate(savedInstanceState)\n"
                          "    WindowCompat.getInsetsController(window, window.decorView).apply {\n"
                          "      isAppearanceLightStatusBars = false\n"
                          "      isAppearanceLightNavigationBars = false\n"
                          "    }\n", 1)
        src = src.replace("import android.os.Bundle\n",
                          "import android.graphics.Color\nimport android.os.Bundle\n", 1)
        src = src.replace("import androidx.activity.enableEdgeToEdge\n",
                          "import androidx.activity.SystemBarStyle\nimport androidx.activity.enableEdgeToEdge\nimport androidx.core.view.WindowCompat\n", 1)
        activity.write_text(src)
        print("   MainActivity.kt -> light status-bar and navigation-bar icons")
