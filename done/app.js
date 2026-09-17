(function () {
    'use strict'; 

    const ADMIN_USERNAME = 'AsalSup';
    const ADMIN_PLATFORM = 'telegram';
    const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
    const CURRENCY = 'تومان';

    const toPersian = (num) => String(num ?? '').replace(/\d/g, d => PERSIAN_DIGITS[d]);
    const formatPrice = (num) => toPersian(Number(num || 0).toLocaleString('en-US'));
    const escapeHTML = (str) => {
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    };
const getParam = (key) => new URLSearchParams(location.search).get(key) || '';

// ✅ خواندن مستقیم از URL — بدون sessionStorage
const parseExtras = (raw) => {
    if (!raw) return [];
    return raw.split(',').filter(Boolean).map(item => {
        const [id, label, price] = item.split('~');
        return { id, label, price: Number(price) || 0 };
    });
};

const payload = {
    code: getParam('code'),
    profileName: getParam('name'),
    profileType: getParam('profileType'),
    fullName: getParam('fullName'),
    phone: getParam('phone'),
    bookingType: getParam('bookingType'),
    bookingTypeLabel: getParam('bookingTypeLabel'),
    subOption: {
        id: getParam('subOptionId'),
        label: getParam('subOption'),
        price: Number(getParam('subOptionPrice')) || 0,
    },
    time: {
        id: getParam('timeId'),
        label: getParam('time'),
        price: Number(getParam('timePrice')) || 0,
    },
    location: {
        id: getParam('locationId'),
        label: getParam('location'),
        price: Number(getParam('locationPrice')) || 0,
    },
    address: getParam('address'),
    notes: getParam('notes'),
    extras: parseExtras(getParam('extras')),   // ✅ پارس رشته ساده
    totalPrice: Number(getParam('total')) || 0,
    prepayment: Number(getParam('prepayment')) || 0,
    remaining: Number(getParam('remaining')) || 0,
    isVip: getParam('isVip') === '1',
};

    const generateTrackingCode = () => {
        const chars = 'ABCDEF0123456789';
        const seg = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return `AS${payload.code}-${seg(4)}`;
    };
    const tracking = generateTrackingCode();



    const $ = (id) => document.getElementById(id);

    $('trackingCode').textContent = tracking;
    $('pfName').textContent = payload.fullName || payload.profileName || 'مهمان';
    $('pfPhone').textContent = toPersian(payload.phone || '—');

    const typePrice = Number(payload.subOption?.price) || 0;
    const timePrice = Number(payload.time?.price) || 0;
    const locPrice = Number(payload.location?.price) || 0;

    $('mType').textContent = payload.subOption?.label || '—';
    if (typePrice > 0) $('mTypePrice').textContent = formatPrice(typePrice);

    $('mTime').textContent = payload.time?.label || '—';
    if (timePrice > 0) $('mTimePrice').textContent = formatPrice(timePrice);

    $('mLoc').textContent = payload.location?.label || '—';
    if (locPrice > 0) $('mLocPrice').textContent = formatPrice(locPrice);

    if (payload.address) {
        $('mAddress').textContent = payload.address;
    }

    if (payload.notes) {
        $('noteText').textContent = payload.notes;
        $('noteLine').style.display = '';
    }

    function renderInvoice() {
        const card = $('invoiceCard');
        const total = Number(payload.totalPrice) || 0;
        const prepayment = Number(payload.prepayment) || 0;
        const remaining = Number(payload.remaining) || 0;
        const isVip = !!payload.isVip;

        let html = `
            <div class="inv-total">
                <span class="it-label">جمع کل</span>
                <span class="it-value">${formatPrice(total)} ${CURRENCY}</span>
            </div>
        `;

        if (isVip && prepayment > 0) {
            html += `
                <div class="inv-prepay">
                    <span class="ip-label">
                        پیش‌پرداخت
                        <span class="ip-badge">VIP</span>
                    </span>
                    <span class="ip-value">${formatPrice(prepayment)} ${CURRENCY}</span>
                </div>
            `;
            if (remaining > 0) {
                html += `
                    <div class="inv-prepay">
                        <span class="ip-label">باقی‌مونده در محل</span>
                        <span class="ip-value remaining">${formatPrice(remaining)} ${CURRENCY}</span>
                    </div>
                `;
            }
        }

        card.innerHTML = html;
    }
    renderInvoice();

function renderExtras() {
    let extras = payload.extras;
    if (!Array.isArray(extras) || !extras.length) return;

    $('extrasSection').style.display = '';
    $('tagsContainer').innerHTML = extras.map(ex => {
        const label = ex.label || ex.id || '';
        const price = Number(ex.price) || 0;
        const priceHTML = price > 0 ? `<span class="ext-price">+${formatPrice(price)}</span>` : '';
        return `<span class="ex-tag">${escapeHTML(label)}${priceHTML}</span>`;
    }).join('');
}
    renderExtras();

function buildAdminMessage() {
    const lines = [];
    lines.push('✦─ فرم درخواست کد ─✦');
    lines.push('');
    lines.push('⌛️ پرداخت در محل');
    lines.push(`☑️ کد پیگیری: #${tracking}`);
    lines.push('');
    const name = payload.fullName || payload.profileName || '';
    const phone = payload.phone ? toPersian(payload.phone) : '';
    if (name || phone) {
        lines.push(`⫸  ${name}${name && phone ? ' | ' : ''}${phone}`);
    }
    const typeLabel = payload.subOption?.label || '';
    const timeLabel = payload.time?.label || '';
    if (typeLabel || timeLabel) {
        lines.push(`⫸ برنامه ${typeLabel}${typeLabel && timeLabel ? ' | ' : ''}${timeLabel}`);
    }
    const locLabel = payload.location?.label || '';
    const address = payload.address || '';
    if (locLabel || address) {
        lines.push(`⫸ مکان ${locLabel}${locLabel && address ? ' | ' : ''}${address}`);
    }
    lines.push('');
    const extras = Array.isArray(payload.extras) ? payload.extras : [];
    if (extras.length) {
        const t = extras
            .map(ex => typeof ex === 'string' ? ex : (ex.label || ex.title || ex.id || ''))
            .filter(Boolean)
            .join('، ');
        if (t) lines.push(`● افزودنی‌ها: ${t}`);
    }
    if (payload.notes) {
        lines.push(`● توضیحات: ${payload.notes}`);
    }
    lines.push('');
    const total = Number(payload.totalPrice) || 0;
    if (total > 0) {
        lines.push(`⫸ جمع کل: ${formatPrice(total)} ${CURRENCY}`);
    }
    return lines.join('\n');
}

    const encoded = encodeURIComponent(buildAdminMessage());
    $('adminBtn').href = ADMIN_PLATFORM === 'telegram'
        ? `https://t.me/${ADMIN_USERNAME}?text=${encoded}`
        : `https://wa.me/${ADMIN_USERNAME}?text=${encoded}`;

    let toastTimer = null;
    function showToast(text) {
        $('toastText').textContent = text;
        $('toast').classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2000);
    }

    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) { return false; }
    }

    $('copyBtn').addEventListener('click', async () => {
        const ok = await copyToClipboard($('trackingCode').textContent);
        if (ok) {
            $('copyBtn').classList.add('copied');
            showToast('کد پیگیری کپی شد');
            if (navigator.vibrate) navigator.vibrate(10);
            setTimeout(() => $('copyBtn').classList.remove('copied'), 1500);
        } else {
            showToast('کپی ناموفق بود');
        }
    });
})();
