# 02 — Softverski zahtjevi

Šta sistem mora raditi, kako se to provjerava i u kom obliku podaci putuju od pripreme do aplikacije.
Prioriteti: **M** mora, **T** trebalo bi, **O** opciono.

## 1. Pregled sistema

Sistem ima dva dijela koji se dodiruju samo preko statičnih fajlova. Zato demo ne zavisi od mreže ni od servera.

```
 Otvoreni skup s Transfermarkta (9 CSV tabela, podaci do juna 2026)
        │  preuzimanje, jednom
        ▼
 PRIPREMA PODATAKA (Python)
   1. minute, golovi, asistencije po igraču i sezoni, 23 lige
   2. faktor jačine lige
   3. prilagođena ocjena i percentili
   4. model izgleda i provjera unazad
   5. rang, razlozi, oznake, slični igrači
   6. bilješka skauta (jezički model, unaprijed)
   provjere kvaliteta: ako ijedna padne, izvoz se ne radi
        │  izvoz
        ▼
 app/public/data/*.json   ← jedini ulaz aplikacije
        │
        ▼
 WEB APLIKACIJA (React)
   /blind   /player/:id   /radar   /time-machine   /evidence
```

## 2. Tehnologije

| Dio | Izbor | Zašto |
|---|---|---|
| Priprema podataka | Python 3.11+, pandas, scikit-learn | Prototip je već u Pythonu; model je logistička regresija i gradient boosting iz scikit-learna |
| Aplikacija | Vite, React, TypeScript | Statična aplikacija bez servera, brza izrada |
| Stil | Vlastiti CSS s tokenima iz makete, bez gotovog UI kompleta | Gotovi kompleti daju prepoznatljiv generički izgled |
| Grafikoni | Vlastite SVG i CSS komponente (četiri vrste) | Mali broj grafikona, potpuna kontrola izgleda, bez zavisnosti |
| Navigacija | React Router, četiri rute | Direktan link na svaki ekran za demo |
| Testovi | Vitest za račune, Playwright za demo tok | Demo tok je kritična putanja i mora se provjeriti automatski |
| Objavljivanje | Statični hosting ili lokalni pregled | Aplikacija radi i s isključenom mrežom |

Struktura repozitorija:

```
pipeline/           priprema podataka, model, izvoz
app/                web aplikacija
app/public/data/    JSON fajlovi koje aplikacija čita
data/raw/           preuzete CSV tabele (ne ide u git, oko 240 MB)
plan/               ovaj plan
.prodready/         zapisi prodready procesa (žičani okviri i ostalo)
```

## 3. Funkcionalni zahtjevi: priprema podataka

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-P01 | Preuzeti devet tabela s javne adrese i provjeriti da svaka ima očekivane kolone. | M | Jedna komanda. Ako kolona nedostaje, priprema staje s jasnom porukom. |
| FR-P02 | Za 14 liga s tabelom nastupa izračunati po igraču i sezoni: minute, golove, asistencije, broj nastupa i klub s najviše minuta. | M | Zbir minuta po ligi i sezoni jednak je zbiru u izvornoj tabeli. |
| FR-P03 | Za 9 liga bez tabele nastupa izračunati isto iz postava i događaja. Starter igra od 0 do 90 ili do izmjene; igrač s klupe od minute ulaska; crveni karton prekida; minute se ograničavaju na 90; autogolovi se ne pripisuju. | M | Na Belgiji i Holandiji 2024/25 najmanje 99 % nastupa je unutar 5 minuta od službenih, golovi se poklapaju u najmanje 99,5 %. |
| FR-P04 | Odrediti vrijednost u trenutku odluke i ishod tri sezone kasnije (definicije u poglavlju 8). | M | Igrač bez vrijednosti u trenutku odluke ne ulazi ni u učenje ni u radar. |
| FR-P05 | Izračunati faktor jačine za 14 liga iz prelazaka igrača (metoda u poglavlju 8). | M | Engleska ima najmanji faktor. Rang-korelacija s medijanom vrijednosti lige je najviše −0,7. |
| FR-P06 | Za 9 liga bez dovoljno prelazaka procijeniti faktor iz tržišne vrijednosti lige i označiti ga kao procjenu. | M | Svaka liga u izvozu ima faktor i izvor: `moves` ili `estimate`. |
| FR-P07 | Izračunati prilagođeni učinak, udio u golovima ekipe, ulogu u ekipi i njihove percentile. | M | Percentili su između 0 i 100. Referentna grupa ima najmanje 30 igrača, inače se koristi šira grupa pozicije. |
| FR-P08 | Odrediti bazen radara: mladi igrači sezone 2025/26 s najmanje 450 minuta i vrijednošću do 1 M €. | M | Broj igrača u bazenu se ispisuje i upisuje u `meta.json`. |
| FR-P09 | Postaviti oznake: mlađi od 18, mali uzorak (ispod 900 minuta), ugovor ističe u narednih 12 mjeseci, rođen u zadnjem kvartalu, ograničeni podaci za poziciju (odbrana i golmani). | T | Svaka oznaka je logička vrijednost u izvozu. |
| FR-P10 | Za svakog igrača u bazenu naći tri najsličnija igrača iste grupe pozicije (poglavlje 8). | T | Sličan igrač nikad nije isti igrač. Lista se u aplikaciji filtrira po budžetu. |
| FR-P11 | Izvesti `players.json`, `leagues.json`, `evidence.json`, `timemachine.json` i `meta.json` prema ugovoru podataka. | M | Fajlovi prolaze provjeru sheme. Ukupna veličina je ispod 2 MB. |
| FR-P12 | Izvršiti provjere kvaliteta iz poglavlja 9 prije izvoza. | M | Ako ijedna provjera padne, fajlovi se ne prepisuju. |
| FR-P13 | Vremeplov: za svaku testiranu sezonu izvesti cijeli rang A po redu modela, s vrijednošću tada, vrijednošću tri sezone kasnije, oznakom uspjeha i historijom vrijednosti, te sezone na kojima je model učio, broj redova učenja, veličinu bazena i stopu bazena. Koristi se ista funkcija kao za današnji radar, s ranijim datumom. | M | Provjera pri izvozu potvrđuje tri stvari: nijedan red učenja nije iz sezone kasnije od dozvoljene, bazen nije filtriran po ishodu, lista sadrži tačno gornjih 10 % bazena. |
| FR-P14 | Izvesti po igraču državljanstvo i historiju tržišne vrijednosti. | T | Svaka tačka historije ima datum i vrijednost. |

## 4. Funkcionalni zahtjevi: model

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-M01 | Skup za učenje: svi mladi igrači iz 14 liga, sezone 2012/13 do 2022/23, vrijednost do 5 M €. Igrač bez procjene vrijednosti tri sezone kasnije je negativan primjer, jer je to u trenutku učenja već poznato. | M | Broj redova se ispisuje. |
| FR-M02 | Osobine: 19 osobina iz poglavlja 8, sve poznate u trenutku odluke. | M | Nijedna osobina ne koristi podatak nastao nakon kraja sezone. |
| FR-M03 | Meta: vrijednost tri sezone kasnije je najmanje dvostruka i najmanje 1 M €. | M | Udio pozitivnih u skupu se ispisuje. |
| FR-M04 | Glavni model: logistička regresija nad standardizovanim osobinama. Kontrolni model: gradient boosting s plitkim stablima. | M | Oba modela imaju fiksno sjeme slučajnosti. |
| FR-M05 | Provjera unazad: za testnu sezonu T (2017/18 do 2022/23) model uči samo na sezonama do T−3, čiji je ishod u trenutku odluke već poznat. | M | Nijedna testna sezona nije u učenju vlastitog modela. |
| FR-M06 | Izvještaj provjere: stopa pogodaka gornjih 10 % i 20 % za oba modela i četiri jednostavna pravila, za budžete do 1 M € i do 500.000 €, s brojem slučajeva i granicom greške. Bazen je svaki mladi igrač sezone do zadanog budžeta; igrač bez kasnije vrijednosti se vodi kao neuspjeh. | M | Izvještaj se upisuje u `evidence.json` i odgovara onome što se prikazuje na ekranu. |
| FR-M07 | Rang: unutar bazena sezone gornjih 10 % po ocjeni modela je A, sljedećih 10 % je B, ostali su C. Uz rang ide historijska stopa iz provjere unazad. | M | Zbir igrača po rangu jednak je veličini bazena. |
| FR-M08 | Razlozi: doprinos osobine je koeficijent pomnožen standardizovanom vrijednošću. Prikazuju se tri najveća pozitivna i najveći negativni, kao rečenice iz rječnika. | M | Svaki igrač ranga A i B ima najmanje dva razloga. |
| FR-M09 | Konačni model za radar uči na svim sezonama s poznatim ishodom i primjenjuje se na sezonu 2025/26. | M | Datum i broj redova učenja su u `meta.json`. |
| FR-M10 | Analiza po kvartalu rođenja: broj igrača i stopa po kvartalu, uz kontrolu dobi. | T | Rezultat je u `evidence.json`. |
| FR-M11 | Dodatne osobine (učinak prilagođen ligi, trend minuta) se zadržavaju samo ako poprave stopu pogodaka u provjeri unazad. | O | Odluka i brojevi prije i poslije su zapisani. Najviše dva sata rada. |
| FR-M12 | Rasponi ishoda po rangu: 25., 50. i 75. percentil omjera vrijednosti tri sezone kasnije i udio igrača bez kasnije vrijednosti. | T | Upisuje se u `evidence.json`. Koriste ih projekcija na kartici i grafikon u vremeplovu. |

## 5. Funkcionalni zahtjevi: aplikacija

### Okvir

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A01 | Gornja traka s četiri numerisana odjeljka (slijepi izbor, radar, vremeplov, dokazi) i oznakom aktivnog. Kartica igrača nije odjeljak: otvara se iz slijepog izbora, iz radara ili iz liste sličnih i ima link za povratak tamo odakle je otvorena. | M | Klik mijenja ekran bez ponovnog učitavanja. Dok je kartica otvorena, označen je odjeljak iz kojeg je otvorena. |
| FR-A02 | Budžet je jedna globalna postavka, vidljiva na svakom ekranu. | M | Promjena budžeta mijenja radar, slične igrače i slijepi izbor. |
| FR-A03 | Traka izvora na dnu svakog ekrana: izvor podataka, broj liga, raspon sezona, način provjere. | M | Tekst dolazi iz `meta.json`. |
| FR-A04 | Tastatura: strelice vode redom kojim teče pitch (slijepi izbor, kartica igrača kojeg bira model nakon otkrivanja, radar, vremeplov, dokazi), tipke 1 do 4 biraju odjeljak, R otkriva igrače na slijepom izboru i ishod u vremeplovu, D uključuje detalje. | T | Radi bez miša tokom cijelog demo toka. |
| FR-A05 | Svi tekstovi interfejsa su u jednom fajlu po jeziku. | T | Promjena jezika ne traži izmjenu komponenti. |
| FR-A06 | Dva nivoa prikaza. Zadani je za prezentaciju: naslov, velike brojke, oznake od najviše pet riječi, bez pasusa. Prekidač "Details" u gornjoj traci otkriva metodu: uzorke, granice greške, definicije, dodatne grafikone. | M | U zadanom prikazu ekran ima najviše 160 riječi i brojki, ne računajući tabelu radara. Stanje prekidača vrijedi za sve ekrane. |

### Slijepi izbor (`/blind`)

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A10 | Zadatak: prije poređenja skaut bira poziciju, dob, budžet i do dvije stvari koje su mu najvažnije (stvara šanse, zabija, redovno igra). Izbori su dugmad, bez kucanja. | M | Broj igrača koji odgovaraju se mijenja sa svakim izborom. Dugme za nastavak je onemogućeno ako ih je manje od tri ili ako nijedna važnost nije izabrana. Zadani zadatak je unaprijed popunjen iz `meta.json`. Izabrani budžet vrijedi za sve ekrane. |
| FR-A11 | Izbor kandidata: među igračima koji odgovaraju zadatku biraju se tri različita: najviši po modelu, najviši po sirovim golovima i asistencijama, i najbolji preostali po skautovim važnostima. Redoslijed prikaza je slučajan, ali isti za isti zadatak. | M | Isti zadatak uvijek daje ista tri igrača istim redom. Nijedan igrač se ne ponavlja. |
| FR-A12 | Slijepo poređenje: ime i klub s ligom su prekriveni crnim trakama. Vide se tri ocjene od 0 do 100 (stvaranje, zabijanje, minutaža), one koje je skaut označio kao važne su prve i istaknute, te pozicija i dob. Cijena, sirovi golovi i rang modela se ne prikazuju. | M | Prekriveni tekst nije čitljiv ni označavanjem mišem ni čitačem ekrana prije otkrivanja. |
| FR-A13 | Otkrivanje: izbor jednog igrača otkriva sva tri. Na svakoj kartici se pojave cijena, golovi i rang. Izabrana kartica je označena, kartica modela nosi etiketu "Model's pick", kartica s najviše golova "Most goals". | M | Otkrivanje traje manje od pola sekunde. Dugmad za izbor nestaju. |
| FR-A14 | Presuda u jednoj krupnoj rečenici: slažu li se skaut i model. Skautov izbor i izbor modela se pamte kao "moji slijepi izbori". Dugme "See why" vodi na karticu igrača kojeg bira model, a "Change" vraća na zadatak. | M | Izbori ostaju zapamćeni dok je aplikacija otvorena. |

### Kartica igrača (`/player/:id`)

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A20 | Zaglavlje: link za povratak, ime, pozicija, dob, klub, liga; tri polja: cijena, istek ugovora, minute s udjelom. | M | Polje bez podatka prikazuje crtu, ne nulu. Adresa bez važeće oznake igrača vodi na radar. |
| FR-A21 | Ocjena u četiri koraka sa strelicama, svaki s velikom brojkom i najviše dva kratka reda teksta: šta je uradio (učinak na 90 minuta), njegova liga (popust ili dodatak u postocima), na istoj skali (prilagođeni učinak), ocjena od 0 do 100. | M | Brojevi se slažu: učinak umanjen za prikazani postotak daje prilagođeni učinak, na dvije decimale. Faktor lige je na prelazak mišem i u detaljima. |
| FR-A22 | Udio u golovima ekipe i minutaža se prikazuju kao mjerači samo u detaljima. | T | Svaki mjerač ima brojku pored trake. |
| FR-A23 | Izgledi: rang i dva niza od deset tačaka, "N od 10 takvih igrača je uspjelo" i "N od 10 kod prosječnog mladog igrača". | M | N je historijska stopa iz `evidence.json` zaokružena na cijeli broj. Tačan broj slučajeva je u detaljima. |
| FR-A24 | Razlozi: do tri pozitivna i jedan negativan, svaki najviše četiri riječi. Oznake: rođen u zadnjem kvartalu, malo minuta, ograničeni podaci, mlađi od 18, ugovor ističe. | M | Svaka oznaka ima objašnjenje na prelazak mišem. |
| FR-A25 | Slični u budžetu: do tri reda s imenom, ligom, cijenom i sličnošću u procentima. | T | Klik otvara karticu tog igrača. Ako ih je manje od tri, prikazuju se oni koji postoje. Napomena o tome šta sličnost poredi je u detaljima. |
| FR-A26 | AI bilješka skauta: najviše dvije kratke rečenice, do 25 riječi. | T | Ako bilješke nema, odjeljak se ne prikazuje. Napomena o porijeklu je u detaljima. |
| FR-A27 | Za odbranu i golmane koraci prikazuju ulogu i kontekst ekipe, uz oznaku ograničenih podataka. | M | Korak s golovima i asistencijama se za te pozicije ne prikazuje. |
| FR-A28 | Projekcija: grafikon vrijednosti igrača do danas i raspon u kojem je za tri godine završila polovina ranijih igrača istog ranga, s tipičnim ishodom. Iznad grafikona su raspon i tipičan ishod kao velike brojke. | T | Raspon je današnja vrijednost pomnožena omjerima iz `evidence.json` za taj rang. U detaljima piše da je to raspon ranijih ishoda, a ne predviđanje, i koliki dio igrača je ostao bez kasnije vrijednosti. |

### Radar (`/radar`)

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A30 | Naslov ekrana je rečenica s brojem igrača koji odgovaraju filterima i brojem igrača ranga A. | M | Brojevi se mijenjaju s filterima. |
| FR-A31 | Filteri: budžet, grupa pozicije, liga, istek ugovora, punoljetnost, sakrivanje imena. | M | Filtriranje traje manje od 100 ms. Zadano: pet regionalnih liga. Filter punoljetnosti postoji, ali je po zadanom isključen (odluka vlasnika od 12. 11. 2026.). |
| FR-A32 | Tabela: rang, igrač s klubom i ligom, pozicija, dob, vrijednost, minute, prilagođeni učinak s trakom, rang izgleda, oznake. | M | Zadani poredak: rang izgleda, zatim prilagođeni učinak. Klik na red otvara karticu. |
| FR-A33 | Grafikon vrijednost naspram izgleda, s linijom budžeta i pragom ranga A. | T | Igrači iznad budžeta su svjetliji. Klik na tačku otvara karticu. |
| FR-A34 | Sakrivanje imena prekriva ime i klub u tabeli. | O | Isti izgled trake kao na slijepom izboru. |
| FR-A35 | Filter "Moji slijepi izbori" prikazuje samo igrače koje je skaut izabrao na slijepom izboru i one koje je tada birao model. | T | Broj pored filtera odgovara broju zapamćenih izbora. |
| FR-A36 | Drugi prikaz radara, "Bosnian passport": igrači s bh. državljanstvom u 23 lige, bez obzira na budžet, s klubom, ligom, dobi, cijenom, minutama, golovima i asistencijama, ocjenom gdje ima smisla i oznakom je li u budžetu. | T | Naslov kaže koliko ih je ukupno, koliko mladih i koliko u budžetu. Za odbranu, golmane i zadnje vezne umjesto ocjene stoji oznaka ograničenih podataka. |

### Vremeplov (`/time-machine`)

Isti radar s kalendarom vraćenim unazad. Služi kao dokaz da bi model zaista izdvojio igrače koji su kasnije uspjeli.

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A50 | Izbor sezone: dugmad za testirane sezone, najmanje četiri zadnje. Zadana je zadnja koja se može provjeriti, ne najbolja. | M | Promjena sezone mijenja listu, naslov i grafikon. |
| FR-A51 | Stanje "tada": naslov s datumom radara i brojem igrača; lista cijelog ranga A te sezone po redu modela, s klubom, ligom i cijenom tada. Ishod se ne vidi. | M | Lista je ista ona iz izvoza za tu sezonu; nijedan igrač nije izostavljen ni premješten. |
| FR-A52 | Stanje "danas": dugme otkriva vrijednost tri sezone kasnije i oznaku uspjeha za svakog igrača. Naslov kaže koliko ih je uspjelo, a red ispod koliko je uspjelo u cijelom bazenu te sezone. | M | Brojevi u naslovu odgovaraju listi. Igrač bez kasnije vrijednosti je prikazan crtom i vodi se kao neuspjeh. Uspjeh se uvijek mjeri tri sezone nakon datuma radara, jednako za svaku sezonu. Za starije sezone lista ima i kolonu s današnjom vrijednošću, a grafikon se produžava do danas; to je dodatak i ne ulazi u brojanje. |
| FR-A53 | Nakon prvog otkrivanja dugmad sezona pokazuju rezultat svake sezone riječima, npr. "17 of 22", i najslabije. | M | Rezultati dolaze iz izvoza. |
| FR-A54 | Grafikon izabranog igrača: vrijednost do datuma radara, raspon očekivanja za tri godine i, nakon otkrivanja, stvarni tok i ishod. | T | Isti grafikon kao projekcija na kartici igrača. |
| FR-A55 | Detalji: na kojim sezonama je model učio i na koliko igrača, veličina bazena, pravilo za igrače bez kasnije vrijednosti i zbir svih testiranih sezona. | M | Tekst se sastavlja iz izvoza. |

### Dokazi (`/evidence`)

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-A40 | Jedan grafikon preko cijele širine: naš izbor i četiri jednostavna pravila kao vodoravne trake, s linijom prosjeka. Iznad je jedna rečenica koja kaže šta znači "uspio". | M | Svaka traka ima vrijednost ispisanu pored. Veličina uzorka i granica greške su u detaljima. |
| FR-A41 | Ispod grafikona: blok "najveći rast svake sezone" s po jednim stvarnim igračem za svaku sezonu vremeplova (ime, klub, krivulja vrijednosti, cijena tada i tri godine kasnije, a za starije sezone i danas), te kartica "šta model ne vidi" (četiri oznake i jedna rečenica). | M | Igrač se bira pravilom, ne ručno: onaj s najvećom vrijednošću tri godine kasnije u rangu A te sezone. Ispod bloka je red sa zbirom svih izbora i brojem onih koji nisu uspjeli. Klik na igrača otvara vremeplov te sezone. |
| FR-A42 | Detalji: isti grafikon za budžet do 500.000 €, s istim redoslijedom redova. | T | Vidljiv samo uz uključene detalje. |
| FR-A43 | Detalji: težina liga kao tačka po ligi na zajedničkoj skali, s primjerom istih igrača u dvije lige, i raspodjela mjeseca rođenja (dvije brojke i 12 malih stubića). | T | Procijenjene vrijednosti liga su prazan kružić s objašnjenjem u potpisu. |
| FR-A44 | Detalji: puna lista ograničenja, najmanje pet stavki. | M | Tekst je običnim jezikom. Uključuje i to da je prednost nad pravilom "najviše minuta" unutar granice greške. |

### Bilješka skauta (jezički model)

| ID | Zahtjev | P | Kriterij prihvatanja |
|---|---|---|---|
| FR-L01 | Bilješke se pišu unaprijed, u pripremi podataka, za sve igrače bazena. Aplikacija ne zove jezički model. | T | Demo radi bez mreže i bez ključa u pregledniku. |
| FR-L02 | Model dobija strukturirani zapis igrača i piše najviše dvije kratke rečenice, do 25 riječi. Ne smije računati ni dodavati činjenice. | T | Svaki broj u bilješci postoji u ulaznom zapisu. Provjera je automatska. |
| FR-L03 | Bilješka koja ne prođe provjeru se zamjenjuje rečenicom iz šablona. | T | Nijedna neprovjerena bilješka ne ulazi u izvoz. |
| FR-L04 | Uz bilješku stoji napomena da ju je napisao jezički model iz brojeva na stranici. | T | Napomena je vidljiva bez prelaska mišem. |

Napomena za izvedbu, ako se koristi Claude API: model `claude-opus-5-5`, strukturirani izlaz preko `output_config.format` s JSON shemom, obrada u paketu jer nije vremenski kritična, i provjera razloga zaustavljanja prije čitanja sadržaja. Ključ ostaje u pripremi podataka i nikad ne ide u aplikaciju.

## 6. Nefunkcionalni zahtjevi

| ID | Zahtjev | Mjera |
|---|---|---|
| NFR-01 | Brzina | Prvi ekran za manje od 2 s; filtriranje ispod 100 ms |
| NFR-02 | Rad bez mreže | Nula mrežnih zahtjeva nakon učitavanja; fontovi su u paketu aplikacije |
| NFR-03 | Ponovljivost | Ista ulazna tabela i isto sjeme daju iste izlazne fajlove |
| NFR-04 | Sljedivost | Svaki prikazani broj ima jedinicu, poređenje i objašnjenje |
| NFR-05 | Čitljivost | Tekst najmanje 14 px, oznake najmanje 12 px; kontrast teksta najmanje 4,5:1 |
| NFR-06 | Pristupačnost | Sve radi tastaturom; fokus je vidljiv; boja nikad nije jedini nosilac značenja |
| NFR-07 | Privatnost | Samo javni podaci; bez naloga, kolačića i praćenja |
| NFR-08 | Preglednik | Zadnja verzija Chromea na laptopu, širina od 1280 px |
| NFR-09 | Tajne | Nijedan ključ u repozitoriju ni u aplikaciji |
| NFR-10 | Poštenje prikaza | Aplikacija prikazuje brojeve iz `evidence.json`; nijedan broj dokaza nije upisan ručno u komponentu |

## 7. Ugovor podataka

Aplikacija čita pet fajlova. Primjeri s izmišljenim igračima su u `ugovor-podataka/`.

### `players.json`: niz zapisa igrača

| Polje | Tip | Opis |
|---|---|---|
| `id` | string | Oznaka igrača iz izvora |
| `name`, `club`, `league_id`, `league_name` | string | Identitet |
| `position_group` | `Attack` \| `Midfield` \| `Defender` \| `Goalkeeper` | Grupa pozicije |
| `position` | string | Detaljna pozicija |
| `age` | broj | Dob na kraju sezone, u godinama s decimalom |
| `birth_quarter` | 1–4 | Kvartal rođenja |
| `height_cm`, `foot` | broj, string ili `null` | Visina i jača noga |
| `value_eur`, `value_date` | broj, datum | Tržišna vrijednost i datum procjene |
| `contract_until` | datum ili `null` | Istek ugovora |
| `minutes`, `matches`, `goals`, `assists` | broj | Sezona 2025/26 |
| `ga90` | broj | Golovi i asistencije na 90 minuta |
| `league_factor`, `league_factor_source` | broj, `moves` \| `estimate` | Faktor lige i porijeklo |
| `ga90_adj` | broj | `ga90` podijeljen faktorom |
| `involvement`, `role` | broj 0–1 | Udio u golovima ekipe; udio u minutama ekipe |
| `pct` | objekt | Percentili `output`, `scoring`, `creating`, `involvement`, `role`, 0–100 |
| `score`, `score_rank_pct` | broj | Ocjena modela i njen rang u bazenu |
| `tier` | `A` \| `B` \| `C` | Rang izgleda |
| `drivers` | niz | Razlozi: `sign` (`+` ili `-`), `key`, `text` |
| `flags` | objekt | `under18`, `low_sample`, `contract_ending`, `born_q4`, `limited_position_data` |
| `similar` | niz | Do tri zapisa: `id`, `similarity` 0–100, `diff` |
| `note` | string ili `null` | Bilješka skauta |
| `citizenship` | string | Državljanstvo; koristi ga prikaz "Bosnian passport" |
| `value_history` | niz | Parovi datum i vrijednost; koristi ih grafikon projekcije |

### Ostali fajlovi

| Fajl | Sadržaj |
|---|---|
| `leagues.json` | Po ligi: oznaka, naziv, država, faktor, izvor faktora, broj sezona, broj igrača u bazenu |
| `evidence.json` | Provjera unazad po budžetu (redovi: pravilo, stopa, uspjelo, izbora), stope i rasponi ishoda po rangu, raspodjela mjeseci rođenja, par "isti igrači, dvije lige", brojevi uzoraka, granice greške |
| `timemachine.json` | Po testiranoj sezoni: datum radara, datum ishoda, sezone učenja, broj redova učenja, veličina i stopa bazena, te cijeli rang A s vrijednošću tada, vrijednošću kasnije, oznakom uspjeha i historijom vrijednosti |
| `meta.json` | Datum izrade, izvor, datum zadnjeg podatka, broj liga i sezona, veličina bazena, verzija modela, broj redova učenja, zadani zadatak za slijepi izbor |

## 8. Definicije i formule

| Pojam | Definicija |
|---|---|
| **Mladi igrač** | Godina početka sezone minus godina rođenja je najviše 21, i igrač ima najmanje 450 ligaških minuta u sezoni |
| **Vrijednost u trenutku odluke** | Zadnja procjena vrijednosti između 1. decembra sezone i 30. juna na kraju sezone |
| **Ishod** | Zadnja procjena između 1. decembra i 30. juna tri sezone kasnije |
| **Pogodak** | Ishod je najmanje dvostruka vrijednost u trenutku odluke i najmanje 1 M € |
| **Sirovi učinak** | 90 × (golovi + asistencije) / minute |
| **Faktor lige** | Koliko je u ligi lakše ostvariti gol ili asistenciju nego u prosjeku 14 liga; 1,00 je prosjek, manje znači težu ligu |
| **Prilagođeni učinak** | Sirovi učinak podijeljen faktorom lige |
| **Popust lige** | 1 − 1 / faktor lige, prikazan kao postotak. Faktor 1,36 daje −26 %. Za lige teže od prosjeka je pozitivan. |
| **Ocjena** | Percentil prilagođenog učinka, od 0 do 100. U izvozu je to `pct.output`, na ekranu "Rating". |
| **Zabijanje, stvaranje, minutaža** | Tri ocjene na slijepom izboru: percentil prilagođenih golova na 90 minuta (`pct.scoring`), prilagođenih asistencija na 90 minuta (`pct.creating`) i uloge u ekipi (`pct.role`) |
| **Podudaranje sa zadatkom** | Prosjek ocjena koje je skaut označio kao važne. Koristi se za izbor trećeg kandidata. |
| **Udio u golovima ekipe** | (golovi + asistencije) / (golovi ekipe × udio igrača u minutama ekipe), najviše 1. Pretpostavlja da ekipa zabija jednako kad je igrač na terenu i kad nije. |
| **Uloga u ekipi** | Minute igrača / (broj utakmica ekipe × 90) |
| **Percentil** | Položaj među mladim igračima iste grupe pozicije u sve 23 lige, sezona 2025/26 |
| **Mali uzorak** | Manje od 900 minuta |

**Faktor lige iz prelazaka.** Uzimaju se napadači i vezni igrači koji su u dvije uzastopne sezone odigrali najmanje 900 minuta u dvije različite lige. Za svaki par liga saberu se njihovi golovi, asistencije i minute u jednoj i u drugoj ligi i izračuna omjer stopa. Faktori se dobijaju metodom najmanjih kvadrata nad logaritmima tih omjera, ponderisano brojem igrača, uz uslov da je prosjek logaritama nula. Parovi s manje od osam igrača se izostavljaju.

**Faktor lige iz vrijednosti.** Na ligama s izmjerenim faktorom procijeni se prava: logaritam faktora u zavisnosti od medijana logaritma vrijednosti igrača lige. Ta prava daje faktor za lige bez dovoljno prelazaka. U prototipu su Rusija i Ukrajina izostavljene iz procjene prave, uz pretpostavku da su im vrijednosti od 2022. poremećene.

**Osobine modela (19).** Dob na kraju sezone; minute; uloga u ekipi; golovi na 90; asistencije na 90; percentil sirovog učinka u ligi, sezoni i poziciji; logaritam vrijednosti; promjena vrijednosti u 12 mjeseci i oznaka da ona nedostaje; minute prethodne sezone; bodovi ekipe po utakmici; medijan vrijednosti saigrača; vrijednost u odnosu na saigrače; medijan vrijednosti lige; visina; četiri oznake grupe pozicije.

**Sličnost.** Svaki igrač je vektor standardizovan unutar grupe pozicije: prilagođeni golovi na 90, prilagođene asistencije na 90, uloga u ekipi, dob, visina i jača noga. Udaljenost je euklidska s težinama. Sličnost u procentima je 100 × (1 − udaljenost / udaljenost na 95. percentilu grupe), najmanje 0. To je skala za prikaz, a ne vjerovatnoća.

## 9. Provjere kvaliteta prije izvoza

1. Svaka od devet tabela ima očekivane kolone i više od nula redova.
2. Izračunate minute na testnim ligama su unutar 5 minuta u najmanje 99 % nastupa.
3. Nijedan igrač nema više minuta nego što je ekipa odigrala.
4. Svaki igrač bazena ima datum rođenja, grupu pozicije i vrijednost.
5. Svaka liga ima faktor između 0,3 i 2,5.
6. Engleska ima najmanji faktor među 14 liga.
7. Nijedna testna sezona provjere unazad nije u vlastitom skupu za učenje.
8. Zbir pogodaka i promašaja u izvještaju jednak je broju izbora.
9. Brojevi po rangu se sabiraju u veličinu bazena.
10. Nijedan sličan igrač nije sam taj igrač.
11. Svaka bilješka sadrži samo brojeve iz ulaznog zapisa.
12. Izlazni fajlovi prolaze provjeru sheme.
13. U vremeplovu nijedan red učenja nije iz sezone koja je manje od tri sezone prije prikazane.
14. Bazen vremeplova sadrži sve mlade igrače sezone do 1 M €, bez obzira na kasniji ishod.
15. Lista vremeplova sadrži tačno gornjih 10 % bazena, redom modela.

## 10. Test prihvatanja: demo tok

Izvodi se tri puta zaredom, s isključenom mrežom nakon učitavanja.

1. Otvoriti `/blind`. Zadatak je popunjen i vidi se broj igrača koji odgovaraju. Nastaviti: vide se tri kartice s prekrivenim imenima.
2. Izabrati igrača. Sva tri se otkrivaju, presuda je ispisana.
3. Otvoriti karticu. Četiri koraka razlaganja se slažu računski.
4. Preći na radar. Naslov pokazuje broj igrača i broj ranga A.
5. Promijeniti budžet. Lista i naslov se mijenjaju odmah.
6. Preći na vremeplov. Vidi se lista za zadnju provjerljivu sezonu, bez ishoda. Otkriti ishod: naslov kaže koliko ih je uspjelo, a dugmad sezona pokazuju rezultat svake.
7. Preći na dokaze. Vide se trake modela i pravila i tri nalaza.
8. Konzola preglednika nema grešaka. Kartica Network nema novih zahtjeva.

Ukupno trajanje koraka 1 do 7 s govorom: najviše 2 minute i 40 sekundi.

## 11. Van opsega

Nalozi i prijava, podaci uživo, video, bh. liga, ženski fudbal, mobilni prikaz ispod 1280 px, tamna tema, upis podataka od strane korisnika.
