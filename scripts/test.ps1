$ErrorActionPreference = "Stop"

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
}

if (-not (Test-Path $node)) {
  throw "Node.js was not found. Install Node.js or run from the Codex desktop environment."
}

& $node --test "web/test/*.test.mjs"

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
  $python = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
}

if (-not (Test-Path $python)) {
  throw "Python was not found. Install Python 3.10+ or run from the Codex desktop environment."
}

& $python -m unittest discover -s tests -p "test_*.py"
