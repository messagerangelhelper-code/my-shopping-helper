import { useEffect, useMemo, useState } from "react";
import { BRAND, GROUPS, STORES, DEFAULT_STORES, storeLink } from "./brand.js";
import { loadData, saveData } from "./storage.js";
import { supabase } from "./account.js";
import Account from "./Account.jsx";
import Premium from "./Premium.jsx";
import { isPremium, checkPremiumOnce, syncAccount } from "./premium.js";

const pad = (n) => String(n).padStart(2, "0");
const isoLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const clean = (s, max = 80) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);
function niceDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return "";
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function addDays(iso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return isoLocal();
  return isoLocal(new Date(+m[1], +m[2] - 1, +m[3] + days));
}
const money = (v) => { const n = Number(String(v || "").replace(/[$,\s]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
const storeById = (id) => STORES.find((s) => s.id === id);

// Price per unit. Weights compare per ounce, liquids per fluid ounce, counts per item.
const UNITS = [
  { id: "oz", label: "oz", kind: "weight", factor: 1 },
  { id: "lb", label: "lb", kind: "weight", factor: 16 },
  { id: "g", label: "g", kind: "weight", factor: 0.035274 },
  { id: "kg", label: "kg", kind: "weight", factor: 35.274 },
  { id: "floz", label: "fl oz", kind: "volume", factor: 1 },
  { id: "qt", label: "quart", kind: "volume", factor: 32 },
  { id: "gal", label: "gallon", kind: "volume", factor: 128 },
  { id: "ml", label: "ml", kind: "volume", factor: 0.033814 },
  { id: "l", label: "liter", kind: "volume", factor: 33.814 },
  { id: "ct", label: "count", kind: "ct", factor: 1 },
  { id: "rolls", label: "rolls", kind: "rolls", factor: 1 },
  { id: "sheets", label: "sheets", kind: "sheets", factor: 1 },
  { id: "loads", label: "loads", kind: "loads", factor: 1 },
];
const unitById = (id) => UNITS.find((u) => u.id === id);
const PER = { weight: "oz", volume: "fl oz", ct: "each", rolls: "roll", sheets: "sheet", loads: "load" };
// Returns { value, per, kind } or null when there's no size.
function perUnit(p) {
  const u = unitById(p.unit);
  const size = Number(p.size);
  if (!u || !(size > 0)) return null;
  return { value: p.price / (size * u.factor), per: PER[u.kind], kind: u.kind };
}
const fmtPer = (v) => (v < 0.1 ? `${(v * 100).toFixed(1)}¢` : `$${v.toFixed(2)}`);
// Best value = lowest price per unit among notes that can be compared (same kind of unit).
function bestValue(prices) {
  const withUnit = (prices || []).map((p) => ({ p, u: perUnit(p) })).filter((x) => x.u);
  if (withUnit.length < 2) return null;
  const counts = {};
  withUnit.forEach((x) => { counts[x.u.kind] = (counts[x.u.kind] || 0) + 1; });
  const kind = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const same = withUnit.filter((x) => x.u.kind === kind);
  if (same.length < 2) return null;
  return same.reduce((b, x) => (!b || x.u.value < b.u.value ? x : b), null);
}
const RESTOCK_PRESETS = [
  { text: "Paper towels", weeks: 2 }, { text: "Toilet paper", weeks: 2 }, { text: "Laundry detergent", weeks: 4 },
  { text: "Dish soap", weeks: 4 }, { text: "Trash bags", weeks: 4 }, { text: "Pet food", weeks: 3 },
  { text: "Diapers", weeks: 1 }, { text: "Toothpaste", weeks: 6 }, { text: "Coffee", weeks: 2 },
];

function StoreButtons({ query, stores }) {
  return (
    <div className="store-grid">
      {stores.map((s) => (
        <a key={s.id} className="store-btn" href={storeLink(s, query)} target="_blank" rel="noopener noreferrer sponsored">
          <span>{s.name} ↗</span>
          {s.note && <span className="store-note">{s.note}</span>}
        </a>
      ))}
    </div>
  );
}

function GroupedStores({ query, ids }) {
  return GROUPS.map((g) => {
    const list = STORES.filter((s) => s.group === g.id && ids.includes(s.id));
    if (!list.length) return null;
    return (
      <div key={g.id} className="group">
        <h3>{g.icon} {g.name}</h3>
        <StoreButtons query={query} stores={list} />
      </div>
    );
  });
}

export default function App() {
  const [data, setData] = useState(loadData);
  const [premium, setPremium] = useState(isPremium);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState("home"); // home | list | stores | restock | premium | settings
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [openItem, setOpenItem] = useState(null);
  const [priceDraft, setPriceDraft] = useState({ store: "", price: "", size: "", unit: "oz" });
  const [toast, setToast] = useState("");

  const update = (fn) => setData((d) => { const next = fn(d); saveData(next); return next; });
  const go = (v) => { setView(v); setOpenItem(null); window.scrollTo({ top: 0 }); };

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--main", BRAND.colors.main);
    root.setProperty("--main-2", BRAND.colors.mainHover);
    root.setProperty("--soft", BRAND.colors.soft);
    document.title = BRAND.name;
    checkPremiumOnce().then((status) => {
      setPremium(isPremium());
      if (status === "activated") setNotice("Premium is active. Thank you! More lists, price notes and restock reminders are unlocked.");
      else if (status === "expired") setNotice("Your Premium plan has ended. Your lists are still saved on this phone.");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
      syncAccount().then(() => setPremium(isPremium()));
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { document.documentElement.classList.toggle("big-text", !!data.bigText); }, [data.bigText]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const myIds = data.stores && data.stores.length ? data.stores : DEFAULT_STORES;
  const otherIds = STORES.map((s) => s.id).filter((id) => !myIds.includes(id));
  const list = data.lists.find((l) => l.id === data.activeList) || data.lists[0];
  const openCount = list.items.filter((i) => !i.got).length;
  const today = isoLocal();
  const restock = data.restock || [];
  const dueRestock = restock.filter((r) => addDays(r.last || "1970-01-01", r.weeks * 7) <= today);

  // ---------- actions ----------
  function runSearch(text) {
    const s = clean(text);
    if (!s) return;
    setQuery(s);
    setSearched(s);
    setShowMore(false);
    update((d) => ({ ...d, recent: [s, ...(d.recent || []).filter((r) => r.toLowerCase() !== s.toLowerCase())].slice(0, 8) }));
  }
  function addToList(text, listId = list.id) {
    const s = clean(text);
    if (!s) return false;
    const target = data.lists.find((l) => l.id === listId) || list;
    if (target.items.some((i) => !i.got && i.name.toLowerCase() === s.toLowerCase())) { setToast("Already on your list."); return false; }
    if (target.items.length >= 300) { setToast("This list is full. Clear checked items first."); return false; }
    update((d) => ({ ...d, lists: d.lists.map((l) => (l.id === target.id ? { ...l, items: [...l.items, { id: uid(), name: s, got: false, prices: [] }] } : l)) }));
    setToast(`Added to "${target.name}".`);
    return true;
  }
  const editItem = (itemId, fn) => update((d) => ({ ...d, lists: d.lists.map((l) => (l.id === list.id ? { ...l, items: l.items.map((i) => (i.id === itemId ? fn(i) : i)) } : l)) }));
  function newList() {
    if (!premium) return go("premium");
    const name = clean(window.prompt("Name your new list (for example: Weekly groceries)") || "", 40);
    if (!name) return;
    if (data.lists.length >= 20) return setToast("You can have up to 20 lists.");
    const id = uid();
    update((d) => ({ ...d, lists: [...d.lists, { id, name, items: [] }], activeList: id }));
  }
  async function shareList() {
    const items = list.items.filter((i) => !i.got);
    const text = `${list.name}:\n${items.map((i) => `• ${i.name}`).join("\n")}`;
    if (navigator.share) { try { await navigator.share({ title: list.name, text }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(text); setToast("List copied. Paste it into a text or note."); } catch { setToast("Couldn't copy on this browser."); }
  }

  // ---------- screens ----------
  let body;
  if (view === "premium") {
    body = <Premium premium={premium} onBack={() => go("home")} />;
  } else if (view === "settings") {
    body = (
      <>
        <button type="button" className="link back" onClick={() => go("home")}>← Back</button>
        <section className="card">
          <h2>Settings</h2>
          <label className="toggle">
            <input type="checkbox" checked={!!data.bigText} onChange={(e) => update((d) => ({ ...d, bigText: e.target.checked }))} />
            <span>Bigger text</span>
          </label>
          <button type="button" className="btn-secondary" onClick={() => go("stores")}>Choose my stores</button>
          <p className="muted small">Your lists and stores are saved on this phone.</p>
        </section>
        <Account premium={premium} />
      </>
    );
  } else if (view === "stores") {
    body = (
      <>
        <button type="button" className="link back" onClick={() => go("home")}>← Back</button>
        <section className="card hero">
          <h1>My stores</h1>
          <p className="muted">Pick the stores you shop at. They show first when you search. The rest stay one tap away under "More stores".</p>
        </section>
        {GROUPS.map((g) => (
          <section key={g.id} className="card">
            <h2>{g.icon} {g.name}</h2>
            <ul className="rows">
              {STORES.filter((s) => s.group === g.id).map((s) => {
                const on = myIds.includes(s.id);
                return (
                  <li key={s.id} className="row">
                    <label className="store-pick">
                      <input type="checkbox" className="tick" checked={on} onChange={(e) => update((d) => {
                        const cur = d.stores && d.stores.length ? d.stores : DEFAULT_STORES;
                        const next = e.target.checked ? [...new Set([...cur, s.id])] : cur.filter((x) => x !== s.id);
                        if (!next.length) { setToast("Keep at least one store."); return d; }
                        return { ...d, stores: STORES.map((x) => x.id).filter((id) => next.includes(id)) };
                      })} />
                      <span><strong>{s.name}</strong>{s.note && <span className="muted small block">{s.note}</span>}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </>
    );
  } else if (view === "restock") {
    if (!premium) {
      body = (
        <>
          <button type="button" className="link back" onClick={() => go("home")}>← Back</button>
          <section className="card premium-teaser">
            <h1>🔁 Restock reminders</h1>
            <p>Never run out of the basics. Tell the app how often you buy paper towels, detergent or pet food, and it flags each one when it's time to buy again.</p>
            <button type="button" className="btn-primary" onClick={() => go("premium")}>See Premium</button>
          </section>
        </>
      );
    } else {
      const sorted = [...restock].sort((a, b) => addDays(a.last || "1970-01-01", a.weeks * 7).localeCompare(addDays(b.last || "1970-01-01", b.weeks * 7)));
      const presets = RESTOCK_PRESETS.filter((p) => !restock.some((r) => r.text === p.text));
      body = (
        <>
          <button type="button" className="link back" onClick={() => go("home")}>← Back</button>
          <section className="card">
            <h1>🔁 Restock reminders</h1>
            {sorted.length === 0 && <p className="muted">Tap an item below to start.</p>}
            <ul className="rows">
              {sorted.map((r) => {
                const due = addDays(r.last || "1970-01-01", r.weeks * 7);
                const late = due <= today;
                return (
                  <li key={r.id} className="row">
                    <span className="row-main">
                      <span className="row-title">{r.text}</span>
                      <span className={`row-sub${late ? " overdue" : ""}`}>{late ? "Time to buy" : `Next: ${niceDate(due)}`} · every {r.weeks === 1 ? "week" : `${r.weeks} weeks`}</span>
                    </span>
                    <span className="row-actions">
                      {late && <button type="button" className="link small" onClick={() => addToList(r.text)}>+ List</button>}
                      <button type="button" className="btn-secondary small-btn" onClick={() => { update((d) => ({ ...d, restock: d.restock.map((x) => (x.id === r.id ? { ...x, last: today } : x)) })); setToast("Got it. Next reminder is set."); }}>Bought</button>
                      <button type="button" className="link danger small" aria-label={`Delete ${r.text}`} onClick={() => update((d) => ({ ...d, restock: d.restock.filter((x) => x.id !== r.id) }))}>✕</button>
                    </span>
                  </li>
                );
              })}
            </ul>
            {presets.length > 0 && (
              <>
                <p className="label">Quick add</p>
                <div className="chips">
                  {presets.map((p) => (
                    <button key={p.text} type="button" className="chip" onClick={() => update((d) => ({ ...d, restock: [...(d.restock || []), { id: uid(), ...p, last: today }] }))}>+ {p.text}</button>
                  ))}
                </div>
                <p className="muted small">Quick-add items count from today. Tap "Bought" each time you buy one.</p>
              </>
            )}
            <form className="inline-form" onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const text = clean(f.get("text"), 60);
              if (!text) return;
              update((d) => ({ ...d, restock: [...(d.restock || []), { id: uid(), text, weeks: Number(f.get("weeks")) || 2, last: today }] }));
              e.currentTarget.reset();
            }}>
              <div className="field"><label className="label" htmlFor="rs-text">Your own item</label><input id="rs-text" name="text" maxLength={60} placeholder="Water filters" /></div>
              <div className="field"><label className="label" htmlFor="rs-weeks">Buy it every</label>
                <select id="rs-weeks" name="weeks" defaultValue="4">{[1, 2, 3, 4, 6, 8, 12].map((w) => <option key={w} value={w}>{w === 1 ? "week" : `${w} weeks`}</option>)}</select>
              </div>
              <button type="submit" className="btn-primary">Add reminder</button>
            </form>
          </section>
        </>
      );
    }
  } else if (view === "list") {
    const open = list.items.filter((i) => !i.got);
    const got = list.items.filter((i) => i.got);
    body = (
      <>
        <button type="button" className="link back" onClick={() => go("home")}>← Back</button>
        <div className="list-tabs" role="tablist" aria-label="Your lists">
          {data.lists.map((l) => (
            <button key={l.id} type="button" role="tab" aria-selected={l.id === list.id} className={l.id === list.id ? "chip on" : "chip"} onClick={() => { update((d) => ({ ...d, activeList: l.id })); setOpenItem(null); }}>
              {l.name} ({l.items.filter((i) => !i.got).length})
            </button>
          ))}
          <button type="button" className="chip" onClick={newList}>+ New list{!premium && <span className="pill-premium">Premium</span>}</button>
        </div>
        <section className="card">
          <div className="row-between">
            <h1>🛒 {list.name}</h1>
            {open.length > 0 && <button type="button" className="btn-secondary small-btn" onClick={shareList}>Share</button>}
          </div>
          <form className="add-row" onSubmit={(e) => { e.preventDefault(); if (addToList(newItem)) setNewItem(""); }}>
            <label className="sr-only" htmlFor="new-item">Add an item</label>
            <input id="new-item" value={newItem} maxLength={80} placeholder="Add an item, like milk" onChange={(e) => setNewItem(e.target.value)} />
            <button type="submit" className="btn-primary">Add</button>
          </form>
          {list.items.length === 0 && <p className="muted">Nothing here yet. Add items above, or search from the home screen and tap "Add to my list".</p>}
          <ul className="items">
            {[...open, ...got].map((i) => {
              const best = (i.prices || []).reduce((b, p) => (!b || p.price < b.price ? p : b), null);
              const value = bestValue(i.prices);
              const isOpen = openItem === i.id;
              return (
                <li key={i.id} className={`item${i.got ? " got" : ""}`}>
                  <div className="item-top">
                    <input type="checkbox" className="tick" checked={i.got} aria-label={`Got ${i.name}`} onChange={(e) => editItem(i.id, (x) => ({ ...x, got: e.target.checked }))} />
                    <button type="button" className="item-main" aria-expanded={isOpen} onClick={() => { setOpenItem(isOpen ? null : i.id); setPriceDraft({ store: myIds[0], price: "", size: "", unit: (i.prices || []).find((p) => p.unit)?.unit || "oz" }); }}>
                      <span className="item-name">{i.name}</span>
                      {value && <span className="item-best">Best value: {storeById(value.p.store)?.name}, {fmtPer(value.u.value)} per {value.u.per}</span>}
                      {best && (!value || value.p.store !== best.store) && <span className={value ? "item-low" : "item-best"}>Lowest price: ${best.price.toFixed(2)} at {storeById(best.store)?.name}</span>}
                      {!i.got && <span className="muted small">{isOpen ? "Hide stores ▲" : "Find it at my stores ▼"}</span>}
                    </button>
                    <button type="button" className="link danger small" aria-label={`Remove ${i.name}`} onClick={() => update((d) => ({ ...d, lists: d.lists.map((l) => (l.id === list.id ? { ...l, items: l.items.filter((x) => x.id !== i.id) } : l)) }))}>✕</button>
                  </div>
                  {isOpen && !i.got && (
                    <div className="item-more">
                      <StoreButtons query={i.name} stores={myIds.map(storeById).filter(Boolean)} />
                      <div className="prices">
                        <p className="label">Price notes{!premium && <span className="pill-premium">Premium</span>}</p>
                        {(i.prices || []).length > 0 && (
                          <ul className="price-list">
                            {[...i.prices].sort((a, b) => (perUnit(a)?.value ?? Infinity) - (perUnit(b)?.value ?? Infinity) || a.price - b.price).map((p) => {
                              const u = perUnit(p);
                              return (
                              <li key={p.store} className={value && value.p.store === p.store ? "best-row" : ""}>
                                <span>
                                  {storeById(p.store)?.name}
                                  <span className="muted small block">{p.size ? `${p.size} ${unitById(p.unit)?.label || ""} · ` : ""}{niceDate(p.date)}</span>
                                </span>
                                <span className="price-cell">
                                  <strong>${p.price.toFixed(2)}</strong>
                                  {u && <span className="muted small block">{fmtPer(u.value)}/{u.per}</span>}
                                </span>
                                {premium && <button type="button" className="link danger small" aria-label={`Remove ${storeById(p.store)?.name} price`} onClick={() => editItem(i.id, (x) => ({ ...x, prices: x.prices.filter((y) => y.store !== p.store) }))}>✕</button>}
                              </li>
                              );
                            })}
                          </ul>
                        )}
                        {premium ? (
                          <form className="price-form" onSubmit={(e) => {
                            e.preventDefault();
                            const price = money(priceDraft.price);
                            if (!price || !priceDraft.store) return setToast("Pick a store and type the price.");
                            const size = Number(String(priceDraft.size).replace(/[^0-9.]/g, ""));
                            const note = { store: priceDraft.store, price, date: today, ...(size > 0 && size < 100000 ? { size: Math.round(size * 1000) / 1000, unit: priceDraft.unit } : {}) };
                            editItem(i.id, (x) => ({ ...x, prices: [...(x.prices || []).filter((y) => y.store !== priceDraft.store), note] }));
                            setPriceDraft({ ...priceDraft, price: "", size: "" });
                          }}>
                            <label className="sr-only" htmlFor={`ps-${i.id}`}>Store</label>
                            <select id={`ps-${i.id}`} value={priceDraft.store} onChange={(e) => setPriceDraft({ ...priceDraft, store: e.target.value })}>
                              {[...myIds, ...otherIds].map((id) => <option key={id} value={id}>{storeById(id).name}</option>)}
                            </select>
                            <label className="sr-only" htmlFor={`pp-${i.id}`}>Price</label>
                            <input id={`pp-${i.id}`} inputMode="decimal" maxLength={10} placeholder="Price $3.49" value={priceDraft.price} onChange={(e) => setPriceDraft({ ...priceDraft, price: e.target.value })} />
                            <div className="size-row">
                              <label className="sr-only" htmlFor={`pz-${i.id}`}>Size (optional)</label>
                              <input id={`pz-${i.id}`} inputMode="decimal" maxLength={8} placeholder="Size, like 24" value={priceDraft.size} onChange={(e) => setPriceDraft({ ...priceDraft, size: e.target.value })} />
                              <label className="sr-only" htmlFor={`pu-${i.id}`}>Unit</label>
                              <select id={`pu-${i.id}`} value={priceDraft.unit} onChange={(e) => setPriceDraft({ ...priceDraft, unit: e.target.value })}>
                                {UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                              </select>
                            </div>
                            <button type="submit" className="btn-secondary small-btn">Save</button>
                            <p className="muted small hint-full">Add the size from the label to compare price per ounce or per item. The size is optional.</p>
                          </form>
                        ) : (
                          <button type="button" className="link small" onClick={() => go("premium")}>Jot down each store's price and see the lowest</button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {got.length > 0 && <button type="button" className="link" onClick={() => update((d) => ({ ...d, lists: d.lists.map((l) => (l.id === list.id ? { ...l, items: l.items.filter((x) => !x.got) } : l)) }))}>Clear checked items</button>}
          {premium && data.lists.length > 1 && (
            <button type="button" className="link danger block" onClick={() => {
              if (!window.confirm(`Delete the list "${list.name}"?`)) return;
              update((d) => { const lists = d.lists.filter((l) => l.id !== list.id); return { ...d, lists, activeList: lists[0].id }; });
            }}>Delete this list</button>
          )}
        </section>
      </>
    );
  } else {
    body = (
      <>
        <section className="card hero">
          <h1>What are you shopping for?</h1>
          <p className="muted">{BRAND.tagline}</p>
          <form className="search-row" onSubmit={(e) => { e.preventDefault(); runSearch(query); }}>
            <label className="sr-only" htmlFor="q">Search every store</label>
            <input id="q" type="search" value={query} maxLength={80} placeholder="Try: paper towels, sofa, chicken" onChange={(e) => setQuery(e.target.value)} autoComplete="off" enterKeyHint="search" />
            <button type="submit" className="btn-primary">Search</button>
          </form>
          {!searched && (data.recent || []).length > 0 && (
            <div className="chips">
              {data.recent.map((r) => <button key={r} type="button" className="chip" onClick={() => runSearch(r)}>{r}</button>)}
            </div>
          )}
        </section>

        {searched && (
          <section className="card results">
            <div className="row-between">
              <h2>“{searched}” at my stores</h2>
              <button type="button" className="btn-secondary small-btn" onClick={() => addToList(searched)}>+ Add to my list</button>
            </div>
            <GroupedStores query={searched} ids={myIds} />
            {otherIds.length > 0 && (
              showMore ? (
                <>
                  <h2 className="more-title">More stores</h2>
                  <GroupedStores query={searched} ids={otherIds} />
                </>
              ) : (
                <button type="button" className="link" onClick={() => setShowMore(true)}>More stores ({otherIds.length}) ▼</button>
              )
            )}
            <p className="muted small">Each button opens that store's own search with its real prices. Some grocery stores ask you to pick your local store first.</p>
          </section>
        )}

        {premium && dueRestock.length > 0 && (
          <button type="button" className="card due-card" onClick={() => go("restock")}>
            <strong>🔁 Time to restock {dueRestock.length} {dueRestock.length === 1 ? "item" : "items"}</strong>
            <span className="muted small">{dueRestock.slice(0, 4).map((r) => r.text).join(" · ")}</span>
          </button>
        )}

        <nav className="quick-nav" aria-label="Your tools">
          <button type="button" className="qn" onClick={() => go("list")}><span aria-hidden="true">🛒</span>My list{openCount > 0 && <span className="count">{openCount}</span>}</button>
          <button type="button" className="qn" onClick={() => go("stores")}><span aria-hidden="true">🏬</span>My stores</button>
          <button type="button" className="qn wide" onClick={() => go("restock")}><span aria-hidden="true">🔁</span>Restock reminders{!premium && <span className="pill-premium">Premium</span>}</button>
        </nav>

        {!premium && (
          <section className="card premium-teaser">
            <h2>Shopping Helper Premium</h2>
            <p className="muted">More lists, price notes so you know which store is cheapest, and restock reminders. From $1.99 a month.</p>
            <button type="button" className="btn-primary" onClick={() => go("premium")}>See plans</button>
          </section>
        )}

        <section className="card">
          <h2>🛡️ Shop safely</h2>
          <p className="muted">Fake store sites and "your package is delayed" texts are common scams. Type store addresses yourself, and check anything suspicious with ScamShield, another CashCow app.</p>
          <a className="btn-secondary link-btn" href="https://cashcowai.online/scamshield.html" target="_blank" rel="noopener noreferrer">Check out ScamShield</a>
        </section>
        <section className="card">
          <h2>🔍 What's in your food?</h2>
          <p className="muted">My Health Check Scan scans a barcode and flags ingredients you may want to avoid.</p>
          <a className="btn-secondary link-btn" href="https://my-health-check-scan.onrender.com" target="_blank" rel="noopener noreferrer">Open My Health Check Scan</a>
        </section>
      </>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <button type="button" className="brand" onClick={() => { setSearched(""); setQuery(""); go("home"); }} aria-label={`${BRAND.name} home`}>
          <span className="logo" aria-hidden="true">🛍️</span>
          <span>{BRAND.name}</span>
        </button>
        <button type="button" className="link light" onClick={() => go("settings")}>Settings</button>
      </header>
      <main>
        {notice && (
          <div className="notice" role="status">
            <span>{notice}</span>
            <button type="button" className="link" onClick={() => setNotice("")} aria-label="Dismiss">✕</button>
          </div>
        )}
        {body}
        <p className="disclaimer">
          {BRAND.name} isn't connected to these stores. Buttons open each store's own website, where prices and stock are set by the store.
          {" "}{BRAND.name} may earn a commission on purchases.
        </p>
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
