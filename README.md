# BUILT TO ROLL · Android 0.3.0

## Nové v aktualizaci 0.3.0

- Kalendář spojuje sport, denní/noční/vlastní směny, práci z domova,
  rezervace spánku a konkrétní dostupné termíny posilovny.
- Více dnů lze označit najednou i přes více měsíců. Noční patří ke dni
  začátku, její pokračování se ukazuje také následující den.
- Práce z domova také blokuje souběh s tréninkem. Do vlastního intervalu lze
  zahrnout dojíždění. Rezervace spánku se nepočítá jako skutečně naspané hodiny.
- Návrh bloku: vlastní období do 366 dnů nebo konec podle uloženého turnaje;
  cíle síla, výbušnost, kondice a kombinace. Náhled uvádí důvody a vynechané
  termíny. Teprve tlačítko Uložit vloží jednotky; stávající záznamy nemění.
- Cviky mají část tréninku a volitelné stejné označení kombinace/okruhu.
  Původní předpis z návrhu se uchová odděleně od pozdějších výsledků.
- Nový check-in vyžaduje vlastní odpovědi namísto předvyplněných hodnot.
- Nové údaje jsou součástí stejné JSON zálohy. Staré zálohy zůstávají kompatibilní.
- Uložení tréninku při chybě úložiště neuzavře formulář a zachová původní deník.

## Jak používat plánování

1. V Profilu vyber dostupné vybavení a zkušenosti. Vlastní váha je také vybavení.
2. V Kalendáři otevři Směny a dostupnost, označ dny a ulož pracovní intervaly.
3. Přidej rezervovaný spánek, zejména po noční směně. Potom zadej BJJ.
4. Označ konkrétní dny pro posilovnu, časové okno a délku 20–120 minut.
5. Otevři Sestavit plán, vyber období a cíl, zobraz návrh, zkontroluj důvody
   a vlož jej do kalendáře. Každou jednotku lze dále upravit v běžném editoru.
6. Před tréninkem vyplň aktuální check-in. Nový check-in automaticky nemění již
   uložené jednotky; podle aktuálního stavu je uprav ručně nebo vytvoř nový návrh.

## Rozsah plánovače a ověření

Jde o transparentní základní šablony s pravidly, nikoli naučený model nebo
klinicky ověřený trenérský systém. Nezvyšuje automaticky kilogramy a neodvozuje
maxima. Poslední zátěž do 90 dnů může převzít pouze ze stejného cviku,
jednotky, počtu opakování a nejvýše cílového RPE; jinak je 0 kg zástupná
hodnota k ručnímu doplnění. Není to doporučení cvičit s nulovou zátěží.

Vynechá přímé kolize, den volna/turnaje, sousední silové dny a podle volby den
s BJJ. Po noční vyžaduje rezervaci nejméně 6 hodin spánku před začátkem;
tato hranice je heuristika aplikace, nikoli potvrzení připravenosti ani
individuální doporučení délky spánku. Skutečné zotavení není z rezervace známé.
BJJ v sousedních dnech, check-in s únavou, čtvrtý týden a blízký turnaj omezují
objem. Při uvedených pohybových omezeních nebo bolesti v daném dni je nutný
ruční plán. Volný text preferencí se automaticky neinterpretuje. Vynechané
cviky se porovnávají názvem/aliasem; důsledky zdravotních omezení se neodhadují.
Délka jednotky je dostupný rozpočet, odhad času cviků nenahrazuje měření.

RPE/RIR vychází z běžného subjektivního popisu rezervy. Odborné pozadí:
https://pubmed.ncbi.nlm.nih.gov/31009432/ . Studie není validací tohoto
plánovače, jeho šablon, mezí ani jejich účinku pro BJJ.

Lokální `node tests/smoke.cjs` kontroluje kompatibilitu dat a plánovací pravidla.
GitHub Actions navíc spouští skutečné Chromium na mobilních i desktopových
šířkách, testy nativního čtení záloh, Android build a lint. Ověření na fyzickém
telefonu je samostatný krok. APK v artefaktu `BUILT-TO-ROLL-Android` je testovací
build. Před instalací si exportuj JSON zálohu; podpis testovacího buildu se může
mezi sestaveními lišit, proto Android nemusí dovolit přímou instalaci přes
starší verzi. Původní aplikaci neodinstalovávej bez ověřené zálohy.

---

# BUILT TO ROLL — Android beta v7

Osobní offline deník pro BJJ a silový trénink. Zachovává vzhled a funkce dodané HTML verze v7.

## Instalace do telefonu

1. V tomto repozitáři otevři **Actions → Android APK**.
2. Otevři poslední úspěšný běh se zelenou fajfkou.
3. V části **Artifacts** stáhni **BUILT-TO-ROLL-Android** (musíš být přihlášený na GitHubu).
4. Rozbal ZIP a v telefonu otevři `app-debug.apk`.
5. Pokud Android požádá, povol instalaci z daného prohlížeče/správce souborů a dokonči instalaci.

Jde o testovací APK podepsané vývojovým klíčem, nikoli vydání v Google Play. Klíč GitHub runneru nemusí být mezi běhy stejný; před případnou odinstalací kvůli nekompatibilnímu podpisu vždy exportuj JSON zálohu. Pro stabilní aktualizace je potřeba později nastavit trvalý podpisový klíč.

## Režim celé obrazovky (0.1.1)

Stavový řádek i systémová navigace jsou při používání skryté. Přejetím od horního nebo dolního okraje je dočasně zobrazíš. Po návratu z výběru souboru nebo jiné aplikace se režim obnoví. Obsah respektuje výřez fotoaparátu a na Androidu 11+ prostor pro klávesnici; na starších verzích se používá systémové zmenšení okna.

Před instalací aktualizace si ulož JSON zálohu. Pokud Android odmítne aktualizaci kvůli jinému vývojovému podpisu, neodinstalovávej původní aplikaci bez ověřené zálohy. Po nové instalaci obnov JSON přes Profil.

## Jednotky cviků (0.1.2)

U každého cviku vyber **Zapisovat jako → Opakování / Čas (s) / Vzdálenost (m)**. Například sáně: 3 série × 15 m; plank: 3 série × 30 s. Jednotka platí pro všechny série daného cviku. Jednotlivé série mohou mít různé hodnoty. Změna jednotky ponechá zadaná čísla, nepřepočítává je. Sekundy a metry podporují desetinné hodnoty.

Starší záznamy bez jednotky zůstávají opakováním. Historie, minulý výkon, kopírování a JSON uchovávají jednotky; CSV má zvláštní sloupec Jednotka série. Objem v kg se počítá jen z opakování × váhy, čas a metry se sčítají zvlášť. Zálohy s novými jednotkami obnovuj v této nebo novější verzi.

## Oprava záloh (0.1.3)

Android čte vybraný dokument přímo přes systémové souborové rozhraní, nezávisle na čtení souborů ve WebView. Import rozpozná prázdný, neúplný nebo neplatný JSON a podporuje UTF-8 BOM. Chybný import ani odmítnuté potvrzení nezmění deník; obnova se dokončí až po úspěšném místním uložení.

Export má pracovní kopii v soukromém úložišti aplikace před otevřením systémového dialogu. Tato kopie přežije obnovení aktivity a procesu. Aplikace označí JSON zálohu jako uloženou až po dokončení zápisu a zavření souboru, nikoli už po stisku tlačítka.

Pokud starší záloha obsahuje 0 B, nová verze z ní žádné záznamy neobnoví. Je nutný nový export z původní aplikace nebo jiná záloha. Při problému s podpisem aktualizace aplikaci neodinstalovávej, dokud nemáš ověřenou platnou zálohu.

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

## Verze 0.2.0 — profil, zásobník a nový zápis

- Rozšířený profil: základní údaje, BJJ a silové zkušenosti, cíle, vybavení, směny a volitelná omezení. Aktuální hmotnost se bere z vážení. Cíle jsou evidované údaje; automatický trenér zatím není implementovaný.
- Zásobník 280 cviků ve 23 skupinách: české i anglické vyhledávání bez diakritiky, filtr vybavení, oblíbené a poslední cviky.
- Vlastní cvik: název, partie, vybavení, výchozí jednotka, alternativní názvy a poznámky. Vlastní cviky lze upravit a odstranit ze zásobníku; zapsané tréninky zůstanou zachované.
- Přístup k zásobníku z Profilu a při přidávání cviku do tréninku.
- Nové ovládání: přehled cviků → detail cviku → tabulka jednotlivých sérií. Změny cviků se uloží až s celým tréninkem.
- Opakování, sekundy a metry, různé série, označení hotové série, tempo, pauza a provedení na každou stranu. Dopomoc se nezapočítává jako zvednutý objem.
- Profil, vlastní cviky, oblíbené a nové údaje sérií jsou součástí JSON zálohy. CSV doplňuje sloupce pro nové údaje série.
- „Začít s prázdným deníkem“ zachová profil a vlastní zásobník. Obnovení ukázkových dat nahrazuje všechna data podle potvrzovacího dialogu.

### Ověření rozhraní

Workflow spouští datové regresní testy, testy souborového I/O, skutečný Chromium test mobilního zápisu, profilů a záloh a nakonec Android build/lint. `UI-review` obsahuje snímky testovacího rozhraní a výsledek browser testů. `BUILT-TO-ROLL-Android` obsahuje APK.

Testovací instalace jsou stále podepsané vývojovým klíčem runneru. Pokud Android odmítne aktualizaci kvůli podpisu, neodinstalovávej aplikaci bez ověřené zálohy. Nativní výběr souboru a chování klávesnice na konkrétním telefonu vyžadují kontrolu na zařízení; browser test je nenahrazuje.
