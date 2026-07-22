param(
  [switch]$Import,
  [switch]$Refresh,
  [string[]]$Country = @(),
  [ValidateSet("strategic", "regional")]
  [string]$RoadProfile = "strategic"
)

$ErrorActionPreference = "Stop"

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

if ($Import) {
  $argsList = @("-m", "russianinfra.extract_geofabrik_osm_roads", "--road-profile", $RoadProfile)
  if ($Refresh) {
    $argsList += "--refresh"
  }
  foreach ($item in $Country) {
    $argsList += @("--country", $item)
  }
  & $python @argsList
} else {
  & $python -m unittest tests.test_pipeline.GeofabrikRoadExtractorTests
}
