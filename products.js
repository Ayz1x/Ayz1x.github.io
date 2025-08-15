// API configuration
const API_CONFIG = {
    baseUrl: 'http://localhost:3000/api',
    endpoints: {
        products: '/products',
        product: '/product/:id'
    }
};

// Current state
let currentPage = 1;
let itemsPerPage = 12;
let totalItems = 0;
let currentFilter = {
    platform: 'all',
    category: 'all'
};

// DOM Elements
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const platformFilter = document.getElementById('platformFilter');
const categoryFilter = document.getElementById('categoryFilter');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// Initialize filters
platformFilter.addEventListener('change', updateProducts);
categoryFilter.addEventListener('change', updateProducts);

// Search functionality
searchInput.addEventListener('input', debounce(updateProducts, 500));

// Pagination
prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        updateProducts();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        updateProducts();
    }
});

// Product template
function createProductCard(product) {
    return `
        <div class="product-card" data-platform="${product.platform}">
            <img src="${product.image}" alt="${product.title}" class="product-image">
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-price">${product.price}</p>
                <p class="product-platform">${product.platform}</p>
                <button class="view-details" onclick="viewProductDetails('${product.id}')">
                    View Details
                </button>
            </div>
        </div>
    `;
}

// Fetch products from API
async function fetchProducts() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.products}`);
        const data = await response.json();
        return data.products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// Update products display
async function updateProducts() {
    try {
        const response = await fetchProducts();
        const { products, total } = response;
        
        // Apply filters
        let filteredProducts = products;
        
        if (currentFilter.platform !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.platform === currentFilter.platform);
        }
        
        // Update pagination
        totalItems = filteredProducts.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        
        // Update page buttons state
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
        
        // Get current page products
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageProducts = filteredProducts.slice(start, end);
        
        // Render products
        productGrid.innerHTML = pageProducts.map(createProductCard).join('');
    } catch (error) {
        console.error('Error updating products:', error);
        productGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
    }
}

// Initialize
updateProducts();
