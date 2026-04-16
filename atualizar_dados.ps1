$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# Find the first Excel file in the directory to avoid encoding/accent issues with hardcoded strings
$excelFile = Get-ChildItem -Path $scriptPath -Filter "*.xlsx" | Select-Object -First 1
if (-not $excelFile) {
    Write-Error "Nenhum arquivo .xlsx encontrado na pasta!"
    exit
}

$excelPath = $excelFile.FullName
$jsOutputPath = Join-Path $scriptPath "data.js"

Write-Host "Iniciando a leitura do arquivo Excel..."

# Create Excel COM Object
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    # Check if file exists
    if (-Not (Test-Path $excelPath)) {
        throw "Arquivo não encontrado: $excelPath"
    }

    $workbook = $excel.Workbooks.Open($excelPath)

    # 1. Read Main Sheet (assume first sheet)
    $sheet = $workbook.Sheets.Item(1)
    $maxRow = $sheet.UsedRange.Rows.Count
    
    # We will build a nested dictionary: MonthKey -> array of dentist objects
    # Dictionary formatting: MonthKey -> (Dentists array)
    $monthlyData = @{}
    
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo("pt-BR")

    for ($r = 2; $r -le $maxRow; $r++) {
        $dentistName = $sheet.Cells.Item($r, 1).Text.Trim()
        $metaDiariaStr = $sheet.Cells.Item($r, 2).Text.Trim()
        $diasUteisStr = $sheet.Cells.Item($r, 3).Text.Trim()
        $metaMensalStr = $sheet.Cells.Item($r, 4).Text.Trim()
        $realizadoStr = $sheet.Cells.Item($r, 5).Text.Trim()
        $atingidoStr = $sheet.Cells.Item($r, 6).Text.Trim()
        $mesReferenteStr = $sheet.Cells.Item($r, 7).Text.Trim() # e.g. "fev/26"

        if ([string]::IsNullOrWhiteSpace($mesReferenteStr) -or [string]::IsNullOrWhiteSpace($dentistName)) {
            continue
        }

        # Parse Month
        $parsedDate = [datetime]::MinValue
        if ([datetime]::TryParse($mesReferenteStr, $culture, 'None', [ref]$parsedDate)) {
            $monthKey = $parsedDate.ToString("yyyy-MM")
            $monthName = $parsedDate.ToString("MMMM yyyy", $culture)
            $monthName = (Get-Culture).TextInfo.ToTitleCase($monthName.ToLower())
        } else {
            # fallback if excel sends exact text 
            $monthKey = $mesReferenteStr
            $monthName = $mesReferenteStr
        }

        # Parse numbers
        $metaDiaria = 0; [int]::TryParse($metaDiariaStr, [ref]$metaDiaria) | Out-Null
        $diasUteis = 0; [int]::TryParse($diasUteisStr, [ref]$diasUteis) | Out-Null
        $metaMensal = 0; [int]::TryParse($metaMensalStr, [ref]$metaMensal) | Out-Null
        $realizado = 0; [int]::TryParse($realizadoStr, [ref]$realizado) | Out-Null
        $atingido = 0; [int]::TryParse($atingidoStr.Replace("%",""), [ref]$atingido) | Out-Null

        if (-not $monthlyData.ContainsKey($monthKey)) {
            $monthlyData[$monthKey] = @{
                DisplayName = $monthName;
                Dentists = @()
            }
        }

        $dentistObj = @{
            name = $dentistName
            metaDiaria = $metaDiaria
            diasUteis = $diasUteis
            metaMensal = $metaMensal
            realizado = $realizado
            atingido = $atingido
        }
        $monthlyData[$monthKey].Dentists += $dentistObj
    }

    # 3. Assemble JSON-like Javascript object
    $jsLines = @()
    $jsLines += "const historicalData = {"

    # Sort keys by date descending (newest first)
    $sortedMonths = $monthlyData.Keys | Sort-Object -Descending

    $monthCount = 0
    foreach ($mKey in $sortedMonths) {
        $monthCount++
        $monthObj = $monthlyData[$mKey]
        $displayName = $monthObj.DisplayName
        $dentistsArr = $monthObj.Dentists
        
        $jsLines += "  `"$mKey|!|$displayName`": ["
        
        $dentistArrayItemCount = 0
        foreach ($dMap in $dentistsArr) {
            $dentistArrayItemCount++
            $name = $dMap.name
            $md = $dMap.metaDiaria
            $du = $dMap.diasUteis
            $mm = $dMap.metaMensal
            $re = $dMap.realizado
            $at = $dMap.atingido
            
            $comma = if ($dentistArrayItemCount -lt $dentistsArr.Count) { "," } else { "" }
            $jsLines += "    { name: `"$name`", metaDiaria: $md, diasUteis: $du, metaMensal: $mm, realizado: $re, atingido: $at }$comma"
        }
        
        $outerComma = if ($monthCount -lt $sortedMonths.Count) { "," } else { "" }
        $jsLines += "  ]$outerComma"
    }

    $jsLines += "};"
    $jsLines += ""
    $jsLines += "let currentMonthKey = Object.keys(historicalData)[0];"
    $jsLines += "let dentistsData = historicalData[currentMonthKey] || [];"

    # Write to file
    Set-Content -Path $jsOutputPath -Value ($jsLines -join "`r`n") -Encoding UTF8

    Write-Host "Processo concluído com sucesso!"
    Write-Host "Arquivo data.js foi atualizado a partir do Excel."

} catch {
    Write-Error "Ocorreu um erro durante a execução: $_"
} finally {
    if ($workbook -ne $null) {
        $workbook.Close($false)
    }
    if ($excel -ne $null) {
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
