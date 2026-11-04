/**
 * Coffee & Cravings — Application Logic
 * Customer site: menu, cart, QR table ordering
 */

// =============================================================================
// CUSTOMER AUTHENTICATION (Clerk: Google, Phone OTP, Email)
// =============================================================================
let clerkInitialized = false;

async function initClerk() {
  if (typeof window.Clerk === 'undefined') return false;
  if (!clerkInitialized) {
    try {
      await window.Clerk.load();
      clerkInitialized = true;

      // Sync user on auth state change
      window.Clerk.addListener(async ({ user }) => {
        if (user) {
          const email = user.primaryEmailAddress ? user.primaryEmailAddress.emailAddress : '';
          const phone = user.primaryPhoneNumber ? user.primaryPhoneNumber.phoneNumber : '';
          const name = user.fullName || user.firstName || (email ? email.split('@')[0] : 'Customer');
          const photoUrl = user.imageUrl || '';

          await handleLoginSuccess({
            uid: user.id,
            email,
            phone,
            name,
            photoUrl
          });
        }
      });
    } catch (e) {
      console.warn('Clerk load error', e);
    }
  }
  return clerkInitialized;
}

async function checkCustomerSession() {
  try {
    const r = await fetch('/api/customer/session');
    if (r.ok) {
      const data = await r.json();
      if (data.loggedIn && data.user) {
        currentCustomerUser = data.user;
        if (data.user.phone && !customerPhone) {
          customerPhone = data.user.phone;
        }
        if (data.user.name && !customerName) {
          customerName = data.user.name;
        }
      } else {
        currentCustomerUser = null;
      }
    }
  } catch (e) {}
  updateCustomerHeaderUI();
}

function updateCustomerHeaderUI() {
  const nameEl = document.getElementById('customer-btn-name');
  const avatarEl = document.getElementById('customer-btn-avatar');
  const mobileLink = document.querySelector('#mobile-auth-item a');
  if (currentCustomerUser) {
    if (nameEl) {
      nameEl.style.display = 'inline';
      nameEl.textContent = currentCustomerUser.name ? currentCustomerUser.name.split(' ')[0] : 'Account';
    }
    if (avatarEl) {
      if (currentCustomerUser.photoUrl) {
        avatarEl.innerHTML = `<img src="${currentCustomerUser.photoUrl}" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" />`;
      } else {
        avatarEl.innerHTML = `<span style="font-weight:700; font-size:13px; color:#92400e;">${(currentCustomerUser.name || 'U')[0].toUpperCase()}</span>`;
      }
    }
    if (mobileLink) {
      mobileLink.textContent = `👤 ${currentCustomerUser.name || 'My Account'}`;
    }
  } else {
    if (nameEl) nameEl.style.display = 'none';
    if (avatarEl) {
      avatarEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    }
    if (mobileLink) {
      mobileLink.textContent = '👤 Sign In / Account';
    }
  }
}

function handleCustomerAccountClick() {
  openCustomerAuthModal();
}

async function openCustomerAuthModal() {
  if (typeof window.Clerk !== 'undefined') {
    await initClerk();
    if (window.Clerk.user) {
      window.Clerk.openUserProfile();
    } else {
      window.Clerk.openSignIn();
    }
  } else {
    showToast('Loading login… Please try again in a moment.', 'info');
  }
}

function closeCustomerAuthModal() {
  if (typeof window.Clerk !== 'undefined' && window.Clerk.closeSignIn) {
    window.Clerk.closeSignIn();
  }
}

function setAuthStatusMsg(msg, isError = false) {
  // Clerk handles UI status messages internally
}

async function handleLoginSuccess(payload) {
  try {
    const r = await fetch('/api/customer/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'Login failed.');
    }
    const data = await r.json();
    currentCustomerUser = data.user;
    if (data.user.phone) {
      customerPhone = data.user.phone;
      try { localStorage.setItem('cc_cust_phone', customerPhone); } catch (e) {}
    }
    if (data.user.name) {
      customerName = data.user.name;
      try { localStorage.setItem('cc_cust_name', customerName); } catch (e) {}
    }
    updateCustomerHeaderUI();
    showToast(`Welcome, ${currentCustomerUser.name || 'Friend'}!`, 'success');
    if (window._pendingCheckout) {
      window._pendingCheckout = false;
      setTimeout(() => {
        openCheckoutModal();
      }, 350);
    } else if (currentView === 'my-orders') {
      navigateTo('my-orders');
    }
  } catch (err) {
    console.error('Server error during sign in', err);
  }
}

async function logoutCustomer() {
  try {
    await fetch('/api/customer/session', { method: 'DELETE' });
    if (typeof window.Clerk !== 'undefined') {
      await window.Clerk.signOut();
    }
  } catch (e) {}
  currentCustomerUser = null;
  customerPhone = '';
  try { localStorage.removeItem('cc_cust_phone'); } catch (e) {}
  updateCustomerHeaderUI();
  showToast('You have been signed out.', 'success');
  if (currentView === 'my-orders') {
    navigateTo('my-orders');
  }
}

function reorderItems(itemsJson) {
  try {
    const items = typeof itemsJson === 'string' ? JSON.parse(decodeURIComponent(itemsJson)) : itemsJson;
    if (!Array.isArray(items) || !items.length) return;
    for (const it of items) {
      if (it.isFree) continue; // skip promotional freebies
      const existing = cart.find(c => c.id === it.id);
      if (existing) {
        existing.qty += it.qty;
      } else {
        cart.push({ id: it.id, qty: it.qty });
      }
    }
    saveCart();
    updateCartBadge();
    showToast('Items added to your cart!', 'success');
    navigateTo('order');
  } catch (e) {
    showToast('Could not reorder items.', 'error');
  }
}

// Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function handleContactSubmit(e) {
  e.preventDefault();
  showToast('Thank you! Your message has been sent to founder@coffeeandcravings.in', 'success');
  e.target.reset();
}

// =============================================================================
// 11. INITIALIZATION ON DOM READY
// =============================================================================
// Menu, prices and availability come from the server (owner edits show up instantly). menu-data.js is only the fallback.
async function loadLiveMenu() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 3000);
    const r = await fetch('/api/config', { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) return;
    const c = await r.json();
    gatewayOn = !!c.gateway;
    if (Array.isArray(c.menu)) MENU_ITEMS.splice(0, MENU_ITEMS.length, ...c.menu);
    if (Array.isArray(c.deals)) activeDeals = c.deals;
    const before = cart.length;
    cart = cart.filter(l => MENU_ITEMS.some(m => m.id === l.id)); // product removed/hidden meanwhile
    if (cart.length !== before) saveCart();
  } catch (e) { /* offline or slow: keep the built-in menu */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  initStorage();
  await checkCustomerSession();
  await loadLiveMenu();
  checkCookiesAccepted();
  updateCartBadge();

  // Scroll effect on header
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (header) {
      if (window.scrollY > 30) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  });

  // Determine starting route
  const hash = window.location.hash.replace('#', '') || 'home';
  navigateTo(hash);
});
