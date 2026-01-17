// DOM Elements
const app = document.getElementById('app');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');
const logoContainer = document.getElementById('logo-container');
const amountGrid = document.getElementById('amount-grid');
const customAmountInput = document.getElementById('custom-amount-input');
const currencyLabel = document.getElementById('currency-label');
const donorName = document.getElementById('donor-name');
const donorMessage = document.getElementById('donor-message');
const donateBtn = document.getElementById('donate-btn');
const donateBtnText = document.getElementById('donate-btn-text');
const donationForm = document.getElementById('donation-form');
const paymentView = document.getElementById('payment-view');
const successView = document.getElementById('success-view');
const qrCode = document.getElementById('qr-code');
const invoiceAmount = document.getElementById('invoice-amount');
const invoiceCurrency = document.getElementById('invoice-currency');
const copyInvoiceBtn = document.getElementById('copy-invoice-btn');
const cancelBtn = document.getElementById('cancel-btn');
const successMessage = document.getElementById('success-message');
const successAmount = document.getElementById('success-amount');
const donateAgainBtn = document.getElementById('donate-again-btn');
const donationsList = document.getElementById('donations-list');
const networkLabel = document.getElementById('network-label');

// BOLT12 elements
const bolt12Option = document.getElementById('bolt12-option');
const showBolt12Btn = document.getElementById('show-bolt12-btn');
const bolt12View = document.getElementById('bolt12-view');
const bolt12QrCode = document.getElementById('bolt12-qr-code');
const copyBolt12Btn = document.getElementById('copy-bolt12-btn');
const backToFormBtn = document.getElementById('back-to-form-btn');

// State
let config = null;
let selectedAmount = 0;
let currentInvoice = null;
let pollInterval = null;

// Initialize
async function init() {
  try {
    // Load config
    const response = await fetch('/api/config');
    config = await response.json();
    
    // Apply theme
    if (config.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    // Set page content
    pageTitle.textContent = config.title;
    pageSubtitle.textContent = config.subtitle;
    document.title = config.title + ' - Donations';
    
    // Set logo if configured
    if (config.logo) {
      logoContainer.innerHTML = `<img src="${config.logo}" alt="Logo" />`;
    }
    
    // Set network badge
    networkLabel.textContent = config.chain;
    
    // Set currency label
    currencyLabel.textContent = config.currency;
    
    // Generate amount buttons
    renderAmountButtons();
    
    // Setup BOLT12 if available
    if (config.bolt12) {
      bolt12Option.classList.remove('hidden');
      bolt12QrCode.innerHTML = `<img src="${config.bolt12.qrCode}" alt="BOLT12 Offer QR" />`;
    }
    
    // Load recent donations
    loadRecentDonations();
    
    // Setup event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Failed to initialize:', error);
    showToast('Failed to load configuration', 'error');
  }
}

function renderAmountButtons() {
  amountGrid.innerHTML = config.suggestedAmounts.map(amount => `
    <button class="amount-btn" data-amount="${amount}">
      <span class="amount-value">${formatNumber(amount)}</span>
      <span class="amount-label">${config.currency}</span>
    </button>
  `).join('');
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

function setupEventListeners() {
  // Amount button clicks
  amountGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.amount-btn');
    if (!btn) return;
    
    // Remove selected from all
    amountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
    
    // Select this one
    btn.classList.add('selected');
    selectedAmount = parseInt(btn.dataset.amount);
    customAmountInput.value = '';
    updateDonateButton();
  });
  
  // Custom amount input
  customAmountInput.addEventListener('input', () => {
    const value = parseInt(customAmountInput.value) || 0;
    selectedAmount = value;
    
    // Deselect buttons
    amountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
    
    updateDonateButton();
  });
  
  // Donate button
  donateBtn.addEventListener('click', createDonation);
  
  // Copy invoice
  copyInvoiceBtn.addEventListener('click', copyInvoice);
  
  // Cancel
  cancelBtn.addEventListener('click', cancelPayment);
  
  // Donate again
  donateAgainBtn.addEventListener('click', resetForm);
  
  // BOLT12 events
  showBolt12Btn.addEventListener('click', showBolt12View);
  copyBolt12Btn.addEventListener('click', copyBolt12Offer);
  backToFormBtn.addEventListener('click', hideBolt12View);
}

function updateDonateButton() {
  if (selectedAmount > 0) {
    donateBtn.disabled = false;
    donateBtnText.textContent = `Donate ${formatNumber(selectedAmount)} ${config.currency}`;
  } else {
    donateBtn.disabled = true;
    donateBtnText.textContent = 'Select an amount';
  }
}

async function createDonation() {
  if (selectedAmount <= 0) return;
  
  donateBtn.disabled = true;
  donateBtnText.textContent = 'Creating invoice...';
  
  try {
    const response = await fetch('/api/donations/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSat: selectedAmount,
        donorName: donorName.value.trim() || undefined,
        message: donorMessage.value.trim() || undefined,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create invoice');
    }
    
    currentInvoice = await response.json();
    showPaymentView();
    startPolling();
  } catch (error) {
    console.error('Failed to create donation:', error);
    showToast(error.message, 'error');
    updateDonateButton();
  }
}

function showPaymentView() {
  donationForm.classList.add('hidden');
  paymentView.classList.remove('hidden');
  successView.classList.add('hidden');
  
  qrCode.innerHTML = `<img src="${currentInvoice.qrCode}" alt="QR Code" />`;
  invoiceAmount.textContent = formatNumber(currentInvoice.amountSat);
  invoiceCurrency.textContent = config.currency;
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/donations/status/${currentInvoice.paymentHash}`);
      const data = await response.json();
      
      if (data.status === 'paid') {
        stopPolling();
        showSuccessView();
        loadRecentDonations();
      } else if (data.status === 'expired') {
        stopPolling();
        showToast('Invoice expired. Please try again.', 'error');
        resetForm();
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 2000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function showSuccessView() {
  donationForm.classList.add('hidden');
  paymentView.classList.add('hidden');
  successView.classList.remove('hidden');
  
  successMessage.textContent = config.successMessage;
  successAmount.textContent = formatNumber(currentInvoice.amountSat);
}

async function copyInvoice() {
  if (!currentInvoice) return;
  
  try {
    await navigator.clipboard.writeText(currentInvoice.invoice);
    showToast('Invoice copied to clipboard!', 'success');
    copyInvoiceBtn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Copied!
    `;
    setTimeout(() => {
      copyInvoiceBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy Invoice
      `;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Failed to copy invoice', 'error');
  }
}

function cancelPayment() {
  stopPolling();
  resetForm();
}

function showBolt12View() {
  donationForm.classList.add('hidden');
  paymentView.classList.add('hidden');
  successView.classList.add('hidden');
  bolt12View.classList.remove('hidden');
}

function hideBolt12View() {
  bolt12View.classList.add('hidden');
  donationForm.classList.remove('hidden');
}

async function copyBolt12Offer() {
  if (!config.bolt12) return;
  
  try {
    await navigator.clipboard.writeText(config.bolt12.offer);
    showToast('BOLT12 offer copied to clipboard!', 'success');
    copyBolt12Btn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
      Copied!
    `;
    setTimeout(() => {
      copyBolt12Btn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy Offer
      `;
    }, 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
    showToast('Failed to copy offer', 'error');
  }
}

function resetForm() {
  currentInvoice = null;
  selectedAmount = 0;
  customAmountInput.value = '';
  donorName.value = '';
  donorMessage.value = '';
  
  amountGrid.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('selected'));
  
  donationForm.classList.remove('hidden');
  paymentView.classList.add('hidden');
  successView.classList.add('hidden');
  
  updateDonateButton();
}

async function loadRecentDonations() {
  try {
    const response = await fetch('/api/donations/recent');
    const donations = await response.json();
    
    if (donations.length === 0) {
      donationsList.innerHTML = '<p class="empty-state">No donations yet. Be the first!</p>';
      return;
    }
    
    donationsList.innerHTML = donations.map(donation => `
      <div class="donation-item">
        <div class="donation-avatar">${getInitials(donation.donorName)}</div>
        <div class="donation-content">
          <div class="donation-name">${escapeHtml(donation.donorName)}</div>
          ${donation.message ? `<div class="donation-message">${escapeHtml(donation.message)}</div>` : ''}
        </div>
        <div class="donation-amount">${formatNumber(donation.amountSat)} ${config?.currency || 'sats'}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load donations:', error);
  }
}

function getInitials(name) {
  if (!name || name === 'Anonymous') return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Start the app
init();
