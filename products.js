// API configuration
const API_CONFIG = {
    baseUrl: 'http://localhost:3000/api',
    endpoints: {
        products: '/ebay/products',
        product: '/product/:id'
    }
};

// --- Simple client-side cart (localStorage) ---
function getCart() {
    try {
        return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(item, qty = 1) {
    const cart = getCart();
    const idx = cart.findIndex(x => x.id === item.id);
    if (idx >= 0) {
        cart[idx].qty = (cart[idx].qty || 1) + Number(qty || 1);
    } else {
        cart.push({ ...item, qty: Math.max(1, Number(qty || 1)) });
    }
    saveCart(cart);
    // Simple feedback
    try {
        const name = item.title?.slice(0, 80) || 'Item';
        console.log(`Added to cart: ${name}`);
        updateCartCount();
        bumpCart();
    } catch {}
}


// Current state
let currentPage = 1;
const itemsPerPage = 12;
let totalItems = 0;

// DOM Elements
const productGrid = document.getElementById('productGrid');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const loader = document.getElementById('loader');

// --- Cart UI helpers (badge + animations) ---
function getCartCount() {
    try {
        return getCart().reduce((sum, it) => sum + Number(it.qty || 1), 0);
    } catch {
        return 0;
    }
}

function updateCartCount() {
    const badge = document.getElementById('cart-count');
    if (!badge) return;
    const count = getCartCount();
    badge.textContent = String(count);
    badge.style.display = count > 0 ? 'inline-block' : 'none';
}

function bumpCart() {
    const link = document.getElementById('nav-cart');
    if (!link) return;
    link.classList.remove('bump');
    // force reflow to restart animation
    // eslint-disable-next-line no-unused-expressions
    void link.offsetWidth;
    link.classList.add('bump');
    setTimeout(() => link.classList.remove('bump'), 500);
}

function showAddBubble(evt) {
    try {
        const bubble = document.createElement('div');
        bubble.className = 'add-bubble';
        bubble.textContent = '+1';
        const x = evt.clientX;
        const y = evt.clientY;
        bubble.style.left = x + 'px';
        bubble.style.top = y + 'px';
        document.body.appendChild(bubble);
        // trigger animation
        requestAnimationFrame(() => {
            bubble.style.opacity = '1';
            bubble.style.transform = 'translateY(-24px)';
        });
        setTimeout(() => {
            bubble.style.opacity = '0';
            bubble.style.transform = 'translateY(-40px)';
        }, 350);
        setTimeout(() => bubble.remove(), 900);
    } catch {}
}

// Tiny firework effect at position
function fireworkAt(x, y) {
    try {
        const colors = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f72585'];
        const particles = 10;
        for (let i = 0; i < particles; i++) {
            const p = document.createElement('div');
            p.className = 'fw-particle';
            const angle = (Math.PI * 2 * i) / particles + Math.random() * 0.6;
            const dist = 24 + Math.random() * 16;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            p.style.setProperty('--x', dx + 'px');
            p.style.setProperty('--y', dy + 'px');
            p.style.color = colors[i % colors.length];
            document.body.appendChild(p);
            // cleanup
            setTimeout(() => p.remove(), 650);
        }
    } catch {}
}

// Pagination event listeners
if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateProducts();
        }
    });
}

if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updateProducts();
        }
    });
}

// Product template
function createProductCard(product) {
    // Use a simple SVG placeholder as fallback for missing images
    const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMDAgMzAwIiBzdHlsZT0iYmFja2dyb3VuZC1jb2xvcjojZjVmNWY1OyI+CiAgPHRleHQgeD0iMTUwIiB5PSIxNTAiIGZvbnQtZmFtaWx5PUFyaWFsIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0PgogIDxsaW5lIHgxPSI1MCIgeTE9IjUwIiB4Mj0iMjUwIiB5Mj0iMjUwIiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIvPgogIDxsaW5lIHgxPSIyNTAiIHkxPSI1MCIgeDI9IjUwIiB5Mj0iMjUwIiBzdHJva2U9IiNkZGQiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4=';
    
    // Determine price text without duplicating currency symbols
    const priceText = (() => {
        // If server already formatted price like "£19.99" use it
        if (typeof product.price === 'string' && /[£$€]/.test(product.price)) return product.price;
        // Build from numeric value + currency
        if (product.priceValue != null) {
            const cur = (product.currency || 'GBP');
            const sym = cur === 'GBP' ? '£' : cur;
            const val = Number(product.priceValue);
            if (!Number.isNaN(val)) return `${sym}${val.toFixed(2)}`;
        }
        // Fallbacks
        if (product.price) return String(product.price);
        return 'Price on request';
    })();
    
    return `
        <div class="product-card" data-platform="ebay">
            <div class="product-image-container" style="background-color: #f5f5f5; padding-bottom: 100%; position: relative; overflow: hidden;">
                <img 
                    src="${product.imageLarge || product.image || placeholderImage}" 
                    alt="${product.title}" 
                    class="product-image" 
                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;"
                    loading="lazy"
                    onerror="this.onerror=null; this.src='${placeholderImage}'; this.style.opacity='0.9'"
                >
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.title}</h3>
                <p class="product-price">${priceText}</p>
                <div class="product-actions">
                  <div class="qty-controls">
                    <button type="button" class="qty-btn qty-decrease" aria-label="Decrease quantity">−</button>
                    <input type="number" class="qty-input" min="1" value="1" aria-label="Quantity" />
                    <button type="button" class="qty-btn qty-increase" aria-label="Increase quantity">+</button>
                  </div>
                  <button 
                      class="add-to-cart" 
                      data-id="${product.id}"
                      data-title="${product.title.replace(/"/g, '&quot;')}"
                      data-pricevalue="${product.priceValue ?? ''}"
                      data-currency="${product.currency || 'GBP'}"
                      data-image="${(product.imageLarge || product.image || '').replace(/"/g, '&quot;')}"
                      data-url="${(product.url || '').replace(/"/g, '&quot;')}"
                      aria-label="Add ${product.title} to cart"
                  >
                      <i class="fas fa-cart-plus" aria-hidden="true"></i>
                      <span>Add to Cart</span>
                  </button>
                </div>
            </div>
        </div>
    `;
}

// Fetch products from API
async function fetchProducts() {
    try {
        const response = await fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.products}`);
        const data = await response.json();
        // Support multiple shapes: {items: [...]}, [...] or {products: [...]}
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.items)) return data.items;
        if (Array.isArray(data?.products)) return data.products;
        return [];
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// Update products display
async function updateProducts() {
    // Show loader and disable pagination while loading
    if (loader) loader.style.display = 'block';
    if (productGrid) productGrid.innerHTML = '';
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    try {
        const products = await fetchProducts();
        totalItems = products.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        // Update pagination info
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1 || totalPages <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages || totalPages <= 1;
        
        // Show all products on current page
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageProducts = products.slice(start, end);
        
        // Render products
        productGrid.innerHTML = products.length > 0 
            ? pageProducts.map(createProductCard).join('')
            : '<p>No products found. Please check back later.</p>';
    } catch (error) {
        console.error('Error updating products:', error);
        productGrid.innerHTML = '<p>Error loading products. Please try again later.</p>';
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
    updateProducts();
    // Event delegation for Add to Cart buttons
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            const target = e.target;
            const card = target.closest('.product-card');
            if (!card) return;

            // Handle quantity +/-
            if (target.closest('.qty-decrease')) {
                const input = card.querySelector('.qty-input');
                if (input) input.value = String(Math.max(1, Number(input.value || 1) - 1));
                return;
            }
            if (target.closest('.qty-increase')) {
                const input = card.querySelector('.qty-input');
                if (input) input.value = String(Math.max(1, Number(input.value || 1) + 1));
                return;
            }

            // Handle add to cart
            const btn = target.closest('.add-to-cart');
            if (!btn) return;
            const qtyInput = card.querySelector('.qty-input');
            const qty = qtyInput ? Math.max(1, Number(qtyInput.value || 1)) : 1;
            const item = {
                id: btn.dataset.id,
                title: btn.dataset.title,
                priceValue: btn.dataset.pricevalue ? Number(btn.dataset.pricevalue) : undefined,
                currency: btn.dataset.currency || 'GBP',
                image: btn.dataset.image,
                url: btn.dataset.url
            };
            addToCart(item, qty);
            showAddBubble(e);
            fireworkAt(e.clientX, e.clientY);
        });
    }
});
