# Ugovor podataka: primjeri

Pet fajlova koje aplikacija čita iz `app/public/data/`. Ovdje su primjeri s oblikom svakog fajla, da se ekrani mogu graditi prije nego stvarni podaci stignu. Opis svakog polja je u `02-softverski-zahtjevi.md`, poglavlje 7.

Ovo nije UI ugovor iz prodreadyja (rute i komponente). On je u `09-ulaz-za-prodready.md`, poglavlje 6.

| Primjer | Stvarni fajl | Napomena |
|---|---|---|
| `players.sample.json` | `players.json` | Tri izmišljena igrača, ista kao u maketi. Stvarni fajl ima oko 440 zapisa. |
| `leagues.sample.json` | `leagues.json` | Sve 23 lige s faktorima iz prototipa. |
| `evidence.sample.json` | `evidence.json` | Brojevi iz prototipa, računati na cijelom bazenu, s rasponima ishoda po rangu. Mora se ponovo izračunati u projektu. |
| `timemachine.sample.json` | `timemachine.json` | **Stvarni izlaz prototipa** za četiri sezone: cijeli rang A, s promašajima i historijom vrijednosti. |
| `meta.sample.json` | `meta.json` | Tekst za traku izvora na dnu ekrana i zadani zadatak za slijepi izbor (`default_brief`). |

Polja koja počinju donjom crtom (`_sample`, `_status`, `_note`) su napomene i ne postoje u stvarnim fajlovima.
