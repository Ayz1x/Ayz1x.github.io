require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const parser = new xml2js.Parser({ explicitArray: false });
// Stripe and Email (optional, enabled via env)
let stripe = null;
try {
  const Stripe = require('stripe');
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
} catch (_) {}
const nodemailer = require('nodemailer');
let mailTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Boolean(process.env.SMTP_SECURE === 'true'),
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Mock product data
const mockProducts = {
    tiktok: [
        {
            id: 'tik1',
            title: 'Luxury Merino Wool Yarn',
            price: '$19.99',
            image: 'https://via.placeholder.com/300x300?text=Merino+Wool',
            description: 'Premium 100% merino wool yarn, perfect for knitting and crocheting',
            platform: 'TikTok Shop',
            category: 'Wool'
        },
        {
            id: 'tik2',
            title: 'Organic Cotton Yarn',
            price: '$14.99',
            image: 'https://via.placeholder.com/300x300?text=Organic+Cotton',
            description: 'Soft and eco-friendly cotton yarn',
            platform: 'TikTok Shop',
            category: 'Cotton'
        }
    ],
    ebay: [
        {
            id: 'eb1',
            title: 'Alpaca Blend Yarn',
            price: '$24.99',
            image: 'https://via.placeholder.com/300x300?text=Alpaca+Blend',
            description: 'Luxurious alpaca blend yarn, perfect for winter projects',
            platform: 'eBay',
            category: 'Wool'
        },
        {
            id: 'eb2',
            title: 'Silk Yarn',
            price: '$29.99',
            image: 'https://via.placeholder.com/300x300?text=Silk+Yarn',
            description: 'Luxurious silk yarn for special projects',
            platform: 'eBay',
            category: 'Silk'
        }
    ]
};

// Configure middleware
app.use(cors());
app.use(express.json());
// Serve static files with proper cache control
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Explicitly serve HTML files with proper content type
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
    }
    next();
});

// Get eBay API base URL based on environment
function getEbayApiBaseUrl() {
  return process.env.EBAY_ENV === 'PRODUCTION' 
    ? 'https://api.ebay.com' 
    : 'https://api.sandbox.ebay.com';
}

// Get eBay OAuth token
async function getEbayToken() {
  try {
    console.log('Generating new eBay OAuth token...');
    console.log('Using App ID:', process.env.EBAY_APP_ID);
    console.log('Using Cert ID:', process.env.EBAY_CERT_ID ? '*****' + process.env.EBAY_CERT_ID.slice(-4) : 'Not set');
    
    const scopes = 'https://api.ebay.com/oauth/api_scope';
    console.log('Requesting scopes:', scopes);
    
    const auth = Buffer.from(`${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`).toString('base64');
    const response = await axios.post(
      'https://api.ebay.com/identity/v1/oauth2/token',
      `grant_type=client_credentials&scope=${encodeURIComponent(scopes)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${auth}`,
          'Content-Language': 'en-GB'
        },
        timeout: 10000 // 10 second timeout
      }
    );
    
    if (!response.data || !response.data.access_token) {
      console.error('No access token in response:', response.data);
      return null;
    }
    
    console.log('Successfully obtained new eBay token');
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting eBay token:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: {
          ...error.config?.headers,
          'Authorization': error.config?.headers?.Authorization ? 'Basic [REDACTED]' : 'Not set'
        }
      }
    });
    return null;
  }
}

// Verification endpoint for eBay OAuth callback
app.get('/ebay/verify', (req, res) => {
  console.log('Received verification request:', {
    query: req.query,
    headers: req.headers,
    host: req.get('host')
  });
  
  const verificationCode = req.query.verification_code;
  
  if (verificationCode) {
    console.log('Verification successful! Code:', verificationCode);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>eBay Verification Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .success { color: green; }
        </style>
      </head>
      <body>
        <h1 class="success">✓ Verification Successful!</h1>
        <p>You can now close this window and return to the eBay developer portal.</p>
        <p><small>Verification code: ${verificationCode.substring(0, 10)}...</small></p>
      </body>
      </html>
    `);
  } else {
    console.log('Verification failed. No code received.');
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>eBay Verification Failed</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .error { color: red; }
        </style>
      </head>
      <body>
        <h1 class="error">✗ Verification Failed</h1>
        <p>No verification code received. Please try again.</p>
        <p><small>Received query: ${JSON.stringify(req.query)}</small></p>
      </body>
      </html>
    `);
  }
});

// API routes (before catch-all routes)
app.get('/api/ebay/verify', async (req, res) => {
  try {
    console.log('Verifying eBay API credentials...');
    
    // Log environment variables (mask sensitive info)
    const credentials = {
      EBAY_APP_ID: process.env.EBAY_APP_ID,
      EBAY_CERT_ID: process.env.EBAY_CERT_ID ? '***' + process.env.EBAY_CERT_ID.slice(-4) : 'Not set',
      EBAY_ENV: process.env.EBAY_ENV || 'Not set',
      EBAY_AUTH_TOKEN: process.env.EBAY_AUTH_TOKEN ? '***' + process.env.EBAY_AUTH_TOKEN.slice(-10) : 'Not set'
    };
    
    console.log('Current configuration:', JSON.stringify(credentials, null, 2));
    
    // Check if we have required credentials
    if (!process.env.EBAY_APP_ID || !process.env.EBAY_CERT_ID) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required credentials',
        required: ['EBAY_APP_ID', 'EBAY_CERT_ID'],
        suggestion: 'Please check your .env file and restart the server'
      });
    }
    
    // Try to get a token if not provided
    const token = process.env.EBAY_AUTH_TOKEN || await getEbayToken();
    
    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Failed to obtain eBay token',
        details: 'Could not authenticate with eBay API',
        suggestion: 'Check your EBAY_APP_ID and EBAY_CERT_ID in .env file'
      });
    }
    
    // Test the token with eBay Trading API call
    console.log('Testing token with eBay Trading API...');
    
    // Create XML request for GetMyeBaySelling
    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
    <GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
      <RequesterCredentials>
        <eBayAuthToken>${token}</eBayAuthToken>
      </RequesterCredentials>
      <ActiveList>
        <Include>true</Include>
        <Pagination>
          <EntriesPerPage>10</EntriesPerPage>
          <PageNumber>1</PageNumber>
        </Pagination>
      </ActiveList>
    </GetMyeBaySellingRequest>`;
    
    const response = await axios.post(
      `${getEbayApiBaseUrl()}/ws/api.dll`,
      xmlRequest,
      {
        headers: {
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-DEV-NAME': process.env.EBAY_DEV_ID,
          'X-EBAY-API-APP-NAME': process.env.EBAY_APP_ID,
          'X-EBAY-API-CERT-NAME': process.env.EBAY_CERT_ID,
          'X-EBAY-API-SITEID': '3', // UK site ID
          'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
          'Content-Type': 'text/xml'
        }
      }
    );
    
    console.log('eBay Trading API test successful');
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    return res.json({
      status: 'success',
      message: 'Successfully connected to eBay API',
      apiStatus: 'Working',
      environment: process.env.EBAY_ENV || 'Not set',
      tokenStatus: 'Valid',
      credentials: {
        appId: process.env.EBAY_APP_ID ? 'Configured' : 'Missing',
        certId: process.env.EBAY_CERT_ID ? 'Configured' : 'Missing',
        authToken: process.env.EBAY_AUTH_TOKEN ? 'Provided' : 'Generated'
      },
      response: {
        status: response.status,
        itemCount: response.data?.itemSummaries?.length || 0
      }
    });
    
  } catch (error) {
    console.error('eBay API test error:', error.message);
    console.error('Error details:', {
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to connect to eBay API',
      error: error.message,
      details: error.response?.data || 'No response details',
      suggestion: 'Check your credentials and internet connection'
    });
  }
});

app.get('/api/ebay/products', async (req, res) => {
  try {
    // Check if we have the required environment variables
    if (!process.env.EBAY_APP_ID || !process.env.EBAY_CERT_ID) {
      console.error('Missing required eBay API credentials');
      return res.status(500).json({
        status: 'error',
        message: 'Configuration Error',
        details: 'eBay API credentials are not properly configured',
        required: ['EBAY_APP_ID', 'EBAY_CERT_ID'],
        suggestion: 'Check your .env file and restart the server'
      });
    }

    console.log('Getting eBay token...');
    const token = await getEbayToken();
    
    if (!token) {
      console.error('Failed to get eBay token');
      return res.status(500).json({
        status: 'error',
        message: 'Failed to authenticate with eBay API',
        details: 'Could not obtain OAuth token',
        suggestion: 'Check your EBAY_APP_ID and EBAY_CERT_ID in .env file'
      });
    }

    console.log('Making request to eBay API...');
    console.log('Using token:', token.substring(0, 20) + '...');
    
    // First, try to get the user's seller ID if not already known
    console.log('Fetching user information...');
    let userInfo = { data: { username: 'ayz1x_yarn' } }; // Default user info
    
    try {
      // Try the production endpoint for user info
      const userResponse = await axios.get(
        `${getEbayApiBaseUrl()}/commerce/identity/v1/user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Language': 'en-GB',
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_GB'
          },
          timeout: 10000
        }
      );
      userInfo = userResponse;
      console.log('User info:', JSON.stringify(userInfo.data, null, 2));
    } catch (userError) {
    }

    console.log('Starting eBay API request...');
    console.log('Using hardcoded credentials from test-ebay.ps1');
    
    // Use the same approach as test-ebay.ps1
    const tradingHeaders = {
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-DEV-NAME': '',
      'X-EBAY-API-APP-NAME': 'AyazBhol-MeadowSk-PRD-7812b73f9-cd9598d9',
      'X-EBAY-API-CERT-NAME': 'PRD-812b73f99693-77aa-4a29-9014-f965',
      'X-EBAY-API-SITEID': '3',  // 3 = UK site
      'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
      'Content-Type': 'text/xml'
    };

    const entriesPerPage = 200;
    let pageNumber = 1;
    let items = [];
    let hasMore = true;
    let firstResponseSaved = false;

    while (hasMore) {
      // Use the same token as in test-ebay.ps1
      const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>v^1.1#i^1#f^0#r^1#p^3#I^3#t^Ul4xMF8xMToyODVCMEZGNUE3QTg2MjA3NDFGNUYzNjQyQ0IzQkZBQl8xXzEjRV4yNjA=</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>${pageNumber}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;

      console.log(`Sending request to eBay API (Page ${pageNumber})...`);
      console.log('Request Headers:', JSON.stringify(tradingHeaders, null, 2));
      console.log('Request Body:', requestBody.substring(0, 500) + '...');
      
      let resp;
      try {
        console.log('Sending request to eBay Trading API...');
        console.log('Request URL: https://api.ebay.com/ws/api.dll');
        console.log('Request Headers:', JSON.stringify(tradingHeaders, null, 2));
        
        resp = await axios.post('https://api.ebay.com/ws/api.dll', requestBody, { 
          headers: tradingHeaders, 
          timeout: 30000,
          responseType: 'text',
          transformResponse: [data => data]
        });
        
        console.log('Received response from eBay API');
        console.log('Response status:', resp.status);
        console.log('Response headers:', JSON.stringify(resp.headers, null, 2));
        console.log('Response data length:', resp.data.length);
        
        // Optionally save raw response for debugging if enabled
        const fs = require('fs');
        if (String(process.env.SAVE_EBAY_XML).toLowerCase() === 'true') {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `ebay_response_${timestamp}.xml`;
          fs.writeFileSync(filename, resp.data);
          console.log(`Raw response saved to ${filename}`);
          fs.writeFileSync('latest_ebay_response.xml', resp.data);
          console.log('Latest response also saved to latest_ebay_response.xml');
        }
      } catch (error) {
        console.error('Error making eBay API request:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response headers:', error.response.headers);
          console.error('Response data:', error.response.data);
        }
        throw error;
      }

      // Optionally save again (kept for backward compatibility) only if enabled
      const fs = require('fs');
      if (String(process.env.SAVE_EBAY_XML).toLowerCase() === 'true') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `ebay_response_${timestamp}.xml`;
        fs.writeFileSync(filename, resp.data);
        console.log(`Raw response saved to ${filename}`);
        fs.writeFileSync('latest_ebay_response.xml', resp.data);
        console.log('Latest response also saved to latest_ebay_response.xml');
      }

      // Parse XML response using xml2js with simpler configuration
      let parsed;
      let currentPageItems = [];
      let currentHasMore = false;
      
      try {
        // Use simpler configuration
        parsed = await parser.parseStringPromise(resp.data, {
          explicitArray: false,  // Don't force arrays for single elements
          mergeAttrs: true,      // Merge attributes as properties
          explicitRoot: false,   // Don't include the root element
          ignoreAttrs: false,    // Include attributes in the result
          trim: true,            // Trim whitespace
          normalize: true,       // Trim whitespace inside text nodes
          normalizeTags: true,   // Normalize all tags to lowercase
          emptyTag: null,        // Handle empty tags as null
          explicitChildren: true // Include child elements
        });
        
        console.log('Successfully parsed XML response');
        
        // Optionally save parsed response for debugging
        if (String(process.env.SAVE_EBAY_XML).toLowerCase() === 'true') {
          const fs = require('fs');
          fs.writeFileSync('ebay_parsed_response.json', JSON.stringify(parsed, null, 2));
          console.log('Parsed response saved to ebay_parsed_response.json');
        }
        
        // Debug: Log the structure of the parsed data
        console.log('Parsed data keys:', Object.keys(parsed));
        
        // Extract items from the parsed XML - handle different possible response structures
        const response = parsed?.GetMyeBaySellingResponse || {};
        const activeList = response.ActiveList || {};
        const itemArray = activeList.ItemArray || {};
        
        if (itemArray.Item) {
          // Convert single item to array if needed
          currentPageItems = Array.isArray(itemArray.Item) 
            ? itemArray.Item 
            : [itemArray.Item];
          
          console.log(`Found ${currentPageItems.length} items in the response`);
          
          // Process items to extract needed fields (flattened)
          currentPageItems = currentPageItems.map(item => {
            const rawPrice = item.SellingStatus?.CurrentPrice;
            const priceStr = typeof rawPrice === 'object' ? (rawPrice._ ?? rawPrice['#text']) : rawPrice;
            const priceValue = parseFloat(priceStr) || 0;
            const currency = (rawPrice?.$?.currencyID) || rawPrice?.currencyID || 'GBP';
            const id = item.ItemID;
            const title = item.Title;
            // Prefer PictureURL (often higher res); fallback to GalleryURL
            let image = undefined;
            const pic = item.PictureDetails;
            if (pic?.PictureURL) {
              if (Array.isArray(pic.PictureURL)) image = pic.PictureURL[0];
              else image = pic.PictureURL;
            }
            if (!image) image = pic?.GalleryURL;
            // Try to upscale eBay CDN thumbnails to higher res
            let imageLarge = image;
            try {
              if (typeof image === 'string' && image.includes('i.ebayimg.com')) {
                imageLarge = image.replace(/s-l\d+\.(jpg|jpeg|png|webp)/i, 's-l800.$1');
              }
            } catch (_) {}
            const url = item.ListingDetails?.ViewItemURL || (id ? `https://www.ebay.co.uk/itm/${id}` : undefined);
            const quantity = item.Quantity || '0';
            return {
              id,
              title,
              price: priceStr ? priceStr : '0.00',
              priceValue,
              currency,
              image,
              imageLarge,
              url,
              quantity
            };
          });
          
          items = items.concat(currentPageItems);
          
          // Log the first item for verification
          if (currentPageItems.length > 0) {
            console.log('First item ID:', currentPageItems[0].id);
            console.log('First item title:', currentPageItems[0].title);
            console.log('First item price:', currentPageItems[0].price, currentPageItems[0].currency);
          }
        } else {
          console.log('No items found in the response. ItemArray:', JSON.stringify(itemArray, null, 2));
        }
        
        // Check if there are more pages
        const pagination = activeList.PaginationResult || {};
        const totalPages = pagination.TotalNumberOfPages;
        
        if (totalPages) {
          currentHasMore = parseInt(totalPages, 10) > pageNumber;
          console.log(`Pagination: Page ${pageNumber} of ${totalPages}, hasMore: ${currentHasMore}`);
        }
        
      } catch (e) {
        console.error('Failed to parse Trading API XML:', e);
        console.error('Raw response start:', resp.data.substring(0, 500) + '...');
        throw e;
      }
      
      console.log(`Page ${pageNumber}: Found ${currentPageItems.length} items, hasMore: ${currentHasMore}`);
      hasMore = currentHasMore;
      
      pageNumber += 1;
      
      // Safety check to prevent infinite loops
      if (pageNumber > 20) {
        console.warn('Reached maximum page limit (20), stopping pagination');
        break;
      }
    }

    console.log(`Collected ${items.length} items from Trading API`);
    
    console.log(`Found ${items.length} listings`);
    if (items.length > 0) {
      console.log('First item:', JSON.stringify(items[0], null, 2));
    }
    
    // Items are already flattened above; use them directly
    const products = items;

    console.log(`Returning ${products.length} products`);
    
    return res.json({
      status: 'success',
      itemCount: products.length,
      items: products,
      userInfo: userInfo.data
    });
  } catch (error) {
    console.error('Error fetching eBay products:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });

    // Handle error response
    let errorMessage = error.message;
    let errorDetails = error.response?.data;
    
    // If we have a response with error details
    if (error.response?.data) {
      try {
        // If it's a string, try to parse it as XML or JSON
        if (typeof error.response.data === 'string') {
          if (error.response.data.includes('<errorMessage>')) {
            const errorMatch = error.response.data.match(/<errorMessage>(.*?)<\/errorMessage>/);
            if (errorMatch) {
              errorMessage = errorMatch[1];
            }
          } else {
            // Try to parse as JSON
            try {
              const errorJson = JSON.parse(error.response.data);
              errorMessage = errorJson.errorMessage?.[0]?.error?.[0]?.message?.[0] || 
                            errorJson.errorMessage?.[0]?.error?.[0]?.longMessage?.[0] ||
                            JSON.stringify(errorJson);
              errorDetails = errorJson;
            } catch (e) {
              // If not JSON, use the raw string
              errorMessage = error.response.data;
            }
          }
        }
        // If it's already an object
        else if (typeof error.response.data === 'object') {
          errorMessage = error.response.data.errorMessage?.[0]?.error?.[0]?.message?.[0] ||
                        error.response.data.errorMessage?.[0]?.error?.[0]?.longMessage?.[0] ||
                        error.response.data.errorMessage ||
                        JSON.stringify(error.response.data);
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
    }

    return res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Failed to fetch eBay listings',
      details: errorMessage,
      errorCode: error.response?.status,
      timestamp: new Date().toISOString(),
      headers: error.response?.headers
    });
  }
});

app.get('/api/products', async (req, res) => {
    const { platform, category, search } = req.query;
    
    // If eBay is selected, fetch from eBay API
    if (platform === 'eBay') {
      try {
        const response = await axios.get('http://localhost:3000/api/ebay/products');
        let products = response.data;
        
        // Apply filters if any
        if (category) {
          products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
        }
        if (search) {
          const searchLower = search.toLowerCase();
          products = products.filter(p => 
            p.title.toLowerCase().includes(searchLower) ||
            p.description.toLowerCase().includes(searchLower)
          );
        }
        
        return res.json(products);
      } catch (error) {
        console.error('Error fetching from eBay:', error);
        // Fall back to mock data if API fails
        return res.json(mockProducts.ebay);
      }
    }
    
    // For other platforms, use mock data
    let products = [...mockProducts.tiktok];
    if (platform) {
      products = products.filter(p => p.platform.toLowerCase() === platform.toLowerCase());
    }

    // Apply filters
    if (platform && platform !== 'all') {
        products = products.filter(p => p.platform === platform);
    }

    if (category && category !== 'all') {
        products = products.filter(p => p.category === category);
    }

    if (search) {
        products = products.filter(p => 
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase())
        );
    }

    res.json({
        products,
        total: products.length
    });
});

app.get('/api/product/:id', (req, res) => {
    const id = req.params.id;
    const product = [...mockProducts.tiktok, ...mockProducts.ebay].find(p => p.id === id);
    if (product) {
        res.json(product);
    } else {
        res.status(404).json({ error: 'Product not found' });
    }
});

// HTML routes
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/products', (req, res) => {
    res.sendFile(path.join(__dirname, 'products.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'contact.html'));
});

// Checkout pages
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'checkout.html'));
});

app.get('/checkout-success', (req, res) => {
  // Simple success page; client can call /api/checkout/confirm to trigger email
  const sessionId = req.query.session_id || '';
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
  <html><head><meta charset="utf-8"><title>Order Successful</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px;">
    <h1>Thank you!</h1>
    <p>Your payment was successful. We are processing your order.</p>
    <div id="status">Confirming your order...</div>
    <script>
      const sid = ${JSON.stringify(sessionId)};
      if (sid) {
        fetch('/api/checkout/confirm?session_id=' + encodeURIComponent(sid))
          .then(r => r.json())
          .then(data => {
            document.getElementById('status').textContent = data.message || 'Order confirmed.';
            // Clear local cart on success
            try { localStorage.removeItem('cart'); } catch (e) {}
          })
          .catch(() => {
            document.getElementById('status').textContent = 'Order confirmed (email pending).';
          });
      } else {
        document.getElementById('status').textContent = 'Order ID missing.';
      }
    </script>
  </body></html>`);
});

// Create Stripe Checkout session
app.post('/api/checkout/create-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ status: 'error', message: 'Stripe not configured. Set STRIPE_SECRET_KEY.' });
    }
    const { cart = [], email, remarks } = req.body || {};
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Cart is empty.' });
    }
    // Build line items from cart
    const line_items = cart.map(item => {
      const currency = (item.currency || 'GBP').toLowerCase();
      // Stripe expects integer amount in smallest currency unit
      const unit_amount = Math.round(Number(item.priceValue || 0) * 100);
      return {
        price_data: {
          currency,
          product_data: { name: item.title || `Item ${item.id}`, images: item.image ? [item.image] : undefined },
          unit_amount: unit_amount > 0 ? unit_amount : 0,
        },
        quantity: Number(item.qty || 1)
      };
    });
    const successUrl = `${req.protocol}://${req.get('host')}/checkout-success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${req.protocol}://${req.get('host')}/checkout`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        remarks: remarks || '',
        items: JSON.stringify(cart.slice(0, 50)) // limit size
      }
    });
    return res.json({ status: 'success', id: session.id, url: session.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Confirm order and send email
app.get('/api/checkout/confirm', async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ status: 'error', message: 'Stripe not configured' });
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ status: 'error', message: 'session_id required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // Optionally ensure payment is paid
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ status: 'error', message: 'Payment not completed yet' });
    }
    // List line items for email detail
    const items = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });

    // Send email if mailTransporter configured
    if (mailTransporter && process.env.ORDER_NOTIFY_EMAIL) {
      const to = process.env.ORDER_NOTIFY_EMAIL;
      const buyer = session.customer_details?.email || session.customer_email || 'unknown';
      const remarks = session.metadata?.remarks || '';
      const list = items.data.map(li => `- ${li.description} x ${li.quantity} @ ${(li.amount_total/100).toFixed(2)} ${(session.currency || 'gbp').toUpperCase()}`).join('\n');
      const body = `New Order Received\n\nBuyer: ${buyer}\nSession: ${session.id}\nTotal: ${(session.amount_total/100).toFixed(2)} ${(session.currency || 'gbp').toUpperCase()}\n\nItems:\n${list}\n\nRemarks:\n${remarks}`;
      await mailTransporter.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to,
        subject: `New Order - ${buyer}`,
        text: body
      });
    }
    return res.json({ status: 'success', message: 'Order confirmed. Confirmation sent.' });
  } catch (err) {
    console.error('Error confirming order:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Fallback route
app.get('*', (req, res) => {
    res.status(404).send('404 - Page Not Found');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Products page: http://localhost:${PORT}/products`);
});
