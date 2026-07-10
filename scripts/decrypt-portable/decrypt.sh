#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
node "$DIR/decrypt.cjs" "$@"
