# 01 — PRD: Fair Scout

Dokument o zahtjevima proizvoda. Verzija za hakaton, 11. novembar 2026.
Brojevi označeni sa **(prototip)** dolaze iz brze provjere od 11. 11. 2026. i moraju se ponoviti u vašem kodu prije nego odu na slajd ili u aplikaciju. Svi su na jednom mjestu u `06-podaci-i-model.md`.

## 1. Sažetak

**Fair Scout** je radar za skauta kluba s malim budžetom. Skaut postavi budžet, a aplikacija mu među mladim igračima iz 23 evropske lige pokaže one koje tržište vjerovatno potcjenjuje, objasni zašto i kaže koliko se tom sudu može vjerovati.

Jedna rečenica za pitch: *"Radar koji ne gleda ime, nego igru."*

## 2. Problem

Skaut malog kluba ima jedan vikend, skroman budžet i hiljade igrača. Zato bira po onome što se vidi bez alata: golovima, imenu kluba i cijeni. Podaci pokazuju da ta tri signala slabo rade.

| Šta skaut gleda | Šta podaci kažu (prototip) |
|---|---|
| Golove i asistencije | Među mladim igračima do 1 M € oni s najviše golova i asistencija uspiju u 36 % slučajeva, a prosjek svih je 30 %. Razlika je unutar granice greške. |
| Cijenu ("jeftin je, vrijedi probati") | Najjeftiniji uspiju u 12 % slučajeva, više nego upola rjeđe od prosjeka. |
| Ligu i klub | Ista 32 igrača imala su 0,69 golova i asistencija na 90 minuta u Holandiji, a 0,32 u Engleskoj. Učinak se ne može porediti bez preračuna. |
| Fizičku zrelost | Od 20.241 prvoligaškog igrača 31 % je rođeno u prva tri mjeseca godine, a 19 % u zadnja tri. |

"Uspjeh" u tabeli znači: vrijednost igrača se za tri godine najmanje udvostručila i prešla milion eura.

Posljedica: talenat ostaje skriven iza slabije lige, lošije ekipe ili kasnijeg datuma rođenja, a klub s malim budžetom ga ne nađe jer nema ni vremena ni alata.

## 3. Korisnici

| Korisnik | Šta mu treba | Kako ga mjerimo |
|---|---|---|
| **Skaut bh. kluba** (primarni) | Kratka lista igrača koje vrijedi otići pogledati, unutar budžeta | Do liste od 10 imena dolazi za manje od minute |
| **Sportski direktor** (sekundarni) | Razlog koji može pročitati i odbraniti pred upravom | Svaka preporuka ima razlaganje ocjene i izvor |
| **Žiri** (publika) | Da za tri minute razumije problem, vidi da alat radi i da je metoda poštena | Vidi `05-ziri-i-bodovanje.md` |

Ilustrativna persona (nije stvarna osoba): Emir, 34 godine, jedini skaut kluba iz Premijer lige BiH, uz to radi u omladinskoj školi. Igrače prati preko Transfermarkta, preporuka menadžera i snimaka. Odlazak na utakmicu u Hrvatsku ili Srbiju znači cijeli dan i trošak, pa mora unaprijed znati zbog koga ide.

Igrači koje gleda su iz liga za koje postoje podaci. Bh. liga nije među njima, pa aplikacija ne ocjenjuje domaće igrače. To se otvoreno kaže i navodi kao sljedeći korak.

## 4. Poslovi koje korisnik obavlja

1. *Kad planiram vikend, želim znati koja tri igrača u regiji najviše vrijede puta.*
2. *Kad mi menadžer ponudi igrača, želim za pola minute vidjeti je li njegov učinak stvaran ili je posljedica lige i ekipe.*
3. *Kad ne mogu platiti igrača kojeg želim, hoću slične koji staju u budžet.*
4. *Kad predlažem igrača upravi, trebam objašnjenje koje nije "meni se sviđa".*

## 5. Ciljevi i ne-ciljevi

**Ciljevi za hakaton**

- Jedan potpun tok koji radi uživo: slijepi izbor → kartica igrača → radar → vremeplov → dokazi.
- Model s provjerom unazad i poštenim poređenjem s jednostavnim pravilima.
- Svaki broj u aplikaciji ima jedinicu, poređenje i izvor.
- Dizajn koji izgleda kao skautski dosje, a ne kao generički dashboard.

**Nije cilj**

- Predviđanje ko će postati profesionalac ili zvijezda.
- Zamjena skauta. Alat sužava listu, čovjek odlučuje.
- Ocjena stila igre. Podaci imaju samo golove, asistencije, minute i kartone.
- Prijava korisnika, nalozi, baza, plaćanje.
- Podaci uživo. Skup je zamrznut na juni 2026.

## 6. Rješenje

| # | Dio | Šta radi | Koji problem rješava |
|---|---|---|---|
| 1 | **Slijepi izbor** | Skaut prvo kaže šta traži: poziciju, dob, budžet i šta mu je najvažnije. Dobije tri kandidata bez imena, kluba, lige i cijene, bira, zatim se sve otkrije i vidi slaže li se model. | Ime, klub i cijena utiču na sud prije nego skaut pogleda igru. |
| 2 | **Radar potcijenjenih** | Rang mladih igrača unutar budžeta po izgledima za napredak, s razlozima. | Golovi i cijena ne pokazuju ko će napredovati. |
| 3 | **Prilagođena ocjena** | Učinak na 90 minuta, preračunat za jačinu lige i ekipe, upoređen s vršnjacima na istoj poziciji. Razlaganje je vidljivo korak po korak. | Učinak iz različitih liga nije uporediv. |
| 4 | **Slični u budžetu** | Tri igrača najsličnijeg profila koje klub može platiti. | Skaut zna kakvog igrača traži, ali ga ne može platiti. |
| 5 | **Dokazi** | Provjera unazad, faktori liga, raspodjela rođenja i lista onoga što model ne zna. | Žiri i korisnik moraju moći provjeriti tvrdnje. |
| 6 | **Vremeplov** | Isti radar s kalendarom vraćenim na raniju sezonu: lista koju bi model tada dao, zatim šta se s tim igračima desilo. Prava imena, cijeli rang A, s promašajima. | Tvrdnja da alat nalazi talente mora se vidjeti na stvarnim igračima, a ne samo u procentima. |
| 7 | **Projekcija** | Na kartici: vrijednost igrača do danas i raspon u kojem je za tri godine završila polovina sličnih igrača. | Rang i "5 od 10" ne govore koliko igrač može vrijediti. |
| 8 | **Naši vani** | Drugi prikaz radara: igrači s bh. pasošem u 23 lige. | Domaći klub nema pregled svojih igrača vani na jednom mjestu. |

**Radar i slijepi izbor nisu isto.** Radar pokazuje šta misli model: lista svih igrača u budžetu, s imenima, poredana. Slijepi izbor pokazuje šta misli skaut kad ne zna ko je ko: tri kandidata po njegovom zadatku, bez imena i bez ocjene modela. Radar daje listu, slijepi izbor daje odluku. Tamo gdje se skaut i model ne slože, to su igrači koje vrijedi otići pogledati.

Izgledi se ne prikazuju kao procenat, nego kao **rang A, B ili C** s historijskom stopom: "od 10 igrača koje je model ranije ovako rangirao, oko 5 je uspjelo". Razlog: sirova vjerovatnoća iz modela nije dobro kalibrisana, a historijska stopa je broj koji se može provjeriti.

Svaki ekran ima dva nivoa. Zadani prikaz je za prezentaciju: naslov, velike brojke i oznake, bez pasusa. Prekidač "Details" otkriva metodu, uzorke i granice greške, za pitanja žirija i za skauta koji želi provjeriti.

## 7. Korisničke priče i kriteriji prihvatanja

| ID | Priča | Kriteriji prihvatanja |
|---|---|---|
| US-01 | Kao skaut želim izabrati između tri igrača bez imena, da moj izbor ne zavisi od kluba i cijene. | Prikazana su tri kandidata koji odgovaraju mom zadatku. Prije izbora se vide samo tri ocjene od 0 do 100 (stvaranje, zabijanje, minutaža), pozicija i dob; ime, klub, liga i cijena su skriveni. Nakon izbora sva tri se otkrivaju odjednom, s cijenom, golovima i rangom. |
| US-02 | Kao skaut želim nakon izbora vidjeti slaže li se model sa mnom. | Presuda u jednoj rečenici kaže slažemo li se. Kartice modela i igrača s najviše golova nose etikete. Moj izbor i izbor modela se pamte kao moji slijepi izbori i mogu se izdvojiti u radaru. |
| US-03 | Kao skaut želim, kad izaberem ili otvorim igrača, vidjeti kako je nastala njegova ocjena. | Kartica prikazuje četiri koraka s velikim brojkama: šta je uradio, njegova liga, učinak na istoj skali, ocjena od 0 do 100. Svaki korak ima brojku i najviše dva kratka reda teksta. |
| US-04 | Kao skaut želim znati koliko mogu vjerovati ocjeni. | Kartica prikazuje rang A/B/C i "N od 10 takvih igrača je uspjelo" naspram prosjeka, oznaku "malo minuta" ispod 900 minuta i oznaku "ograničeni podaci" za odbranu i golmane. Tačan broj slučajeva je u detaljima. |
| US-05 | Kao skaut želim listu igrača unutar budžeta. | Radar filtrira po budžetu, poziciji, ligi, dobi i isteku ugovora. Naslov ekrana kaže koliko igrača odgovara i koliko ih je ranga A. Filtriranje je trenutno. |
| US-06 | Kao skaut želim jednim pogledom vidjeti ko je jeftin i obećavajući. | Grafikon vrijednost naspram izgleda, s linijom budžeta i pragom ranga A. Klik na tačku otvara karticu. |
| US-07 | Kao skaut želim slične igrače koje mogu platiti. | Na kartici su tri igrača iste grupe pozicije, unutar budžeta, sa sličnošću u procentima i jednom rečenicom razlike. |
| US-08 | Kao sportski direktor želim kratak pisani sažetak. | Bilješka od najviše dvije kratke rečenice koristi samo brojeve s kartice. U detaljima stoji da ju je napisao jezički model i da ne dodaje činjenice. |
| US-09 | Kao član žirija želim vidjeti da je model provjeren. | Ekran "Dokazi" prikazuje stopu pogodaka modela i četiri jednostavna pravila, veličinu uzorka i granicu greške. |
| US-10 | Kao član žirija želim vidjeti šta model ne zna. | Isti ekran ima listu ograničenja običnim jezikom. |
| US-13 | Kao skaut želim prvo reći šta tražim, da kandidati odgovaraju mojoj potrebi, a ne opštoj rang-listi. | Pozicija, dob, budžet i do dvije važnosti se biraju dugmadima, bez kucanja. Broj igrača koji odgovaraju se vidi odmah. S manje od tri igrača nastavak je onemogućen. |
| US-12 | Kao član žirija koji nije tehnički želim shvatiti poentu ekrana za nekoliko sekundi. | U zadanom prikazu nema pasusa: poenta je u naslovu i u jednoj velikoj brojci ili slici. Metoda je iza prekidača "Details". |
| US-14 | Kao član žirija želim vidjeti da bi alat zaista izdvojio igrače koji su kasnije uspjeli. | Vremeplov prikazuje radar za prošlu sezonu onako kako bi tada izgledao, zatim ishod. Lista je cijeli rang A po redu modela, s promašajima. Model je učio samo na sezonama čiji je ishod tada bio poznat. Dostupne su sve testirane sezone i njihov zbir. |
| US-15 | Kao skaut želim vidjeti gdje bi igrač mogao biti za tri godine. | Kartica prikazuje vrijednost do danas i raspon u kojem je završila polovina ranijih igrača istog ranga, s tipičnim ishodom. Piše da je to raspon ranijih ishoda, a ne predviđanje. |
| US-16 | Kao skaut bh. kluba želim pregled igrača s bh. pasošem vani. | Radar ima drugi prikaz s tim igračima: klub, liga, dob, cijena, minute, ocjena gdje ima smisla i oznaka je li u budžetu. |
| US-11 | Kao skaut želim znati mogu li igrača uopšte dovesti. | Igrači mlađi od 18 godina su označeni; filter ih može sakriti, ali po zadanom su prikazani. Igrači kojima ugovor ističe u narednih 12 mjeseci su označeni. |

## 8. Opseg

| Prioritet | Stavke |
|---|---|
| **Mora** | Priprema podataka za 23 lige; faktor lige; model i provjera unazad; izvoz u JSON; ekrani Slijepi izbor, Kartica igrača, Radar (tabela i filteri), Vremeplov, Dokazi; razlaganje ocjene; rang A/B/C; oznake malog uzorka i pozicije; traka izvora podataka |
| **Trebalo bi** | Grafikon vrijednost naspram izgleda; slični u budžetu; bilješka jezičkog modela; oznaka isteka ugovora; oznaka kvartala rođenja; projekcija na kartici; prikaz "Naši vani"; prečice na tastaturi za demo |
| **Moglo bi** | "Sličan poznatom igraču u istoj dobi"; pretraga po imenu; prekidač jezika; izvoz liste u PDF |
| **Neće** | Nalozi i prijava; podaci uživo; video; bh. liga; ženski fudbal (nema podataka u skupu) |

Pravilo rezanja ako ponestane vremena: prvo otpada red "Moglo bi", zatim bilješka jezičkog modela, zatim grafikon na radaru. Četiri ekrana iz reda "Mora" se ne režu.

## 9. Mjere uspjeha

Sve mjere s ciljanim vrijednostima su u `03-KPI.md`. Tri glavne:

1. Model u provjeri unazad pogađa češće od prosjeka i od svakog jednostavnog pravila.
2. Demo tok od slijepog izbora do dokaza traje najviše 75 sekundi i radi bez mreže.
3. Svaki prikazani broj ima jedinicu, poređenje i izvor.

## 10. Pretpostavke

| Pretpostavka | Šta ako ne stoji |
|---|---|
| Pitch i aplikacija su na engleskom (materijali hakatona su na engleskom). | Tekstovi su izdvojeni u jedan fajl; bosanska verzija je u `04-frontend-dizajn.md`. |
| Brief izazova 02 ne traži ništa što ovaj plan ne pokriva. | Opseg je uzak, jedna stvar se može dodati u red "Trebalo bi". |
| Ono što model nauči na 14 liga s dugom historijom vrijedi i za 9 liga s dvije sezone. | Ne može se provjeriti unazad. To se navodi kao ograničenje u aplikaciji i na pitchu. |
| Podaci s Transfermarkta smiju se koristiti za hakaton. | Uslove korištenja nismo uspjeli potvrditi. Vidi rizik R-05. |

## 11. Rizici

| ID | Rizik | Vjerovatnoća | Odgovor |
|---|---|---|---|
| R-01 | Brojevi u vašem kodu ispadnu slabiji od prototipa | Srednja | Prikazati ono što dobijete. Priča stoji i s manjom razlikom, jer su tri nalaza (golovi, cijena, liga) robusna. Ne uljepšavati. |
| R-02 | Žiri pita "model je jedva bolji od pravila najviše minuta" | Visoka | Reći sami, prije pitanja. Odgovor je u `08-pitch-i-demo.md`. |
| R-03 | Aplikacija izgleda kao generički dashboard | Srednja | `04-frontend-dizajn.md`, maketa u `dizajn/mockup.html` i lista zabrana u poglavlju 12 istog dokumenta. Tokeni i komponente se prepisuju iz makete, bez gotovog UI kompleta. |
| R-04 | Demo zakaže zbog mreže | Niska | Svi podaci su u statičnim fajlovima. Rezervni snimak ekrana. |
| R-05 | Pitanje o pravu na korištenje podataka | Srednja | Navesti izvor na svakom ekranu, reći da je skup javan i da se koristi za nekomercijalni prototip, a da bi proizvod tražio licencirane podatke. |
| R-06 | Faktor za lige s dvije sezone je procjena | Sigurno | Označen kao procjena u aplikaciji (prazan kružić, riječ "estimate"). |
| R-07 | Ocjena za odbranu i golmane je slaba | Sigurno | Oznaka "ograničeni podaci za poziciju". Demo voditi na napadaču ili krilu. |
| R-08 | Vremeplov se shvati kao "mogli ste ga kupiti za tu cijenu" | Srednja | Kolona se zove "cijena tada", u detaljima piše da je to procjena koja kasni, a u pitchu se kaže "model ga je izdvojio", ne "mogao se kupiti". |
| R-09 | Rezultat se jako razlikuje po sezonama (od 7 od 23 do 17 od 22) | Sigurno | Vremeplov pokazuje sve sezone, i najslabiju, uz zbir. Zadana je zadnja koja se može provjeriti, ne najbolja. |

## 12. Pravednost, inkluzija i zaštita igrača

- **Slijepi prikaz** uklanja ime, klub, ligu, državljanstvo i cijenu iz prvog suda.
- **Datum rođenja:** aplikacija označava igrače rođene u zadnjem kvartalu, jer ih je na ovom nivou 2,3 puta manje nego rođenih u prvom (608 naspram 1.394 među mladima, prototip), a u podacima su češće rasli u vrijednosti. Nalaz je na granici pouzdanosti, pa je to oznaka, a ne dio ocjene.
- **Manje lige:** faktor lige vraća igračima iz slabijih liga uporedivost koju sirova statistika ne daje.
- **Maloljetnici:** u bazenu su trojica mlađa od 18 godina (prototip). Prikazani su i označeni: vlasnik projekta je 12. 11. 2026. odlučio da se ne skrivaju, jer su to javni podaci koje skaut može naći i sam. Međunarodni transfer maloljetnika je ograničen pravilima FIFA-e; tačnu odredbu provjeriti prije navođenja.
- **Privatnost:** koriste se samo javni podaci o profesionalnim nastupima. Nema naloga, praćenja ni ličnih podataka mimo onoga što je javno.
- **Igrač nije broj:** ocjena je namijenjena skautu kao razlog da ode pogledati igrača. Nije javna rang-lista.
- **Ženski fudbal:** skup podataka ga ne sadrži. Metoda je ista, ali to je sljedeći korak, a ne dio demoa.

## 13. Poslije hakatona

1. Podaci za bh. ligu u saradnji sa savezom ili klubovima, da radar radi i u drugom smjeru: da strani skaut vidi igrače odavde.
2. Licencirani podaci s više događaja (šutevi, dodavanja, odbrana), da ocjena vrijedi za sve pozicije.
3. Razgovor s tri skauta ili sportska direktora: da li bi listu koristili i šta nedostaje.
4. Ženske lige.
