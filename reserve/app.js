const CONFIG = {
    API_URL: 'https://your-domain.com/api/booking',
    DATA_PATH: '../data',
    IMAGE_PATH: '../data/image',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 5MB
    CURRENCY: 'تومان',
    WALLET_URL: '../wallet',    
    ORDERS_URL: '../done',   
    TEMP_MODE: true,           
};

const PERSIAN_DIGITS = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
const LOCATION_ID_MAP = { host: 'female', outcall: 'male' };
const ICONS = {
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    user: '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M9 19h6"/></svg>',
    out: '<svg viewBox="0 0 24 24"><circle cx="10" cy="14" r="5"/><line x1="19" y1="5" x2="14" y2="10"/><polyline points="15 5 19 5 19 9"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    star: '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    warning: '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17.01"/></svg>',
info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8.01"/></svg>',
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function formatPrice(num) {
    return Number(num || 0).toLocaleString('en-US').replace(/\d/g, d => PERSIAN_DIGITS[d]);
}

function parsePrice(text) {
    if (typeof text === 'number') return text;
    if (!text) return 0;
    const map = { '۰':0,'۱':1,'۲':2,'۳':3,'۴':4,'۵':5,'۶':6,'۷':7,'۸':8,'۹':9 };
    return parseInt(String(text).replace(/[۰-۹]/g, d => map[d]).replace(/[^\d]/g, ''), 10) || 0;
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

function vibrate(ms = 8) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

const State = {
    code: null,
    data: null,         
    selections: {
        bookingType: null, 
        subOption: null,   
        extras: new Set(),   
        time: null,         
        location: null,     
        address: '',
        fullName: '',
        phone: '',
        notes: '',
        file: null,
    },

    calculateTotal() {
        if (!this.data) return { total: 0, breakdown: [] };
        const breakdown = [];
        let total = 0;

        if (this.selections.subOption) {
            const s = this.selections.subOption;
            total += s.price;
            breakdown.push({ label: s.label, price: s.price });
        }

        (this.data.extras || []).forEach(extra => {
            if (this.selections.extras.has(extra.id)) {
                total += extra.price;
                breakdown.push({ label: extra.label || extra.title || extra.id, price: extra.price });
            }
        });

        if (this.selections.location && this.selections.location.price > 0) {
            total += this.selections.location.price;
            breakdown.push({ label: this.selections.location.label, price: this.selections.location.price });
        }

        if (this.selections.time && this.selections.time.price > 0) {
            total += this.selections.time.price;
            breakdown.push({ label: this.selections.time.label, price: this.selections.time.price });
        }

        return { total, breakdown };
    },

calculatePrepayment() {
    const { total } = this.calculateTotal();
    const isVip = String(this.data?.profile?.type || '').toUpperCase() === 'VIP';

    if (!isVip) {
        return { isVip: false, prepayment: 0, remaining: total };
    }

    const FIXED = 1_000_000;
    let PERCENT = 0;

    if (total > 2_000_000) {
        PERCENT = 0.20;
    }

    const prepayment = FIXED + Math.round((total - FIXED) * PERCENT);
    const remaining = total - prepayment;

    return { isVip: true, prepayment, remaining };
},

    buildPayload() {
    const { total, breakdown } = this.calculateTotal();
    const { isVip, prepayment, remaining } = this.calculatePrepayment();

    return {
        code: this.code,
        profileName: this.data?.profile?.name || '',
        profileType: this.data?.profile?.type || '',
        bookingType: this.selections.bookingType,
        subOption: this.selections.subOption,
        extras: [...this.selections.extras],
        time: this.selections.time,
        location: this.selections.location,
        address: this.selections.address,
        fullName: this.selections.fullName,
        phone: this.selections.phone,
        notes: this.selections.notes,
        hasFile: !!this.selections.file,
        fileName: this.selections.file?.name || '',
        totalPrice: total,
        isVip,
        prepayment,
        remaining,
        breakdown,
        timestamp: new Date().toISOString(),
    };
},
};

const UI = {

    _bannerTimer: null,

    /**
     * @param {string} text  — 
     * @param {boolean|object} options — 
     */
    showBanner(text, options = false) {
        const banner = $('#banner');
        const icon = $('#bannerIcon');
        const textEl = $('#bannerText');

        let opts = {};
        if (typeof options === 'boolean') {
            opts = { type: options ? 'error' : 'success' };
        } else if (options && typeof options === 'object') {
            opts = options;
        }

        const type = opts.type || 'success'; // success | error | warning | info
        const title = opts.title || text;
        const desc = opts.desc || '';
        const duration = opts.duration ?? (type === 'error' ? 4200 : 3200);

        const iconMap = {
            success: ICONS.check,
            error: ICONS.cross,
            warning: ICONS.warning || ICONS.cross,
            info: ICONS.info || ICONS.check,
        };

        banner.classList.remove('error', 'warning', 'info', 'success');
        banner.classList.add(type);
        icon.innerHTML = iconMap[type] || ICONS.check;

        if (desc) {
            textEl.innerHTML = `
                <span class="banner-title">${escapeHTML(title)}</span>
                <span class="banner-desc">${escapeHTML(desc)}</span>
            `;
        } else {
            textEl.textContent = title;
        }

        banner.classList.add('show');
        clearTimeout(this._bannerTimer);
        this._bannerTimer = setTimeout(() => {
            banner.classList.remove('show');
        }, duration);

        vibrate(type === 'error' ? 18 : 8);
    },

    showError(field, reason) {
        const messages = {
            fullName: {
                empty: {
                    title: 'نام را وارد کنید',
                    desc: 'برای ثبت رزرو، نام و نام خانوادگی الزامی است.',
                },
                short: {
                    title: 'نام خیلی کوتاه است',
                    desc: 'لطفاً نام کامل خود را وارد کنید (حداقل ۳ حرف).',
                },
                invalid: {
                    title: 'نام معتبر نیست',
                    desc: 'از حروف و فاصله استفاده کنید؛ اعداد و نمادها مجاز نیستند.',
                },
            },
            phone: {
                empty: {
                    title: 'شماره تماس را وارد کنید',
                    desc: 'برای هماهنگی رزرو، شماره تماس الزامی است.',
                },
                short: {
                    title: 'شماره تماس ناقص است',
                    desc: 'شماره باید حداقل ۱۰ رقم باشد.',
                },
                invalid: {
                    title: 'شماره تماس معتبر نیست',
                    desc: 'فقط ارقام فارسی یا انگلیسی وارد کنید.',
                },
                format: {
                    title: 'قالب شماره اشتباه است',
                    desc: 'مثال صحیح: ۰۹۱۲۳۴۵۶۷۸۹',
                },
            },
            address: {
                empty: {
                    title: 'آدرس را وارد کنید',
                    desc: 'چون مکان برنامه «خارج از محل» است، آدرس الزامی است.',
                },
                short: {
                    title: 'آدرس خیلی کوتاه است',
                    desc: 'لطفاً آدرس دقیق‌تری وارد کنید (حداقل ۱۰ حرف).',
                },
            },
            file: {
                empty: {
                    title: 'عکس سلفی الزامی است',
                    desc: 'برای احراز هویت، لطفاً یک عکس سلفی آپلود کنید.',
                },
                size: {
                    title: 'حجم فایل زیاد است',
                    desc: 'حداکثر حجم مجاز ۵ مگابایت است.',
                },
                type: {
                    title: 'فرمت فایل مجاز نیست',
                    desc: 'فقط تصاویر (JPG، PNG، WEBP) و PDF پذیرفته می‌شوند.',
                },
            },
            selection: {
                empty: {
                    title: 'یک گزینه را انتخاب کنید',
                    desc: 'برای ادامه، باید حداقل یک مورد را انتخاب کنید.',
                },
            },
            network: {
                failed: {
                    title: 'خطا در ارتباط',
                    desc: 'اتصال اینترنت خود را بررسی و دوباره تلاش کنید.',
                },
            },
        };

        const msg = messages[field]?.[reason];
        if (msg) {
            this.showBanner(msg.title, {
                type: 'error',
                title: msg.title,
                desc: msg.desc,
            });
        } else {
            this.showBanner(reason || 'خطایی رخ داد', { type: 'error' });
        }
    },


    unSkeleton(el) {
        if (!el) return;
        el.classList.remove('sk', 'sk-line', 'sk-avatar', 'sk-segmented', 'sk-circle');
    },

    renderProfile(profile, code) {
        const { name, type, status } = profile || {};
        const nameEl = $('#profileName');
        const tagEl = $('#profileTag');
        const codeEl = $('#profileCode');
        const avatarEl = $('#profileAvatar');

        this.unSkeleton(nameEl);
        nameEl.textContent = name || 'بدون نام';
        nameEl.classList.add('profile-name');

        this.unSkeleton(codeEl);
        codeEl.textContent = `CODE: ${code}`;

        this.unSkeleton(tagEl);
        if (type && String(type).toUpperCase() === 'VIP') {
            tagEl.classList.add('vip-tag');
            tagEl.innerHTML = `${ICONS.star}VIP`;
        } else if (type) {
            tagEl.classList.add('regu-tag');
            tagEl.textContent = type;
        } else {
            tagEl.classList.add('regu-tag');
            tagEl.textContent = 'عادی';
        }

        const statusBadge = status === 'online' ? '<span class="avatar-status"></span>' : '';
        avatarEl.classList.remove('sk', 'sk-avatar');
        avatarEl.innerHTML = `<img src="${CONFIG.IMAGE_PATH}/${code}.png" alt="${escapeHTML(name)}" onerror="this.style.display='none'">${statusBadge}`;

        $('#navTitle').textContent = name ? `رزرو برنامه با ${name}` : 'رزرو برنامه';
    },

    section(title, contentHTML) {
        return `
            <div class="section-label">${escapeHTML(title)}</div>
            ${contentHTML}
        `;
    },

    renderBookingTypes(bookingTypes) {
        const container = $('#sectionBookingTypes');
        if (!bookingTypes || !bookingTypes.length) {
            container.innerHTML = '';
            return;
        }

        const tabsHTML = bookingTypes.map((bt, i) => `
            <button type="button" data-type-id="${escapeHTML(bt.id)}" class="${i === 0 ? 'active' : ''}">
                ${escapeHTML(bt.label || bt.title || bt.id)}
            </button>
        `).join('');

        const groupsHTML = bookingTypes.map((bt, btIndex) => {
            const optionsHTML = (bt.options || []).map((opt, optIndex) => {
                const isFirst = optIndex === 0;
                const label = opt.label || opt.title || opt.id;
                const sub = opt.sub || opt.description || '';
                return `
                    <div class="row sub-option">
                        <span class="row-icon">${ICONS.check}</span>
                        <div style="flex:1">
                            <div class="row-label">${escapeHTML(label)}</div>
                            ${sub ? `<div class="row-sub">${escapeHTML(sub)}</div>` : ''}
                        </div>
                        <span class="price-tag">${formatPrice(opt.price)}</span>
                        <label class="ios-radio">
                            <input type="radio"
                                name="subOption_${escapeHTML(bt.id)}"
                                value="${escapeHTML(opt.id)}"
                                data-type-id="${escapeHTML(bt.id)}"
                                data-option-id="${escapeHTML(opt.id)}"
                                data-price="${opt.price}"
                                data-label="${escapeHTML(label)}"
                                ${isFirst ? 'checked' : ''}>
                            <span class="circle"></span>
                        </label>
                    </div>
                `;
            }).join('');

            return `
                <div class="card sub-options ${btIndex === 0 ? 'active' : ''}" data-group="${escapeHTML(bt.id)}">
                    ${optionsHTML}
                </div>
            `;
        }).join('');

        container.innerHTML = this.section(
            'نوع برنامه را انتخاب کنید',
            `<div class="segmented" id="bookingTypeTabs">${tabsHTML}</div>${groupsHTML}`
        );

        const firstType = bookingTypes[0];
        State.selections.bookingType = firstType.id;
        const firstOption = firstType.options?.[0];
        if (firstOption) {
            State.selections.subOption = {
                typeId: firstType.id,
                optionId: firstOption.id,
                price: firstOption.price,
                label: firstOption.label || firstOption.title || firstOption.id,
            };
        }

        $$('#bookingTypeTabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('#bookingTypeTabs button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const typeId = btn.dataset.typeId;
                State.selections.bookingType = typeId;
                $$('.sub-options').forEach(g => {
                    g.classList.toggle('active', g.dataset.group === typeId);
                });
                const firstRadio = $(`.sub-options[data-group="${typeId}"] input[type="radio"]`);
                if (firstRadio) firstRadio.checked = true;
                this._syncSubOption(typeId);
        
                // ✅ اینجا زمان‌ها رو بر اساس نوع برنامه دوباره رندر کن
                const bt = (State.data?.bookingTypes || []).find(t => t.id === typeId);
                if (bt?.timeOptions) {
                    UI.renderTimeOptions(bt.timeOptions);
                } else {
                    // اگر timeOptions مخصوص این نوع نبود، از حالت پیش‌فرض استفاده کن
                    UI.renderTimeOptions(State.data?.timeOptions || []);
                }
        
                vibrate();
                this.renderTotal();
            });
        });

        $$('#sectionBookingTypes input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                this._syncSubOption(radio.dataset.typeId);
                this.renderTotal();
            });
        });
    },

    _syncSubOption(typeId) {
        const radio = $(`#sectionBookingTypes input[type="radio"][data-type-id="${typeId}"]:checked`);
        if (!radio) return;
        State.selections.subOption = {
            typeId,
            optionId: radio.dataset.optionId,
            price: Number(radio.dataset.price),
            label: radio.dataset.label,
        };
    },

    renderExtras(extras) {
        const container = $('#sectionExtras');
        if (!extras || !extras.length) {
            container.innerHTML = '';
            return;
        }

        const rowsHTML = extras.map(extra => {
            const label = extra.label || extra.title || extra.id;
            const sub = extra.sub || extra.description || '';
            return `
                <div class="row">
                    <span class="row-icon">${ICONS.heart}</span>
                    <div style="flex:1">
                        <div class="row-label">${escapeHTML(label)}</div>
                        ${sub ? `<div class="row-sub">${escapeHTML(sub)}</div>` : ''}
                    </div>
                    <span class="price-tag">${formatPrice(extra.price)}</span>
                    <label class="ios-checkbox">
                        <input type="checkbox"
                            name="extra_${escapeHTML(extra.id)}"
                            data-extra-id="${escapeHTML(extra.id)}"
                            data-price="${extra.price}"
                            data-label="${escapeHTML(label)}">
                        <span class="box">${ICONS.check}</span>
                    </label>
                </div>
            `;
        }).join('');

        container.innerHTML = this.section('موارد اضافی', `<div class="card">${rowsHTML}</div>`);

        $$('#sectionExtras input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const id = cb.dataset.extraId;
                if (cb.checked) State.selections.extras.add(id);
                else State.selections.extras.delete(id);
                this.renderTotal();
            });
        });
    },

    renderTimeOptions(timeOptions) {
        const container = $('#sectionTime');
        if (!timeOptions || !timeOptions.length) {
            container.innerHTML = '';
            return;
        }
    
        const activeOptions = timeOptions.filter(t => t.status !== false);
        const defaultTime = activeOptions[1] || activeOptions[0];
    
        const tabsHTML = timeOptions.map(opt => {
            const label = opt.label || opt.title || opt.id;
            const isDisabled = opt.status === false;
            const isActive = defaultTime && opt.id === defaultTime.id;
            return `
                <button type="button"
                    data-time-id="${escapeHTML(opt.id)}"
                    data-price="${opt.price || 0}"
                    data-label="${escapeHTML(label)}"
                    class="${isActive ? 'active' : ''}"
                    ${isDisabled ? 'disabled' : ''}>
                    ${escapeHTML(label)}
                </button>
            `;
        }).join('');
    
        const descsHTML = timeOptions.map(opt => {
            const isActive = defaultTime && opt.id === defaultTime.id;
            const icon = opt.icon === 'bolt' ? ICONS.bolt : opt.icon === 'check' ? ICONS.check : ICONS.clock;
            const title = opt.title || opt.label || opt.id;
            const desc = opt.description || opt.sub || '';
            const priceHTML = opt.price > 0 ? `<br>شامل <span class="price-tag">${formatPrice(opt.price)}</span> هزینه بیشتر` : '';
            return `
                <div class="option-desc ${isActive ? 'active' : ''}" data-desc="${escapeHTML(opt.id)}">
                    <div class="option-desc-title">
                        ${icon}
                        ${escapeHTML(title)}
                    </div>
                    <p class="option-desc-text">
                        ${escapeHTML(desc)}
                        ${priceHTML}
                    </p>
                </div>
            `;
        }).join('');
    
        container.innerHTML = this.section(
            'زمان برنامه',
            `<div class="segmented" id="timeTabs">${tabsHTML}</div>
             <div class="card" style="margin-top:10px">${descsHTML}</div>`
        );
    
        if (defaultTime) {
            State.selections.time = {
                id: defaultTime.id,
                price: defaultTime.price || 0,
                label: defaultTime.label || defaultTime.title || defaultTime.id,
            };
        } else {
            State.selections.time = null;
        }
    
        // چون این عنصر دوباره ساخته شده، ایونت‌ها رو دوباره وصل می‌کنیم
        this._bindTimeEvents();
    },
    
    _bindTimeEvents() {
        $$('#timeTabs button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                $$('#timeTabs button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const id = btn.dataset.timeId;
                State.selections.time = {
                    id,
                    price: Number(btn.dataset.price),
                    label: btn.dataset.label,
                };
                $$('.option-desc').forEach(d => d.classList.toggle('active', d.dataset.desc === id));
                vibrate();
                UI.renderTotal();
            });
        });
    },

renderLocations(locations) {
    const container = $('#sectionLocation');
    if (!locations || !locations.length) {
        container.innerHTML = '';
        return;
    }

    const defaultLoc = locations[0];
    const isSingle = locations.length === 1;

    const rowsHTML = locations.map((loc, i) => {
        const label = loc.label || loc.title || loc.id;
        const price = loc.price || 0;
        const isHost = loc.id === 'host';
        const icon = isHost ? ICONS.pin : ICONS.out;
        const priceHTML = price > 0
            ? `<span class="price-tag">${formatPrice(price)}</span>`
            : `<span class="free-tag">رایگان</span>`;

        if (isSingle) {
            return `
                <div class="row" data-location-id="${escapeHTML(loc.id)}">
                    <span class="row-icon">${icon}</span>
                    <div style="flex:1">
                        <span class="row-label">${escapeHTML(label)}</span>
                    </div>
                    ${priceHTML}
                </div>
            `;
        }

        const isFirst = i === 0;
        return `
            <div class="row" data-location-id="${escapeHTML(loc.id)}">
                <span class="row-icon">${icon}</span>
                <div style="flex:1">
                    <span class="row-label">${escapeHTML(label)}</span>
                </div>
                ${priceHTML}
                <label class="ios-radio">
                    <input type="radio"
                        name="location"
                        value="${escapeHTML(loc.id)}"
                        data-price="${price}"
                        data-label="${escapeHTML(label)}"
                        data-has-input="${loc.hasInput ? '1' : '0'}"
                        ${isFirst ? 'checked' : ''}>
                    <span class="circle"></span>
                </label>
            </div>
        `;
    }).join('');

    const anyHasInput = locations.some(l => l.hasInput);
    const addressRowHTML = anyHasInput ? `
        <div class="row">
            <span class="row-icon">${ICONS.pin}</span>
            <input type="text" id="address" placeholder="آدرس را وارد کنید ..." autocomplete="off">
        </div>
    ` : '';

    container.innerHTML = this.section(
        'مکان برنامه',
        `<div class="card">${rowsHTML}${addressRowHTML}</div>`
    );

    State.selections.location = {
        id: defaultLoc.id,
        price: defaultLoc.price || 0,
        label: defaultLoc.label || defaultLoc.title || defaultLoc.id,
    };

    const addressInput = $('#address');

    function applyLocationToAddress(loc) {
        if (!addressInput) return;

        if (loc.address) {
            addressInput.value = loc.address;
            addressInput.disabled = true;
            addressInput.placeholder = '';
            State.selections.address = loc.address;
        } else {
            addressInput.value = '';
            addressInput.disabled = false;
            addressInput.placeholder = 'آدرس را وارد کنید ...';
            State.selections.address = '';
        }
    }

    if (addressInput) {
        applyLocationToAddress(defaultLoc);
        addressInput.addEventListener('input', () => {
            State.selections.address = addressInput.value.trim();
        });
    }

    $$('#sectionLocation input[name="location"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const loc = locations.find(l => l.id === radio.value);
            if (!loc) return;

            State.selections.location = {
                id: loc.id,
                price: loc.price || 0,
                label: loc.label || loc.title || loc.id,
            };

            applyLocationToAddress(loc);
            this.renderTotal();
        });
    });
},

    renderPersonal() {
        const container = $('#sectionPersonal');
        container.innerHTML = this.section(
            'اطلاعات شخصی',
            `<div class="card">
                <div class="row">
                    <span class="row-icon">${ICONS.user}</span>
                    <input type="text" id="fullName" placeholder="نام شما" autocomplete="off">
                </div>
                <div class="row">
                    <span class="row-icon">${ICONS.phone}</span>
                    <input type="tel" id="phone" placeholder="شماره تماس جهت هماهنگی" autocomplete="off" inputmode="tel">
                </div>
            </div>`
        );

        $('#fullName').addEventListener('input', e => State.selections.fullName = e.target.value.trim());
        $('#phone').addEventListener('input', e => State.selections.phone = e.target.value.trim());
    },

    renderNotes() {
        const container = $('#sectionNotes');
        container.innerHTML = `
            <div class="card">
                <div class="row textarea-row">
                    <textarea id="notes" placeholder="اگر توضیح یا درخواست خاصی دارید اینجا بنویسید..."></textarea>
                </div>
            </div>
        `;
        $('#notes').addEventListener('input', e => State.selections.notes = e.target.value.trim());
    },

renderSelfie() {
    const container = $('#sectionSelfie');
    container.innerHTML = `
        <div class="section-label">
            عکس سلفی
        </div>
        <div class="card" id="selfieCard">
            <div class="row">
                <span class="row-icon">${ICONS.file}</span>
                <label class="file-label">
                    <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp,application/pdf">
                    <span class="file-cta">انتخاب فایل</span>
                    <span class="file-name" id="fileName">هیچ عکسی انتخاب نشده</span>
                </label>
            </div>
        </div>
        <p class="section-hint">درصورت نیاز میتوانید عکس خود را برای ادمین بفرستید</p>
    `;

    const fileInput = $('#fileInput');
    const fileNameEl = $('#fileName');
    const card = $('#selfieCard');

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];

    card?.classList.remove('has-error');

    // اگر فایلی انتخاب نشد (یا لغو شد) → پاکسازی و خروج
    if (!file) {
        fileNameEl.textContent = 'هیچ عکسی انتخاب نشده';
        State.selections.file = null;
        return;
    }

    if (file.size > CONFIG.MAX_FILE_SIZE) {
        UI.showError('file', 'size');
        fileInput.value = '';
        fileNameEl.textContent = 'هیچ عکسی انتخاب نشده';
        State.selections.file = null;
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const allowedExts = /\.(jpe?g|png|webp|pdf)$/i;
    if (!allowedTypes.includes(file.type) && !allowedExts.test(file.name)) {
        UI.showError('file', 'type');
        fileInput.value = '';
        fileNameEl.textContent = 'هیچ عکسی انتخاب نشده';
        State.selections.file = null;
        return;
    }

    fileNameEl.textContent = file.name;
    State.selections.file = file;
    card?.classList.remove('has-error');
    vibrate(6);
});
},

renderTotal() {
    const container = $('#sectionTotal');
    const { total, breakdown } = State.calculateTotal();
    const { isVip, prepayment, remaining } = State.calculatePrepayment();

    const breakdownHTML = breakdown.length
        ? breakdown.map(item => `
            <div class="breakdown-row">
                <span class="breakdown-label">${escapeHTML(item.label)}</span>
                <span class="breakdown-price">${formatPrice(item.price)}</span>
            </div>
        `).join('')
        : `<div class="breakdown-empty">موردی انتخاب نشده</div>`;

    const prepaymentHTML = isVip ? `
        <div class="prepay-row">
            <span class="prepay-label">
                پیش‌پرداخت
                <span class="prepay-badge">VIP</span>
            </span>
            <span class="prepay-value">${formatPrice(prepayment)}</span>
        </div>
        <div class="prepay-row">
            <span class="prepay-label">باقی‌مونده در محل</span>
            <span class="prepay-value remaining">${formatPrice(remaining)}</span>
        </div>
    ` : '';

    container.innerHTML = `
        <div class="section-label">فاکتور</div>
        <div class="total-display">
            <div class="total-breakdown">${breakdownHTML}</div>
            <div class="total-row">
                <span class="total-label">جمع کل</span>
                <span class="total-value">${formatPrice(total)} ${CONFIG.CURRENCY}</span>
            </div>
            ${prepaymentHTML}
        </div>
    `;
},

    renderFootnote(text) {
        $('#footnote').textContent = text || 'درصورت وجود هرگونه سوال به آیدی ادمین پیام بدید';
    },
};

function validate() {
    const { fullName, phone, location, address, file } = State.selections;

    if (!fullName) {
        UI.showError('fullName', 'empty');
        scrollToAndFocus('#fullName');
        return false;
    }
    if (fullName.length < 3) {
        UI.showError('fullName', 'short');
        scrollToAndFocus('#fullName');
        return false;
    }
    if (!/^[\u0600-\u06FFa-zA-Z\s\u200c]+$/.test(fullName)) {
        UI.showError('fullName', 'invalid');
        scrollToAndFocus('#fullName');
        return false;
    }

    if (!phone) {
        UI.showError('phone', 'empty');
        scrollToAndFocus('#phone');
        return false;
    }
    const digits = phone.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                        .replace(/\D/g, '');
    if (digits.length < 10) {
        UI.showError('phone', 'short');
        scrollToAndFocus('#phone');
        return false;
    }
    if (!/^[\d۰-۹\s\-+()]+$/.test(phone)) {
        UI.showError('phone', 'invalid');
        scrollToAndFocus('#phone');
        return false;
    }

    const loc = State.data?.locations?.find(l => l.id === location?.id);
    if (loc?.hasInput && !address) {
        UI.showError('address', 'empty');
        scrollToAndFocus('#address');
        return false;
    }
    if (loc?.hasInput && address && address.length < 10) {
        UI.showError('address', 'short');
        scrollToAndFocus('#address');
        return false;
    }

    if (!file) {
        UI.showError('file', 'empty');
        scrollToAndFocus('#fileInput');
        return false;
    }

    return true;
}

function scrollToAndFocus(selector) {
    const el = $(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el.focus({ preventScroll: true }), 350);
}

function redirectToNextPage(payload) {
    const { isVip, prepayment, remaining } = State.calculatePrepayment();
    const hasPrepayment = isVip && prepayment > 0;

    try {
        sessionStorage.setItem('bookingPayload', JSON.stringify(payload));
        sessionStorage.setItem('bookingTimestamp', Date.now().toString());
    } catch (e) {
        console.warn('sessionStorage unavailable:', e);
    }

    const params = new URLSearchParams({
        code: State.code || '',
        total: payload.totalPrice,
        prepayment: prepayment,
        remaining: remaining,
    });

    const target = hasPrepayment
        ? `${CONFIG.WALLET_URL}?${params.toString()}`
        : `${CONFIG.ORDERS_URL}?${params.toString()}`;

    console.log('🚀 Redirecting to:', target);

    const msgTitle = hasPrepayment ? 'موجودی کافی نیست' : 'ثبت برنامه';
    const msgDesc = hasPrepayment
        ? `پیش‌پرداخت ${formatPrice(prepayment)} ${CONFIG.CURRENCY} — لطفاً پرداخت را تکمیل کنید.`
        : 'در حال انتقال به صفحه سفارشات...';

    UI.showBanner(msgTitle, {
        type: hasPrepayment ? 'info' : 'success',
        title: msgTitle,
        desc: msgDesc,
        duration: 1500,
    });

    setTimeout(() => {
        window.location.href = target;
    }, 900);
}

async function submitBooking() {
    if (!validate()) return;

    const payload = State.buildPayload();
    console.log('📦 Payload:', payload);

    const btn = $('#bookBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'در حال انتقال...';
    vibrate(15);

    try {
        if (CONFIG.TEMP_MODE) {
            redirectToNextPage(payload);
            return;
        }

        const formData = new FormData();
        formData.append('payload', JSON.stringify(payload));
        if (State.selections.file) {
            formData.append('selfie', State.selections.file);
        }

        const res = await fetch(CONFIG.API_URL, { method: 'POST', body: formData });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        UI.showBanner('رزرو با موفقیت ثبت شد', {
            type: 'success',
            title: '✅ رزرو ثبت شد',
            desc: `مبلغ ${formatPrice(payload.totalPrice)} ${CONFIG.CURRENCY} — به‌زودی با شما تماس می‌گیریم.`,
            duration: 4000,
        });
    } catch (err) {
        console.error('❌ Submit error:', err);
        UI.showBanner('خطا در ارسال', {
            type: 'error',
            title: 'ارسال ناموفق بود',
            desc: 'اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.',
            duration: 5000,
        });
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function loadProfile(code) {
    const res = await fetch(`${CONFIG.DATA_PATH}/${code}.json`);
    if (!res.ok) throw new Error('پروفایل یافت نشد');
    return res.json();
}

async function init() {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    State.code = code;

    document.getElementById('navPrev').addEventListener('click', () => {
        location.href = "../";
    });
    document.getElementById('navNext').addEventListener('click', () => {
        location.href = "../";
    });
    document.getElementById('galleryBtn').addEventListener('click', () => {
        location.href = "../gallery?code=" + code;
    });


    $('#bookBtn').addEventListener('click', submitBooking);

    $('#bookingForm').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            submitBooking();
        }
    });

    if (!code) {
        UI.showBanner('کد پروفایل یافت نشد', true);
        return;
    }

    try {
        const data = await loadProfile(code);
        State.data = data;
        console.log('✅ Loaded profile:', data);

        UI.renderProfile(data.profile || {}, code);
        UI.renderBookingTypes(data.bookingTypes);
        UI.renderExtras(data.extras);
        const firstType = data.bookingTypes?.[0];
        UI.renderTimeOptions(firstType?.timeOptions || data.timeOptions || []);
        UI.renderLocations(data.locations);
        UI.renderPersonal();
        UI.renderNotes();
        UI.renderSelfie();
        UI.renderTotal();
        UI.renderFootnote(data.footnote);

        $('#app')?.classList.remove('skeleton-screen');

    } catch (err) {
        console.error('❌ Init error:', err);
        UI.showBanner(err.message || 'خطا در بارگذاری', true);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
