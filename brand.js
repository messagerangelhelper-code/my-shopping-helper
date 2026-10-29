// Rebrand the app here: change the name, tagline and colors, and the whole app follows.
// (Also update the <title> and theme-color in index.html.)
export const BRAND = {
  name: "My Shopping Helper",
  tagline: "Type it once, then check every store you shop at. One list for all of them.",
  colors: {
    main: "#5b3fa8", // header, buttons
    mainHover: "#6d50bd",
    soft: "#f0ebfa", // light highlight
  },
};

export const GROUPS = [
  { id: "everything", name: "Everything stores", icon: "🛍️" },
  { id: "grocery", name: "Groceries", icon: "🥦" },
  { id: "home", name: "Furniture & home", icon: "🛋️" },
  { id: "discount", name: "Dollar & discount", icon: "💵" },
  { id: "pharmacy", name: "Pharmacy & everyday", icon: "💊" },
];

// Each store opens its own search, so prices and stock are always current.
// "note" shows under the button when the store needs something first (a local store, a membership).
// To earn from a store, join its affiliate program and set "affiliate" to a function that wraps
// the store link in your tracking link, e.g. affiliate: (url) => `https://YOUR-LINK?u=${encodeURIComponent(url)}`
// Programs to check: Amazon Associates; Impact (Walmart, Target, Wayfair, and others); FlexOffers; CJ.
const q = encodeURIComponent;
export const STORES = [
  // Everything stores
  { id: "amazon", name: "Amazon", group: "everything", search: (s) => `https://www.amazon.com/s?k=${q(s)}`, affiliate: null },
  { id: "walmart", name: "Walmart", group: "everything", search: (s) => `https://www.walmart.com/search?q=${q(s)}`, affiliate: null },
  { id: "target", name: "Target", group: "everything", search: (s) => `https://www.target.com/s?searchTerm=${q(s)}`, affiliate: null },
  { id: "costco", name: "Costco", group: "everything", note: "Membership store", search: (s) => `https://www.costco.com/CatalogSearch?keyword=${q(s)}`, affiliate: null },
  { id: "samsclub", name: "Sam's Club", group: "everything", note: "Membership store", search: (s) => `https://www.samsclub.com/s/${q(s)}`, affiliate: null },

  // Groceries
  { id: "kroger", name: "Kroger", group: "grocery", note: "Pick your store for local prices", search: (s) => `https://www.kroger.com/search?query=${q(s)}`, affiliate: null },
  { id: "heb", name: "H-E-B", group: "grocery", note: "Pick your store for local prices", search: (s) => `https://www.heb.com/search?q=${q(s)}`, affiliate: null },
  { id: "wholefoods", name: "Whole Foods", group: "grocery", search: (s) => `https://www.wholefoodsmarket.com/search?text=${q(s)}`, affiliate: null },
  { id: "sprouts", name: "Sprouts", group: "grocery", note: "Pick your store for local prices", search: (s) => `https://shop.sprouts.com/search?search_term=${q(s)}`, affiliate: null },
  { id: "aldi", name: "Aldi", group: "grocery", note: "Pick your store for local prices", search: (s) => `https://www.aldi.us/results?q=${q(s)}`, affiliate: null },
  { id: "albertsons", name: "Albertsons", group: "grocery", search: (s) => `https://www.albertsons.com/shop/search-results.html?q=${q(s)}`, affiliate: null },
  { id: "tomthumb", name: "Tom Thumb", group: "grocery", note: "Texas (Albertsons family)", search: (s) => `https://www.tomthumb.com/shop/search-results.html?q=${q(s)}`, affiliate: null },
  { id: "traderjoes", name: "Trader Joe's", group: "grocery", note: "Browse only; buy in store", search: (s) => `https://www.traderjoes.com/home/search?q=${q(s)}&section=products`, affiliate: null },
  { id: "instacart", name: "Instacart", group: "grocery", note: "Many local stores, with delivery", search: (s) => `https://www.instacart.com/store/s?k=${q(s)}`, affiliate: null },

  // Furniture & home
  { id: "wayfair", name: "Wayfair", group: "home", search: (s) => `https://www.wayfair.com/keyword.php?keyword=${q(s)}`, affiliate: null },
  { id: "ashley", name: "Ashley", group: "home", search: (s) => `https://www.ashleyfurniture.com/search/?q=${q(s)}`, affiliate: null },
  { id: "roomstogo", name: "Rooms To Go", group: "home", search: (s) => `https://www.roomstogo.com/search?query=${q(s)}`, affiliate: null },
  { id: "ikea", name: "IKEA", group: "home", search: (s) => `https://www.ikea.com/us/en/search/?q=${q(s)}`, affiliate: null },

  // Dollar & discount
  { id: "dollartree", name: "Dollar Tree", group: "discount", search: (s) => `https://www.dollartree.com/searchresults?Ntt=${q(s)}`, affiliate: null },
  { id: "dollargeneral", name: "Dollar General", group: "discount", search: (s) => `https://www.dollargeneral.com/search?q=${q(s)}`, affiliate: null },
  { id: "familydollar", name: "Family Dollar", group: "discount", search: (s) => `https://www.familydollar.com/search?q=${q(s)}`, affiliate: null },
  { id: "fivebelow", name: "Five Below", group: "discount", search: (s) => `https://www.fivebelow.com/search?q=${q(s)}`, affiliate: null },

  // Pharmacy & everyday
  { id: "walgreens", name: "Walgreens", group: "pharmacy", search: (s) => `https://www.walgreens.com/search/results.jsp?Ntt=${q(s)}`, affiliate: null },
  { id: "cvs", name: "CVS", group: "pharmacy", search: (s) => `https://www.cvs.com/search?searchTerm=${q(s)}`, affiliate: null },
];

// Stores turned on for someone who hasn't chosen yet.
export const DEFAULT_STORES = ["amazon", "walmart", "target", "kroger", "heb", "dollartree", "dollargeneral", "walgreens"];

export function storeLink(store, query) {
  const url = store.search(query);
  return store.affiliate ? store.affiliate(url) : url;
}
