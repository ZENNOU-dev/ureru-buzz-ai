#!/bin/bash
exec 2>>/tmp/google-workspace-mcp-debug.log
echo "=== START $(date) ===" >&2
echo "PATH: $PATH" >&2
echo "PWD: $PWD" >&2
echo "NODE: $(which node 2>&1)" >&2
echo "GOOGLE_APPLICATION_CREDENTIALS: $GOOGLE_APPLICATION_CREDENTIALS" >&2
echo "HOME: $HOME" >&2
/Users/yumhahada/.nvm/versions/node/v24.11.1/bin/node /Users/yumhahada/ad-orchestration/google-workspace-mcp/dist/index.js
EXIT_CODE=$?
echo "=== EXIT CODE: $EXIT_CODE $(date) ===" >&2
