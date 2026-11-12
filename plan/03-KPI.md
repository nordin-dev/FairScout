# 03 — KPI: kako znamo da je dobro

Četiri grupe mjera. Prve tri se mjere do predaje, četvrta je prijedlog za poslije hakatona.
Kolona "Prototip" pokazuje vrijednost iz brze provjere od 11. 11. 2026. Tamo gdje je prazna, mjera još nije mjerena.

## A. Hakaton: bodovi žirija

Šest kriterija, svaki 1 do 5, ukupno 30. Cilj je najmanje 4 na svakom kriteriju. Šta donosi bodove po kriteriju stoji u `05-ziri-i-bodovanje.md`.

| ID | Kriterij | Cilj | Kako provjeravamo prije predaje |
|---|---|---|---|
| H-1 | Relevantnost sportskog problema | 5 | Problem se može reći u dvije rečenice s jednim našim brojem. Jedna osoba izvan tima ga ponovi nakon što ga čuje jednom. |
| H-2 | Kvalitet podataka i analitička ispravnost | 5 | Sve mjere iz grupe B su ispunjene i vidljive na ekranu "Dokazi". |
| H-3 | Tehnička izvedba | 4 | Sve mjere iz grupe C su ispunjene. Tok radi tri puta zaredom bez greške. |
| H-4 | Inovacija i kreativnost | 4 | Zadatak, slijepo poređenje i otkrivanje rade i zajedno traju manje od 30 sekundi u demou. Vremeplov otkriva ishod jednim klikom. |
| H-5 | Izvodljivost, uticaj i inkluzija | 4 | Na pitchu se izgovore: ko koristi, šta dobija, šta je sljedeći korak, i jedan nalaz o pravednosti. |
| H-6 | Kvalitet prezentacije | 5 | Pitch traje 2:50 do 3:00 u tri uzastopne probe. Postoji rezervni snimak. |

## B. Podaci i model

| ID | Mjera | Definicija | Cilj | Prototip |
|---|---|---|---|---|
| D-1 | Tačnost izračunatih minuta | Udio nastupa gdje se minute izračunate iz postava i izmjena razlikuju najviše 5 od službenih (test na Belgiji i Holandiji 2024/25) | ≥ 99 % | 99,9 % |
| D-2 | Tačnost izračunatih golova | Udio nastupa s istim brojem golova kao u službenoj tabeli | ≥ 99,5 % | 100 % |
| D-3 | Potpunost profila | Udio igrača u bazenu radara s datumom rođenja, pozicijom i vrijednošću | 100 % (uslov ulaska u bazen) | 100 % |
| D-4 | Smislenost faktora liga | Rang-korelacija faktora iz prelazaka s tržišnom vrijednošću lige, 14 liga | ≤ −0,7 | −0,85 |
| M-1 | Stopa pogodaka modela | Udio pogodaka među gornjih 10 % po modelu, mladi do 1 M €, provjera unazad 2017/18–2022/23 | ≥ 15 postotnih poena iznad prosjeka | 47–53 % naspram 30 % |
| M-2 | Prednost nad najboljim pravilom | Ista stopa minus stopa najboljeg jednostavnog pravila | > 0, prijaviti s granicom greške | +3 do +9 poena, granica ±8 |
| M-3 | Razdvajanje (AUC) | Površina ispod ROC krive na istom skupu | ≥ 0,65 | 0,67–0,68 |
| M-4 | Poštenje prikaza | Razlika između prikazane historijske stope ranga i stope izmjerene u provjeri unazad | 0 (prikazuje se izmjereni broj) | — |
| M-5 | Ponovljivost | Dva pokretanja pripreme podataka daju iste brojeve | Da | — |
| M-6 | Stopa po kvartalu rođenja | Stopa pogodaka izbora modela po kvartalu rođenja, prijavljena na ekranu "Dokazi" ili u bilješci | Prijavljeno | Stvarna stopa udvostručenja vrijednosti u testnom skupu: Q1 39 %, Q4 49 % |
| M-7 | Poštenje vremeplova | Lista je cijeli rang A iz izvoza, bazen nije čišćen po ishodu, prikazane su sve testirane sezone | Da, uz automatsku provjeru pri izvozu | Šest sezona: 15/23, 10/22, 17/22, 7/23, 10/20, 11/23 |

Pojmovi:

- **Pogodak:** vrijednost igrača tri godine kasnije je najmanje dvostruka i najmanje 1 M €.
- **Jednostavna pravila:** najviše minuta, najviše golova i asistencija na 90 minuta, najmlađi, najjeftiniji.
- **Provjera unazad:** za svaku sezonu model uči samo na sezonama čiji je ishod tada već bio poznat.

Ako M-1 ne bude ispunjen u vašem kodu, proizvod i dalje stoji: prikazuje se ono što je izmjereno, a težište pitcha se prebacuje na tri robusna nalaza (golovi, cijena, liga) i na slijepi izbor.

## C. Proizvod i demo

| ID | Mjera | Cilj | Kako mjerimo |
|---|---|---|---|
| P-1 | Vrijeme do liste | Od otvaranja radara do liste unutar budžeta: manje od 10 sekundi, bez kucanja | Štoperica |
| P-2 | Trajanje demo toka | Slijepi izbor → kartica → radar → vremeplov → dokazi, s govorom: najviše 2:40 | Štoperica, tri probe |
| P-3 | Učitavanje | Prvi ekran za manje od 2 sekunde na laptopu za demo | Alat preglednika |
| P-4 | Rad bez mreže | Nula mrežnih zahtjeva nakon učitavanja | Kartica Network, isključen wifi |
| P-5 | Greške | Nula grešaka u konzoli tokom demo toka | Konzola preglednika |
| P-6 | Sljedivost brojeva | Svaka metrika na kartici ima jedinicu, poređenje i objašnjenje na prelazak mišem | Pregled po listi iz `02-softverski-zahtjevi.md` |
| P-7 | Čitljivost s projektora | Najmanji tekst 12 px za oznake, 14 px za sadržaj; kontrast teksta najmanje 4,5:1 | Pregled, proba na projektoru ili TV-u |
| P-8 | Upravljanje tastaturom | Strelice mijenjaju ekran, R otkriva igrače | Proba |
| P-9 | Dosljednost zapisa | Jedan format za novac (€150k, €1.2M), minute (1,180), decimale (0.53) | Pregled |
| P-10 | Količina teksta na ekranu | U zadanom prikazu nema pasusa; najviše 160 riječi i brojki po ekranu, ne računajući tabelu radara. Maketa: zadatak 51, slijepo poređenje 88, otkrivanje 145, kartica 184, dokazi 140. Liste radara i vremeplova se ne računaju. | Brojanje vidljivog teksta, kao u maketi (`data-words`) |
| P-11 | Razumljivost bez objašnjenja | Osoba izvan tima nakon pet sekundi gledanja ekrana kaže šta je poenta | Proba s jednom osobom po ekranu |

## D. Poslije hakatona: uticaj (prijedlog, nije mjereno)

| ID | Mjera | Zašto |
|---|---|---|
| I-1 | Broj skauta ili sportskih direktora koji su vidjeli alat i rekli bi ga koristiti | Jedina prava provjera relevantnosti |
| I-2 | Udio igrača s liste koje je skaut otišao pogledati uživo | Mjeri da li lista štedi vrijeme |
| I-3 | Potpisani igrači s liste i njihova vrijednost nakon dvije sezone | Krajnji ishod |
| I-4 | Udio igrača rođenih u drugoj polovini godine na listama skauta, prije i poslije | Mjeri uticaj na pravednost |
| I-5 | Udio igrača iz manjih klubova i liga na listama | Isto |

Na pitchu se iz grupe D kaže samo jedna rečenica: šta biste prvo mjerili s pravim klubom.
