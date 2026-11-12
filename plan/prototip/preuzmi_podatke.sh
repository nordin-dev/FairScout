#!/usr/bin/env bash
# Preuzima devet tabela otvorenog skupa s Transfermarkta u zadani folder.
# Upotreba: bash preuzmi_podatke.sh data/raw
set -euo pipefail

OUT="${1:-data/raw}"
BASE="https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data"
mkdir -p "$OUT"

for t in competitions games appearances game_lineups game_events player_valuations transfers players clubs; do
  echo "preuzimam $t"
  curl -fsSL -o "$OUT/$t.csv.gz" "$BASE/$t.csv.gz"
done

echo "gotovo:"
ls -lh "$OUT"
