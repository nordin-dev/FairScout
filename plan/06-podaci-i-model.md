# 06 — Podaci i model

Jedino mjesto na kojem stoje svi provjereni brojevi. Ostali dokumenti se pozivaju na ovaj.

**Status:** sve brojke su iz brzog prototipa od 11. 11. 2026. Skripte i njihovi ispisi su u `prototip/`. Prije nego ijedan broj ode u aplikaciju ili na pitch, mora se ponoviti u kodu projekta.

**Ispravka od 11. 11. navečer.** Prva verzija ovog dokumenta navodila je da izbori modela uspiju u 53–59 % slučajeva, uz prosjek od 37 %. Te brojke su računate samo na igračima koji su tri godine kasnije još imali procjenu vrijednosti, čime je izostavljeno 265 igrača i sve stope su ispale više. Sada se računa svaki igrač sezone, a onaj kojem se izgubio trag se vodi kao "nije uspio". Nove brojke su niže, a odnos između modela i pravila je ostao isti. Vremeplov i dokazi koriste isti račun.

## 1. Izvor

| | |
|---|---|
| Skup | Otvoreni skup podataka s Transfermarkta: `github.com/dcaribou/transfermarkt-datasets` (isti je na Kaggleu kao `davidcariboo/player-scores`) |
| Preuzimanje | `https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/<tabela>.csv.gz` |
| Tabele | `competitions`, `games`, `appearances`, `game_lineups`, `game_events`, `player_valuations`, `transfers`, `players`, `clubs` |
| Zadnji podatak | Utakmice do 6. 7. 2026, nastupi do 28. 6. 2026, vrijednosti do 12. 6. 2026. Ažuriranje skupa je stalo u julu 2026. |
| Šta ima | Postave, golovi, asistencije, izmjene, kartoni, minute, datum rođenja, državljanstvo, pozicija, visina, noga, historija tržišne vrijednosti, transferi |
| Šta nema | Šutevi, dodavanja, odbrambene akcije, podaci o kretanju. Bh. liga. Ženski fudbal. Niži rangovi. |

**Pravo korištenja.** Skup je javan i slobodan za preuzimanje, ali potiče sa stranice Transfermarkt, čije uslove korištenja nismo uspjeli potvrditi. Za hakaton: navesti izvor na svakom ekranu i reći da je prototip nekomercijalan. Za proizvod bi trebali licencirani podaci.

**Tržišna vrijednost.** To je procjena zajednice Transfermarkta, a ne cijena. Kasni za formom, ponekad mjesecima. Dio onoga što model vidi kao "potcijenjeno" je samo procjena koja još nije ažurirana.

## 2. Pokrivenost: 23 evropske prve lige

| Grupa | Lige | Sezone | Uloga |
|---|---|---|---|
| Duga historija (14) | Italija, Španija, Engleska, Francuska, Turska, Njemačka, Holandija, Portugal, Belgija, Rusija, Grčka, Škotska, Ukrajina, Danska | 2012/13–2025/26 | Učenje modela, provjera unazad, vremeplov, faktori liga |
| Kratka historija (9) | Poljska, Srbija, Češka, Rumunija, Švicarska, Hrvatska, Austrija, Norveška, Švedska | 2024/25–2025/26 | Radar: ovdje tražimo igrače |

- U 14 liga ima 1.606.102 nastupa.
- U 9 liga tabela nastupa je prazna, ali postoje postave i događaji iz kojih se minute, golovi i asistencije računaju.

**Provjera računa minuta** na Belgiji i Holandiji, sezona 2024/25, gdje postoje oba izvora (16.757 nastupa):

| Mjera | Rezultat |
|---|---|
| Minute potpuno iste | 93,6 % |
| Minute unutar 5 minuta | 99,9 % |
| Golovi isti | 100 % |
| Asistencije iste | 99,8 % |

**Odakle model uči.** Mladih igrača do 1 M € s poznatom kasnijom vrijednošću ima 2.326, a 87 % ih dolazi iz osam liga: Holandija 439, Danska 348, Ukrajina 297, Belgija 224, Grčka 220, Škotska 195, Portugal 174, Rusija 117. Iz pet najvećih liga ih je ukupno 250. Model dakle uči na ligama koje po vrijednosti liče na one u kojima tražimo.

## 3. Definicije

| Pojam | Definicija |
|---|---|
| Mladi igrač | Godina početka sezone minus godina rođenja je najviše 21; najmanje 450 ligaških minuta |
| Vrijednost u trenutku odluke | Zadnja procjena između 1. decembra sezone i 30. juna na kraju sezone |
| Ishod | Zadnja procjena između 1. decembra i 30. juna tri sezone kasnije |
| **Uspio** | Ishod je najmanje dvostruk i najmanje 1 M € |
| Bez kasnije vrijednosti | Igrač koji tri sezone kasnije nema procjenu. Vodi se kao "nije uspio". |

Zašto uslov od milion eura. S metom "samo udvostručenje" pravilo "izaberi najjeftinije" izgleda dobro, jer igrač od 50.000 € lako dođe na 100.000 €. Uslov od milion eura uklanja taj lažni uspjeh.

## 4. Faktor jačine lige

**Metoda za 14 liga.** Igrači (napad i vezni) koji su u dvije uzastopne sezone odigrali najmanje 900 minuta u dvije različite lige. Takvih prelazaka je 3.126, od toga 1.610 napadača i veznih. Za svaki par liga poredi se učinak istih igrača u jednoj i drugoj, a faktori se dobijaju metodom najmanjih kvadrata.

| Liga | Faktor | Liga | Faktor |
|---|---|---|---|
| Engleska | 0,59 | Portugal | 1,04 |
| Španija | 0,69 | Holandija | 1,15 |
| Italija | 0,71 | Danska | 1,21 |
| Francuska | 0,78 | Belgija | 1,21 |
| Njemačka | 0,80 | Grčka | 1,24 |
| Rusija | 1,00 | Škotska | 1,53 |
| Turska | 1,03 | Ukrajina | 1,62 |

1,00 je prosjek 14 liga. Manji faktor znači da je gol ili asistenciju teže ostvariti.
Primjer: ista 32 igrača imala su 0,69 golova i asistencija na 90 minuta u Holandiji i 0,32 u Engleskoj.

**Procjena za 9 liga.** Faktor iz prelazaka prati tržišnu vrijednost lige: korelacija −0,95, prosječna greška 0,07. Iz te veze:

| Liga | Procjena | Liga | Procjena |
|---|---|---|---|
| Švicarska | 1,20 | Poljska | 1,39 |
| Austrija | 1,27 | Rumunija | 1,39 |
| Norveška | 1,31 | Srbija | 1,42 |
| Hrvatska | 1,36 | Češka | 1,46 |
| Švedska | 1,36 | | |

Ovo su procjene bez provjere unazad. Češka je vjerovatno potcijenjena, jer njeni klubovi u evropskim takmičenjima prolaze bolje nego što tržišna vrijednost govori; to je naša pretpostavka, nije provjereno. Unakrsna provjera je moguća na igračima koji su igrali i u ovim ligama i u 14 dugih (37 do 124 po ligi) i na rezultatima klubova u evropskim takmičenjima, koji su u skupu.

Ograničenja metode: igrači koji mijenjaju ligu nisu slučajan uzorak, često su u usponu ili padu; u novoj ligi mogu imati drugu ulogu; uslov od 900 minuta zadržava samo one koji su se izborili za mjesto.

## 5. Model

| | |
|---|---|
| Skup za učenje | Svi mladi igrači iz 14 liga, 2012/13–2022/23, vrijednost do 5 M €. Igrač bez kasnije vrijednosti je negativan primjer. |
| Osobine | 19: dob, minute, uloga u ekipi, golovi i asistencije na 90, percentil učinka, vrijednost, promjena vrijednosti u 12 mjeseci, minute prethodne sezone, bodovi ekipe po utakmici, vrijednost saigrača, vrijednost u odnosu na saigrače, vrijednost lige, visina, pozicija |
| Modeli | Logistička regresija (glavni, jer se može objasniti) i gradient boosting (kontrolni) |
| Šta najviše utiče | Dob i vrijednost u odnosu na saigrače: mlad igrač koji redovno igra u ekipi koja vrijedi više od njega. Zatim asistencije i rast vrijednosti. |
| Rang | Unutar bazena sezone (svi mladi do 1 M €): gornjih 10 % po ocjeni modela je A, sljedećih 10 % je B, ostali su C |

## 6. Provjera unazad

Za svaku testnu sezonu od 2017/18 do 2022/23 model uči samo na sezonama čiji je ishod u tom trenutku već bio poznat (tri i više sezona ranije). Bazen je svaki mladi igrač te sezone do zadanog budžeta. U svakoj sezoni svako pravilo bira svojih gornjih 10 %.

**Mladi do 1 M €:** 1.333 igrača, 133 izbora po pravilu, granica greške oko ±8 postotnih poena.

| Kako biramo | Uspjelo | Stopa |
|---|---|---|
| Model, logistička regresija | 70 od 133 | 53 % |
| Model, gradient boosting | 63 od 133 | 47 % |
| Najviše minuta | 59 od 133 | 44 % |
| Najviše golova i asistencija na 90 | 48 od 133 | 36 % |
| Najmlađi | 48 od 133 | 36 % |
| **Svi igrači, prosjek** | 395 od 1.333 | **30 %** |
| Najjeftiniji | 16 od 133 | 12 % |

**Mladi do 500.000 €:** 732 igrača, 74 izbora po pravilu, granica greške oko ±11 poena.

| Kako biramo | Uspjelo | Stopa |
|---|---|---|
| Model, gradient boosting | 36 od 74 | 49 % |
| Model, logistička regresija | 31 od 74 | 42 % |
| Najviše minuta | 28 od 74 | 38 % |
| Najmlađi | 25 od 74 | 34 % |
| **Svi igrači, prosjek** | 167 od 732 | **23 %** |
| Najviše golova i asistencija na 90 | 12 od 74 | 16 % |
| Najjeftiniji | 10 od 74 | 14 % |

**Po rangu** (logistička regresija, do 1 M €):

| Rang | Ko | Uspjelo | Stopa | Na ekranu |
|---|---|---|---|---|
| A | Gornjih 10 % | 70 od 133 | 53 % | "5 od 10" |
| B | Sljedećih 10 % | 50 od 134 | 37 % | "4 od 10" |
| C | Ostali | 275 od 1.066 | 26 % | "3 od 10" |
| Cijeli bazen | | 395 od 1.333 | 30 % | "3 od 10" |

**Po sezoni** (rang A, logistička regresija):

| Sezona | Model učio na | Rang A uspjelo | Cijeli bazen |
|---|---|---|---|
| 2017/18 | 2012/13–2014/15 | 15 od 23 | 30 % |
| 2018/19 | 2012/13–2015/16 | 10 od 22 | 27 % |
| 2019/20 | 2012/13–2016/17 | 17 od 22 | 32 % |
| 2020/21 | 2012/13–2017/18 | 7 od 23 | 22 % |
| 2021/22 | 2012/13–2018/19 | 10 od 20 | 38 % |
| 2022/23 | 2012/13–2019/20 | 11 od 23 | 31 % |

### Kako čitati ove rezultate

- **Model je jasno iznad prosjeka:** 17 do 23 poena na budžetu do 1 M €.
- **Golovi i asistencije su blizu prosjeka**, a na manjem budžetu ispod njega.
- **Najjeftiniji su najgori izbor.**
- **Prednost nad pravilom "najviše minuta" je mala:** 3 do 9 poena, unutar ili na rubu granice greške. To se kaže otvoreno.
- **Rezultat se jako razlikuje po sezonama:** od 7 od 23 do 17 od 22. U jednoj sezoni model je bio jedva iznad bazena.
- **Dva modela se ne slažu koji je bolji** na dva budžeta. Zato se prikazuje raspon.
- Mjera razdvajanja (AUC) je 0,67 do 0,69. To je umjeren signal.

### Vremeplov: isti radar, raniji datum

Vremeplov nije izbor lijepih primjera. To je isti postupak kojim nastaje današnji radar, pokrenut s ranijim datumom. Da bi se to moglo dokazati, vrijedi pet pravila:

1. **Isti kod.** Lista za prošlu sezonu nastaje istom funkcijom, istim osobinama i istim pravilom ranga kao današnji radar. Mijenja se samo datum.
2. **Model ne zna budućnost.** Za sezonu koja se završava u junu 2023. model uči samo na sezonama čiji je ishod do tada bio poznat (do 2019/20). To se provjerava automatski pri svakoj izradi podataka.
3. **Bazen se ne čisti naknadno.** U bazenu je svaki mladi igrač te sezone do 1 M €, i oni kojima se kasnije izgubio trag.
4. **Prikazuje se cijeli rang A**, redom kojim ga je model poredao, s promašajima.
5. **Prikazuju se sve testirane sezone**, i najslabija, uz zbir za svih šest.

Uspjeh se uvijek mjeri tri sezone nakon datuma radara. To je rok za koji je model napravljen, i mora biti isti za svaku sezonu da bi se sezone mogle porediti. Današnja vrijednost se za starije sezone prikazuje kao dodatak i ne mijenja brojanje. Primjer iz sezone 2019/20: Martín Zubimendi 0,25 M € → 40 M € nakon tri godine → 75 M € danas; Hugo Guillamón 0,2 M € → 14 M € → 1,5 M € danas.

Izlaz prototipa po ovim pravilima:

| Sezona | Datum radara | Rang A | Uspjelo | Najveći rast (vrijednost tada → tri godine kasnije) |
|---|---|---|---|---|
| 2019/20 | 30. 6. 2020. | 22 | 17 | Martín Zubimendi 0,25 → 40 M €; Lutsharel Geertruida 0,9 → 25 M €; Hugo Guillamón 0,2 → 14 M €; David Carmo 0,9 → 14 M € |
| 2020/21 | 30. 6. 2021. | 23 | 7 | Albert Grønbæk 1,0 → 12 M €; Iván Jaime 1,0 → 8 M €; Sven Mijnans 0,7 → 6,5 M € |
| 2021/22 | 30. 6. 2022. | 20 | 10 | Dango Ouattara 0,9 → 28 M €; Rocco Reitz 0,65 → 15 M €; Javi López 0,7 → 7,5 M € |
| 2022/23 | 30. 6. 2023. | 23 | 11 | Renato Veiga 1,0 → 25 M €; Thomas Kristensen 0,7 → 12 M €; Sem Steijn 1,0 → 11 M € |

Pune liste, s promašajima, su u `ugovor-podataka/timemachine.sample.json` i u `prototip/rezultati/timemachine.txt`.

Šta vremeplov ne tvrdi: da se igrač mogao kupiti za prikazanu cijenu. Cijena "tada" je procjena koja kasni, a klub bi tražio više. Tvrdnja je uža: model je igrača izdvojio dok je procjena još bila ispod milion eura.

### Projekcija: gdje bi igrač mogao biti za tri godine

Projekcija nije poseban model. To je raspon onoga što se desilo ranijim igračima istog ranga, pomnožen današnjom vrijednošću igrača.

| Rang | Četvrtina završi ispod | Tipičan ishod | Četvrtina završi iznad | Bez kasnije vrijednosti |
|---|---|---|---|---|
| A | × 1,33 | × 3,0 | × 7,2 | 16 od 133 |
| B | × 1,0 | × 1,8 | × 4,3 | 19 od 134 |
| C | × 0,8 | × 1,5 | × 3,3 | 230 od 1.066 |

Za igrača ranga A koji danas vrijedi 150.000 € to je raspon od 200.000 € do 1,1 M €, s tipičnim ishodom od 450.000 €. Na ekranu se kaže "pola sličnih igrača je završilo ovdje", a ne "ovaj igrač će vrijediti".

### Prati li vrijednost sportski napredak

Model uči na tržišnoj vrijednosti, pa je prigovor "to je predviđanje cijene" opravdan. Zato su izbori modela provjereni i na ishodima u kojima vrijednost ne učestvuje, u iste tri sezone nakon odluke:

| Sportski ishod | Izbori modela | Cijeli bazen | Pravilo "najviše minuta" |
|---|---|---|---|
| Standardno igrao u ligi petice (900+ minuta u sezoni) | 29 od 133, 22 % | 82 od 1.333, 6 % | 16 od 133, 12 % |
| Postao standardan (1.800+ minuta u sezoni, 14 liga) | 50 od 133, 38 % | 397 od 1.333, 30 % | 75 od 133, 56 % |
| Ostao u prvoj ligi (450+ minuta) | 99 od 133, 74 % | 874 od 1.333, 66 % | 112 od 133, 84 % |

- Izbori modela dođu do standardne uloge u ligi petice tri i po puta češće od bazena. Dio njih je u ligi petice već bio; među onima izvan nje to je 8 od 91 naspram 59 od 1.272, što je premalo slučajeva za jak zaključak.
- Na ishodu "postao standardan" model je samo malo iznad bazena, a ispod pravila "najviše minuta". To je očekivano: to pravilo bira one koji već igraju.
- Vrijednost i sport idu zajedno: od 70 izbora koji su uspjeli po vrijednosti, 57 % je postalo standardno i 36 % je igralo u ligi petice. Od 63 koji nisu uspjeli, to je 16 % i 6 %.

Zaključak: vrijednost je mjerilo napretka, a ne ono što se prodaje. Skripta je `prototip/sport.py`.

### Šta još znamo, a ne ide u pitch

- **Ko će zaigrati u ligi petice.** Za mlade izvan pet najvećih liga model pogađa u oko polovini gornjih 10 %, uz prosjek 16 %. Ali rangiranje samo po tržišnoj vrijednosti postiže isto. Tu tržište već zna, model ne dodaje ništa. Zato je filter budžeta srž proizvoda.
- **Učenje na svim igračima pomaže malo.** Kad model uči i na igračima bez kasnije vrijednosti, logistička regresija ide s 50 % na 53 %. Gradient boosting ostaje na 47 %.

## 7. Datum rođenja

- Među 20.241 igračem koji je imao sezonu s najmanje 450 minuta: 31,2 % je rođeno u januaru–martu, 19,4 % u oktobru–decembru. Udio pada gotovo ravnomjerno od januara (11,4 %) do decembra (6,2 %).
- Datum "1. januar", koji se nekad upisuje kad pravi datum nije poznat, ima 0,5 % igrača i ne mijenja sliku.
- Kod igrača rođenih u Engleskoj najmanje ih je rođeno od juna do avgusta, a skok je u septembru. To odgovara tamošnjoj granici godišta i pokazuje da je uzrok selekcija, a ne biologija.
- Među mladim igračima s poznatom kasnijom vrijednošću: 1.394 rođenih u prvom kvartalu, 608 u zadnjem. Odnos je 2,3 prema 1.
- Rođeni u zadnjem kvartalu češće udvostruče vrijednost u svakoj dobnoj grupi, npr. 38 % naspram 27 % kod starijih od 21,5 godina.
- Uz kontrolu dobi i ostalih osobina omjer šansi je 1,23, s intervalom od 1,02 do 1,46.

Šta to znači: nalaz je na granici pouzdanosti, odnosi se na metu "samo udvostručenje" i računat je na igračima s poznatom kasnijom vrijednošću. Dodavanje kvartala rođenja modelu nije popravilo tačnost. Zato je u proizvodu to oznaka na kartici, a ne dio ocjene. U literaturi se sličan obrazac opisuje kao prednost onih koji su se probili uprkos zaostatku; referencu treba naći i provjeriti prije navođenja.

## 8. Bazen radara, sezona 2025/26

| | Sve 23 lige | Hrvatska, Srbija, Poljska, Češka, Rumunija |
|---|---|---|
| Mladi do 1 M € | 437 | 181 |
| Mladi do 500.000 € | 227 | 102 |
| Mladi do 250.000 € | 65 | — |

Od 437 igrača: napad 117, vezni 145, odbrana 151, golmani 24. Istek ugovora je poznat za 88 %, a 86 igračima ugovor ističe do 30. 6. 2027. Trojica su mlađa od 18 godina. Po kvartalu rođenja: 160, 109, 98, 70.

**Igrači s bh. pasošem ("Naši vani").** U sezoni 2025/26 u 23 lige je 66 igrača s bh. državljanstvom i najmanje 450 minuta. Osam ih je mladih po definiciji bazena: Kerim Alajbegović, Nidal Čelik, Filip Taraba, Arjan Malić, Luka Mikulić, Ermin Mahmić, Esmir Bajraktarević i Muhamed Buljubašić. Samo dvojica su u bazenu do 1 M € (Taraba i Mikulić), oba ranga C. Ostali vrijede od 1,5 do 22 M €. Lista je dakle pregled naših igrača vani, a ne lista za kupovinu.

## 9. Ograničenja

1. Tržišna vrijednost je procjena koja kasni, i ona je istovremeno ulaz i meta modela.
2. Model ne vidi karakter, odluke ni igru bez lopte.
3. Za odbranu, golmane i veći dio veznih nema podataka o vlastitim akcijama. Ocjena iz golova i asistencija za njih malo znači.
4. U devet liga model se primjenjuje bez provjere unazad, a faktor lige je procjena.
5. Ispod 900 minuta ocjena je nestabilna.
6. Dva testirana modela daju različite rezultate; prednost nad najboljim jednostavnim pravilom nije statistički pouzdana na ovom uzorku.
7. Rezultat se jako razlikuje po sezonama.
8. Vrijednosti su 2020. jednokratno snižene zbog pandemije, što unosi šum u sezone oko te godine.

## 10. Kako ponoviti

Skripte u `prototip/` rade ovim redom. Svaka prima putanju do foldera s preuzetim tabelama.

| Skripta | Šta radi | Ispis |
|---|---|---|
| `preuzmi_podatke.sh` | Preuzima devet tabela | — |
| `census.py` | Popis podataka po ligi | u terminalu |
| `check2.py` | Račun minuta, prelasci i faktori liga, raspodjela rođenja | `rezultati/check2.txt` |
| `build.py` | Tabela igrač-sezona s osobinama | `rows.json` |
| `evidence2.py` | **Provjera unazad na cijelom bazenu.** Brojke iz poglavlja 6. | `rezultati/evidence2.txt` |
| `timemachine.py` | **Vremeplov**, rasponi ishoda po rangu, igrači s bh. pasošem | `rezultati/timemachine.txt` |
| `proto.py`, `extra.py` | Ranije provjere na igračima s poznatom kasnijom vrijednošću; kvartal rođenja | `rezultati/proto.txt`, `rezultati/extra.txt` |
| `proxy.py` | Procjena faktora za devet liga, sastav bazena | u terminalu |

Skripte su istraživačke: ispisuju brojeve, ne izvoze fajlove za aplikaciju. Priprema podataka u projektu ih koristi kao polaznu tačku.

## 11. Otvoreno

- Unakrsna provjera procijenjenih faktora liga.
- Može li učinak prilagođen ligi kao osobina popraviti model. Vremenski okvir: najviše dva sata.
- Referenca iz literature za nalaz o datumu rođenja.
- Potvrda uslova korištenja podataka.
- Nalaz o datumu rođenja ponoviti na cijelom bazenu, kao i ostale brojke.
