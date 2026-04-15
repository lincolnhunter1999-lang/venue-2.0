#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node first, then run this again."
  exit 1
fi
npm install
npm start
