# Get all active listings with pagination
$entriesPerPage = 200   # Max per page for Trading API
$pageNumber = 1
$allListings = @()
$firstResponseSaved = $false

try {
    $headers = @{
        "X-EBAY-API-COMPATIBILITY-LEVEL" = "967"
        "X-EBAY-API-DEV-NAME" = ""
        "X-EBAY-API-APP-NAME" = "AyazBhol-MeadowSk-PRD-7812b73f9-cd9598d9"
        "X-EBAY-API-CERT-NAME" = "PRD-812b73f99693-77aa-4a29-9014-f965"
        "X-EBAY-API-SITEID" = "3"  # 3 = UK site
        "X-EBAY-API-CALL-NAME" = "GetMyeBaySelling"
        "Content-Type" = "text/xml"
    }

    do {
        # Build request body for current page
        $requestBody = @"
<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>v^1.1#i^1#f^0#r^1#p^3#I^3#t^Ul4xMF8xMToyODVCMEZGNUE3QTg2MjA3NDFGNUYzNjQyQ0IzQkZBQl8xXzEjRV4yNjA=</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>$entriesPerPage</EntriesPerPage>
      <PageNumber>$pageNumber</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>
"@

        $response = Invoke-RestMethod -Uri "https://api.ebay.com/ws/api.dll" -Method Post -Headers $headers -Body $requestBody

        if (-not $firstResponseSaved) {
            # Save the first response to a file for easier reading
            $response.OuterXml | Out-File "ebay_listings_response.xml"
            Write-Host "Success! Response saved to ebay_listings_response.xml" -ForegroundColor Green
            $firstResponseSaved = $true
        }

        $listings = $response.GetMyeBaySellingResponse.ActiveList.ItemArray.Item
        if ($listings) {
            $allListings += @($listings)
        }

        $hasMore = ($response.GetMyeBaySellingResponse.ActiveList.HasMoreItems -eq 'true')
        $pageNumber++
    } while ($hasMore)

    # Display a summary of all listings
    if ($allListings.Count -gt 0) {
        Write-Host "`nFound $($allListings.Count) listings:" -ForegroundColor Cyan
        foreach ($item in $allListings) {
            # Try to read price and currency robustly from XML object
            $priceNode = $item.SellingStatus.CurrentPrice
            $price = $null
            $currency = $null
            if ($priceNode) {
                try { $price = $priceNode.'#text' } catch {}
                if (-not $price) { $price = $priceNode.value }
                try { $currency = $priceNode.'@currencyID' } catch {}
                if (-not $currency) { $currency = $priceNode._currencyID }
            }

            $status = $item.SellingStatus.ListingStatus
            $quantity = $item.Quantity - $item.SellingStatus.QuantitySold
            
            Write-Host "`n- $($item.Title)" -ForegroundColor Yellow
            Write-Host "  ID: $($item.ItemID)"
            Write-Host "  Price: $currency $price"
            Write-Host "  Status: $status"
            Write-Host "  Available Qty: $quantity"
            Write-Host "  URL: https://www.ebay.co.uk/itm/$($item.ItemID)"
        }
    } else {
        Write-Host "No active listings found." -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "Error:" -ForegroundColor Red
    Write-Host "Status Code:" $_.Exception.Response.StatusCode.value__
    Write-Host "Message:" $_.Exception.Message
    
    # Try to extract and display the error details from the response
    try {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $errorResponse = $reader.ReadToEnd()
        Write-Host "Error Details:" $errorResponse -ForegroundColor Red
    } catch {
        Write-Host "Could not read error details" -ForegroundColor Red
    }
}