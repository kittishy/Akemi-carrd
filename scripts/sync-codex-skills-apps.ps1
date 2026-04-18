$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$homeRoot = [Environment]::GetFolderPath("UserProfile")

$pluginName = "solara-local-catalog"
$pluginRoot = Join-Path $homeRoot "plugins\$pluginName"
$pluginSkillsRoot = Join-Path $pluginRoot "skills"
$pluginManifestDir = Join-Path $pluginRoot ".codex-plugin"
$marketplaceDir = Join-Path $homeRoot ".agents\plugins"
$marketplaceFile = Join-Path $marketplaceDir "marketplace.json"

$sourceRoots = @(
    @{
        Path = Join-Path $workspaceRoot ".shared-skills"
        Prefix = "project"
        Exclude = @()
    },
    @{
        Path = Join-Path $homeRoot ".agents\skills"
        Prefix = "global-agents"
        Exclude = @()
    },
    @{
        Path = Join-Path $homeRoot ".codex\skills"
        Prefix = "global-codex"
        Exclude = @(".system")
    }
)

$agentSourceRoot = Join-Path $workspaceRoot ".shared-agents"

function Assert-SafePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedRoot
    )

    $resolvedExpectedRoot = [System.IO.Path]::GetFullPath($ExpectedRoot)
    $resolvedPath = [System.IO.Path]::GetFullPath($Path)

    if (-not $resolvedPath.StartsWith($resolvedExpectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path detected: $resolvedPath is outside $resolvedExpectedRoot"
    }
}

function New-CleanDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$ExpectedRoot
    )

    Assert-SafePath -Path $Path -ExpectedRoot $ExpectedRoot

    if (Test-Path $Path) {
        Remove-Item -LiteralPath $Path -Recurse -Force
    }

    New-Item -ItemType Directory -Path $Path -Force | Out-Null
}

function Copy-SkillTree {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceRoot,
        [Parameter(Mandatory = $true)]
        [string]$Prefix,
        [string[]]$Exclude = @()
    )

    if (-not (Test-Path $SourceRoot)) {
        return @()
    }

    $copied = @()

    Get-ChildItem -LiteralPath $SourceRoot -Directory | ForEach-Object {
        if ($Exclude -contains $_.Name) {
            return
        }

        $destinationName = "$Prefix-$($_.Name)"
        $destinationPath = Join-Path $pluginSkillsRoot $destinationName
        Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
        $copied += $destinationName
    }

    return $copied
}

function Convert-AgentToSkill {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourceFile
    )

    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($SourceFile)
    $skillName = "project-agent-$baseName"
    $skillRoot = Join-Path $pluginSkillsRoot $skillName
    $skillFile = Join-Path $skillRoot "SKILL.md"
    $sourceText = Get-Content -LiteralPath $SourceFile -Raw

    New-Item -ItemType Directory -Path $skillRoot -Force | Out-Null

    $skillText = @"
# $baseName

Use this when you want to follow the "$baseName" agent profile from the Akemi workspace.
This wrapper exists so the shared agent appears in Codex under "Habilidades e aplicativos".

## Source
$SourceFile

## Agent Profile
$sourceText
"@

    Set-Content -LiteralPath $skillFile -Value $skillText -Encoding UTF8
    return $skillName
}

New-Item -ItemType Directory -Path (Join-Path $homeRoot "plugins") -Force | Out-Null
New-Item -ItemType Directory -Path $marketplaceDir -Force | Out-Null

New-CleanDirectory -Path $pluginRoot -ExpectedRoot (Join-Path $homeRoot "plugins")
New-Item -ItemType Directory -Path $pluginSkillsRoot -Force | Out-Null
New-Item -ItemType Directory -Path $pluginManifestDir -Force | Out-Null

$copiedSkills = @()
foreach ($sourceRoot in $sourceRoots) {
    $copiedSkills += Copy-SkillTree -SourceRoot $sourceRoot.Path -Prefix $sourceRoot.Prefix -Exclude $sourceRoot.Exclude
}

$wrappedAgents = @()
if (Test-Path $agentSourceRoot) {
    Get-ChildItem -LiteralPath $agentSourceRoot -Filter *.md -File | ForEach-Object {
        $wrappedAgents += Convert-AgentToSkill -SourceFile $_.FullName
    }
}

$pluginManifest = [ordered]@{
    name = $pluginName
    version = "1.0.0"
    description = "Workspace and global skills catalog for Codex"
    author = [ordered]@{
        name = "isand"
    }
    homepage = "https://codex.local/$pluginName"
    repository = "https://codex.local/$pluginName"
    license = "UNLICENSED"
    keywords = @("skills", "agents", "workspace", "local")
    skills = "./skills/"
    interface = [ordered]@{
        displayName = "Solara Local Catalog"
        shortDescription = "Skills e agents do projeto + globais"
        longDescription = "Agrega skills compartilhados do workspace, skills globais do PC e wrappers para agents compartilhados para que tudo apareca na aba de Habilidades e aplicativos do Codex."
        developerName = "isand"
        category = "Coding"
        capabilities = @("Interactive", "Write")
        websiteURL = "https://codex.local/$pluginName"
        privacyPolicyURL = "https://codex.local/privacy"
        termsOfServiceURL = "https://codex.local/terms"
        defaultPrompt = @(
            "Quais skills locais eu tenho neste PC?",
            "Quais agents do projeto estao disponiveis?",
            "Mostre os skills globais e do workspace"
        )
        brandColor = "#E8510A"
    }
}

$pluginManifestPath = Join-Path $pluginManifestDir "plugin.json"
$pluginManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $pluginManifestPath -Encoding UTF8

if (Test-Path $marketplaceFile) {
    $marketplace = Get-Content -LiteralPath $marketplaceFile -Raw | ConvertFrom-Json -Depth 10
}
else {
    $marketplace = [pscustomobject]@{
        name = "local"
        interface = [pscustomobject]@{
            displayName = "Local Plugins"
        }
        plugins = @()
    }
}

$pluginEntry = [pscustomobject]@{
    name = $pluginName
    source = [pscustomobject]@{
        source = "local"
        path = "./plugins/$pluginName"
    }
    policy = [pscustomobject]@{
        installation = "INSTALLED_BY_DEFAULT"
        authentication = "ON_INSTALL"
    }
    category = "Coding"
}

$existingEntries = @()
if ($marketplace.plugins) {
    $existingEntries = @($marketplace.plugins | Where-Object { $_.name -ne $pluginName })
}

$marketplace.plugins = @($existingEntries + $pluginEntry)
$marketplace | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $marketplaceFile -Encoding UTF8

[pscustomobject]@{
    PluginRoot = $pluginRoot
    PluginManifest = $pluginManifestPath
    MarketplaceFile = $marketplaceFile
    ProjectSkillCount = @($copiedSkills | Where-Object { $_ -like "project-*" }).Count
    GlobalAgentsSkillCount = @($copiedSkills | Where-Object { $_ -like "global-agents-*" }).Count
    GlobalCodexSkillCount = @($copiedSkills | Where-Object { $_ -like "global-codex-*" }).Count
    WrappedAgentCount = $wrappedAgents.Count
    TotalEntries = @($copiedSkills + $wrappedAgents).Count
} | Format-List
