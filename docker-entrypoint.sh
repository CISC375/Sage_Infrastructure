#!/bin/sh
set -e

# Optional: do any setup here, like migrations, seeding, etc.
echo "Starting Node server..."

exec "$@"
