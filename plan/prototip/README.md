# Prototip: skripte brze provjere

Istraživačke skripte od 11. 11. 2026. kojima su dobijeni brojevi u `06-podaci-i-model.md`. Ispisuju rezultate u terminal i ne izvoze fajlove za aplikaciju. Služe kao polazna tačka za pripremu podataka u projektu.

## Pokretanje

```bash
# 1. preuzeti podatke (oko 240 MB) u data/raw u korijenu projekta
bash plan/prototip/preuzmi_podatke.sh data/raw

# 2. okruženje
python3 -m venv .venv && .venv/bin/pip install numpy scikit-learn

# 3. skripte, ovim redom
python3 plan/prototip/census.py data/raw /tmp/agg.json
python3 plan/prototip/check2.py data/raw /tmp/agg.json
.venv/bin/python plan/prototip/build.py data/raw /tmp/rows.json
.venv/bin/python plan/prototip/proto.py data/raw
.venv/bin/python plan/prototip/extra.py /tmp/rows.json
.venv/bin/python plan/prototip/proxy.py /tmp/rows.json data/raw
.venv/bin/python plan/prototip/evidence2.py /tmp/rows.json /tmp/evidence2.json
.venv/bin/python plan/prototip/timemachine.py /tmp/rows.json data/raw /tmp/timemachine.json
```

`extra.py` traje oko pet minuta zbog ponavljanja uzorka; ostale skripte do minut i po.

## Šta je gdje

| Skripta | Sadržaj | Ispis |
|---|---|---|
| `census.py` | Popis podataka po ligi | u terminalu |
| `check2.py` | Račun minuta iz postava, prelasci i faktori liga, raspodjela rođenja | `rezultati/check2.txt` |
| `build.py` | Tabela igrač-sezona sa svim osobinama | `rows.json` |
| `proto.py` | Model, provjera unazad s metom "samo udvostručenje", primjeri izbora, radar | `rezultati/proto.txt` |
| `extra.py` | Stroža meta, objektivna meta, kvartal rođenja uz kontrolu dobi | `rezultati/extra.txt` |
| `proxy.py` | Procjena faktora za devet liga, sastav bazena radara | u terminalu |
| `evidence2.py` | **Provjera unazad na cijelom bazenu**: svaki igrač sezone se računa, i onaj bez kasnije vrijednosti | `rezultati/evidence2.txt` |
| `timemachine.py` | **Vremeplov**: radar pušten unazad za šest sezona, rasponi ishoda po rangu, igrači s bh. pasošem | `rezultati/timemachine.txt` |
| `sport.py` | Napreduju li izbori modela i sportski: minute i liga u naredne tri sezone, bez tržišne vrijednosti | `rezultati/sport.txt` |

## Napomene

- `build.py` je početni dio skripte `proto.py` s izvozom tabele; kod se ponavlja.
- Ispisi su dijelom na bosanskom, dijelom na engleskom.
- `rezultati/proto.txt` sadrži imena stvarnih igrača s ocjenama prototipa. To su preliminarni rezultati, ne preporuke.
- Glavni brojevi za aplikaciju dolaze iz `evidence2.py` i `timemachine.py`. Brojke iz `proto.py` i `extra.py` su računate samo na igračima s poznatom kasnijom vrijednošću i zato su više; ne koristiti ih za prikaz.
