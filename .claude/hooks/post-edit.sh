#!/bin/bash
# Runs after Claude edits any file. Runs typecheck on TS files only.
FILE_PATH="$1"
if [[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.tsx ]]; then
  cd "$(git rev-parse --show-toplevel)" || exit 0
  pnpm typecheck 2>&1 | tail -20
fi
