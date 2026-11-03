#!/bin/bash
# offload.sh - run Codex (gpt-6.1-sol) or agy (Gemini) non-interactively on a well-specified task, with the standard
# preamble, a timeout and a log. Rules: docs/MODEL-RULE.md section 6 (Words/Sword) / handoff note (yahwehs-globe).
#
#   offload.sh codex|agy <workdir> <prompt-file> [--model M] [--effort E] [--timeout SECONDS] [--readonly]
#                        [--add-dir DIR]... [--no-preamble-check]
#   offload.sh prep <repo-dir> <name>     make a throw-away local CLONE /Volumes/androidbuild/offload-work/<name> on a new
#                                          branch offload/<name> at the repo's current HEAD (no remote), print its path
#   offload.sh commit <workdir> <log-file> <subject> <path>...   (run by the supervising Claude session, NOT by the
#                                          worker) commit exactly those paths locally, no trailers, provenance line in body
#
# Exit codes: 0 ok | 2 usage | 3 workdir refused | 4 prompt refused (secrets/keychain) | 5 CLI missing / bad input
#             | 20 CLI failed (see log) | 75 quota / rate limit (try later) | 124 timeout
# Always prints the log path last ("LOG: ...") and a ready-to-paste provenance line ("WROTE-BY: ...").
#
# Safety choices (why):
#  Workers cannot commit: Codex's workspace-write sandbox makes every .git (clone or worktree) read-only, and agy's
#  commands are limited to read-only helpers. So workers leave changes uncommitted and the supervisor runs `commit` after
#  the tests pass. Use a clone (prep), not a worktree, so the real repo's .git is never writable by a worker.
#  codex: -s workspace-write (or read-only with --readonly) + approval_policy=never + --ignore-user-config.
#         ~/.codex/config.toml on this machine sets sandbox_mode=danger-full-access; --ignore-user-config (auth.json
#         still works) plus an explicit -s means the CLI cannot silently run unsandboxed. workspace-write has no
#         network. --ephemeral keeps no session files.
#  agy:   --mode accept-edits (edits auto-accepted, other tool calls still need approval, which print mode denies) or
#         --mode plan with --readonly, plus --sandbox (terminal restrictions). Never --dangerously-skip-permissions.
#  both:  workdir must be under /Volumes/androidbuild (or the yahwehs-globe project dir); API-key/token-looking
#         environment variables are removed from the child; the script never reads or passes credentials (the CLIs use
#         their own login); a prompt that mentions keychain / secret / key-file names is refused.
set -u
OFFROOT=/Volumes/androidbuild
LOGDIR=$OFFROOT/offload-logs
WORKROOT=$OFFROOT/offload-work
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PREAMBLE="$HERE/offload_preamble.md"

die() { echo "offload.sh: $2" >&2; exit "$1"; }
usage() { sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

[ $# -ge 1 ] || usage
if [ "$1" = prep ]; then
  [ $# -eq 3 ] || usage
  repo="$(cd "$2" 2>/dev/null && pwd -P)" || die 3 "no such repo $2"
  name="$3"; [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] || die 2 "name must be [A-Za-z0-9._-]+"
  mkdir -p "$WORKROOT"; [ -e "$WORKROOT/$name" ] && die 3 "$WORKROOT/$name already exists"
  sha="$(git -C "$repo" rev-parse HEAD)" || die 20 "not a git repo"
  git clone -q --local --no-checkout "$repo" "$WORKROOT/$name" >&2 || die 20 "git clone failed"
  git -C "$WORKROOT/$name" checkout -q -b "offload/$name" "$sha" >&2 || die 20 "checkout failed"
  git -C "$WORKROOT/$name" remote remove origin   # a worker must have nowhere to push
  echo "$WORKROOT/$name"; exit 0
fi

if [ "$1" = commit ]; then
  [ $# -ge 5 ] || usage
  wd="$(cd "$2" 2>/dev/null && pwd -P)" || die 3 "no such workdir"; lg="$3"; subj="$4"; shift 4
  case "$wd/" in "$OFFROOT"/?*) ;; *) die 3 "workdir must be under $OFFROOT";; esac
  git -C "$wd" add -- "$@" || exit 20
  git -C "$wd" commit -q -m "$subj" -m "Drafted by an offloaded worker through tools/offload.sh (log $lg); accepted after tests and an independent diff review. Nothing pushed" -- "$@" || exit 20
  git -C "$wd" log --stat --format='%h %s' -1; exit 0
fi

[ $# -ge 3 ] || usage
tool="$1"; workdir_in="$2"; promptfile="$3"; shift 3
model=""; effort=""; tmo=3600; readonly_=0; extra_dirs=()
while [ $# -gt 0 ]; do
  case "$1" in
    --model) model="${2:?}"; shift 2;;
    --effort) effort="${2:?}"; shift 2;;
    --timeout) tmo="${2:?}"; shift 2;;
    --readonly) readonly_=1; shift;;
    --add-dir) extra_dirs+=("${2:?}"); shift 2;;
    *) usage;;
  esac
done
case "$tool" in codex|agy) ;; *) usage;; esac
[[ "$tmo" =~ ^[0-9]+$ ]] || die 2 "--timeout is seconds"
command -v "$tool" >/dev/null || die 5 "$tool not installed"
[ -f "$promptfile" ] || die 5 "prompt file not found: $promptfile"
[ -f "$PREAMBLE" ] || die 5 "missing $PREAMBLE"

# --- workdir must be inside an allowed root (symlinks resolved) -------------------------------------------------
workdir="$(cd "$workdir_in" 2>/dev/null && pwd -P)" || die 3 "no such workdir: $workdir_in"
under() { case "$1/" in "$2"/*) return 0;; esac; return 1; }
ok=0
rr="$(cd "$OFFROOT" && pwd -P)"; if [ "$workdir" != "$rr" ] && under "$workdir" "$rr"; then ok=1; fi
gl="$(cd /Users/pliu0036/Documents/CodingProject/yahwehs-globe 2>/dev/null && pwd -P)"; [ -n "$gl" ] && under "$workdir" "$gl" && ok=1
[ "$ok" = 1 ] || die 3 "workdir $workdir is outside $OFFROOT/* and the yahwehs-globe project dir"
adds=()
for d in ${extra_dirs[@]+"${extra_dirs[@]}"}; do
  dd="$(cd "$d" 2>/dev/null && pwd -P)" || die 3 "no such --add-dir $d"
  under "$dd" "$OFFROOT" || die 3 "--add-dir must be under $OFFROOT"
  adds+=("$dd")
done
# --- refuse prompts that point at secrets ------------------------------------------------------------------------
if grep -qiE 'keychain|security +(find|add|delete)-|PasswordManager|\.env\b|\.p8\b|\.p12\b|\.jks\b|\.keystore|key\.properties|id_rsa|id_ed25519|\.netrc|\.npmrc|\.git-credentials|\.ssh/|\.codex/auth|auth\.json|api[_ -]?key|secret|passw(or)?d|credential|bearer|service-account|google-services|GoogleService-Info|\bsk-[A-Za-z0-9]|AKIA[0-9A-Z]{8}' "$promptfile"; then
  echo "offload.sh: prompt mentions keychain/secret/key material (matched: $(grep -ioE 'keychain|PasswordManager|\.env\b|\.p8\b|\.p12\b|\.jks\b|\.keystore|key\.properties|id_rsa|\.netrc|\.npmrc|auth\.json|api[_ -]?key|secret|passw(or)?d|credential|bearer|service-account|google-services' "$promptfile" | sort -u | tr '\n' ' '))" >&2
  die 4 "refused: reword the task so it does not touch keys/keychain/secrets (those are never offloaded)"
fi

# --- compose prompt, log paths ----------------------------------------------------------------------------------
mkdir -p "$LOGDIR" || die 5 "cannot create $LOGDIR"
stamp="$(date +%Y%m%d-%H%M%S)"
slug="$(basename "$workdir")-$(basename "${promptfile%.*}")"; slug="${slug//[^A-Za-z0-9._-]/_}"
LOG="$LOGDIR/$stamp-$tool-$slug.log"
FULL="$LOGDIR/$stamp-$tool-$slug.prompt.md"
{ cat "$PREAMBLE"; printf '\n\n---\nTASK%s\n\n' "$([ "$readonly_" = 1 ] && echo ' (READ-ONLY: do not edit, create or delete any file; answer in your reply only)')"; cat "$promptfile"; } > "$FULL"

# clean environment: drop anything that looks like a credential
clean_env=()
while IFS='=' read -r k _; do
  case "$k" in *KEY*|*TOKEN*|*SECRET*|*PASSWORD*|*PASSWD*|*CREDENTIAL*|*AUTH*|SSH_AUTH_SOCK|GH_*|GITHUB_*|NETLIFY_*|FIREBASE_*|AWS_*|APPLE_*|FASTLANE_*) clean_env+=(-u "$k");; esac
done < <(env)

run_limited() { # run_limited <secs> cmd... : timeout without GNU timeout (perl alarm, then kill the process group)
  perl -e '$s=shift; $SIG{ALRM}=sub{kill "TERM",-$$; sleep 3; kill "KILL",-$$; exit 124}; setpgrp(0,0); alarm $s; $p=fork; if(!$p){exec @ARGV or exit 127} waitpid($p,0); exit($?>>8)' "$@"
}

nchg0=$(git -C "$workdir" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
head0="$(git -C "$workdir" rev-parse HEAD 2>/dev/null || echo none)"
t0=$(date +%s)
{ echo "# offload $stamp tool=$tool workdir=$workdir readonly=$readonly_ model=${model:-default} effort=${effort:-default} timeout=${tmo}s"
  echo "# prompt: $FULL (preamble + $promptfile)"; echo "# HEAD before: $head0"; } > "$LOG"

status=0
if [ "$tool" = codex ]; then
  m="${model:-gpt-6.1-sol}"; e="${effort:-medium}"; model="$m"; effort="$e"
  sb=workspace-write; [ "$readonly_" = 1 ] && sb=read-only
  args=(codex exec -m "$m" -c "model_reasoning_effort=\"$e\"" -c 'approval_policy="never"' -s "$sb"
        --ignore-user-config --ephemeral -C "$workdir" -o "$LOG.last.txt")
  for d in ${adds[@]+"${adds[@]}"}; do args+=(--add-dir "$d"); done
  [ -e "$workdir/.git" ] || args+=(--skip-git-repo-check)
  args+=(-)   # prompt from stdin
  ( cd "$workdir" && run_limited "$tmo" env ${clean_env[@]+"${clean_env[@]}"} "${args[@]}" ) < "$FULL" >>"$LOG" 2>&1
  status=$?
else
  # agy model ids may carry the effort as a suffix (gemini-3.8-flash-medium); then --effort must not also be given
  m="${model:-gemini-3.8-flash}"; model="$m"; [ -z "$effort" ] && [ "$m" = "gemini-3.8-flash" ] && effort=medium
  case "$m" in *-low|*-medium|*-high) effort="";; esac
  mode=accept-edits; [ "$readonly_" = 1 ] && mode=plan
  # print mode cannot ask for approval, so unapproved commands are auto-denied. Allow only read-only helpers (and, for
  # write tasks, serial.sh for tests); git add/commit, push, curl, rm etc. stay denied.
  allow='"command(grep)","command(sed)","command(ls)","command(cat)","command(head)","command(tail)","command(wc)","command(git status)","command(git diff)","command(git log)","command(git show)","command(git ls-files)"'
  [ "$readonly_" = 0 ] && allow="$allow"',"command(/Volumes/androidbuild/tools/serial.sh)"'
  args=(agy --model "$m" --mode "$mode" --sandbox --output-format json --print-timeout "${tmo}s"
        --settings "{\"permissions\":{\"allow\":[$allow]}}")
  [ -n "$effort" ] && args+=(--effort "$effort")
  for d in ${adds[@]+"${adds[@]}"}; do args+=(--add-dir "$d"); done
  args+=("--print=$(cat "$FULL")")
  ( cd "$workdir" && run_limited "$((tmo + 30))" env ${clean_env[@]+"${clean_env[@]}"} "${args[@]}" ) < /dev/null >>"$LOG" 2>&1
  status=$?
  python3 -I - "$LOG" "$LOG.last.txt" <<'PY' 2>/dev/null
import sys,json
for line in reversed(open(sys.argv[1],errors="replace").read().splitlines()):
    if line.startswith("{"):
        try: j=json.loads(line)
        except Exception: continue
        open(sys.argv[2],"w").write(j.get("response",""))
        break
PY
  if [ "$status" -eq 0 ] && [ ! -s "$LOG.last.txt" ]; then
    echo "offload.sh: agy returned an empty response (denied actions: $(grep -o '"denied_actions":\[[^]]*\]' "$LOG" | tail -1))" | tee -a "$LOG" >&2; status=20
  fi
fi
t1=$(date +%s)
head1="$(git -C "$workdir" rev-parse HEAD 2>/dev/null || echo none)"
ncommits=0; [ "$head0" != none ] && ncommits=$(git -C "$workdir" rev-list --count "$head0..$head1" 2>/dev/null || echo 0)
nchg=$(git -C "$workdir" status --porcelain 2>/dev/null | wc -l | tr -d ' '); nchg=$((nchg - nchg0))
usage="$( { grep -A1 -E '^tokens used' "$LOG" | tail -2 | tr '\n' ' '; grep -oE '"usage":\{[^}]*\}' "$LOG" | tail -1; } )"
if [ "$status" -ne 0 ] && [ "$status" -ne 124 ]; then
  if grep -qiE 'rate.?limit|usage limit|RESOURCE_EXHAUSTED|spend cap|quota|\b429\b' <(tail -n 60 "$LOG"); then status=75; else status=20; fi
fi
{ echo; echo "# exit=$status seconds=$((t1 - t0)) HEAD after: $head1 (new commits: $ncommits) change in uncommitted paths: $nchg"; echo "# usage: ${usage:-n/a}"; } >> "$LOG"
echo "WROTE-BY: $tool $model${effort:+ ($effort)} via tools/offload.sh, $(date +%F), log $LOG, prompt $FULL (accepted only after tests + a Sonnet diff review by someone else)"
echo "exit=$status seconds=$((t1 - t0)) new-commits=$ncommits uncommitted-delta=$nchg usage: ${usage:-n/a}"
[ -s "$LOG.last.txt" ] && echo "LAST-MESSAGE: $LOG.last.txt"
echo "LOG: $LOG"
exit "$status"
