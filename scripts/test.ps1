$ErrorActionPreference = "Stop"

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path $node)) {
  throw "Node.js was not found. Install Node.js or run from the Codex desktop environment."
}

& $node --test "web/test/*.test.mjs"
