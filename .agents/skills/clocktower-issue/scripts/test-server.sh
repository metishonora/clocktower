#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 start <issue> <worktree> [port] | stop <issue> | status <issue>" >&2
  exit 2
}

require_issue() {
  case "$1" in
    ''|*[!0-9]*) echo "Issue must be numeric." >&2; exit 2 ;;
  esac
}

state_dir_for() {
  local root="${TMPDIR:-/tmp}"
  echo "${root%/}/clocktower-test-server-$1"
}

label_for() {
  echo "com.clocktower.test-server.issue-$1"
}

job_pid() {
  local label="$1"
  launchctl list | awk -v target="$label" '$3 == target && $1 ~ /^[0-9]+$/ { print $1; exit }'
}

process_alive() {
  test -n "$(job_pid "$1")"
}

command="${1:-}"
issue="${2:-}"
test -n "$command" && test -n "$issue" || usage
require_issue "$issue"

state_dir="$(state_dir_for "$issue")"
label="$(label_for "$issue")"
pid_file="$state_dir/server.pid"
log_file="$state_dir/server.log"

case "$command" in
  start)
    worktree="${3:-}"
    port="${4:-4173}"
    test -n "$worktree" || usage
    case "$port" in
      ''|*[!0-9]*) echo "Port must be numeric." >&2; exit 2 ;;
    esac

    worktree="$(cd "$worktree" && pwd)"
    vite="$worktree/web/node_modules/.bin/vite"
    test -x "$vite" || { echo "Vite is unavailable at $vite; install workspace dependencies first." >&2; exit 1; }
    command -v launchctl > /dev/null || { echo "launchctl is required to detach the server from the tool session." >&2; exit 1; }

    tailscale_bin="$(command -v tailscale || true)"
    test -n "$tailscale_bin" || { echo "tailscale CLI is unavailable." >&2; exit 1; }
    tailscale_ip="$($tailscale_bin ip -4 | sed -n '1p')"
    test -n "$tailscale_ip" || { echo "No Tailscale IPv4 address is available." >&2; exit 1; }

    if process_alive "$label"; then
      echo "A server is already running for issue $issue." >&2
      "$0" status "$issue"
      exit 1
    fi

    mkdir -p "$state_dir"
    launchctl remove "$label" 2>/dev/null || true
    rm -f "$pid_file"
    printf '%s\n' "$worktree" > "$state_dir/worktree"
    printf '%s\n' "$port" > "$state_dir/port"
    printf 'http://%s:%s/\n' "$tailscale_ip" "$port" > "$state_dir/url"
    : > "$log_file"
    launcher="$state_dir/run.sh"
    {
      echo '#!/bin/bash'
      printf 'export PATH=%q\n' "$PATH"
      printf 'cd %q\n' "$worktree/web"
      printf 'exec %q --host 0.0.0.0 --port %q --strictPort >> %q 2>&1\n' "$vite" "$port" "$log_file"
    } > "$launcher"
    chmod +x "$launcher"
    launchctl submit -l "$label" -- "$launcher"

    attempts=0
    while test "$attempts" -lt 30; do
      if curl -fsS "http://127.0.0.1:$port/" > /dev/null 2>&1; then
        pid="$(job_pid "$label")"
        test -n "$pid" || { echo "Server responded without a launchd PID." >&2; exit 1; }
        printf '%s\n' "$pid" > "$pid_file"
        "$0" status "$issue"
        exit 0
      fi
      if ! launchctl list "$label" > /dev/null 2>&1; then
        echo "Test server exited during startup. Log: $log_file" >&2
        tail -n 30 "$log_file" >&2 || true
        exit 1
      fi
      attempts=$((attempts + 1))
      sleep 1
    done

    echo "Test server did not become healthy. Log: $log_file" >&2
    "$0" stop "$issue" || true
    exit 1
    ;;

  status)
    if ! process_alive "$label"; then
      echo "STOPPED issue=$issue state=$state_dir"
      exit 1
    fi
    pid="$(job_pid "$label")"
    printf '%s\n' "$pid" > "$pid_file"
    echo "RUNNING issue=$issue pid=$pid log=$log_file url=$(cat "$state_dir/url") state=$state_dir"
    ;;

  stop)
    if ! launchctl list "$label" > /dev/null 2>&1; then
      rm -f "$pid_file"
      echo "STOPPED issue=$issue state=$state_dir"
      exit 0
    fi

    launchctl remove "$label"
    attempts=0
    while launchctl list "$label" > /dev/null 2>&1 && test "$attempts" -lt 10; do
      attempts=$((attempts + 1))
      sleep 1
    done
    if launchctl list "$label" > /dev/null 2>&1; then
      echo "launchd did not remove $label." >&2
      exit 1
    fi
    rm -f "$pid_file"
    echo "STOPPED issue=$issue state=$state_dir"
    ;;

  *) usage ;;
esac
