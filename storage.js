// Saved on this phone only: lists, chosen stores, recent searches and restock reminders.
const KEY = "msh-data";

const DEFAULTS = {
  stores: null, // null = use DEFAULT_STORES until the person chooses
  lists: [{ id: "main", name: "Shopping list", items: [] }],
  activeList: "main",
  recent: [],
  restock: [],
  bigText: false,
};

export function loadData() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    const d = { ...DEFAULTS, ...(v && typeof v === "object" ? v : {}) };
    if (!Array.isArray(d.lists) || !d.lists.length) d.lists = DEFAULTS.lists;
    if (!d.lists.some((l) => l.id === d.activeList)) d.activeList = d.lists[0].id;
    return d;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveData(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage not available (private window); the app still works */
  }
}
