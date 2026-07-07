$ErrorActionPreference = "Stop"

$bundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$node = if (Test-Path $bundledNode) {
  $bundledNode
} else {
  (Get-Command node -ErrorAction SilentlyContinue).Source
}

if (-not $node -or -not (Test-Path $node)) {
  throw "Node.js was not found. Install Node.js or run from the Codex desktop environment."
}

& $node --test "web/test/*.test.mjs"

$bundledPython = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$python = if (Test-Path $bundledPython) {
  $bundledPython
} else {
  (Get-Command python -ErrorAction SilentlyContinue).Source
}

if (-not $python -or -not (Test-Path $python)) {
  throw "Python was not found. Install Python 3.10+ or run from the Codex desktop environment."
}

$env:PYTHONPATH = if ($env:PYTHONPATH) {
  "src$([System.IO.Path]::PathSeparator)$env:PYTHONPATH"
} else {
  "src"
}

& $python -m unittest discover -s tests -p "test_*.py"
