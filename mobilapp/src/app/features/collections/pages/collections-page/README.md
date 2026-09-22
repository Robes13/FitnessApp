# CollectionsPage

Designets "Samlinger" (HTML-linje 1214). Titel, undertekst, orange plus-knap, filter-chips i
en vandret scroll med blød højrekant, og listen af kort.

Siden ejer kun to ting: det valgte filter (`selectedId`, `null` = "Alle") og om arket "Ny
samling" er åbent. Rækkerne kommer fra `CollectionsViewService.entriesFor()`.

Hvert kort har en tone (`accent`, `positive`, `selected`, `negative`) fra måltidet. Tonen
sættes som en modifier-klasse på kortet, der binder to lokale variabler
(`--collection-tint`, `--collection-ink`) til tokens — så ikonflise og metalinje deler farve
uden at gentage reglerne fire gange.

Et tryk på et kort går til `APP_PATH.recipe(entry.id)`. Efter "Opret samling" slår siden om
til filteret for det måltid, samlingen hører under.
