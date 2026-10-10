import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Activity, ArchiveRestore, ArrowDownToLine, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Download, FileImage, Menu, Minus, Package, Plus, Search, Settings2, Trash2, Truck, X, Pencil, Database, CircleHelp, Moon, Sun, Wallet } from 'lucide-react';
import { MONTHS, WEEKDAYS, dateLabel, daysInMonth, en, fa, fromKey, keyOf, toGregorian, todayKey } from './lib/jalali';
import { exportBackup, exportImageOrPdf, sumRows, totalOf, type RecordEntry } from './lib/exports';

type Tab = 'home' | 'entry' | 'records' | 'reports' | 'settings';
type Vehicle = 'nissan' | 'arisan' | 'khavar';
const VEHICLES: { key: Vehicle; label: string; short: string; color: string }[] = [
  { key: 'nissan', label: 'نیسان', short: 'ن', color: '#087f62' },
  { key: 'arisan', label: 'آریسان', short: 'آ', color: '#4888bb' },
  { key: 'khavar', label: 'خاور', short: 'خ', color: '#bd8a4e' },
];
const STORAGE_KEY = 'daily-unloading-records-v1';
const RATES_KEY = 'daily-unloading-rates-v1';
const THEME_KEY = 'daily-unloading-theme-v1';
type Rates = Record<Vehicle, number>;
const defaultRates = (): Rates => ({ nissan: 0, arisan: 0, khavar: 0 });
const validRates = (value: unknown): value is Rates => !!value && typeof value === 'object' && VEHICLES.every(v => Number.isSafeInteger((value as Record<string, unknown>)[v.key]) && (value as Rates)[v.key] >= 0 && (value as Rates)[v.key] <= 999999999);
const loadRates = (): Rates => { try { const value: unknown = JSON.parse(localStorage.getItem(RATES_KEY) || 'null'); return validRates(value) ? value : defaultRates(); } catch { return defaultRates(); } };
const money = (value: number) => `${fa(value.toLocaleString('en-US'))} تومان`;
const isValidRecord = (r: unknown): r is RecordEntry => {
  if (!r || typeof r !== 'object') return false;
  const x = r as Record<string, unknown>;
  if (typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || typeof x.note !== 'string') return false;
  const { year, month, day } = fromKey(x.date);
  if (year < 1300 || year > 1500 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false;
  return VEHICLES.every(v => Number.isSafeInteger(x[v.key]) && (x[v.key] as number) >= 0 && (x[v.key] as number) <= 999999);
};
const loadRecords = (): RecordEntry[] => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter(isValidRecord).sort((a: RecordEntry, b: RecordEntry) => b.date.localeCompare(a.date));
  } catch { return []; }
};
const emptyCounts = () => ({ nissan: '0', arisan: '0', khavar: '0' });

function App() {
  const today = todayKey();
  const current = fromKey(today);
  const [records, setRecords] = useState<RecordEntry[]>(loadRecords);
  const [rates, setRates] = useState<Rates>(loadRates);
  const [rateInputs, setRateInputs] = useState<Record<Vehicle, string>>(() => { const loaded = loadRates(); return { nissan: String(loaded.nissan), arisan: String(loaded.arisan), khavar: String(loaded.khavar) }; });
  const [theme, setTheme] = useState<'light' | 'dark'>(() => { try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); document.documentElement.style.colorScheme = theme; try { localStorage.setItem(THEME_KEY, theme); } catch { /* Appearance still works for this session. */ } }, [theme]);
  const [tab, setTab] = useState<Tab>('home');
  const tabRef = useRef<Tab>('home');
  const [formDate, setFormDate] = useState(today);
  const [counts, setCounts] = useState<Record<Vehicle, string>>(emptyCounts);
  const [note, setNote] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState({ year: current.year, month: current.month });
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reportYear, setReportYear] = useState(current.year);
  const [reportMonth, setReportMonth] = useState(current.month);
  const [notice, setNotice] = useState('');
  const [busyExport, setBusyExport] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const saveRecords = (next: RecordEntry[]) => {
    const sorted = [...next].sort((a, b) => b.date.localeCompare(a.date));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); setRecords(sorted); return true; }
    catch { setNotice('ذخیره اطلاعات روی این دستگاه ممکن نشد. فضای ذخیره‌سازی را بررسی کنید.'); return false; }
  };
  const monthRows = useMemo(() => records.filter(r => { const d = fromKey(r.date); return d.year === reportYear && d.month === reportMonth; }), [records, reportYear, reportMonth]);
  const yearRows = useMemo(() => records.filter(r => fromKey(r.date).year === reportYear), [records, reportYear]);
  const currentMonthRows = useMemo(() => records.filter(r => { const d = fromKey(r.date); return d.year === current.year && d.month === current.month; }), [records, current.year, current.month]);
  const monthSums = sumRows(monthRows);
  const yearSums = sumRows(yearRows);
  const currentSums = sumRows(currentMonthRows);
  const allSums = sumRows(records);
  const costFor = (sums: ReturnType<typeof sumRows>) => VEHICLES.reduce((sum, v) => sum + sums[v.key] * rates[v.key], 0);
  const setRate = (vehicle: Vehicle, value: string) => {
    const cleaned = en(value).replace(/[^0-9]/g, '').slice(0, 9);
    setRateInputs(previous => ({ ...previous, [vehicle]: cleaned }));
    const next = { ...rates, [vehicle]: Number(cleaned || 0) };
    try { localStorage.setItem(RATES_KEY, JSON.stringify(next)); setRates(next); }
    catch { setNotice('ذخیره دستمزدها روی این دستگاه ممکن نشد. فضای ذخیره‌سازی را بررسی کنید.'); }
  };
  const todayRecord = records.find(r => r.date === today);
  const editing = records.some(r => r.date === formDate);
  const filtered = useMemo(() => {
    const q = en(search.trim());
    return records.filter(r => !q || r.date.includes(q) || dateLabel(r.date).includes(search.trim()) || r.note.includes(search.trim()));
  }, [records, search]);
  const earliestYear = Math.max(1300, Math.min(current.year - 5, reportYear, ...records.map(r => fromKey(r.date).year)));
  const latestYear = Math.min(1500, Math.max(current.year + 2, reportYear, ...records.map(r => fromKey(r.date).year)));
  const yearOptions = Array.from({ length: latestYear - earliestYear + 1 }, (_, i) => latestYear - i);

  const selectDate = (key: string) => {
    const existing = records.find(r => r.date === key);
    setFormDate(key);
    setCounts(existing ? { nissan: String(existing.nissan), arisan: String(existing.arisan), khavar: String(existing.khavar) } : emptyCounts());
    setNote(existing?.note ?? '');
    setCalendarOpen(false);
    setNotice('');
  };
  const editRecord = (r: RecordEntry) => {
    selectDate(r.date);
    navigate('entry');
  };
  const updateCount = (vehicle: Vehicle, value: string) => {
    const cleaned = en(value).replace(/[^0-9]/g, '').slice(0, 6);
    setCounts(previous => ({ ...previous, [vehicle]: cleaned }));
  };
  const changeCount = (vehicle: Vehicle, delta: number) => updateCount(vehicle, String(Math.max(0, Math.min(999999, Number(counts[vehicle] || 0) + delta))));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (VEHICLES.some(v => counts[v.key] === '' || !Number.isSafeInteger(Number(counts[v.key])) || Number(counts[v.key]) < 0)) {
      setNotice('تعداد هر خودرو باید یک عدد صحیح و غیرمنفی باشد.'); return;
    }
    const entry: RecordEntry = { date: formDate, nissan: Number(counts.nissan), arisan: Number(counts.arisan), khavar: Number(counts.khavar), note: note.trim().slice(0, 500) };
    const wasEditing = editing;
    if (saveRecords([...records.filter(r => r.date !== formDate), entry])) setNotice(wasEditing ? 'اطلاعات این روز به‌روزرسانی شد.' : 'بارهای این روز با موفقیت ثبت شد.');
  };
  const deleteRecord = () => {
    if (!deleteDate) return;
    if (saveRecords(records.filter(r => r.date !== deleteDate))) {
      if (formDate === deleteDate) { setCounts(emptyCounts()); setNote(''); }
      setNotice('رکورد انتخاب‌شده حذف شد.');
    }
    setDeleteDate(null);
  };
  const moveCalendar = (delta: number) => {
    setCalendarMonth(prev => {
      const index = prev.year * 12 + prev.month - 1 + delta;
      return { year: Math.floor(index / 12), month: index % 12 + 1 };
    });
  };
  const openCalendar = () => { const d = fromKey(formDate); setCalendarMonth({ year: d.year, month: d.month }); setCalendarOpen(true); };
  const firstDay = (toGregorian({ ...calendarMonth, day: 1 }).getDay() + 1) % 7;
  const calendarDays = daysInMonth(calendarMonth.year, calendarMonth.month);
  const reportTitle = `${MONTHS[reportMonth - 1]} ${fa(reportYear)}`;
  const download = async (format: 'jpg', scope: 'month' | 'year' | 'daily') => {
    const rows = scope === 'month' ? monthRows : scope === 'year' ? yearRows : records;
    if (!rows.length) { setNotice('برای این گزارش هنوز اطلاعاتی ثبت نشده است.'); return; }
    const title = scope === 'month' ? `گزارش ماهانه · ${reportTitle}` : scope === 'year' ? `گزارش سالانه · ${fa(reportYear)}` : 'گزارش سوابق روزانه';
    const filename = scope === 'month' ? `gozaresh-mah-${reportYear}-${reportMonth}` : scope === 'year' ? `gozaresh-sal-${reportYear}` : 'gozaresh-roozane';
    try {
      setBusyExport(true);
      await exportImageOrPdf(rows, title, filename, format, rates);
      setNotice('فایل در پوشهٔ دانلود ذخیره شد.');
    } catch { setNotice('تهیه خروجی انجام نشد. دوباره تلاش کنید.'); }
    finally { setBusyExport(false); }
  };
  const restore = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setNotice('حجم فایل پشتیبان بیش از حد مجاز است.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      if ((parsed.version !== 1 && parsed.version !== 2) || !Array.isArray(parsed.records) || !parsed.records.every(isValidRecord) || (parsed.rates !== undefined && !validRates(parsed.rates))) throw new Error('invalid');
      const dates = parsed.records.map((r: RecordEntry) => r.date);
      if (new Set(dates).size !== dates.length) throw new Error('duplicates');
      if (saveRecords(parsed.records)) {
        if (parsed.rates && validRates(parsed.rates)) {
          try { localStorage.setItem(RATES_KEY, JSON.stringify(parsed.rates)); setRates(parsed.rates); setRateInputs({ nissan: String(parsed.rates.nissan), arisan: String(parsed.rates.arisan), khavar: String(parsed.rates.khavar) }); }
          catch { setNotice('سوابق بازیابی شد، اما ذخیره دستمزدها ممکن نشد.'); }
        }
        const restoredToday = (parsed.records as RecordEntry[]).find(r => r.date === today);
        setFormDate(today);
        setCounts(restoredToday ? { nissan: String(restoredToday.nissan), arisan: String(restoredToday.arisan), khavar: String(restoredToday.khavar) } : emptyCounts());
        setNote(restoredToday?.note ?? '');
        setRestoreOpen(false);
        setNotice(`${fa(parsed.records.length)} روز از نسخه پشتیبان بازیابی شد.`);
      }
    } catch { setNotice('فایل انتخاب‌شده نسخه پشتیبان معتبر این برنامه نیست.'); }
  };
  const navigate = (next: Tab) => {
    if (tabRef.current !== next) window.history.pushState({ unloadingScreen: next }, '');
    tabRef.current = next;
    setTab(next);
    setMenuOpen(false);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  useEffect(() => {
    window.history.replaceState({ unloadingScreen: 'home' }, '');
    const onBack = () => {
      if (tabRef.current === 'home') { window.close(); return; }
      tabRef.current = 'home';
      setTab('home');
      setCalendarOpen(false);
      setDeleteDate(null);
      setRestoreOpen(false);
      setMenuOpen(false);
      setNotice('');
      window.history.replaceState({ unloadingScreen: 'home' }, '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  const navItems: { id: Tab; label: string; icon: typeof Package }[] = [
    { id: 'home', label: 'خانه', icon: Package }, { id: 'records', label: 'سوابق روزانه', icon: ClipboardList },
    { id: 'reports', label: 'گزارش‌ها', icon: BarChart3 }, { id: 'settings', label: 'تنظیمات', icon: Settings2 },
  ];
  const exportButtons = (scope: 'daily' | 'month' | 'year') => <div className="export-grid" data-testid={`export-options-${scope}`}>
    <button type="button" className="export-button" data-testid={`export-${scope}-jpg`} disabled={busyExport} onClick={() => download('jpg', scope)}><FileImage size={19} /> خروجی عکس JPG</button>
  </div>;

  return <div className="app-shell" dir="rtl">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Truck size={27} strokeWidth={2.1} /></div><div><strong>مدیریت تخلیه بار</strong><small>ثبت دقیق، خیال آسوده</small></div></div>
      <div className="sidebar-caption">منوی اصلی</div>
      <nav aria-label="منوی اصلی" className="side-nav">{navItems.map(item => <button key={item.id} type="button" data-testid={`nav-${item.id}`} className={`nav-link ${tab === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={20} /><span>{item.label}</span>{tab === item.id && <span className="nav-indicator" />}</button>)}</nav>
      <div className="side-note"><CircleHelp size={19} /><span>اطلاعات شما فقط روی همین دستگاه نگهداری می‌شود.</span></div>
      <div className="sidebar-bottom">یک روز منظم، یک کار راحت‌تر.</div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="mobile-brand"><span className="mobile-logo"><Truck size={21} /></span><strong>مدیریت تخلیه بار</strong></div><div className="topbar-desktop"><span className="topbar-greeting">سلام، روز خوبی داشته باشید 👋</span></div><div className="topbar-actions"><button type="button" className="theme-toggle" data-testid="theme-toggle" aria-label={theme === 'dark' ? 'فعال‌کردن تم روشن' : 'فعال‌کردن تم تاریک'} title={theme === 'dark' ? 'تم روشن' : 'تم تاریک'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button><span className="today-pill"><CalendarDays size={17} /> {dateLabel(today)}</span><button className="mobile-menu-button" data-testid="menu-toggle" aria-label="باز کردن منو" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22} /></button></div></header>
      {menuOpen && <div className="mobile-menu" data-testid="mobile-menu">{navItems.map(item => <button key={item.id} data-testid={`mobile-menu-${item.id}`} onClick={() => navigate(item.id)}><item.icon size={19} />{item.label}</button>)}</div>}
      <main className="content">
        {notice && <div className={`notice ${notice.includes('نشد') || notice.includes('نیست') || notice.includes('بیش') || notice.includes('باید') ? 'notice-error' : ''}`} role="status" data-testid="notice"><span>{notice}</span><button aria-label="بستن پیام" data-testid="dismiss-notice" onClick={() => setNotice('')}><X size={18} /></button></div>}
        {tab === 'home' && <>
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> نمای کلی فعالیت</div><h1>داشبورد روزانه</h1><p>همه‌چیز برای ثبت و پیگیری بارها، یک‌جا و مرتب.</p></div><div className="heading-date"><CalendarDays size={18} /> امروز، {dateLabel(today)}</div></div>
          <section className="stats-grid" aria-label="آمار بارها">
            <div className="stat-card stat-primary"><div className="stat-top"><span>مجموع بارهای امروز</span><div className="stat-icon"><Package size={21} /></div></div><div className="stat-value" data-testid="stat-today">{fa(todayRecord ? totalOf(todayRecord) : 0)} <small>بار</small></div><div className="stat-foot">ثبت‌شده در {dateLabel(today)}</div></div>
            <div className="stat-card"><div className="stat-top"><span>مجموع بارهای این ماه</span><div className="stat-icon mint"><BarChart3 size={21} /></div></div><div className="stat-value" data-testid="stat-month">{fa(currentSums.total)} <small>بار</small></div><div className="stat-foot">{MONTHS[current.month - 1]} {fa(current.year)}</div></div>
            <div className="stat-card"><div className="stat-top"><span>کل بارها از ابتدا</span><div className="stat-icon blue"><Activity size={21} /></div></div><div className="stat-value" data-testid="stat-all">{fa(allSums.total)} <small>بار</small></div><div className="stat-foot">در {fa(records.length)} روز ثبت‌شده</div></div>
          </section>
          <div className="monthly-cost-summary" data-testid="dashboard-month-cost"><span><Wallet size={20} /> حقوق فعلی این ماه</span><strong>{money(costFor(currentSums))}</strong><button type="button" data-testid="dashboard-rates-link" onClick={() => navigate('settings')}>ثبت مبالغ دستمزد حقوق بار <ChevronLeft size={16} /></button></div>
          <section className="vehicle-stats" aria-label="آمار خودروهای ماه جاری">{VEHICLES.map(v => <div className="vehicle-stat" key={v.key}><span className="vehicle-icon" style={{ backgroundColor: v.color + '18', color: v.color }}><Truck size={20} /></span><div><span className="vehicle-stat-label">{v.label} <span>در این ماه</span></span><strong data-testid={`stat-month-${v.key}`}>{fa(currentSums[v.key])} <small>بار</small></strong></div></div>)}</section>
          <div className="home-columns"><button type="button" className="panel entry-card" data-testid="open-load-entry" onClick={() => { selectDate(today); navigate('entry'); }}><span className="entry-card-icon"><Plus size={31} /></span><span className="entry-card-copy"><span className="section-kicker">ثبت روزانه</span><strong>ثبت بار</strong><span>تعداد بارهای نیسان، آریسان و خاور را برای تاریخ دلخواه وارد کنید.</span><span className="entry-card-action">ورود به ثبت بار <ChevronLeft size={18} /></span></span></button>
            <section className="panel recent-panel"><div className="section-head"><div><div className="section-kicker">آخرین فعالیت‌ها</div><h2>ثبت‌های اخیر</h2><p>نگاهی سریع به روزهای گذشته</p></div><button className="text-link" data-testid="view-all-records" onClick={() => navigate('records')}>مشاهده همه <ChevronLeft size={17} /></button></div>{records.length === 0 ? <div className="empty-state" data-testid="recent-empty"><div className="empty-icon"><ClipboardList size={30} /></div><strong>هنوز باری ثبت نشده</strong><p>برای ثبت اولین بار، روی «ثبت بار» بزنید؛ سوابق اینجا نمایش داده می‌شوند.</p></div> : <div className="recent-list">{records.slice(0, 5).map(r => <div className="recent-item" key={r.date}><div className="recent-date-icon"><CalendarDays size={20} /></div><div className="recent-info"><strong>{dateLabel(r.date)}</strong><span>نیسان {fa(r.nissan)} · آریسان {fa(r.arisan)} · خاور {fa(r.khavar)}</span></div><span className="recent-count">{fa(totalOf(r))} بار</span></div>)}</div>}<div className="recent-bottom"><button data-testid="recent-report-link" onClick={() => navigate('reports')}>مشاهده گزارش ماهانه <ChevronLeft size={16} /></button></div></section></div>
        </>}
        {tab === 'entry' && <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> ثبت روزانه</div><h1>ثبت بار</h1><p>تاریخ و تعداد بار هر خودرو را وارد کنید.</p></div><button type="button" className="secondary-button" data-testid="entry-back-home" onClick={() => navigate('home')}><ChevronRight size={18} /> بازگشت به خانه</button></div><section className="panel form-panel entry-form-panel" ref={formRef}><div className="section-head"><div><div className="section-kicker">اطلاعات تخلیه</div><h2>{editing ? 'ویرایش بارهای روز' : 'ثبت بار جدید'}</h2><p>برای هر تاریخ فقط یک رکورد ذخیره می‌شود.</p></div><div className="head-icon"><Plus size={23} /></div></div>
          <form onSubmit={submit} data-testid="load-form"><div className="field-label">تاریخ تخلیه بار</div><button type="button" className="date-selector" data-testid="date-picker-open" onClick={openCalendar}><span><CalendarDays size={20} /> {dateLabel(formDate)}</span><ChevronLeft size={19} /></button>{editing && <div className="edit-hint" data-testid="existing-date-hint"><Pencil size={16} /> برای این تاریخ قبلاً اطلاعات ثبت شده؛ ذخیره، همان اطلاعات را ویرایش می‌کند.</div>}
          <div className="field-label count-title">تعداد بارها <span>برای هر خودرو</span></div><div className="count-list">{VEHICLES.map(v => <div className="count-row" key={v.key}><div className="count-vehicle"><span className="count-vehicle-icon" style={{ backgroundColor: v.color + '18', color: v.color }}><Truck size={19} /></span><strong>{v.label}</strong></div><div className="counter"><button type="button" data-testid={`decrement-${v.key}`} aria-label={`کاهش ${v.label}`} onClick={() => changeCount(v.key, -1)}><Minus size={18} /></button><input aria-label={`تعداد بار ${v.label}`} data-testid={`input-${v.key}`} inputMode="numeric" pattern="[0-9۰-۹٠-٩]*" value={counts[v.key]} onChange={e => updateCount(v.key, e.target.value)} /><button type="button" data-testid={`increment-${v.key}`} aria-label={`افزایش ${v.label}`} onClick={() => changeCount(v.key, 1)}><Plus size={19} /></button></div></div>)}</div>
          <label className="field-label note-label" htmlFor="note">توضیحات <span>(اختیاری)</span></label><textarea id="note" data-testid="input-note" maxLength={500} rows={3} placeholder="مثلاً: تخلیه بار انبار شماره ۲..." value={note} onChange={e => setNote(e.target.value)} />
          <div className="form-footer"><div className="form-total">جمع این روز <strong data-testid="form-total">{fa(VEHICLES.reduce((s, v) => s + Number(counts[v.key] || 0), 0))} بار</strong></div><button type="submit" className="primary-button" data-testid="save-record"><Check size={19} /> {editing ? 'ذخیره تغییرات' : 'ثبت بارهای امروز'}</button></div></form></section></>}
        {tab === 'records' && <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> آرشیو روزانه</div><h1>سوابق ثبت‌شده</h1><p>تمام روزهایی که بار تخلیه کرده‌اید، به ترتیب تاریخ.</p></div><button className="primary-button heading-action" data-testid="new-record" onClick={() => { selectDate(today); navigate('entry'); }}><Plus size={19} /> ثبت بار جدید</button></div><section className="panel records-panel"><div className="records-toolbar"><div><h2>لیست بارهای روزانه</h2><p>{fa(filtered.length)} روز پیدا شد</p></div><div className="search-box"><Search size={19} /><input data-testid="records-search" aria-label="جست‌وجوی سوابق" value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی تاریخ یا توضیحات..." /></div></div>{filtered.length === 0 ? <div className="empty-state" data-testid="records-empty"><div className="empty-icon"><Search size={29} /></div><strong>{records.length ? 'موردی پیدا نشد' : 'هنوز سابقه‌ای ندارید'}</strong><p>{records.length ? 'عبارت جست‌وجو را تغییر دهید.' : 'از بخش خانه اولین بار روزانه را ثبت کنید.'}</p></div> : <div className="record-list">{filtered.map(r => <div className="record-card" key={r.date} data-testid={`record-${r.date}`}><div className="record-main"><div className="record-date"><span className="record-calendar"><CalendarDays size={20} /></span><div><strong>{dateLabel(r.date)}</strong><span>{r.note || 'بدون توضیحات'}</span></div></div><div className="record-breakdown">{VEHICLES.map(v => <span key={v.key}><i style={{ backgroundColor: v.color }} />{v.label} <strong>{fa(r[v.key])}</strong></span>)}</div><div className="record-total"><small>جمع کل</small><strong data-testid={`record-total-${r.date}`}>{fa(totalOf(r))} بار</strong></div></div><div className="record-actions"><button data-testid={`edit-${r.date}`} onClick={() => editRecord(r)}><Pencil size={17} /> ویرایش</button><button className="danger-action" data-testid={`delete-${r.date}`} onClick={() => setDeleteDate(r.date)}><Trash2 size={17} /> حذف</button></div></div>)}</div>}</section><section className="panel export-panel"><div><h2>گزارش سوابق روزانه</h2><p>گزارش تصویری سوابق ثبت‌شده را دریافت کنید.</p></div>{exportButtons('daily')}</section></>}
        {tab === 'reports' && <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> تحلیل عملکرد</div><h1>گزارش‌ها و آمار</h1><p>عملکرد ماهانه و سالانه را با یک نگاه ببینید.</p></div></div><section className="panel filter-panel"><div><strong>بازه گزارش</strong><p>ماه و سال دلخواه را انتخاب کنید</p></div><div className="filter-controls"><label>سال <select data-testid="report-year" value={reportYear} onChange={e => setReportYear(Number(e.target.value))}>{yearOptions.map(y => <option value={y} key={y}>{fa(y)}</option>)}</select></label><label>ماه <select data-testid="report-month" value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))}>{MONTHS.map((m, i) => <option value={i + 1} key={m}>{m}</option>)}</select></label></div></section><div className="report-section-title"><div><span className="section-kicker">گزارش ماهانه</span><h2>{reportTitle}</h2></div><span className="report-days">{fa(monthRows.length)} روز ثبت‌شده</span></div><section className="report-cards"><div className="report-total-card"><span>مجموع کل بارهای ماه</span><strong data-testid="report-month-total">{fa(monthSums.total)} <small>بار</small></strong><span>{reportTitle}</span></div>{VEHICLES.map(v => <div className="report-small-card" key={v.key}><span className="report-dot" style={{ backgroundColor: v.color }} /><span>بارهای {v.label}</span><strong data-testid={`report-month-${v.key}`}>{fa(monthSums[v.key])} <small>بار</small></strong></div>)}</section><section className="panel costs-panel" aria-label="هزینه دستمزدهای ماهانه"><div className="costs-heading"><div><span className="section-kicker">محاسبه دستمزد</span><h2>هزینه بارهای {reportTitle}</h2><p>بر اساس نرخ هر بار که در تنظیمات وارد کرده‌اید</p></div><Wallet size={24} /></div><div className="cost-breakdown">{VEHICLES.map(v => <div key={v.key}><span>{v.label} <small>({fa(monthSums[v.key])} بار × {money(rates[v.key])})</small></span><strong data-testid={`report-month-cost-${v.key}`}>{money(monthSums[v.key] * rates[v.key])}</strong></div>)}</div><div className="costs-total"><span>جمع کل دستمزد ماه</span><strong data-testid="report-month-cost-total">{money(costFor(monthSums))}</strong></div></section><div className="charts-grid"><section className="panel chart-panel"><div className="section-head"><div><h2>مقایسه خودروها</h2><p>سهم هر خودرو از بارهای این ماه</p></div><BarChart3 size={21} className="muted-icon" /></div><div className="vehicle-chart" data-testid="vehicle-chart">{VEHICLES.map(v => <div className="bar-row" key={v.key}><div><span>{v.label}</span><strong>{fa(monthSums[v.key])}</strong></div><div className="bar-track"><div style={{ width: `${monthSums.total ? (monthSums[v.key] / monthSums.total) * 100 : 0}%`, backgroundColor: v.color }} /></div></div>)}{!monthRows.length && <p className="chart-empty">برای این ماه هنوز باری ثبت نشده است.</p>}</div></section><section className="panel chart-panel"><div className="section-head"><div><h2>روند بارهای روزانه</h2><p>تعداد کل بارها در روزهای این ماه</p></div><Activity size={21} className="muted-icon" /></div><div className="daily-chart-scroll" data-testid="daily-chart"><div className="daily-chart">{Array.from({ length: daysInMonth(reportYear, reportMonth) }, (_, i) => { const r = monthRows.find(row => fromKey(row.date).day === i + 1); const value = r ? totalOf(r) : 0; const max = Math.max(1, ...monthRows.map(totalOf)); return <div className="day-column" key={i}><div className="day-bar-space" title={`${fa(i + 1)} ${MONTHS[reportMonth - 1]}: ${fa(value)} بار`}><div className={`day-bar ${value ? '' : 'zero'}`} style={{ height: `${value ? Math.max(8, value / max * 100) : 2}%` }} /></div><small>{fa(i + 1)}</small></div>; })}</div></div></section></div><section className="panel month-days-panel"><div className="section-head"><div><h2>جزئیات روزهای {MONTHS[reportMonth - 1]}</h2><p>ریز بارهای ثبت‌شده در این ماه</p></div></div>{monthRows.length ? <div className="table-scroll"><table data-testid="report-days-table"><thead><tr><th>تاریخ</th><th>نیسان</th><th>آریسان</th><th>خاور</th><th>جمع کل</th></tr></thead><tbody>{monthRows.map(r => <tr key={r.date}><td>{dateLabel(r.date)}</td><td>{fa(r.nissan)}</td><td>{fa(r.arisan)}</td><td>{fa(r.khavar)}</td><td><strong>{fa(totalOf(r))} بار</strong></td></tr>)}</tbody></table></div> : <div className="small-empty" data-testid="report-month-empty">در این ماه هنوز اطلاعاتی ثبت نشده است.</div>}</section><section className="panel export-panel"><div><h2>دریافت گزارش ماهانه</h2><p>گزارش {reportTitle} را به‌صورت تصویر JPG ذخیره کنید.</p></div>{exportButtons('month')}</section><div className="report-section-title annual-title"><div><span className="section-kicker">نمای سالانه</span><h2>عملکرد سال {fa(reportYear)}</h2></div><div className="annual-total" data-testid="report-year-total">مجموع سال: <strong>{fa(yearSums.total)} بار</strong> · دستمزد: <strong data-testid="report-year-cost-total">{money(costFor(yearSums))}</strong></div></div><section className="panel annual-panel"><div className="annual-grid">{MONTHS.map((m, i) => { const rows = yearRows.filter(r => fromKey(r.date).month === i + 1); const total = sumRows(rows).total; return <button key={m} data-testid={`year-month-${i + 1}`} className={`annual-month ${reportMonth === i + 1 ? 'selected' : ''}`} onClick={() => { setReportMonth(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><span>{m}</span><strong>{fa(total)} <small>بار</small></strong></button>; })}</div><div className="annual-footer"><span>نیسان: <b data-testid="report-year-nissan">{fa(yearSums.nissan)}</b></span><span>آریسان: <b data-testid="report-year-arisan">{fa(yearSums.arisan)}</b></span><span>خاور: <b data-testid="report-year-khavar">{fa(yearSums.khavar)}</b></span></div></section><section className="panel export-panel"><div><h2>دریافت گزارش سالانه</h2><p>گزارش تصویری تمام روزهای سال {fa(reportYear)}</p></div>{exportButtons('year')}</section></>}
        {tab === 'settings' && <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> نگهداری اطلاعات</div><h1>تنظیمات</h1><p>نرخ دستمزدها و نسخه پشتیبان اطلاعات را مدیریت کنید.</p></div></div><section className="panel rate-panel"><div className="rate-heading"><div className="setting-icon"><Wallet size={25} /></div><div><h2>ثبت مبالغ دستمزد حقوق بار</h2><p>نرخ هر بار را به تومان وارد کنید. توجه: در این نسخه نرخ‌ها به‌صورت کلی ذخیره می‌شوند، نه جداگانه برای هر ماه.</p></div></div><div className="rate-grid">{VEHICLES.map(v => <label className="rate-field" key={v.key}><span>هر بار {v.label}</span><div className="rate-input-wrap"><input type="text" inputMode="numeric" data-testid={`rate-${v.key}`} aria-label={`دستمزد هر بار ${v.label} به تومان`} value={rateInputs[v.key]} onChange={e => setRate(v.key, e.target.value)} onBlur={() => setRateInputs(previous => ({ ...previous, [v.key]: String(rates[v.key]) }))} /><span>تومان</span></div></label>)}</div><p className="rate-hint">با تغییر نرخ، هزینه گزارش‌های گذشته هم بر اساس نرخ جدید محاسبه می‌شود.</p></section><div className="settings-grid"><section className="panel setting-card"><div className="setting-icon"><Download size={25} /></div><h2>تهیه نسخه پشتیبان</h2><p>تمام سوابق ثبت‌شده در یک فایل ذخیره می‌شود. این فایل را در جای امن نگه دارید.</p><div className="setting-meta">شامل {fa(records.length)} روز ثبت‌شده</div><button className="primary-button" data-testid="backup-download" onClick={() => { exportBackup(records, rates); setNotice('فایل در پوشهٔ دانلود ذخیره شد.'); }}><ArrowDownToLine size={19} /> دریافت فایل پشتیبان</button></section><section className="panel setting-card"><div className="setting-icon blue"><ArchiveRestore size={25} /></div><h2>بازیابی اطلاعات</h2><p>با انتخاب فایل پشتیبان قبلی، اطلاعات فعلی جایگزین می‌شوند. پیش از بازیابی، از اطلاعات فعلی پشتیبان بگیرید.</p><div className="setting-meta">فایل با پسوند JSON</div><input ref={fileInput} type="file" accept=".json,application/json" className="hidden-input" data-testid="backup-file-input" onChange={restore} /><button className="secondary-button" data-testid="backup-restore" onClick={() => setRestoreOpen(true)}><ArchiveRestore size={19} /> انتخاب فایل و بازیابی</button></section></div><div className="privacy-note"><Database size={22} /><div><strong>اطلاعات شما روی دستگاه شماست</strong><p>سوابق در حافظه همین مرورگر یا برنامه ذخیره می‌شوند. پاک‌کردن داده‌های برنامه ممکن است آن‌ها را حذف کند؛ بهتر است هر چند وقت یک‌بار نسخه پشتیبان تهیه کنید.</p></div></div></>}
      </main>
      <footer className="footer">مدیریت تخلیه بار روزانه <span>•</span> ثبت ساده، گزارش دقیق</footer>
    </div>
    <nav className="bottom-nav" aria-label="منوی پایین">{navItems.map(item => <button key={item.id} data-testid={`bottom-nav-${item.id}`} className={tab === item.id ? 'active' : ''} onClick={() => navigate(item.id)}><item.icon size={22} strokeWidth={tab === item.id ? 2.4 : 1.8} /><span>{item.id === 'home' ? 'خانه' : item.id === 'records' ? 'سوابق' : item.id === 'reports' ? 'گزارش‌ها' : 'تنظیمات'}</span></button>)}</nav>
    {calendarOpen && <div className="modal-backdrop" onClick={() => setCalendarOpen(false)}><div className="calendar-modal" role="dialog" aria-modal="true" aria-label="انتخاب تاریخ شمسی" data-testid="calendar-dialog" onClick={e => e.stopPropagation()}><div className="modal-header"><div><span className="section-kicker">تقویم شمسی</span><h2>انتخاب تاریخ تخلیه</h2></div><button className="icon-button" aria-label="بستن تقویم" data-testid="calendar-close" onClick={() => setCalendarOpen(false)}><X size={21} /></button></div><div className="calendar-controls"><button aria-label="ماه قبل" data-testid="calendar-prev" onClick={() => moveCalendar(-1)}><ChevronRight size={20} /></button><div><select aria-label="ماه تقویم" data-testid="calendar-month" value={calendarMonth.month} onChange={e => setCalendarMonth({ ...calendarMonth, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select><select aria-label="سال تقویم" data-testid="calendar-year" value={calendarMonth.year} onChange={e => setCalendarMonth({ ...calendarMonth, year: Number(e.target.value) })}>{Array.from({ length: 201 }, (_, i) => 1300 + i).map(y => <option key={y} value={y}>{fa(y)}</option>)}</select></div><button aria-label="ماه بعد" data-testid="calendar-next" onClick={() => moveCalendar(1)}><ChevronLeft size={20} /></button></div><div className="calendar-grid">{WEEKDAYS.map((d, i) => <span className="week-label" key={i}>{d}</span>)}{Array.from({ length: firstDay }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: calendarDays }, (_, i) => { const key = keyOf({ ...calendarMonth, day: i + 1 }); return <button key={key} data-testid={`calendar-day-${i + 1}`} className={`${key === formDate ? 'selected' : ''} ${key === today ? 'today' : ''} ${records.some(r => r.date === key) ? 'has-record' : ''}`} onClick={() => selectDate(key)}>{fa(i + 1)}</button>; })}</div><button className="calendar-today" data-testid="calendar-today" onClick={() => selectDate(today)}>رفتن به امروز</button></div></div>}
    {deleteDate && <div className="modal-backdrop" onClick={() => setDeleteDate(null)}><div className="confirm-modal" role="alertdialog" aria-modal="true" aria-label="تأیید حذف" onClick={e => e.stopPropagation()}><div className="confirm-icon"><Trash2 size={25} /></div><h2>حذف رکورد روزانه؟</h2><p>اطلاعات {dateLabel(deleteDate)} حذف می‌شود و گزارش‌ها بلافاصله به‌روز خواهند شد. این کار قابل بازگشت نیست.</p><div className="confirm-actions"><button className="secondary-button" data-testid="cancel-delete" onClick={() => setDeleteDate(null)}>انصراف</button><button className="delete-button" data-testid="confirm-delete" onClick={deleteRecord}>بله، حذف شود</button></div></div></div>}
    {restoreOpen && <div className="modal-backdrop" onClick={() => setRestoreOpen(false)}><div className="confirm-modal" role="alertdialog" aria-modal="true" aria-label="تأیید بازیابی" onClick={e => e.stopPropagation()}><div className="confirm-icon restore"><ArchiveRestore size={25} /></div><h2>بازیابی نسخه پشتیبان</h2><p>با انتخاب فایل، همه اطلاعات فعلی با اطلاعات آن جایگزین می‌شوند. اگر لازم است ابتدا از داده‌های فعلی پشتیبان بگیرید.</p><div className="confirm-actions"><button className="secondary-button" data-testid="cancel-restore" onClick={() => setRestoreOpen(false)}>انصراف</button><button className="primary-button" data-testid="confirm-restore" onClick={() => fileInput.current?.click()}>انتخاب فایل</button></div></div></div>}
  </div>;
}

export default App;
