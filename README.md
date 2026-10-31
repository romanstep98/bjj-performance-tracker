# BUILT TO ROLL — Android beta v7

Osobní offline deník pro BJJ a silový trénink. Zachovává vzhled a funkce dodané HTML verze v7.

## Instalace do telefonu

1. V tomto repozitáři otevři **Actions → Android APK**.
2. Otevři poslední úspěšný běh se zelenou fajfkou.
3. V části **Artifacts** stáhni **BUILT-TO-ROLL-Android** (musíš být přihlášený na GitHubu).
4. Rozbal ZIP a v telefonu otevři `app-debug.apk`.
5. Pokud Android požádá, povol instalaci z daného prohlížeče/správce souborů a dokonči instalaci.

Jde o testovací APK podepsané vývojovým klíčem, nikoli vydání v Google Play. Klíč GitHub runneru nemusí být mezi běhy stejný; před případnou odinstalací kvůli nekompatibilnímu podpisu vždy exportuj JSON zálohu. Pro stabilní aktualizace je potřeba později nastavit trvalý podpisový klíč.

## Funkce

- Gi, No-Gi, Open Mat, silový a kondiční trénink, regenerace a vlastní aktivity.
- Techniky, sparingová kola, délka, RPE, cviky, série, opakování, váhy a RIR.
- Plánování v kalendáři, kopírování jednotek, historie a statistiky.
- Spánek, denní check-in, hmotnost a turnaje s odpočtem.
- Export JSON, obnova JSON, export tréninků a vážení do CSV.
- První spuštění otevře prázdný deník. Ukázková data lze zapnout v Profilu.

## Data a zálohy

Data se ukládají do místního úložiště Android WebView. Aplikace nevyžaduje internetové ani plošné souborové oprávnění. Soubory záloh vybíráš v systémovém dialogu Androidu. Vymazání dat aplikace nebo její odinstalace smaže deník. Pravidelně používej **Profil → Export JSON** a soubor uchovávej mimo aplikaci.

Existující záznamy z původního HTML se nepřenášejí automaticky. V HTML použij Export JSON; v Android aplikaci **Profil → Obnovit zálohu**. Obnova nahrazuje celý deník, neslučuje záznamy.

„Asistent“ v původní v7 používá místní pravidla, není připojený k ChatGPT. Cloudová synchronizace, systémové připomínky ani propojení s Google Kalendářem zatím nejsou implementované.

## Sestavení

JDK 17, Android SDK 36, Gradle 8.13 a Android Gradle Plugin 8.13.2:

```sh
gradle assembleDebug lintDebug
```

Výsledek: `app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions připraví nástroje automaticky. Lokálně lze projekt otevřít v kompatibilním Android Studiu; Gradle wrapper zatím není součástí repozitáře, použij instalovaný Gradle 8.13.

## Zdrojové soubory

- `reference/BJJ-Performance-Tracker-beta-v7.html`: nezměněný originál.
- `app/src/main/assets/index.html`: verze pro Android se stejným vzhledem, prázdným startem a exportem přes systémový dialog.
- `app/src/main/java/cz/builttoroll/app/MainActivity.java`: offline WebView, import/export, potvrzovací dialogy a tlačítko Zpět.
- `.github/workflows/android.yml`: sestavení APK a Android lint.

## Kontrola rozhraní

Datovou logiku a generování obrazovek lze ověřit pomocí Node.js:

```sh
node tests/smoke.cjs
```

Android dialogy, instalaci, chování klávesnice a ukládání po restartu je nutné ověřit na telefonu nebo emulátoru.
