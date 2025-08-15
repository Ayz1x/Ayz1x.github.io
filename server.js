const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();

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
app.use(express.static(__dirname, {
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// API routes (before catch-all routes)
app.get('/api/products', (req, res) => {
    const { platform, category, search } = req.query;
    let products = [...mockProducts.tiktok, ...mockProducts.ebay];

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

