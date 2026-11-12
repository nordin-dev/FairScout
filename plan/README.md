# Fair Scout — plan projekta

AI Sports Analytics Hackathon, IUS, 11–13. novembar 2026. Izazov 02, *Find the Hidden Talent*.
Rok za izradu: četvrtak 12. 11. u 16:00. Pitch traje tri minute.

**Ideja:** radar koji skautu kluba s malim budžetom pokaže mlade potcijenjene igrače u 23 evropske lige, objasni ocjenu korak po korak i kaže koliko joj se može vjerovati.

## Šta je u folderu

| Fajl | Šta sadrži | Ko ga čita |
|---|---|---|
| `01-PRD.md` | Problem, korisnici, rješenje, korisničke priče, opseg, rizici | Oboje, prvo |
| `02-softverski-zahtjevi.md` | Zahtjevi s kriterijima prihvatanja, ugovor podataka, formule, provjere | Oboje, tokom izrade |
| `03-KPI.md` | Mjere za žiri, podatke i model, proizvod i demo | Oboje, prije predaje |
| `04-frontend-dizajn.md` | Smjer dizajna, tokeni, komponente, ekrani, grafikoni, tekstovi | Osoba za aplikaciju |
| `05-ziri-i-bodovanje.md` | Šest kriterija i tri člana žirija: čime dobijamo bodove | Oboje, prije pitcha |
| `06-podaci-i-model.md` | Izvor, metoda i svi provjereni brojevi na jednom mjestu | Osoba za podatke |
| `07-plan-izrade.md` | Faze, raspored, tačke provjere, šta se reže | Oboje |
| `08-pitch-i-demo.md` | Tekst pitcha na oba jezika, tok demoa, pitanja i odgovori | Osoba za pitch |
| `09-ulaz-za-prodready.md` | Vizija, opseg, ekrani, rizici i 30 priča u obliku za prodready | Za unos u prodready |
| `dizajn/mockup.html` | Radna maketa: četiri odjeljka (slijepi izbor, radar, vremeplov, dokazi) i kartica igrača. Strelice mijenjaju ekran, R otkriva igrače, D uključuje detalje metode. | Oboje |
| `dizajn/ekran-*.png` | Snimci svih ekrana makete: `1a`, `1b`, `1c` su tri koraka slijepog izbora, zatim kartica igrača, `2` radar i `2b` prikaz "Naši vani", `3a` i `3b` vremeplov tada i danas, `4` dokazi; fajlovi s `detalji` u nazivu su s uključenim detaljima | Mjerilo za izgled |
| `ugovor-podataka/` | Primjeri pet JSON fajlova koje aplikacija čita; `timemachine.sample.json` je stvarni izlaz prototipa | Osoba za aplikaciju |
| `prototip/` | Skripte brze provjere i njihovi ispisi | Osoba za podatke |

Za deset minuta: `01-PRD.md`, zatim otvoriti `dizajn/mockup.html`, zatim tabela u `06-podaci-i-model.md`, poglavlje 6.

## Ključne odluke

1. **Korisnik je skaut bh. kluba**, a igrači koje gleda su iz liga za koje postoje podaci. Bh. liga nije u podacima.
2. **Dijelovi proizvoda:** slijepi izbor, radar potcijenjenih, prilagođena ocjena s projekcijom, slični u budžetu, vremeplov i dokazi.
   Radar pokazuje šta misli model. Slijepi izbor pokazuje šta misli skaut kad ne zna ko je ko: prvo kaže šta traži, zatim bira između tri kandidata bez imena.
3. **Pogodak** znači: vrijednost igrača se za tri godine najmanje udvostručila i prešla milion eura.
4. **Glavni model je logistička regresija**, jer se njeni razlozi mogu vjerno prikazati. Gradient boosting je kontrola.
5. **Izgledi su rang A, B ili C s historijskom stopom**, ne procenat.
   **Vremeplov je dokaz na stvarnim igračima:** isti radar s ranijim datumom, model koji ne zna budućnost, cijela lista s promašajima, sve sezone.
6. **Aplikacija čita statične fajlove.** Nema servera, demo radi bez mreže.
7. **Vlastite komponente i grafikoni**, bez gotovog UI kompleta, da aplikacija ne izgleda generički.
8. **Svijetla tema**, zbog projektora.
9. **Ekran se gleda, ne čita.** Zadani prikaz ima naslov, velike brojke i oznake. Metoda je iza prekidača "Details".
10. **Izrada ide kroz prodready.**

## Šta je provjereno, a šta nije

| Provjereno na podacima (prototip, 11. 11.) | Nije provjereno |
|---|---|
| Skup pokriva 23 lige; 14 ima 14 sezona, 9 ima dvije | Uslovi korištenja podataka |
| Minute se mogu izračunati iz postava: 99,9 % unutar 5 minuta | Faktori za devet liga s kratkom historijom: procjena bez provjere unazad |
| Faktori liga iz 3.126 prelazaka daju smislen poredak | Da li ono što model nauči vrijedi i u devet kratkih liga |
| Izbori modela uspiju u 47–53 %, prosjek je 30 % (računa se svaki igrač sezone) | Tačna odredba FIFA-e o transferu maloljetnika |
| Golovi i asistencije: 36 %; najjeftiniji: 12 % | Referenca iz literature za nalaz o datumu rođenja |
| Vremeplov za šest sezona: 15/23, 10/22, 17/22, 7/23, 10/20, 11/23 | |
| Rođenih u prvom kvartalu je 31 %, u zadnjem 19 % | Šta tačno piše u briefu izazova 02 |

Svi brojevi iz lijeve kolone moraju se ponoviti u kodu projekta prije nego odu u aplikaciju ili pitch.

## Otvorena pitanja za tim

1. Jesu li pitch i interfejs na engleskom ili bosanskom? Plan pretpostavlja engleski; bosanski tekstovi su pripremljeni.
2. Traži li brief izazova 02 nešto što plan ne pokriva?
3. Ko je osoba za podatke, a ko za aplikaciju i pitch?
4. Kojim servisom se pišu bilješke skauta, ako se uopšte rade?
5. Može li se do četvrtka dobiti mišljenje jednog skauta ili trenera?
