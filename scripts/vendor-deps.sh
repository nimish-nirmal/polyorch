#!/bin/bash
set -euo pipefail

echo "Vendoring Go dependencies..."

if ! command -v go >/dev/null 2>&1; then
    echo "ERROR: Go is not installed. Please install Go 1.22+ and try again."
    exit 1
fi

go env -w GOFLAGS="-mod=mod"
go mod tidy
go mod vendor

echo "Vendored $(ls vendor/modules.txt | wc -l) module paths into ./vendor/"
echo "Next: run 'make build-api' or 'make docker-build'"
