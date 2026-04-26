const LEGACY_ACCOUNT_KEY = 'userAccount';
const BILLING_STATE_KEY = 'simuImmoBillingState';

const DEFAULT_CONFIG = Object.freeze({
    enabled: false,
    provider: 'stripe',
    authProvider: 'supabase',
    planName: 'Investisseur Pro+',
    priceLabel: '9,99 EUR / mois',
    checkoutUrl: '',
    portalUrl: '',
    supportEmail: 'gegertauren@gmail.com',
    supabaseUrl: '',
    supabaseAnonKey: ''
});

const DEFAULT_STATE = Object.freeze({
    isPremium: false,
    subscriptionStatus: 'free',
    planName: DEFAULT_CONFIG.planName,
    priceLabel: DEFAULT_CONFIG.priceLabel,
    customerEmail: '',
    currentPeriodEnd: '',
    checkoutUrl: '',
    portalUrl: '',
    provider: DEFAULT_CONFIG.provider,
    authProvider: DEFAULT_CONFIG.authProvider,
    supportEmail: DEFAULT_CONFIG.supportEmail,
    source: 'local'
});

function readStoredJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (error) {
        return null;
    }
}

function normalizeStatus(raw = {}) {
    if (typeof raw.subscriptionStatus === 'string' && raw.subscriptionStatus.trim()) {
        return raw.subscriptionStatus.trim();
    }
    return raw.isPremium ? 'active' : 'free';
}

function normalizeBillingState(raw = {}, config = getBillingConfig()) {
    const subscriptionStatus = normalizeStatus(raw);
    const isPremium = Boolean(raw.isPremium || subscriptionStatus === 'active' || subscriptionStatus === 'trialing');

    return {
        ...DEFAULT_STATE,
        ...raw,
        isPremium,
        subscriptionStatus,
        planName: raw.planName || config.planName,
        priceLabel: raw.priceLabel || config.priceLabel,
        checkoutUrl: raw.checkoutUrl || config.checkoutUrl || '',
        portalUrl: raw.portalUrl || config.portalUrl || '',
        provider: raw.provider || config.provider,
        authProvider: raw.authProvider || config.authProvider,
        supportEmail: raw.supportEmail || config.supportEmail
    };
}

function clearBillingReturnParams() {
    const url = new URL(window.location.href);
    let changed = false;

    ['billing', 'session_id'].forEach(param => {
        if (url.searchParams.has(param)) {
            url.searchParams.delete(param);
            changed = true;
        }
    });

    if (changed) {
        history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
}

export function getBillingConfig() {
    const runtimeConfig = window.INVESTISSEUR_PRO_BILLING_CONFIG || {};

    return {
        ...DEFAULT_CONFIG,
        ...runtimeConfig,
        enabled: Boolean(
            runtimeConfig.enabled ||
            runtimeConfig.checkoutUrl ||
            runtimeConfig.portalUrl ||
            (runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey)
        )
    };
}

export function loadBillingState() {
    const raw = readStoredJson(BILLING_STATE_KEY) || readStoredJson(LEGACY_ACCOUNT_KEY) || {};
    return normalizeBillingState(raw);
}

export function saveBillingState(nextState) {
    const normalized = normalizeBillingState(nextState);

    localStorage.setItem(BILLING_STATE_KEY, JSON.stringify(normalized));
    localStorage.setItem(LEGACY_ACCOUNT_KEY, JSON.stringify({
        isPremium: normalized.isPremium,
        subscriptionStatus: normalized.subscriptionStatus,
        planName: normalized.planName,
        customerEmail: normalized.customerEmail || ''
    }));

    return normalized;
}

export function applyPremiumClass(account = loadBillingState()) {
    document.body.classList.toggle('is-premium', Boolean(account.isPremium));
}

export function isHostedBillingConfigured(config = getBillingConfig()) {
    return Boolean(config.checkoutUrl);
}

export function canOpenBillingPortal(account = loadBillingState(), config = getBillingConfig()) {
    return Boolean((account && account.portalUrl) || config.portalUrl);
}

export function openHostedCheckout(config = getBillingConfig()) {
    if (!config.checkoutUrl) return false;
    window.location.href = config.checkoutUrl;
    return true;
}

export function openHostedPortal(account = loadBillingState(), config = getBillingConfig()) {
    const portalUrl = (account && account.portalUrl) || config.portalUrl;
    if (!portalUrl) return false;
    window.location.href = portalUrl;
    return true;
}

export function applyBillingReturnState() {
    const params = new URLSearchParams(window.location.search);
    const billingStatus = params.get('billing');

    if (!billingStatus) {
        return { status: 'idle', changed: false };
    }

    if (billingStatus === 'success') {
        saveBillingState({
            ...loadBillingState(),
            subscriptionStatus: 'pending_activation',
            lastCheckoutAt: new Date().toISOString()
        });
        clearBillingReturnParams();
        return { status: 'success', changed: true };
    }

    if (billingStatus === 'cancel') {
        clearBillingReturnParams();
        return { status: 'cancel', changed: false };
    }

    clearBillingReturnParams();
    return { status: 'idle', changed: false };
}

export function formatBillingPeriodEnd(value) {
    if (!value) return '';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}