$pptPath = (Resolve-Path "VoiceGuard_SIH_Presentation_Final.pptx").Path
$pdfPath = Join-Path (Get-Location) "VoiceGuard_SIH_Presentation_Final.pdf"
$exportDir = Join-Path (Get-Location) "sih_slide_previews"

Write-Host "Exporting PDF from $pptPath to $pdfPath..."
$ppt = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $ppt.Presentations.Open($pptPath, $true, $false, $false)
    $presentation.SaveAs($pdfPath, 32)
    Write-Host "PDF successfully exported: $pdfPath"

    for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
        $slide = $presentation.Slides.Item($i)
        $outPath = Join-Path $exportDir "slide_$i.png"
        $slide.Export($outPath, "PNG", 1920, 1080)
        Write-Host "Exported slide $i to $outPath"
    }
    $presentation.Close()
} catch {
    Write-Host "Export error: $_"
} finally {
    $ppt.Quit()
}

