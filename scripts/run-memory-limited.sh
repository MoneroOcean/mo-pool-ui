#!/usr/bin/env bash
set -euo pipefail

# A hard cgroup cap includes browser children; Node's heap cap alone does not.
_resource_guard_main() {
  local mode=$1
  shift
  if (( $# == 0 )); then
    printf 'Usage: run-memory-limited.sh command [argument ...]\n' >&2
    return 2
  fi

  local repository lock cgroup='' max swap oom id controllers path lock_status
  repository=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
  lock="$repository/tmp/resource-guard.lock"

  if [[ $(uname -s) != Linux ]]; then
    printf 'Resource guard: the hard memory cap is unavailable on this platform.\n' >&2
    export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=512"
    [[ $mode == sourced ]] && return 0
    exec "$@"
  fi

  if [[ ! -f /sys/fs/cgroup/cgroup.controllers ]]; then
    printf 'Resource guard: Linux requires cgroup v2 memory enforcement.\n' >&2
    return 1
  fi

  if [[ -n ${RESOURCE_GUARD_CGROUP:-} || -n ${RESOURCE_GUARD_PENDING:-} ]]; then
    while IFS=: read -r id controllers path; do
      [[ $id == 0 && -z $controllers ]] && cgroup=$path
    done < /proc/self/cgroup
    if [[ $cgroup != /* || $cgroup == */../* || $cgroup == */.. ||
          ( -n ${RESOURCE_GUARD_CGROUP:-} && $RESOURCE_GUARD_CGROUP != "$cgroup" ) ]]; then
      printf 'Resource guard: inherited memory boundary or repository lock is invalid.\n' >&2
      return 1
    fi
    if ! read -r max < "/sys/fs/cgroup$cgroup/memory.max" ||
       ! read -r swap < "/sys/fs/cgroup$cgroup/memory.swap.max" ||
       ! read -r oom < "/sys/fs/cgroup$cgroup/memory.oom.group" ||
       [[ ! $max =~ ^[0-9]+$ || ${#max} -gt 10 ]] ||
       (( max <= 0 || max > 2147483648 )) ||
       [[ $swap != 0 || $oom != 1 ]]; then
      printf 'Resource guard: the inherited cgroup must cap memory at 2 GiB, disable swap, and kill the whole group on OOM.\n' >&2
      return 1
    fi
    if [[ /proc/self/fd/9 -ef "$lock" ]]; then
      if ! flock -n 9; then
        printf 'Resource guard: the inherited repository lock is invalid.\n' >&2
        return 1
      fi
    elif [[ -n ${RESOURCE_GUARD_CGROUP:-} && -f $lock ]]; then
      # Node/npm children close extra descriptors. The outer process keeps its
      # lock; require actual contention as well as the verified cgroup marker.
      lock_status=0
      flock -n -E 75 "$lock" true || lock_status=$?
      if (( lock_status != 75 )); then
        printf 'Resource guard: the outer repository lock is not held.\n' >&2
        return 1
      fi
    else
      printf 'Resource guard: the inherited repository lock is missing.\n' >&2
      return 1
    fi
    export RESOURCE_GUARD_CGROUP=$cgroup
    unset RESOURCE_GUARD_PENDING
    [[ $mode == sourced ]] && return 0
    exec "$@"
  fi

  if ! command -v systemd-run >/dev/null || ! command -v flock >/dev/null; then
    printf 'Resource guard: Linux requires systemd-run and flock; refusing an unbounded run.\n' >&2
    return 1
  fi
  mkdir -p "$repository/tmp"
  # Keep the file in place: replacing/unlinking it would create independent locks.
  exec 9>>"$lock"
  if ! flock -n 9; then
    printf 'Resource guard: another build or test is already running in this repository.\n' >&2
    return 1
  fi
  export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=512"
  export RESOURCE_GUARD_PENDING=1
  local -a manager=()
  (( EUID != 0 )) && manager=(--user)
  exec systemd-run "${manager[@]}" --scope --quiet --expand-environment=no \
    -p MemoryMax=2G -p MemorySwapMax=0 -p OOMPolicy=kill \
    bash "$repository/scripts/run-memory-limited.sh" "$@"
}

if [[ ${BASH_SOURCE[0]} != "$0" ]]; then
  _resource_guard_main sourced bash "$0" "$@"
else
  _resource_guard_main executable "$@"
fi
