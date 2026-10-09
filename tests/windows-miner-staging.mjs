import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setupConfiguredPorts, setupPlan } from '../src/setup.js';

const source = readFileSync(new URL('../src/setup.js', import.meta.url), 'utf8');
const helperSource = source.match(/function windowsExpandFlatten\([^]*?\n\}(?=\n)/)?.[0];
assert.ok(helperSource, 'shared Windows staging helper exists');
const flatten = new Function(`return (${helperSource});`)();
const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
const nativeAvailable = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', 'exit 0'], { timeout: 10000, stdio: 'ignore' }).status === 0;

test('Windows NVIDIA MM stages BZ without leaving its launcher directory', () => {
  const ports = setupConfiguredPorts({ configured: [{ port: 1, tlsPort: 2, difficulty: 1000, targetHashrate: 1000, description: 'fixture' }] });
  const plan = setupPlan({ os: 'windows', gpu: 'nvidia', profile: 'multi-miner', ports });
  assert.equal((plan.downloadCommand.match(/Set-Location/g) || []).length, 1, 'only initial MM staging changes directory');
  assert.equal((plan.downloadCommand.match(/Expected one staged miner file/g) || []).length, 1, 'all fixed miners use shared staging');
  assert.equal((plan.downloadCommand.match(/^function Expand-MinerArchive\(/gm) || []).length, 1, 'shared staging is defined once');
  assert.equal((plan.downloadCommand.match(/^Expand-MinerArchive '/gm) || []).length, 4, 'MM and each fixed miner have one literal staging call');
  const intel = setupPlan({ os: 'windows', gpu: 'intel', profile: 'multi-miner', ports });
  assert.equal((intel.downloadCommand.match(/^function Expand-MinerArchive\(/gm) || []).length, 1, 'Intel shares the same staging helper');
  assert.equal((intel.downloadCommand.match(/^Expand-MinerArchive '/gm) || []).length, 2, 'Intel stages MM and SRBMiner');
  const selector = source.match(/windowsZipDownload\(BZMINER_RELEASE_API, ([^,\n]+), BZMINER_ZIP/)?.[1];
  assert.ok(selector && source.includes(`windowsAssetDownload(BZMINER_RELEASE_API, ${selector}, BZMINER_ZIP)`), 'MM preserves the direct BZ asset selector');
});

test('shared Windows staging binds one expected file and copies all siblings', () => {
  const command = flatten('fixture.zip', 'fixture.exe');
  assert.ok(command.includes("-DestinationPath $stage -Force"), 'archive extraction must use fresh staging');
  assert.ok(command.includes('-Recurse -File -Filter "fixture.exe"'), 'staging must bind the expected executable');
  assert.ok(command.includes('.Count -ne 1'), 'missing and ambiguous layouts fail closed');
  assert.ok(command.includes('[IO.Path]::GetTempPath()') && command.includes('[Guid]::NewGuid()'), 'staging must use a fresh unique temp directory');
  assert.ok(command.includes('Copy-Item -Destination . -Recurse -Force'), 'sibling files and directories are preserved');
  assert.ok(!/Set-Location|Push-Location|Pop-Location/.test(command), 'staging leaves current directory unchanged');
  assert.ok(command.includes('try {') && command.includes('} finally {'), 'staging cleanup must run on success and failure');
  assert.ok(command.includes('Remove-Item -LiteralPath $stage -Recurse -Force'), 'cleanup must target only the created temp directory');
});

for (const layout of ['root', 'nested', 'missing', 'duplicate', 'upgrade', 'shared', 'copy-error']) {
  test(`native Windows staging: ${layout} layout`, { skip: !nativeAvailable }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-windows-staging-'));
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const files = layout === 'root' ? ['fixture.exe', 'support.dll', 'data/asset.txt']
      : ['nested', 'upgrade', 'shared', 'copy-error'].includes(layout) ? ['package/fixture.exe', 'package/support.dll', 'package/data/asset.txt']
        : layout === 'duplicate' ? ['a/fixture.exe', 'b/fixture.exe'] : ['support.dll'];
    const fileList = files.map(quote).join(', ');
    let command = flatten('fixture.zip', 'fixture.exe');
    if (layout === 'shared') {
      const ports = setupConfiguredPorts({ configured: [{ port: 1, tlsPort: 2, difficulty: 1000, targetHashrate: 1000, description: 'fixture' }] });
      const plan = setupPlan({ os: 'windows', gpu: 'nvidia', profile: 'multi-miner', ports });
      const shared = plan.downloadCommand.match(/^function Expand-MinerArchive\([^]*?^\}/m)?.[0];
      assert.ok(shared, 'the generated shared staging function must be present');
      command = `${shared}\nExpand-MinerArchive 'fixture.zip' 'fixture.exe'`;
    }
    const script = `$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath ${quote(dir)}
$initial = (Get-Location).Path
New-Item -ItemType Directory temporary | Out-Null
$env:TEMP = Join-Path $initial temporary
$env:TMP = $env:TEMP
New-Item -ItemType Directory input | Out-Null
foreach ($file in @(${fileList})) {
  $path = Join-Path input $file
  New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
  [IO.File]::WriteAllText((Join-Path $initial $path), 'fixture')
}
Compress-Archive -Path 'input/*' -DestinationPath fixture.zip
${layout === 'copy-error' ? `$copyCalls = 0
function Copy-Item {
  [CmdletBinding()] param([Parameter(ValueFromPipeline)] $InputObject, $Destination, [switch] $Recurse, [switch] $Force)
  process { $script:copyCalls++; Write-Error -ErrorId StagingCopyDenied 'Fixture copy denied' }
}` : ''}
${(layout === 'upgrade' || layout === 'shared') ? `New-Item -ItemType Directory -Path stage/old -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $initial 'stage/old/fixture.exe'), 'old executable')
[IO.File]::WriteAllText((Join-Path $initial 'stage/old/obsolete.dll'), 'old library')` : ''}
$failed = $false
$continued = $false
try {
${command}
  $continued = $true
} catch {
  if ($_.Exception.Message -ne 'Expected one staged miner file' -and $_.FullyQualifiedErrorId -notlike 'StagingCopyDenied*') { exit 16 }
  $failed = $true
}
if ((Get-Location).Path -ne $initial) { exit 11 }
if (@(Get-ChildItem -LiteralPath $env:TEMP -Force).Count -ne 0) { exit 17 }
${(layout === 'upgrade' || layout === 'shared') ? `if ([IO.File]::ReadAllText((Join-Path $initial 'stage/old/fixture.exe')) -ne 'old executable') { exit 18 }
if ([IO.File]::ReadAllText((Join-Path $initial 'stage/old/obsolete.dll')) -ne 'old library') { exit 19 }
if (Test-Path -LiteralPath obsolete.dll) { exit 20 }` : ''}
if ($failed -ne $${['missing', 'duplicate', 'copy-error'].includes(layout)}) { exit 12 }
if ($failed -and $continued) { exit 21 }
${layout === 'copy-error' ? 'if ($copyCalls -lt 1) { exit 22 }' : ''}
if (!$failed) {
  foreach ($file in @('fixture.exe', 'support.dll', 'data/asset.txt')) {
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { exit 13 }
    if ([IO.File]::ReadAllText((Join-Path $initial $file)) -ne 'fixture') { exit 14 }
  }
} elseif (Test-Path -LiteralPath fixture.exe) { exit 15 }
exit 0`;
    try {
      const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', script], { cwd: dir, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
      assert.equal(result.status, 0, 'native staging fixture passed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const scenario of ['upgrade', 'metadata-failure', 'download-failure', 'missing', 'wrong-type', 'wrong-prefix', 'http', 'unsafe-url', 'trailing-newline']) {
  test(`native Windows generated download: ${scenario}`, { skip: !nativeAvailable }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ui-windows-download-'));
    const quote = value => `'${value.replaceAll("'", "''")}'`;
    const ports = setupConfiguredPorts({ configured: [{ port: 1, tlsPort: 2, targetHashrate: 1000 }] });
    const command = setupPlan({ os: 'windows', gpu: 'nvidia', profile: 'srb-gpu', algo: 'kawpow', miner: 'bzminer', ports }).downloadCommand;
    const script = `$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath ${quote(dir)}
$initial = (Get-Location).Path
New-Item -ItemType Directory -Path old/package,new/package,bzminer/a-old,temporary | Out-Null
$env:TEMP = Join-Path $initial temporary
$env:TMP = $env:TEMP
[IO.File]::WriteAllText((Join-Path $initial 'old/package/bzminer.exe'), 'old')
[IO.File]::WriteAllText((Join-Path $initial 'bzminer/a-old/bzminer.exe'), 'old')
[IO.File]::WriteAllText((Join-Path $initial 'new/package/bzminer.exe'), 'current')
Compress-Archive -Path old/package -DestinationPath bzminer.zip -ErrorAction Stop
Compress-Archive -Path new/package -DestinationPath current.zip -ErrorAction Stop
$oldHash = (Get-FileHash -LiteralPath bzminer.zip).Hash
$downloadCalls = 0
function Invoke-RestMethod {
  [CmdletBinding()] param([Parameter(Position=0)] $Uri)
  ${scenario === 'metadata-failure' ? "Write-Error -ErrorId FixtureMetadataFailure 'Fixture metadata denied'" : ''}
  $url = 'https://github.com/bzminer/bzminer/releases/download/v1/bzminer_v1_windows.zip'
  ${scenario === 'wrong-prefix' ? "$url = 'https://github.com/other/bzminer/releases/download/v1/bzminer_v1_windows.zip'" : ''}
  ${scenario === 'http' ? "$url = $url.Replace('https:', 'http:')" : ''}
  ${scenario === 'unsafe-url' ? '$url += "`n-o fixture"' : ''}
  ${scenario === 'trailing-newline' ? '$url += "`n"' : ''}
  $asset = [pscustomobject]@{ name = 'bzminer_v1_windows.zip'; browser_download_url = $url }
  return [pscustomobject]@{ assets = ${scenario === 'missing' ? '@()' : scenario === 'wrong-type' ? "'invalid'" : '@($asset)'} }
}
function Invoke-WebRequest {
  [CmdletBinding()] param([Parameter(Position=0)] $Uri, $OutFile)
  $script:downloadCalls++
  ${scenario === 'download-failure' ? "Write-Error -ErrorId FixtureDownloadFailure 'Fixture download denied'; return" : "[IO.File]::Copy((Join-Path $initial 'current.zip'), (Join-Path $initial $OutFile), $true)"}
}
Set-Alias iwr Invoke-WebRequest
$failed = $false
$continued = $false
try {
${command}
  $continued = $true
} catch { $failed = $true }
if ($failed -ne $${scenario !== 'upgrade'}) { exit 31 }
if (@(Get-ChildItem -LiteralPath $env:TEMP -Force).Count -ne 0) { exit 32 }
${scenario === 'upgrade' ? `if ([IO.File]::ReadAllText((Join-Path (Get-Location).Path 'bzminer.exe')) -ne 'current') { exit 33 }
if ([IO.File]::ReadAllText((Join-Path $initial 'bzminer/a-old/bzminer.exe')) -ne 'old') { exit 34 }` : `if ($continued) { exit 35 }
if ((Get-FileHash -LiteralPath (Join-Path $initial 'bzminer.zip')).Hash -ne $oldHash) { exit 36 }
if ((Get-Location).Path -ne $initial) { exit 37 }
if ($downloadCalls -ne ${scenario === 'download-failure' ? 1 : 0}) { exit 38 }`}
exit 0`;
    try {
      const result = spawnSync(shell, ['-NoProfile', '-NonInteractive', '-Command', script], { cwd: dir, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
      assert.equal(result.status, 0, 'generated download fixture passed');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
