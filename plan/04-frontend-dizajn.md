# 04 — Prijedlog dizajna interfejsa

Radna maketa je u `dizajn/mockup.html`. Otvorite je u pregledniku: strelice mijenjaju ekran, tipka R otkriva igrače, tipka D uključuje detalje. Snimci svih ekrana su u istom folderu.
Igrači u maketi su izmišljeni. Brojevi na ekranu "Dokazi" su iz prototipa.

**Druga verzija, 11. 11.** Prva verzija je imala previše teksta na ekranima 1, 2 i 4. Sada se svaki ekran čita kao radar: jedan naslov, velike brojke i slika, a objašnjenja metode su iza prekidača "Details".

**Treća izmjena, 11. 11.** Slijepi izbor počinje zadatkom: skaut prvo kaže šta traži, pa tek onda dobija tri kandidata bez imena. Tako se jasno razlikuje od radara.

**Četvrta izmjena, 11. 11.** Kartica igrača više nije odjeljak u navigaciji. Bez izabranog igrača nema šta pokazati, pa se otvara samo iz slijepog izbora, iz radara ili iz liste sličnih. 

**Peta izmjena, 11. 11.** Dodani su vremeplov kao novi odjeljak, projekcija na kartici igrača i prikaz "Bosnian passport" u radaru. Navigacija sada ima četiri odjeljka: slijepi izbor, radar, vremeplov, dokazi. Brojke na ekranu dokaza su ispravljene, jer se sada računa svaki igrač sezone.

## 1. Ideja u jednoj rečenici

**Skautski dosje koji se gleda, a ne čita:** papir, tinta, jedna boja za podatke, imena prekrivena crnim trakama dok skaut ne izabere, i velike brojke umjesto rečenica.

Crna traka preko imena je znak po kojem se aplikacija pamti. Ona u jednom pogledu kaže šta proizvod radi: sudi se o igri, a ne o imenu.

## 2. Zašto ovako

| Cilj | Odluka u dizajnu |
|---|---|
| Žiri koji nije tehnički mora shvatiti poentu za pet sekundi | Na ekranu nema pasusa. Poenta je u naslovu i u jednoj velikoj brojci ili slici. |
| Žiri ne smije čitati dok tim govori | Tekst na ekranu su oznake od dvije do pet riječi. Objašnjava onaj ko govori. |
| Stručnjak za podatke ipak traži metodu | Prekidač "Details" (tipka D) otkriva uzorke, granice greške i definicije. Koristi se za pitanja, ne tokom pitcha. |
| Projektor ispira boje i sitan tekst | Svijetla podloga, tamna tinta, krupne brojke, bez tamne teme |
| Aplikacija ne smije ličiti na generički dashboard | Bez gradijenata, sjena, emotikona i šarenih pločica; jedna boja nosi podatke |
| Tok mora pratiti pitch | Četiri numerisana odjeljka istim redom kojim se govori; kartica igrača se otvara između prvog i drugog |
| Žiri mora vidjeti stvarnog skrivenog talenta | Vremeplov: prava imena, cijena tada i sada, jedan klik između |

## 3. Šest principa

1. **Prvo za salu, zatim za stručnjaka.** Zadani prikaz je za prezentaciju. Sve što traži čitanje ide u detalje.
2. **Jedna poenta po ekranu.** Naslov je kaže, jedna slika je pokaže.
3. **Brojka umjesto rečenice.** "5 od 10" i deset tačaka umjesto rečenice o historijskoj stopi.
4. **Obične riječi.** "Ocjena", "cijena", "uspjeli su". Bez "percentil", "faktor lige", "provjera unazad" u zadanom prikazu.
5. **Boja nosi samo podatke.** Plava znači "ovo je mjera". Sve ostalo je tinta na papiru.
6. **Poštenje ostaje vidljivo.** Raspon umjesto jedne vrijednosti, pravilo "najviše minuta" je na grafikonu, "šta ne vidi" je na ekranu bez klika.

Mjera: u zadanom prikazu nijedan tekst nije duži od jedne kratke rečenice, a ekran ima najviše 160 riječi i brojki zajedno, ne računajući tabelu radara. Izmjereno u maketi: zadatak 51, slijepo poređenje 88 (145 nakon otkrivanja), kartica 184, dokazi 140. Liste radara i vremeplova se ne računaju. Maketa sama broji vidljive riječi i upisuje ih u atribut `data-words` na elementu `html`.

## 4. Tokeni

### Boje

| Token | Vrijednost | Namjena | Kontrast na listu |
|---|---|---|---|
| `--paper` | `#f7f5ef` | Podloga stranice | — |
| `--sheet` | `#fcfbf8` | Svaka kartica i svaki grafikon | — |
| `--ink` | `#14161a` | Tekst, crne trake, glavno dugme | 17,5:1 |
| `--ink-2` | `#4a4b4f` | Sporedni tekst | 8,4:1 |
| `--ink-3` | `#6f706f` | Oznake, tekst osa | 4,8:1 |
| `--hair` | `#dcd9cf` | Tanke linije, mreža | — |
| `--hair-strong` | `#c3c2b7` | Osnovne linije, okviri polja, strelice | — |
| `--accent` | `#2a78d6` | Jedina boja podataka: trake, tačke, mjerači | 4,3:1 |
| `--accent-ink` | `#1c5cab` | Plava kao tekst, okvir izabrane kartice | 6,4:1 |
| `--accent-deep` | `#104281` | Rang A | — |
| `--accent-light` | `#86b6ef` | Rang C, raspon između modela | 2,0:1 |
| `--accent-track` | `#cde2fb` | Neispunjeni dio mjerača i prazne tačke | — |
| `--context` | `#9b998f` | Sve što je "ostalo" na grafikonu | 2,8:1, zato uvijek s ispisanom vrijednošću |
| `--context-track` | `#e6e3da` | Prazne tačke u sivom nizu | — |
| `--warn` | `#fab219` | Upozorenje, samo uz ikonu i tekst | — |

Paleta je provjerena alatom za provjeru boja grafikona: plava prolazi provjere svjetline, zasićenosti i kontrasta, a tri plava koraka za rangove prolaze provjeru uređene skale na podlozi `--sheet`. Zato se grafikoni crtaju samo na listu.

Pravila: tekst nikad ne nosi boju podataka; zelena i crvena se ne koriste za "dobro" i "loše"; žuta se javlja samo u trokutu upozorenja, uvijek s tekstom.

### Tipografija

| Uloga | Font | Veličina i težina |
|---|---|---|
| Naslov ekrana | IBM Plex Sans | 44 px, 600, u jednom redu |
| Velika brojka | IBM Plex Sans | 44–56 px, 600 |
| Presuda nakon izbora | IBM Plex Sans | 30 px, 600 |
| Tekst uz brojku | IBM Plex Sans | 15–20 px |
| Oznake, navigacija, dugmad | IBM Plex Mono | 12–13 px, 500, velika slova |
| Brojevi u tabelama | IBM Plex Mono | 13–20 px, cifre jednake širine |
| Detalji | IBM Plex Sans | 13–14 px, sporedna boja |

Dvije porodice iz iste familije. Sans je za čitanje i velike brojke, mono za oznake i brojeve u kolonama. Fontovi se pakuju u aplikaciju, da demo ne zavisi od mreže.

### Razmaci i oblik

- Mreža od 8 px. Razmak između kartica 24 px. Unutrašnji rub kartice 24–28 px.
- Širina sadržaja do 1320 px, bočni rub 40 px.
- Zaobljenje 2 px. Izuzeci: krajevi traka na grafikonima 4 px, tačke su krugovi.
- Linije debljine 1 px. Tamna linija odvaja zaglavlje, svijetla redove.
- Bez sjena i gradijenata.

## 5. Komponente

| Komponenta | Opis |
|---|---|
| **Gornja traka** | Naziv, četiri numerisana odjeljka (01 Blind pick, 02 Radar, 03 Time machine, 04 Evidence), prekidač "Details", polje s budžetom. Dok je otvorena kartica igrača, označen je odjeljak iz kojeg je otvorena. |
| **Povratak** | Link iznad imena na kartici igrača: "← Back to blind pick" ili "← Back to radar", zavisno odakle je otvorena |
| **List** | Podloga `--sheet`, okvir od tanke linije, zaobljenje 2 px |
| **Crna traka** | Prekriva ime i klub s ligom. Pri otkrivanju se povlači ulijevo za 0,45 s. Uz smanjeno kretanje nestaje bez animacije. |
| **Izbor zadatka** | Redovi s oznakom lijevo i dugmadima desno. Izabrano dugme je tamno. Nema polja za kucanje. |
| **Red velikih brojki** | Oznaka iznad, brojka od 44 px ispod; tri u nizu. Na slijepom izboru su to tri ocjene od 0 do 100 s tankom trakom ispod: istaknute su one koje je skaut označio kao važne, ostale su sive. |
| **Koraci ocjene** | Četiri koraka u nizu sa strelicama: oznaka, brojka od 56 px, dva kratka reda teksta. Zadnji korak ima plavu liniju iznad. |
| **Niz tačaka** | Deset tačaka, popunjene pokazuju "N od 10". Plave za igrača, sive za prosjek. |
| **Par brojki** | Dvije brojke od 48 px s oznakom ispod svake i znakom između (strelica ili "vs") |
| **Oznaka ranga** | Kvadrat sa slovom A, B ili C; tri koraka plave. Slovo je uvijek tu. |
| **Etiketa** | Mala oznaka na kartici nakon otkrivanja: "Model's pick" plava, "Most goals" s okvirom, "Your pick" tamna |
| **Mjerač** | Naziv, traka od 8 px, brojka. U radaru i u detaljima. |
| **Oznaka** | Okvir od tanke linije, mono tekst. Veća varijanta za "šta ne vidi". |
| **Dugme** | Tamna podloga, bijeli mono tekst |
| **Tabela** | Zaglavlje u mono fontu s tamnom linijom ispod, redovi s tankom linijom |
| **Detalj** | Blok sitnijeg teksta koji se vidi samo kad je prekidač uključen |
| **Grafikon vrijednosti** | Crna linija vrijednosti do datuma odluke, tačka odluke, svijetloplava lepeza do raspona za tri godine i isprekidana linija do tipičnog ishoda. U vremeplovu se nakon otkrivanja dodaju stvarni tok i tačka ishoda. Isti je na kartici igrača i u vremeplovu. |
| **Red vremeplova** | Redni broj, ime, klub i liga, cijena tada, cijena kasnije i tačka: puna za uspjeh, prazna za neuspjeh |
| **Prekidač prikaza** | Dva dugmeta iznad radara, "In my budget" i "Bosnian passport", svako s brojem igrača |
| **Traka izvora** | Jedan red na dnu ekrana |

## 6. Ekrani

Svaki ekran ima četiri stanja: zadano, prazno, učitavanje i greška.

### 01 Slijepi izbor (`/blind`), snimci `ekran-1a`, `ekran-1b` i `ekran-1c`

Poenta: *skaut bira po onome što igrač radi, a ne po tome ko je.* Ekran ima tri koraka.

**Korak 1, zadatak.** Skaut kaže šta traži.

```
 What are you looking for?
 ┌──────────────────────────────────────────────────────────────┐
 │ POSITION        [Winger] [Striker] [Midfielder] [Defender] … │
 │ AGE             [19 or under] [21 or under]                  │
 │ BUDGET          [€250k] [€500k] [€1M]                        │
 │ MOST IMPORTANT  [Creates chances] [Scores goals] [Plays …]   │
 │ 14 players match                 [ SHOW ME THREE, NO NAMES ] │
 └──────────────────────────────────────────────────────────────┘
```

- Sve se bira dugmadima. Zadani zadatak je popunjen, pa je za demo dovoljan jedan klik.
- Broj igrača koji odgovaraju se mijenja odmah. S manje od tri dugme je onemogućeno i piše da treba proširiti pretragu.

**Korak 2, slijepo poređenje.** Tri kandidata po zadatku, bez imena.

```
 Three wingers. No names. Pick one.
 Winger · 21 or under · up to €500k · creates chances, scores goals  [Change]
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ PLAYER A     │ │ PLAYER B     │ │ PLAYER C     │
 │ ████████     │ │ █████████    │ │ ██████████   │
 │ ██████████   │ │ ███████████  │ │ ███████      │
 │ CREAT SCOR PT│ │ CREAT SCOR PT│ │ CREAT SCOR PT│
 │  91   64  44 │ │  52   88  88 │ │  70   58  21 │
 │ [  PICK A  ] │ │ [  PICK B  ] │ │ [  PICK C  ] │
 └──────────────┘ └──────────────┘ └──────────────┘
```

- Tri ocjene od 0 do 100. Prve i istaknute su one koje je skaut označio kao važne, treća je siva.
- Ne vide se ime, klub, liga, cijena, sirovi golovi ni mišljenje modela.
- Tri kandidata su namjerno različita: najviši po modelu, najviši po sirovim golovima i asistencijama, i najbolji preostali po skautovim važnostima.

**Korak 3, otkrivanje.** Trake se povlače. Na karticama se pojave cijena, golovi i rang, te etikete "Model's pick" i "Most goals". Ispod je presuda u jednoj krupnoj rečenici: slažu li se skaut i model.

**Po čemu se razlikuje od radara.** Radar je lista modela, s imenima i poredana. Ovdje skaut odlučuje sam, na tri kandidata po svom zadatku, bez imena i bez ocjene modela. Njegov izbor i izbor modela se pamte i mogu se izdvojiti u radaru filterom "My blind picks".

Stanja: prazno je korak 1 s porukom da treba proširiti pretragu; učitavanje su tri kartice s crnim trakama; greška je poruka s dugmetom za ponovni pokušaj.

### Kartica igrača (`/player/:id`), snimci `ekran-kartica-igraca` i `ekran-kartica-igraca-detalji`

Nije odjeljak u navigaciji. Otvara se dugmetom "See why" nakon slijepog izbora, klikom na red u radaru ili na sličnog igrača. Bez igrača se ne može otvoriti: adresa bez važeće oznake vodi na radar.

Poenta: *ocjena nastaje u četiri koraka koja svako može pratiti.*

```
 Ivan Uzorak                              PRICE   CONTRACT  MINUTES
 Right winger · 20 · NK Primjer, Croatia  €150k   Jun 2027  1,180
 ┌──────────────────────────────────────────────────────────────┐
 │ 01 WHAT HE DID   02 HIS LEAGUE   03 ON ONE SCALE   04 RATING │
 │   0.53      →      −26%     →       0.39      →     86 /100  │
 │ goals+assists    Croatia is      comparable       better than│
 │ per 90 min       easier          across leagues   86% his age│
 └──────────────────────────────────────────────────────────────┘
 ┌──────────────────────┐ ┌───────────────────────────────────────┐
 │ OUTLOOK   Tier A     │ │ WHERE HE COULD BE IN THREE YEARS      │
 │ ●●●●●○○○○○ 5 in 10   │ │ €200k – €1.1M        €450k            │
 │ ●●●○○○○○○○ 3 in 10   │ │ ●────── lepeza do raspona ──────▮     │
 └──────────────────────┘ └───────────────────────────────────────┘
 ┌───────────────────┐ ┌─────────────────┐ ┌───────────────────┐
 │ WHY               │ │ SIMILAR, BUDGET │ │ AI SCOUT NOTE     │
 │ + Regular at 20   │ │ P. Primjer  91% │ │ jedna do dvije    │
 │ + Cheap for …     │ │ L. Eksempel 87% │ │ kratke rečenice   │
 └───────────────────┘ └─────────────────┘ └───────────────────┘
```

- Liga se prikazuje kao postotak ("−26 %"), ne kao dijeljenje faktorom. Faktor je u detaljima i na prelazak mišem.
- Razlozi su do četiri reda od najviše četiri riječi.
- Za odbranu i golmane koraci prikazuju ulogu i kontekst ekipe, uz oznaku ograničenih podataka.
- Detalji dodaju: udio u golovima ekipe i minutažu kao mjerače, broj slučajeva iza "5 od 10", napomenu o sličnosti i porijeklo bilješke.
- **Projekcija** je u drugom redu, desno od izgleda: raspon u kojem je završila polovina sličnih igrača i tipičan ishod kao velike brojke, ispod grafikon vrijednosti s lepezom do tog raspona. U trećem redu su razlozi, slični igrači i AI bilješka.
- Prazno: "Igrač nije u bazenu" i link na radar. Učitavanje: raspored s praznim brojkama. Greška: kao na prvom ekranu.

### 02 Radar (`/radar`), snimci `ekran-2-radar` i `ekran-2b-radar-nasi-vani`

Poenta: *ovo je lista za vikend.* Ekran je ostao kao u prvoj verziji, uz kraće nazive kolona.

- Naslov kaže koliko igrača staje u budžet i koliko ih je ranga A.
- Lijevo filteri, desno grafikon cijena naspram izgleda i tabela.
- Iznad je prekidač prikaza. "Bosnian passport" zamijeni grafikon i tabelu listom igrača s bh. pasošem, bez obzira na budžet: klub, liga, dob, cijena, minute, golovi i asistencije, ocjena gdje ima smisla i oznaka je li u budžetu. Naslov kaže koliko ih je ukupno, koliko mladih i koliko u budžetu.
- Prazno: "Nijedan igrač ne odgovara filterima" i dugme koje vraća zadane filtere.

### 03 Vremeplov (`/time-machine`), snimci `ekran-3a-vremeplov-tada` i `ekran-3b-vremeplov-danas`

Poenta: *alat bi ove igrače zaista izdvojio, i to se vidi na pravim imenima.*

```
 June 2023. The radar shows 23 players under €1M.
 The model has seen nothing after this date.
 [2019/20] [2020/21] [2021/22] [2022/23]            [ SHOW JUNE 2026 ]
 ┌───────────────────────────────────────────┐ ┌──────────────────┐
 │  1 Antoine Mendy    €1.0M │ 13 …    €700k │ │ PICK 4           │
 │  2 Oscar Schwartau  €1.0M │ 14 …    €1.0M │ │ Renato Veiga     │
 │  3 Aïman Maurer     €800k │ 15 …    €800k │ │        ╱ raspon  │
 │  4 Renato Veiga     €1.0M │ 16 …    €700k │ │ ●─────╱          │
 └───────────────────────────────────────────┘ └──────────────────┘
```

- **Tada:** lista je cijeli rang A te sezone, po redu modela, s cijenom tada. Ishod se ne vidi.
- **Danas:** jedan klik ili tipka R dopiše vrijednost tri godine kasnije i tačku uz svakog igrača: puna znači da je uspio. Naslov postaje "June 2026. 11 of the 23 made it.", a red ispod kaže koliko je uspjelo u cijelom bazenu te sezone.
- Dugmad sezona nakon prvog otkrivanja pokazuju rezultat svake sezone, i najslabije, u istom obliku kao naslov: "11 of 23".
- Lista ima tri kolone s godinom u zaglavlju: cijena tada, tri godine kasnije (po njoj se broji uspjeh) i, za starije sezone, danas. Kolona "danas" je dodatak: pokazuje i igrače koji su poslije nastavili rasti i one koji su pali. Snimak `ekran-3c-vremeplov-2019-danas`.
- Desno je grafikon izabranog igrača: vrijednost do datuma radara, lepeza do očekivanog raspona i, nakon otkrivanja, stvarni tok.
- Zašto je ovo dokaz, a ne priča: lista izgleda kao radar, mijenja se samo datum, prikazana je cijela s promašajima, i dostupne su sve sezone. Pet pravila po kojima nastaje je u `06-podaci-i-model.md`, poglavlje 6.
- U maketi su ovo stvarni igrači i stvarni izlaz prototipa.
- Stanja: učitavanje su prazni redovi; ako `timemachine.json` nedostaje, ekran to kaže i ne prikazuje nijedno ime.

### 04 Dokazi (`/evidence`), snimci `ekran-4-dokazi` i `ekran-4b-dokazi-detalji`

Poenta: *naši izbori uspijevaju češće od svakog jednostavnog pravila, a evo i ko su.*

```
 Does it work? We tested it on the past.
 "Made it" = value doubled and passed €1M within three years.
 ┌──────────────────────────────────────────────────────────────┐
 │ Fair Scout    ██████████████████████▒▒▒  47–53%              │
 │ Most minutes  ████████████████████  44%      │ prosjek 30%   │
 │ Most goals    ████████████████  36%                          │
 │ Youngest      ████████████████  36%                          │
 │ Cheapest      █████  12%                                     │
 └──────────────────────────────────────────────────────────────┘
 ┌────────────────────────────────────────────┐ ┌────────────────┐
 │ THE BIGGEST RISER OF EACH SEASON           │ │ WHAT IT CANNOT │
 │ 2019/20    2020/21    2021/22    2022/23   │ │ SEE            │
 │ Zubimendi  Grønbæk    Ouattara   Veiga     │ │ [Character] …  │
 │  ╱‾‾        ╱‾╲        ╱‾‾        ╱‾‾      │ │ It says who to │
 │ €250k→€40M €1.0M→€12M €900k→€28M €1.0M→€25M│ │ watch, not who │
 │ All 88 picks: €63M → €362M. 43 did not.    │ │ to sign.       │
 └────────────────────────────────────────────┘ └────────────────┘
```

- Jedan širok grafikon nosi glavni dokaz.
- Ispod su četiri stvarna igrača, po jedan iz svake sezone vremeplova, s krivuljom vrijednosti i dvije krupne brojke. Ovo je ono što oko prvo uhvati.
- Igrač se bira pravilom, ne ručno: najveća vrijednost tri godine kasnije u rangu A te sezone. Odmah ispod stoji red sa zbirom svih izbora i brojem onih koji nisu uspjeli, da blok ne bude samo izlog uspjeha.
- Klik na igrača otvara vremeplov te sezone.
- Dvije statistike iz ranije verzije (isti igrači u dvije lige, mjeseci rođenja) su u detaljima, uz opis provjere, grafikon za budžet do 500.000 €, težinu liga i puna ograničenja.
- Ako `evidence.json` ili `timemachine.json` nedostaje, ekran to kaže i ne prikazuje nijedan broj ni ime.

## 7. Grafikoni

Zajednička pravila: trake debljine najviše 24 px, kraj trake zaobljen 4 px, osnova ravna; vrijednost je ispisana pored trake; jedna osa po grafikonu; prelazak mišem dopunjuje, ne zamjenjuje ispis.

| Prikaz | Oblik | Kodiranje | Zašto taj oblik |
|---|---|---|---|
| Ko bira bolje | Vodoravne trake preko cijele širine | Naš izbor plavo, pravila sivo, svijetloplavi nastavak za raspon između dva modela, uspravna linija prosjeka | Jedna stvar je poenta, ostalo je kontekst |
| Izgledi igrača | Dva niza od deset tačaka | Plavi niz za igrača, sivi za prosjek | "5 od 10" razumije svako, bez čitanja procenata |
| Koraci ocjene | Četiri brojke sa strelicama | Bez boje, osim linije iznad rezultata | Račun se prati slijeva nadesno kao rečenica |
| Najveći rast sezone | Mala linija vrijednosti iznad dvije krupne brojke | Crna linija, crna tačka na datumu radara, tamnoplava tri godine kasnije | Rast se vidi prije nego se pročita broj |
| Isti igrači, dvije lige (detalji) | Par brojki sa strelicom | Bez grafikona | Dvije brojke su cijela priča |
| Mjeseci rođenja (detalji) | Par brojki i 12 malih stubića | Prvi i zadnji kvartal plavo, sredina sivo | Slika potvrđuje brojke, ne traži čitanje |
| Cijena naspram izgleda | Tačke, cijena na logaritamskoj skali | Rang A tamnoplavo i veće, iznad budžeta svjetlije | "Jeftin i obećavajući" je gornji lijevi ugao |
| Težina liga (detalji) | Tačka po ligi na zajedničkoj skali | Puna tačka izmjereno, prazan kružić procjena | Procjena se razlikuje oblikom, ne samo bojom |
| Vrijednost kroz vrijeme | Linija, lepeza i uspravna traka raspona | Crno je stvarna vrijednost, plavo raspon ishoda sličnih igrača, isprekidano tipičan ishod | Vidi se gdje je igrač bio, gdje bi mogao biti i, u vremeplovu, gdje je završio |
| Lista vremeplova | Dvije kolone redova s tačkom na kraju | Puna tamnoplava tačka za uspjeh, prazna za neuspjeh | Odnos uspjeha i promašaja se vidi bez brojanja |

## 8. Tekstovi interfejsa

Zadani jezik je engleski, jer su materijali hakatona na engleskom. Ako je pitch na bosanskom, koristi se druga kolona.

| Ključ | Engleski | Bosanski |
|---|---|---|
| `nav.blind` | Blind pick | Slijepi izbor |
| `nav.radar` | Radar | Radar |
| `nav.time` | Time machine | Vremeplov |
| `nav.evidence` | Evidence | Dokazi |
| `shell.details` | Details | Detalji |
| `card.back` | Back to {blind pick / radar} | Nazad na {slijepi izbor / radar} |
| `brief.title` | What are you looking for? | Šta tražite? |
| `brief.position` / `brief.age` / `brief.budget` | Position / Age / Budget | Pozicija / Dob / Budžet |
| `brief.matters` | Most important · pick two | Najvažnije · izaberite dvije |
| `brief.creates` / `brief.scores` / `brief.plays` | Creates chances / Scores goals / Plays regularly | Stvara šanse / Zabija / Redovno igra |
| `brief.count` | {n} players match | {n} igrača odgovara |
| `brief.widen` | Widen the search. | Proširite pretragu. |
| `brief.go` | Show me three, no names | Pokaži mi trojicu, bez imena |
| `blind.title` | Three {positions}. No names. Pick one. | Tri kandidata. Bez imena. Izaberite jednog. |
| `blind.change` | Change | Promijeni |
| `blind.scale` | Scores out of 100, against players of the same position and age. Bold = what you asked for. | Ocjene od 0 do 100, u odnosu na igrače iste pozicije i dobi. Istaknuto = ono što ste tražili. |
| `score.creating` / `score.scoring` / `score.playing` | Creating / Scoring / Playing time | Stvaranje / Zabijanje / Minutaža |
| `blind.pick` | Pick {x} | Izaberi {x} |
| `blind.tag.model` | Model's pick | Izbor modela |
| `blind.tag.goals` | Most goals | Najviše golova |
| `blind.tag.you` | Your pick | Vaš izbor |
| `blind.verdict.agree` | You and the model agree: {x}. | Vi i model se slažete: {x}. |
| `blind.verdict.differ` | You picked {x}. The model picks {y}. | Izabrali ste {x}. Model bira {y}. |
| `blind.verdict.differ.sub` | Both go on your list. Where you disagree is worth a trip. | Oba idu na vašu listu. Gdje se ne slažete, vrijedi otići pogledati. |
| `blind.why` | See why | Pogledaj zašto |
| `stat.price` / `stat.goals` / `stat.outlook` | Price / Goals / Outlook | Cijena / Golovi / Izgledi |
| `card.flow` | How we rate him | Kako ga ocjenjujemo |
| `card.step1` | What he did | Šta je uradio |
| `card.step2` | His league | Njegova liga |
| `card.step3` | On one scale | Na istoj skali |
| `card.step4` | Rating | Ocjena |
| `card.made_it` | {n} in 10 players like him made it | {n} od 10 takvih igrača je uspjelo |
| `card.average` | {n} in 10 for the average young player | {n} od 10 kod prosječnog mladog igrača |
| `card.why` | Why | Zašto |
| `card.similar` | Similar, in your budget | Slični, u vašem budžetu |
| `card.note` | AI scout note | AI bilješka skauta |
| `flag.born_q4` | Born Oct–Dec · often overlooked | Rođen okt–dec · često previđen |
| `flag.low_sample` | Few minutes | Malo minuta |
| `flag.limited` | Limited data | Ograničeni podaci |
| `radar.title` | {n} young players fit your budget. {a} are tier A. | {n} mladih igrača staje u vaš budžet. {a} je ranga A. |
| `evidence.title` | Does it work? We tested it on the past. | Radi li? Provjerili smo na prošlosti. |
| `evidence.made_it` | "Made it" = the player's value doubled and passed €1M within three years. | "Uspio" = vrijednost igrača se udvostručila i prešla 1 M € za tri godine. |
| `evidence.chart` | How often does each way of picking get it right? | Koliko često koji način izbora pogodi? |
| `evidence.find1` | Same players, two leagues | Isti igrači, dvije lige |
| `evidence.find2` | Born early, picked more | Rođeni ranije, birani češće |
| `evidence.find3` | What it cannot see | Šta ne vidi |
| `evidence.close` | It says who to watch, not who to sign. | Kaže koga pogledati, ne koga potpisati. |
| `tm.title.then` | {month year}. The radar shows {n} players under €1M. | {mjesec godina}. Radar pokazuje {n} igrača ispod 1 M €. |
| `tm.lede.then` | The model has seen nothing after this date. | Model ne zna ništa poslije ovog datuma. |
| `tm.reveal` | Show {month year} | Pokaži {mjesec godina} |
| `tm.title.now` | {month year}. {h} of the {n} made it. | {mjesec godina}. Uspjelo je {h} od {n}. |
| `tm.lede.now` | Among all {p} young players of that season: {k} in 10. | Među svih {p} mladih igrača te sezone: {k} od 10. |
| `tm.legend` | Black: his value. Blue: where half of similar players ended. | Crno: njegova vrijednost. Plavo: gdje je završila polovina sličnih igrača. |
| `proj.title` | Where he could be in three years | Gdje bi mogao biti za tri godine |
| `proj.range` | half of the players like him ended here | ovdje je završila polovina igrača poput njega |
| `proj.typical` | the typical one | tipičan ishod |
| `radar.seg.budget` / `radar.seg.bih` | In my budget / Bosnian passport | U mom budžetu / Bh. pasoš |
| `radar.bih.title` | {n} players with a Bosnian passport play in these 23 leagues. | {n} igrača s bh. pasošem igra u ove 23 lige. |

Pravila pisanja: u zadanom prikazu nema pasusa; oznake imaju najviše pet riječi; isti naziv za istu stvar na svakom ekranu; brojevi u jednom formatu (`€150k`, `€1.2M`, `1,180`, `0.53`); bez uzvičnika i bez riječi poput "AI-powered".

## 9. Pristupačnost i projektor

- Kontrast teksta najmanje 4,5:1. Siva traka konteksta je ispod 3:1, pa uz nju uvijek stoji ispisana vrijednost.
- Sve radi tastaturom, fokus ima vidljiv plavi okvir.
- Prekriveno ime nije dostupno čitaču ekrana prije otkrivanja.
- Rang ima slovo, niz tačaka ima ispisano "5 od 10", procijenjena vrijednost ima drugačiji oblik tačke.
- Proba na projektoru ili TV-u prije pitcha: ako se sive linije ne vide, potamniti `--hair` na `--hair-strong`.

## 10. Demo način

- Direktan link na svaki ekran, pa se demo može nastaviti s bilo kojeg mjesta.
- Slijepi skup je uvijek isti.
- Strelice vode redom kojim teče pitch: slijepi izbor, kartica igrača kojeg bira model (nakon otkrivanja), radar, vremeplov, dokazi. R otkriva igrače na slijepom izboru i ishod u vremeplovu, D uključuje detalje, tipke 1 do 4 biraju odjeljak.
- Tokom pitcha detalji su isključeni. Uključuju se tek kad žiri pita za metodu.
- Preglednik u punom ekranu, uvećanje 100 % na 1440 px ili 110 % na većem ekranu.

## 11. Kako maketa ulazi u izradu

- Tokeni i CSS komponenti se prepisuju iz `dizajn/mockup.html` u aplikaciju. Maketa je mjerilo: ekran u aplikaciji treba izgledati kao snimak.
- U prodready koraku žičanih okvira maketa se dijeli na četiri stranice pod `.prodready/wireframes/`, svaka s četiri stanja iz poglavlja 6.
- Fontovi se preuzimaju i pakuju lokalno.

## 12. Šta ne raditi

| Znak generičke aplikacije | Šta radimo umjesto |
|---|---|
| Pasusi teksta na ekranu koji se prikazuje publici | Naslov, brojka i oznaka; ostalo u detalje |
| Stručni izrazi u zadanom prikazu | Obične riječi; izraz ide u detalje |
| Ljubičasti ili plavi gradijent u zaglavlju | Ravna podloga boje papira |
| Kartice s velikim zaobljenjem i sjenom | List s tankom linijom, zaobljenje 2 px |
| Red od četiri pločice s brojkom bez konteksta | Brojka uvijek s poređenjem: "5 od 10" naspram "3 od 10" |
| Emotikoni i ukrasne ikone uz naslove | Numerisane oznake u mono fontu |
| Tamna tema s neonskim akcentima | Svijetla, tinta na papiru |
| Zeleno i crveno za dobro i loše | Uređena plava skala sa slovom |
| Zadani izgled biblioteke grafikona | Vlastiti grafikoni, jedna plava i siva |
| Kružni grafikon | Vodoravne trake ili niz tačaka |
| Naslov "Dashboard" ili "Analytics" | Rečenica koja kaže poentu |
| Procenat s decimalom kao "AI ocjena" | Rang i "N od 10" |
| Animacije pri svakom učitavanju | Jedna animacija: otkrivanje imena |
