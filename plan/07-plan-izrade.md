# 07 — Plan izrade

Rok: **četvrtak 12. 11. 2026. u 16:00**. Zamrzavanje funkcija u 13:00.
Izrada ide kroz prodready. Sadržaj za svaki njegov korak je u `09-ulaz-za-prodready.md`.

## 1. Uloge

| Uloga | Odgovornost | Priče |
|---|---|---|
| **Podaci** | Priprema podataka, model, provjera unazad, vremeplov, izvoz | S-001 do S-012, S-025, S-027 |
| **Aplikacija** | Okvir, pet ekrana, provjera demoa, objava | S-013 do S-024, S-026, S-028 do S-030 |
| **Pitch** | Jedna osoba vodi tekst od prvog sata, druga upravlja aplikacijom na sceni | `08-pitch-i-demo.md` |

Dvije strane se dodiruju samo preko pet JSON fajlova. Dok stvarni podaci ne stignu, aplikacija se gradi na primjerima iz `ugovor-podataka/`.

## 2. Faze

| Faza | Šta se radi | Kraj faze znači |
|---|---|---|
| **0. Postavka u prodreadyju** | Projekat, upoznavanje, vizija, opseg, putanje, žičani okviri, UI ugovor, rizici, priče | Priče su unesene i prvi sprint može početi |
| **1. Podaci i model** (SP-1) | S-001 do S-009, S-011, S-027 | Pet JSON fajlova prolazi sve provjere kvaliteta |
| **2. Aplikacija** (SP-2), uporedo s fazom 1 | S-013 do S-016, S-018, S-020 do S-022, S-026, S-028 | Svih pet ekrana radi na primjerima podataka |
| **3. Spajanje** | Stvarni fajlovi u aplikaciju | Demo tok radi na stvarnim podacima |
| **4. Dorada** (SP-3) | S-010, S-012, S-017, S-019, S-023 do S-025, S-029, S-030 | Automatski test demoa prolazi tri puta |
| **5. Zamrzavanje i pitch** | Rezervni snimak, proba na projektoru, probe pitcha | Tri probe između 2:50 i 3:00 |

## 3. Okvirni raspored

| Kada | Podaci | Aplikacija |
|---|---|---|
| Srijeda, do ponoći | Faza 0 zajedno, zatim S-001 do S-004 | Faza 0 zajedno, zatim S-013 |
| Srijeda, noć | S-005 do S-009, S-011 | S-026, S-014, S-015, S-016, S-018 |
| Četvrtak, do 10:00 | Spajanje, ponavljanje brojeva, S-025 | S-020, S-021, S-022, spajanje |
| Četvrtak, 10:00–13:00 | S-010, S-012; model najviše dva sata | S-017, S-019, S-023 |
| **Četvrtak, 13:00** | **Zamrzavanje. Nakon ovoga samo ispravke grešaka.** | |
| Četvrtak, 13:00–14:00 | Provjera brojeva na ekranu "Dokazi" i u pitchu | S-024, rezervni snimak, proba na projektoru |
| Četvrtak, 14:00–16:00 | Probe pitcha, pitanja i odgovori | Probe pitcha, pitanja i odgovori |

Ako se sve završi večeras, četvrtak prije podne ostaje za doradu i probe. Raspored je gornja granica, ne obaveza.

## 4. Kritični put

```
S-001 → S-002 ┐
      → S-003 ┴→ S-004 → S-005 → S-006 → S-007 → S-008 → S-009 → S-011 → spajanje
S-013 → S-026 → S-014, S-015 → S-016, S-018, S-020 → S-021 → S-022 ─────────────→ spajanje
```

Najduže traju S-003 (minute iz postava), S-005 (faktori liga), S-007 i S-008 (model i provjera). Za sve četiri postoji radni kod u `prototip/`.

## 5. Tri tačke provjere

| Tačka | Pitanje | Ako je odgovor "ne" |
|---|---|---|
| Nakon S-003 | Poklapaju li se izračunate minute s testnim ligama u 99 %? | Ne ići dalje. Bez toga devet liga nema podatke i radar se ograničava na 14 liga. |
| Nakon S-008 | Je li model iznad prosjeka za najmanje 15 poena, računato na cijelom bazenu? | Prikazati izmjereno. Pitch prebaciti na nalaze o golovima, cijeni i ligi i na slijepi izbor. |
| Četvrtak u 10:00 | Radi li demo tok na stvarnim podacima? | Odmah rezati po redu iz poglavlja 6. |

## 6. Šta se reže i kojim redom

1. S-019 grafikon vrijednost naspram izgleda. Radar ostaje s tabelom.
2. S-030 prikaz "Naši vani".
3. S-029 projekcija na kartici. Grafikon u vremeplovu ostaje.
4. S-012 bilješka skauta. Odjeljak se ne prikazuje.
5. S-010 i S-017 slični igrači. Kartica ostaje s razlaganjem i izgledima.
6. Drugi grafikon provjere (budžet do 500.000 €) i grafikon mjeseci rođenja.

Ne reže se: slijepi izbor, razlaganje ocjene, radar s filterom budžeta, vremeplov, grafikon provjere unazad, lista ograničenja.

## 6a. Brzi popravak na čekanju

Ako se u pripremi pokaže da prigovor "ovo je predviđanje cijene" treba jači odgovor na ekranu: dodati sportski ishod. U vremeplovu oznaka ko je kasnije standardno igrao u ligi petice, na ekranu dokaza brojka "22 % naspram 6 %". Podaci i račun postoje (`06-podaci-i-model.md`, odjeljak "Prati li vrijednost sportski napredak"). Odluka od 12. 11.: za sada se ne ugrađuje.

## 7. Rezervni plan za demo

- Snimak ekrana cijelog toka, bez zvuka, do 80 sekundi.
- Aplikacija otvorena u dva prozora: jedan na `/blind`, drugi na `/evidence`.
- Ako projektor ne radi: pitch uz snimke iz `dizajn/` na laptopu okrenutom žiriju.
- Ako model nije gotov: aplikacija radi s rangom iz prototipa, uz jasnu napomenu na ekranu "Dokazi" da su brojevi preliminarni.

## 8. Šta znači "gotovo"

- Sve priče prioriteta "must" su završene po kriterijima iz `09-ulaz-za-prodready.md`.
- Mjere iz `03-KPI.md`, grupe B i C, su izmjerene i upisane.
- Lista iz `05-ziri-i-bodovanje.md`, poglavlje 5, je prekrižena.
- Nijedan broj u aplikaciji ili pitchu nije iz prototipa.
