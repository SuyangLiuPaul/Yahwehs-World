#!/bin/bash
# Rebuilds every .woff2 in public/fonts from its upstream original, so the
# pages never ask fonts.googleapis.com for a face and never fall back to a
# system font either.
#
#   tools/subset-fonts.sh [--margin full|punct|none] [--keep-work]
#
# WHAT IT BUILDS. Seven families, split the way Google Fonts splits them so a
# Russian page downloads only the Cyrillic file:
#
#   Inter            UI sans      variable 400-600  latin latin-ext cyrillic cyrillic-ext greek
#   Spectral         serif/display  500, 600        latin latin-ext cyrillic cyrillic-ext
#   IBM Plex Mono    numbers/mono   400, 500        latin latin-ext cyrillic cyrillic-ext
#   Noto Sans SC/TC  CJK UI         400             cjk-sc / cjk-tc
#   Noto Serif SC/TC CJK body       500             cjk-sc / cjk-tc
#   Noto Sans/Serif Hebrew  variable 400-600        hebrew
#
# WHY ONE WEIGHT PER CJK FACE. The pages ask for Noto Sans SC/TC at 400, 500
# and 600 and Noto Serif SC/TC at 500 and 600 — ten CJK files. At the measured
# character count each one is 1.2-1.9 MB, so ten of them is about 15 MB and the
# dist budget has about 6.7 MiB left. Four faces at one weight each is 5.9 MiB
# and keeps the thing that matters most: real Simplified glyph forms for
# Simplified readers and real Traditional forms for Traditional ones. The
# heavier weights are synthesised by the browser (see the font-weight ranges in
# public/fonts/fonts.css), which is a small flaw in the bold headings and is
# NOT a fall back to a system face. If the budget ever frees up, add the extra
# weights here first — Noto Serif CJK has a real SemiBold (600); Noto Sans CJK
# does not, so a 600 sans would have to come from Google Fonts' variable
# NotoSansSC[wght].ttf instead.
#
# WHY --margin punct IS THE DEFAULT. tools/font-coverage.mjs would like to add
# the common-use Han of each script (GB2312 level 1, Big5 level 1) as insurance
# against a late text edit, which is what --margin full does. That costs 2.4 MiB
# more than the budget has. `punct` still covers every measured codepoint plus
# the whole CJK symbols block and the fullwidth forms, so nothing on the pages
# today can fall back; only a NEW character would. Re-run this script after any
# text change and run `node tools/font-coverage.mjs --check` in CI.
#
# WHERE THE ORIGINALS COME FROM. Local first, download second. The sha256 of
# every original actually used is recorded in public/fonts/OFL.txt.
#
#   ~/Library/Fonts/NotoSansCJK{sc,tc}-Regular.otf     (install from
#   ~/Library/Fonts/NotoSerifCJK{sc,tc}-Medium.otf      https://github.com/notofonts/noto-cjk)
#   $CACHE/Inter.ttf                     google/fonts ofl/inter        (fetched if missing)
#   $CACHE/Spectral-{Medium,SemiBold}.ttf          ofl/spectral        (fetched if missing)
#   $CACHE/IBMPlexMono-{Regular,Medium}.ttf        ofl/ibmplexmono     (fetched if missing)
#   $CACHE/Noto{Sans,Serif}Hebrew.ttf    ofl/noto{sans,serif}hebrew   (fetched if missing)
#
# where CACHE defaults to ~/Library/Caches/yahwehs-world-fonts — deliberately
# OUTSIDE the repo, so a few MB of upstream originals cannot be swept into a
# commit by a stray `git add .`. Override it with FONT_CACHE=…
#
# This follows tools/subset-fonts.sh in the Yahweh's Words repo
# (/Users/pliu0036/Documents/CodingProject/Yahwehdehua/tools/subset-fonts.sh):
# same idea of deriving the character list from the shipped text rather than
# guessing, the same pyftsubset flags (--layout-features, --no-hinting,
# --desubroutinize, which measurably SHRINKS the CFF CJK faces here), the same
# "fetch the original once into a cache that is not in the repo" trick, and the
# same habit of instancing a variable original to the weights actually used
# (that half comes from its tools/build-latin-font.sh). The list itself is
# built by tools/font-coverage.mjs instead of a SQL query, because this repo
# ships JSON, not a bible.db.
#
# Needs: fonttools + brotli (`pip install 'fonttools[woff]' brotli`, or
# /opt/homebrew/bin/pyftsubset), node, curl.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/fonts"
CACHE="${FONT_CACHE:-$HOME/Library/Caches/yahwehs-world-fonts}"
MARGIN=punct
KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --margin) MARGIN="$2"; shift 2 ;;
    --keep-work) KEEP=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

command -v pyftsubset >/dev/null || { echo "FATAL: pyftsubset not on PATH. brew install fonttools, or pip install 'fonttools[woff]' brotli." >&2; exit 1; }
command -v node >/dev/null || { echo "FATAL: node not on PATH." >&2; exit 1; }
python3 -I -c 'import brotli' 2>/dev/null || { echo "FATAL: python3 cannot import brotli, so pyftsubset cannot write woff2. pip install brotli." >&2; exit 1; }

WORK="$(mktemp -d)"
cleanup() { [ "$KEEP" = 1 ] || rm -rf "$WORK"; }
trap cleanup EXIT
mkdir -p "$OUT" "$CACHE"

# ---------------------------------------------------------------- the originals

# The cache lives outside the repo (see CACHE above), so fetch each original
# once and keep it.
fetch() {   # file  url
  [ -f "$CACHE/$1" ] && return 0
  echo "fetching $1"
  curl -fsS -L -o "$CACHE/$1.part" "$2" || { echo "FATAL: could not download $1 from $2" >&2; exit 1; }
  # A GitHub 404 is served as HTML, which pyftsubset would reject much later
  # with a confusing error; catch it here.
  case "$(file -b "$CACHE/$1.part")" in
    *"Font data"*) mv "$CACHE/$1.part" "$CACHE/$1" ;;
    *) echo "FATAL: $2 did not return a font (got: $(file -b "$CACHE/$1.part"))." >&2; exit 1 ;;
  esac
}

GF=https://github.com/google/fonts/raw/main/ofl
fetch Inter.ttf                 "$GF/inter/Inter%5Bopsz%2Cwght%5D.ttf"
fetch Spectral-Medium.ttf       "$GF/spectral/Spectral-Medium.ttf"
fetch Spectral-SemiBold.ttf     "$GF/spectral/Spectral-SemiBold.ttf"
fetch IBMPlexMono-Regular.ttf   "$GF/ibmplexmono/IBMPlexMono-Regular.ttf"
fetch IBMPlexMono-Medium.ttf    "$GF/ibmplexmono/IBMPlexMono-Medium.ttf"
fetch NotoSansHebrew.ttf        "$GF/notosanshebrew/NotoSansHebrew%5Bwdth%2Cwght%5D.ttf"
fetch NotoSerifHebrew.ttf       "$GF/notoserifhebrew/NotoSerifHebrew%5Bwdth%2Cwght%5D.ttf"
fetch NotoSansSymbols2.ttf      "$GF/notosanssymbols2/NotoSansSymbols2-Regular.ttf"

# The four CJK faces are 16-20 MB each and are expected to be installed. They
# are NOT fetched, because a 70 MB download hidden inside a font build is a
# nasty surprise; the message says exactly what to do.
CJK_DIR="$HOME/Library/Fonts"
for f in NotoSansCJKsc-Regular.otf NotoSansCJKtc-Regular.otf \
         NotoSerifCJKsc-Medium.otf NotoSerifCJKtc-Medium.otf; do
  [ -f "$CJK_DIR/$f" ] || {
    echo "FATAL: $CJK_DIR/$f is missing." >&2
    echo "  Install the full Noto CJK faces (SIL OFL 1.1) from" >&2
    echo "  https://github.com/notofonts/noto-cjk — Sans/OTF/{Simplified,Traditional}Chinese" >&2
    echo "  and Serif/OTF/{Simplified,Traditional}Chinese — into $CJK_DIR." >&2
    exit 1
  }
done

# ---------------------------------------------------------------- the character lists

CHARS="$WORK/chars"
echo "building the character inventory (margin=$MARGIN)…"
node "$ROOT/tools/font-coverage.mjs" --emit "$CHARS" --margin="$MARGIN"

have() { [ -s "$CHARS/$1.txt" ]; }

# ---------------------------------------------------------------- subsetting

# --desubroutinize is counter-intuitive for size but measured smaller on these
# CFF CJK faces (1.44 MiB vs 1.52 MiB for Noto Sans CJK SC), and the Latin TTFs
# ignore it. --layout-features keeps kerning, ligatures, locl (the SC/TC form
# selection), ccmp (Hebrew points) and the figure variants; it drops the
# vertical-writing and Asian-punctuation-compression tables, which no page uses.
FEATURES='kern,liga,clig,calt,ccmp,locl,mark,mkmk,rlig,tnum,onum,frac,sups,subs'
COMMON=(--layout-features="$FEATURES" --no-hinting --desubroutinize --flavor=woff2
        --drop-tables+=DSIG --name-IDs='*' --name-legacy)

built=()
sub() {   # source  group  out-stem
  have "$2" || { echo "  skip $3-$2 (nothing needs group $2)"; return 0; }
  pyftsubset "$1" --text-file="$CHARS/$2.txt" "${COMMON[@]}" \
    --output-file="$OUT/$3-$2.woff2"
  built+=("$3-$2.woff2")
  printf '  %-40s %8d bytes\n' "$3-$2.woff2" "$(stat -f%z "$OUT/$3-$2.woff2")"
}

# A variable original, pinned on every axis but wght and clipped to the weights
# the pages actually ask for. One file then serves 400, 500 and 600 — fewer
# bytes than three statics and the weights are the real designed ones.
instance() {   # source  out.ttf  axis-pins...
  local src="$1" dst="$2"; shift 2
  fonttools varLib.instancer "$src" "$@" -o "$dst" >/dev/null
}

echo
echo "Inter — UI sans, variable 400-600"
# opsz 16: the UI body is 15-16 px and the chips run to 11, so a text optical
# size suits the pages far better than Inter's 14 default or a display value.
instance "$CACHE/Inter.ttf" "$WORK/Inter-400-600.ttf" opsz=16 wght=400:600
for g in latin latin-ext cyrillic cyrillic-ext greek; do sub "$WORK/Inter-400-600.ttf" "$g" Inter-400-600; done

echo
echo "Spectral — serif / display"
for w in 500:Medium 600:SemiBold; do
  for g in latin latin-ext cyrillic cyrillic-ext; do sub "$CACHE/Spectral-${w#*:}.ttf" "$g" "Spectral-${w%%:*}"; done
done

echo
echo "IBM Plex Mono — verse numbers and figures"
# Cyrillic is built too: the reader's chapter and verse chrome is mono and the
# Russian editions put Cyrillic labels through it.
for w in 400:Regular 500:Medium; do
  for g in latin latin-ext cyrillic cyrillic-ext; do sub "$CACHE/IBMPlexMono-${w#*:}.ttf" "$g" "IBMPlexMono-${w%%:*}"; done
done

echo
echo "Hebrew — Psalm 119's acrostic headings, the divine name in the licence notes, the ark's object labels"
instance "$CACHE/NotoSansHebrew.ttf"  "$WORK/NotoSansHebrew-400-600.ttf"  wdth=100 wght=400:600
instance "$CACHE/NotoSerifHebrew.ttf" "$WORK/NotoSerifHebrew-400-600.ttf" wdth=100 wght=400:600
sub "$WORK/NotoSansHebrew-400-600.ttf"  hebrew NotoSansHebrew-400-600
sub "$WORK/NotoSerifHebrew-400-600.ttf" hebrew NotoSerifHebrew-400-600

echo
echo "Symbols — the ▾ / ▸ / ▶ triangles in the chevrons, install hints and walk controls"
# Stem has no digit of its own: the filenames parse as <Family>-<weight>-<group>.
sub "$CACHE/NotoSansSymbols2.ttf" symbols NotoSansSymbols-400

echo
echo "CJK — one weight per family and script (see the note at the top)"
sub "$CJK_DIR/NotoSansCJKsc-Regular.otf" cjk-sc NotoSansSC-400
sub "$CJK_DIR/NotoSansCJKtc-Regular.otf" cjk-tc NotoSansTC-400
sub "$CJK_DIR/NotoSerifCJKsc-Medium.otf" cjk-sc NotoSerifSC-500
sub "$CJK_DIR/NotoSerifCJKtc-Medium.otf" cjk-tc NotoSerifTC-500

# ---------------------------------------------------------------- report

echo
total=0
printf '%-44s %10s\n' FILE BYTES
for f in $(cd "$OUT" && ls *.woff2 | sort); do
  n=$(stat -f%z "$OUT/$f"); total=$((total + n))
  printf '%-44s %10d\n' "$f" "$n"
done
printf '%-44s %10d  (%.2f MiB)\n' TOTAL "$total" "$(echo "scale=4; $total/1048576" | bc)"

echo
echo "verifying coverage against the shipped text…"
node "$ROOT/tools/font-coverage.mjs" --check --margin="$MARGIN"
