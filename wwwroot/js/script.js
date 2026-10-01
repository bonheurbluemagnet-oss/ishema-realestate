/**
 * ISHEMA REAL ESTATE - Production Connected JavaScript Application
 * Connects directly to Node.js / ASP.NET Core Database API
 */

const ISHEMA = (() => {
  const USD_RATE = 1350;
  let currentCurrency = localStorage.getItem('ishema_currency') || 'RWF';
  let currentUser = null;

  // Format Price Helper
  function formatPrice(amount, status, originalCurrency = 'RWF') {
    const isRent = status === 'rent';
    const rentSuffix = isRent ? '/month' : '';
    const numericAmount = Number(amount) || 0;

    if (currentCurrency === 'USD') {
      const usdVal = originalCurrency === 'USD' ? numericAmount : Math.round(numericAmount / USD_RATE);
      const rwfVal = originalCurrency === 'USD' ? Math.round(numericAmount * USD_RATE) : numericAmount;
      return `$${usdVal.toLocaleString()}${rentSuffix} <span class="property-price-usd">(${rwfVal.toLocaleString()} RWF)</span>`;
    }

    // Default RWF display
    const rwfVal = originalCurrency === 'USD' ? Math.round(numericAmount * USD_RATE) : numericAmount;
    return `${rwfVal.toLocaleString()} RWF${rentSuffix}`;
  }

  // Fetch properties from database API
  async function fetchProperties(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.set(key, params[key]);
      }
    });

    try {
      const token = localStorage.getItem('ishema_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/properties?${query.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        return data.properties || [];
      }
    } catch (err) {
      console.error('Failed to fetch properties from database API:', err);
    }
    return [];
  }

  // Fetch single property by ID from database API
  async function fetchPropertyById(id) {
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        return data.property || null;
      }
    } catch (err) {
      console.error('Failed to fetch property details:', err);
    }
    return null;
  }

  // Favorite Management (Sync with DB if authenticated)
  function getFavorites() {
    return JSON.parse(localStorage.getItem('ishema_favorites') || '[]');
  }

  async function toggleFavorite(id) {
    let favs = getFavorites();
    const token = localStorage.getItem('ishema_token');
    let isNowFav = false;

    if (token) {
      try {
        const res = await fetch(`/api/favorites/${id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        isNowFav = data.favorited;
      } catch (e) {}
    }

    // Update local cache as well
    const idx = favs.indexOf(id);
    if (idx === -1) {
      favs.push(id);
      isNowFav = true;
    } else {
      favs.splice(idx, 1);
      isNowFav = false;
    }
    localStorage.setItem('ishema_favorites', JSON.stringify(favs));
    updateFavBadges();
    showToast(isNowFav ? "Property saved to your favorites." : "Property removed from favorites.");
    return isNowFav;
  }

  function updateFavBadges() {
    const count = getFavorites().length;
    document.querySelectorAll('.fav-badge-count').forEach(el => {
      el.textContent = count;
    });
  }

  // Toast Notification
  function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span> <div>${message}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Render a Single Property Card HTML from real database entity
  function renderCard(prop) {
    const favs = getFavorites();
    const isFav = favs.includes(prop.id);
    const isLand = prop.type === "Land";
    const cover = prop.cover_image || (prop.images && prop.images[0] ? prop.images[0].url : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80');
    const locationDisplay = `${prop.district ? prop.district + ', ' : ''}${prop.province || 'Rwanda'}`;

    return `
      <div class="property-card" data-id="${prop.id}">
        <div class="property-img-wrap">
          <img src="${cover}" alt="${prop.title}" class="property-img" loading="lazy">
          <div class="badge-stack-left">
            <span class="badge-tag ${prop.status === 'sale' ? 'badge-sale' : 'badge-rent'}">
              For ${prop.status === 'sale' ? 'Sale' : 'Rent'}
            </span>
            <span class="badge-tag badge-type">${prop.type}</span>
            ${prop.published ? '<span class="badge-tag badge-verified">✓ Verified</span>' : '<span class="badge-tag badge-rent">Draft</span>'}
            ${prop.video ? '<span class="badge-tag" style="background:#dc2626; color:#fff;">🎬 Video Tour</span>' : ''}
          </div>
          <button class="fav-card-btn ${isFav ? 'favorited' : ''}" onclick="ISHEMA.toggleFavorite('${prop.id}'); this.classList.toggle('favorited');" title="Save property">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        ${isLand ? `
          <div class="land-card-banner">
            <span>Land Size: <strong>${prop.land_size || prop.size} m²</strong></span>
            <span>Location: <strong>${prop.district}</strong></span>
          </div>
        ` : ''}
        <div class="property-body">
          <div class="property-location">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span>${prop.address ? `${prop.address}, ` : ''}${locationDisplay}</span>
          </div>
          <h3 class="property-title">
            <a href="property.html?id=${prop.id}">${prop.title}</a>
          </h3>
          <div class="property-price-box">
            <span class="property-price">${formatPrice(prop.price, prop.status, prop.currency)}</span>
          </div>
          <div class="property-features">
            ${isLand ? `
              <div class="feature-pill"><strong>${prop.land_size || prop.size} m²</strong> Plot</div>
              <div class="feature-pill"><strong>Registered Title</strong></div>
              <div class="feature-pill"><strong>Utilities Available</strong></div>
            ` : `
              <div class="feature-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M21 7H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2z"/><path d="M7 11v6"/></svg>
                <span>${prop.bedrooms || 0} Beds</span>
              </div>
              <div class="feature-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6v6m6-6v6m-9-3h12a3 3 0 0 1 3 3v5H3v-5a3 3 0 0 1 3-3z"/></svg>
                <span>${prop.bathrooms || 0} Baths</span>
              </div>
              <div class="feature-pill">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                <span>${prop.size || prop.land_size || 0} m²</span>
              </div>
            `}
          </div>
          <div class="property-footer">
            <div class="agent-mini">
              <img src="${(prop.user && prop.user.photo_url) || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=120&q=80'}" class="agent-mini-img">
              <span class="agent-mini-name">${(prop.user && prop.user.name) || 'Ishema Certified Agent'}</span>
            </div>
            <a href="property.html?id=${prop.id}" class="btn btn-outline btn-sm">View Details</a>
          </div>
        </div>
      </div>
    `;
  }

  // Setup Currency Switcher
  function setupCurrency() {
    document.querySelectorAll('.currency-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.currency === currentCurrency);
      btn.addEventListener('click', (e) => {
        currentCurrency = e.target.dataset.currency;
        localStorage.setItem('ishema_currency', currentCurrency);
        document.querySelectorAll('.currency-btn').forEach(b => b.classList.toggle('active', b.dataset.currency === currentCurrency));
        if (window.refreshListings) {
          window.refreshListings();
        }
      });
    });
  }

  // Mobile Menu
  function setupMobileMenu() {
    const btn = document.getElementById('hamburger-btn');
    const menu = document.getElementById('nav-links');
    if (btn && menu) {
      btn.addEventListener('click', () => {
        menu.classList.toggle('active');
      });
    }
  }

  // Check Current Authenticated Session & Update Top Nav
  async function checkCurrentUser() {
    const token = localStorage.getItem('ishema_token');
    const authActions = document.getElementById('header-auth-actions');
    if (!token) {
      if (authActions) {
        authActions.innerHTML = `
          <a href="account.html" class="btn btn-outline btn-sm">Login</a>
          <a href="account.html" class="btn btn-primary btn-sm">Register</a>
          <a href="admin.html" class="btn btn-accent btn-sm">Admin Portal</a>
        `;
      }
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        if (authActions) {
          const isAdmin = currentUser.role === 'admin';
          authActions.innerHTML = `
            ${isAdmin ? '<a href="admin.html" class="btn btn-accent btn-sm" style="font-weight:700;">⚙️ Admin Dashboard</a>' : ''}
            <a href="account.html" class="btn btn-outline btn-sm">👤 ${currentUser.name.split(' ')[0]}</a>
            <button class="btn btn-sm" onclick="ISHEMA.logout()" style="background:var(--bg-subtle);">Logout</button>
          `;
        }
      } else {
        localStorage.removeItem('ishema_token');
      }
    } catch (e) {}
  }

  function logout() {
    const token = localStorage.getItem('ishema_token');
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    localStorage.removeItem('ishema_token');
    currentUser = null;
    showToast("You have been logged out.");
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  // Theme Management (Dark Mode / Light Mode)
  function getPreferredTheme() {
    const saved = localStorage.getItem('ishema_theme');
    if (saved) return saved;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }

  let currentTheme = getPreferredTheme();

  function applyTheme(theme, notify = false) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ishema_theme', theme);

    // Update Quick Theme button in top bar
    document.querySelectorAll('.theme-quick-icon').forEach(el => {
      el.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
    document.querySelectorAll('.theme-quick-text').forEach(el => {
      el.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });

    // Update Theme Toggle button in navbar
    document.querySelectorAll('.theme-toggle-label').forEach(el => {
      el.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.classList.toggle('active', theme === 'dark');
    });

    if (notify) {
      showToast(theme === 'dark' ? "Dark mode activated 🌙" : "Light mode activated ☀️");
    }
  }

  function toggleTheme() {
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
    return nextTheme;
  }

  function setupTheme() {
    applyTheme(currentTheme, false);

    // Listen to OS preference change if user hasn't explicitly set a preference
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('ishema_theme')) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }

    // Attach click handlers to any .theme-toggle-btn or .theme-quick-btn
    document.querySelectorAll('.theme-toggle-btn, .theme-quick-btn').forEach(btn => {
      if (!btn.dataset.themeBound) {
        btn.dataset.themeBound = 'true';
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          toggleTheme();
        });
      }
    });
  }

  return {
    fetchProperties,
    fetchPropertyById,
    formatPrice,
    toggleFavorite,
    getFavorites,
    updateFavBadges,
    showToast,
    renderCard,
    setupCurrency,
    setupMobileMenu,
    checkCurrentUser,
    logout,
    setupTheme,
    toggleTheme,
    applyTheme,
    getTheme: () => currentTheme,
    USD_RATE
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  ISHEMA.setupTheme();
  ISHEMA.setupCurrency();
  ISHEMA.setupMobileMenu();
  ISHEMA.updateFavBadges();
  ISHEMA.checkCurrentUser();
});
