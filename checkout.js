// Render cart summary and handle checkout submission
(function() {
  function getCart() {
    try { return JSON.parse(localStorage.getItem('cart') || '[]'); } catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart || []));
  }

  // --- Cart badge helpers (mirror of products.js) ---
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

  function formatMoney(value, currency) {
    const cur = (currency || 'GBP').toUpperCase();
    const sym = cur === 'GBP' ? '£' : cur + ' ';
    const v = Number(value || 0);
    return `${sym}${v.toFixed(2)}`;
  }

  function renderCart() {
    const cartEl = document.getElementById('cartSummary');
    const cart = getCart();
    if (!cartEl) return;

    if (!cart.length) {
      cartEl.innerHTML = '<p>Your cart is empty. <a href="products.html">Go back to products</a>.</p>';
      updateCartCount();
      return;
    }

    const lines = cart.map(item => {
      const qty = Number(item.qty || 1);
      const price = Number(item.priceValue || 0);
      const lineTotal = qty * price;
      return `
        <div class="cart-line">
          <img src="${item.image || ''}" alt="${item.title || ''}" onerror="this.style.display='none'" />
          <div class="cart-line-info">
            <div class="title">${item.title || 'Item'}</div>
            <div class="unit-price">Unit: ${formatMoney(price, item.currency)}</div>
          </div>
          <div class="cart-line-right">
            <div class="line-total">Total: ${formatMoney(lineTotal, item.currency)}</div>
            <div class="line-controls">
              <div class="qty-controls" data-id="${item.id}">
                <button type="button" class="qty-btn qty-decrease" aria-label="Decrease quantity" data-id="${item.id}">−</button>
                <input type="number" class="qty-input" data-id="${item.id}" min="1" value="${qty}" />
                <button type="button" class="qty-btn qty-increase" aria-label="Increase quantity" data-id="${item.id}">+</button>
              </div>
              <button type="button" class="remove-item" data-id="${item.id}">Remove</button>
            </div>
          </div>
        </div>`;
    }).join('');

    const total = cart.reduce((sum, it) => sum + Number(it.priceValue || 0) * Number(it.qty || 1), 0);

    cartEl.innerHTML = `
      <h3 style="margin:0 0 8px;">Order Summary</h3>
      ${lines}
      <div class="order-total">
        <div class="value">Grand Total: ${formatMoney(total, cart[0]?.currency || 'GBP')}</div>
      </div>`;
    updateCartCount();
  }

  function updateItemQuantity(id, newQty) {
    const cart = getCart();
    const idx = cart.findIndex(it => String(it.id) === String(id));
    if (idx === -1) return;
    const qty = Math.max(1, Number(newQty || 1));
    cart[idx].qty = qty;
    saveCart(cart);
    renderCart();
    updateCartCount();
  }

  function removeItem(id) {
    const cart = getCart().filter(it => String(it.id) !== String(id));
    saveCart(cart);
    renderCart();
    updateCartCount();
  }

  async function createSession(payload) {
    const res = await fetch('/api/checkout/create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to create checkout session');
    }
    return res.json();
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCart();
    updateCartCount();
    // Keep badge in sync if cart changes in another tab
    window.addEventListener('storage', (e) => {
      if (e.key === 'cart') updateCartCount();
    });

    // Quantity and remove handlers via event delegation on cartSummary
    const cartEl = document.getElementById('cartSummary');
    if (cartEl) {
      cartEl.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.getAttribute('data-id');
        if (!id) return;

        if (target.classList.contains('qty-decrease')) {
          const cart = getCart();
          const item = cart.find(it => String(it.id) === String(id));
          const current = Math.max(1, Number(item?.qty || 1));
          updateItemQuantity(id, Math.max(1, current - 1));
        } else if (target.classList.contains('qty-increase')) {
          const cart = getCart();
          const item = cart.find(it => String(it.id) === String(id));
          const current = Math.max(1, Number(item?.qty || 1));
          updateItemQuantity(id, current + 1);
        } else if (target.classList.contains('remove-item')) {
          removeItem(id);
        }
      });

      cartEl.addEventListener('change', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.classList.contains('qty-input')) {
          const id = target.getAttribute('data-id');
          if (!id) return;
          const value = Number((target).value || 1);
          updateItemQuantity(id, value);
        }
      });
    }

    const form = document.getElementById('checkoutForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email')?.value?.trim();
        const remarks = document.getElementById('remarks')?.value?.trim();
        const cart = getCart();
        if (!cart.length) {
          alert('Your cart is empty.');
          return;
        }
        const btn = document.getElementById('payBtn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Redirecting...';
        }
        try {
          const { url } = await createSession({ cart, email, remarks });
          if (url) {
            window.location.href = url;
          } else {
            throw new Error('No checkout URL returned');
          }
        } catch (err) {
          console.error(err);
          alert('Failed to start checkout: ' + (err.message || err));
          if (btn) { btn.disabled = false; btn.textContent = 'Pay Now'; }
        }
      });
    }
  });
})();
