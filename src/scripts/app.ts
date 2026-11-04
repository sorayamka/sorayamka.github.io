import { ui, type Locale } from "../lib/i18n";

interface CartItem {
  id: string;
  name: string;
  path: string;
  image: string;
  quantity: number;
}

interface CartProduct {
  id: string;
  name: string;
  path: string;
  image: string;
  quantity: number;
}

interface CatalogProduct {
  id: string;
  index: number;
  name: string;
  path: string;
  image: string;
  thumbnail: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  subcategorySlug: string;
  inStock: boolean;
  search: string;
}

const CART_KEY = "seventh-legion-cart:v1";
const root = document.documentElement;
const locale: Locale = document.body.dataset.locale === "en" ? "en" : "ru";
const t = ui[locale];
root.classList.add("js");

const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

const createCatalogProduct = (product: CatalogProduct, locale: Locale) => {
  const t = ui[locale];
  const image = product.thumbnail || product.image;
  const cardNumber = String(product.index + 1).padStart(3, "0");
  const card = document.createElement("article");
  card.className = "product-card";
  card.dataset.productCard = "";
  card.dataset.id = product.id;
  card.dataset.name = product.search;
  card.dataset.category = product.categorySlug;
  card.dataset.subcategory = product.subcategorySlug;
  card.dataset.stock = String(product.inStock);
  card.dataset.path = product.path;

  const media = document.createElement("a");
  media.className = "product-card__media";
  media.href = product.path;
  media.setAttribute(
    "aria-label",
    `${t.openProduct} ${product.name}, ${product.inStock ? t.inStock.toLocaleLowerCase(locale) : t.onOrder.toLocaleLowerCase(locale)}, ${locale === "en" ? "number" : "номер"} ${cardNumber}`,
  );

  if (image) {
    const imageElement = document.createElement("img");
    imageElement.src = image;
    if (product.thumbnail) imageElement.srcset = `${product.thumbnail} 480w, ${product.image} 1200w`;
    imageElement.sizes = "(max-width: 720px) 45vw, (max-width: 1280px) 30vw, 23vw";
    imageElement.alt = product.name;
    imageElement.width = 480;
    imageElement.height = 480;
    imageElement.loading = "lazy";
    imageElement.decoding = "async";
    media.append(imageElement);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "product-card__placeholder";
    placeholder.append(t.photoPending);
    media.append(placeholder);
  }

  const stock = document.createElement("span");
  stock.className = `product-card__stock${product.inStock ? "" : " is-out"}`;
  stock.textContent = product.inStock ? t.inStock : t.onOrder;
  const index = document.createElement("span");
  index.className = "product-card__index";
  index.textContent = cardNumber;
  media.append(stock, index);

  const body = document.createElement("div");
  body.className = "product-card__body";
  const category = document.createElement("span");
  category.className = "product-card__category";
  category.textContent = product.subcategory || product.category;
  const heading = document.createElement("h3");
  const title = document.createElement("a");
  title.href = product.path;
  title.setAttribute("translate", "no");
  title.textContent = product.name;
  heading.append(title);

  const bottom = document.createElement("div");
  bottom.className = "product-card__bottom";
  const price = document.createElement("span");
  price.className = "product-card__price";
  price.textContent = t.priceOnRequest;
  const addButton = document.createElement("button");
  addButton.className = "product-card__add";
  addButton.type = "button";
  addButton.dataset.addToCart = "";
  addButton.dataset.productId = product.id;
  addButton.dataset.productName = product.name;
  addButton.dataset.productPath = product.path;
  addButton.dataset.productImage = image;
  addButton.setAttribute("aria-label", `${t.addToCart}: ${product.name}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "19");
  svg.setAttribute("height", "19");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  const plus = document.createElementNS("http://www.w3.org/2000/svg", "path");
  plus.setAttribute("d", "M12 5v14M5 12h14");
  plus.setAttribute("stroke", "currentColor");
  plus.setAttribute("stroke-width", "1.8");
  plus.setAttribute("stroke-linecap", "round");
  svg.append(plus);
  addButton.append(svg);
  bottom.append(price, addButton);
  body.append(category, heading, bottom);
  card.append(media, body);
  return card;
};

const clampQuantity = (value: unknown) => Math.max(1, Math.min(9999, Math.trunc(Number(value) || 1)));

const itemWord = (value: number) => {
  if (locale === "en") return value === 1 ? "item" : "items";
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return "позиция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "позиции";
  return "позиций";
};

const loadCart = (): CartItem[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CartItem =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.path === "string" &&
          typeof item?.image === "string" &&
          Number.isFinite(item?.quantity),
      )
      .map((item) => ({ ...item, quantity: clampQuantity(item.quantity) }));
  } catch {
    return [];
  }
};

let cart = loadCart();

const saveCart = () => {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    return true;
  } catch {
    return false;
  }
};

const showToast = (message: string) => {
  const toast = document.querySelector<HTMLElement>("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(Number(toast.dataset.timer ?? 0));
  toast.dataset.timer = String(window.setTimeout(() => toast.classList.remove("is-visible"), 2800));
};

const updateCartCount = () => {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll<HTMLElement>("[data-cart-count]").forEach((element) => {
    element.textContent = String(count);
    element.toggleAttribute("data-has-items", count > 0);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-cart-open]").forEach((button) => {
    button.setAttribute("aria-label", locale === "en" ? `Open cart, ${count} ${itemWord(count)}` : `Открыть корзину, ${count} ${itemWord(count)}`);
  });
  document.querySelectorAll<HTMLElement>("[data-cart-page-count], [data-cart-hero-count]").forEach((element) => {
    element.textContent = String(count);
  });
};

const cartItemMarkup = (item: CartItem, full = false) => `
  <article class="cart-line${full ? " cart-line--full" : ""}">
    <a class="cart-line__image" href="${escapeHtml(item.path)}" aria-label="${t.openProduct} ${escapeHtml(item.name)}">
      ${item.image ? `<img src="${escapeHtml(item.image)}" alt="" width="160" height="120" loading="lazy" />` : `<span>${locale === "en" ? "7L" : "7Л"}</span>`}
    </a>
    <div class="cart-line__body">
      <a href="${escapeHtml(item.path)}" translate="no">${escapeHtml(item.name)}</a>
      <span>${t.priceOnRequest}</span>
      <div class="cart-line__controls">
        <button type="button" data-cart-action="decrease" data-cart-id="${escapeHtml(item.id)}" aria-label="${locale === "en" ? "Decrease quantity" : "Уменьшить количество"} ${escapeHtml(item.name)}">−</button>
        <output data-cart-quantity aria-label="${locale === "en" ? "Quantity" : "Количество"} ${escapeHtml(item.name)}">${item.quantity}</output>
        <button type="button" data-cart-action="increase" data-cart-id="${escapeHtml(item.id)}" aria-label="${locale === "en" ? "Increase quantity" : "Увеличить количество"} ${escapeHtml(item.name)}">+</button>
        <button class="cart-line__remove" type="button" data-cart-action="remove" data-cart-id="${escapeHtml(item.id)}" aria-label="${locale === "en" ? "Remove" : "Удалить"} ${escapeHtml(item.name)}">${locale === "en" ? "Remove" : "Удалить"}</button>
      </div>
    </div>
  </article>
`;

const renderCart = () => {
  const drawerItems = document.querySelector<HTMLElement>("[data-cart-drawer-items]");
  const empty = document.querySelector<HTMLElement>("[data-cart-empty]");
  const footer = document.querySelector<HTMLElement>("[data-cart-footer]");
  const pageItems = document.querySelector<HTMLElement>("[data-cart-page-items]");
  const pageEmpty = document.querySelector<HTMLElement>("[data-cart-page-empty]");
  const pageFooter = document.querySelector<HTMLElement>("[data-cart-page-footer]");
  const markup = cart.map((item) => cartItemMarkup(item)).join("");
  const pageMarkup = cart.map((item) => cartItemMarkup(item, true)).join("");

  if (drawerItems) drawerItems.innerHTML = markup;
  if (pageItems) pageItems.innerHTML = pageMarkup;
  if (empty) empty.hidden = cart.length > 0;
  if (footer) footer.hidden = cart.length === 0;
  if (pageEmpty) pageEmpty.hidden = cart.length > 0;
  if (pageFooter) pageFooter.hidden = cart.length === 0;
  updateCartCount();
};

const addToCart = (product: CartProduct, openAfterAdd = false) => {
  const quantity = clampQuantity(product.quantity);
  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    existing.quantity = clampQuantity(existing.quantity + quantity);
  } else {
    cart.push({ ...product, quantity });
  }
  if (!saveCart()) {
    showToast(locale === "en" ? "Could not save the cart" : "Не удалось сохранить корзину");
    return;
  }
  renderCart();
  if (openAfterAdd) {
    openCart();
  } else {
    showToast(locale === "en" ? `${product.name} added to cart` : `${product.name} добавлен в корзину`);
  }
};

const updateQuantity = (id: string, delta: number) => {
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;
  const removeItem = delta < 0 && item.quantity === 1;
  item.quantity = clampQuantity(item.quantity + delta);
  if (removeItem) cart = cart.filter((entry) => entry.id !== id);
  if (!saveCart()) {
    showToast(locale === "en" ? "Could not save the cart" : "Не удалось сохранить корзину");
    return;
  }
  renderCart();
};

const removeFromCart = (id: string) => {
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;
  if (!window.confirm(locale === "en" ? `Remove “${item.name}” from the cart?` : `Удалить «${item.name}» из корзины?`)) return;
  cart = cart.filter((entry) => entry.id !== id);
  if (!saveCart()) {
    showToast(locale === "en" ? "Could not save the cart" : "Не удалось сохранить корзину");
    return;
  }
  renderCart();
  document.querySelector<HTMLButtonElement>("[data-cart-open]")?.focus();
};

const clearCart = () => {
  if (cart.length === 0) return;
  if (!window.confirm(locale === "en" ? "Clear the entire cart?" : "Очистить всю корзину?")) return;
  cart = [];
  if (!saveCart()) {
    showToast(locale === "en" ? "Could not save the cart" : "Не удалось сохранить корзину");
    return;
  }
  renderCart();
  showToast(locale === "en" ? "Cart cleared" : "Корзина очищена");
  document.querySelector<HTMLAnchorElement>(locale === "en" ? 'a[href="/en/shop/"]' : 'a[href="/shop/"]')?.focus();
};

const downloadCart = () => {
  const now = new Date();
  const lines = locale === "en"
    ? [
        "Seventh Legion — shopping list",
        `Created: ${now.toLocaleString("en-US")}`,
        "",
        ...cart.map(
          (item, index) =>
            `${index + 1}. ${item.name}\n   Quantity: ${item.quantity}\n   Link: ${new URL(item.path, location.origin).href}\n   Price: on request`,
        ),
      ]
    : [
        "Седьмой Легион — рабочий список",
        `Сформирован: ${now.toLocaleString("ru-RU")}`,
        "",
        ...cart.map(
          (item, index) =>
            `${index + 1}. ${item.name}\n   Количество: ${item.quantity}\n   Ссылка: ${new URL(item.path, location.origin).href}\n   Цена: по запросу`,
        ),
      ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sedmoy-legion-${now.toLocaleDateString("sv-SE")}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast(locale === "en" ? "List downloaded" : "Список скачан");
};

const openCart = () => {
  const dialog = document.querySelector<HTMLDialogElement>("#cart-drawer");
  if (!dialog) return;
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  const scrollbarGap = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  document.body.style.paddingRight = `${scrollbarGap}px`;
  document.body.classList.add("has-modal");
  document.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus();
};

const closeCart = () => {
  const dialog = document.querySelector<HTMLDialogElement>("#cart-drawer");
  if (!dialog) return;
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
  document.body.style.paddingRight = "";
  document.body.classList.remove("has-modal");
};

const addProductFromButton = (button: HTMLElement) => {
  const form = button.closest<HTMLFormElement>("form");
  const input = form?.querySelector<HTMLInputElement>('input[name="quantity"]');
  if (input && !input.checkValidity()) {
    input.reportValidity();
    return;
  }
  addToCart(
    {
      id: button.dataset.productId ?? "",
      name: button.dataset.productName ?? (locale === "en" ? "Product" : "Товар"),
      path: button.dataset.productPath ?? "/shop/",
      image: button.dataset.productImage ?? "",
      quantity: clampQuantity(input?.value ?? 1),
    },
    button.dataset.openAfterAdd === "true",
  );
  button.classList.add("is-added");
  window.setTimeout(() => button.classList.remove("is-added"), 650);
};

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const addButton = target.closest<HTMLElement>("[data-add-to-cart]");
  if (addButton) {
    addProductFromButton(addButton);
    return;
  }

  if (target.closest("[data-cart-open]")) {
    openCart();
    return;
  }
  if (target.closest("[data-cart-close]")) {
    closeCart();
    return;
  }
  if (target.closest("[data-cart-clear]")) {
    clearCart();
    return;
  }
  if (target.closest("[data-cart-download]")) {
    downloadCart();
    return;
  }

  const action = target.closest<HTMLElement>("[data-cart-action]");
  if (action?.dataset.cartId) {
    const id = action.dataset.cartId;
    const actionName = action.dataset.cartAction ?? "";
    if (actionName === "increase") updateQuantity(id, 1);
    if (actionName === "decrease") {
      const item = cart.find((entry) => entry.id === id);
      if (item?.quantity === 1 && !window.confirm(locale === "en" ? `Remove “${item.name}” from the cart?` : `Удалить «${item.name}» из корзины?`)) return;
      updateQuantity(id, -1);
    }
    if (actionName === "remove") {
      removeFromCart(id);
      return;
    }
    if (actionName === "increase" || (actionName === "decrease" && cart.some((entry) => entry.id === id))) {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`[data-cart-action="${actionName}"][data-cart-id="${CSS.escape(id)}"]`)
          ?.focus();
      });
    }
  }
});

document.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-product-form]")) return;
  event.preventDefault();
});

const cartDialog = document.querySelector<HTMLDialogElement>("#cart-drawer");
cartDialog?.addEventListener("close", () => {
  document.body.style.paddingRight = "";
  document.body.classList.remove("has-modal");
});
cartDialog?.addEventListener("click", (event) => {
  if (event.target === cartDialog) closeCart();
});

window.addEventListener("storage", (event) => {
  if (event.key !== CART_KEY) return;
  cart = loadCart();
  renderCart();
});

const normalize = (value: string) => value.trim().toLocaleLowerCase(locale === "en" ? "en-US" : "ru-RU");

const initCatalog = (catalog: HTMLElement) => {
  const pageSize = 48;
  const numberFormatter = new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU");
  const search = catalog.querySelector<HTMLInputElement>("[data-catalog-search]");
  const stock = catalog.querySelector<HTMLInputElement>("[data-stock-filter]");
  const sort = catalog.querySelector<HTMLSelectElement>("[data-sort-select]");
  const subcategory = catalog.querySelector<HTMLSelectElement>("[data-subcategory-filter]");
  const categorySelect = catalog.querySelector<HTMLSelectElement>("[data-category-filter]");
  const grid = catalog.querySelector<HTMLElement>("[data-product-grid]");
  const resultCount = catalog.querySelector<HTMLElement>("[data-result-count]");
  const empty = catalog.querySelector<HTMLElement>("[data-catalog-empty]");
  const pagination = catalog.querySelector<HTMLElement>("[data-catalog-pagination]");
  const pageStart = catalog.querySelector<HTMLElement>("[data-page-start]");
  const pageEnd = catalog.querySelector<HTMLElement>("[data-page-end]");
  const pageTotal = catalog.querySelector<HTMLElement>("[data-page-total]");
  const pageSelect = catalog.querySelector<HTMLSelectElement>("[data-page-select]");
  const previousPage = catalog.querySelector<HTMLButtonElement>("[data-page-prev]");
  const nextPage = catalog.querySelector<HTMLButtonElement>("[data-page-next]");
  const initialCards = [...catalog.querySelectorAll<HTMLElement>("[data-product-card]")];
  const initialProducts = initialCards.map((card, index) => ({
    id: card.dataset.id ?? String(index),
    index,
    name: card.querySelector<HTMLElement>("h3")?.textContent?.trim() ?? (locale === "en" ? "Product" : "Товар"),
    path: card.dataset.path ?? "/shop/",
    image: card.querySelector<HTMLImageElement>("img")?.currentSrc ?? "",
    thumbnail: "",
    category: card.querySelector<HTMLElement>(".product-card__category")?.textContent?.trim() ?? "",
    categorySlug: card.dataset.category ?? "",
    subcategory: "",
    subcategorySlug: card.dataset.subcategory ?? "",
    inStock: card.dataset.stock === "true",
    search: card.dataset.name ?? "",
  }));
  const activeCategory = catalog.dataset.activeCategory ?? "";
  const activeSubcategory = catalog.dataset.activeSubcategory ?? "";
  const catalogIndex = catalog.dataset.catalogIndex;
  const base = catalog.dataset.catalogBase ?? "/shop/";
  let products: CatalogProduct[] = [];
  let catalogReady = false;
  let catalogRequest: Promise<CatalogProduct[]> | null = null;
  let category = activeCategory || new URLSearchParams(location.search).get("category") || "";
  let currentPage = Math.max(1, Number(new URLSearchParams(location.search).get("page")) || 1);
  let timer = 0;
  let historyMode: "push" | "replace" = "replace";
  let syncingUrl = false;

  const loadProducts = async () => {
    if (catalogReady) return products;
    if (!catalogRequest) {
      catalogRequest = (async () => {
        if (!catalogIndex) return initialProducts;
        try {
          const response = await fetch(catalogIndex, { credentials: "same-origin" });
          if (!response.ok) throw new Error(`Catalog index request failed: ${response.status}`);
          const parsed: unknown = await response.json();
          return Array.isArray(parsed) && parsed.length > 0 ? (parsed as CatalogProduct[]) : initialProducts;
        } catch {
          return initialProducts;
        }
      })().then((nextProducts) => {
        products = nextProducts;
        catalogReady = true;
        return products;
      });
    }
    return catalogRequest;
  };

  const updateCategoryUi = () => {
    catalog.querySelectorAll<HTMLButtonElement>("[data-filter-category]").forEach((button) => {
      const active = (button.dataset.filterCategory ?? "") === category;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (categorySelect) categorySelect.value = category;
    if (subcategory) {
      [...subcategory.options].forEach((option) => {
        if (!option.value) return;
        option.hidden = Boolean(category && option.dataset.category !== category);
      });
      if (subcategory.value && category && subcategory.selectedOptions[0]?.dataset.category !== category) {
        subcategory.value = "";
      }
    }
  };

  const syncUrl = () => {
    if (syncingUrl) return;
    const next = new URLSearchParams();
    if (search?.value.trim()) next.set("q", search.value.trim());
    if (category) next.set("category", category);
    if (subcategory?.value) next.set("subcategory", subcategory.value);
    if (stock?.checked) next.set("stock", "1");
    if (sort?.value && sort.value !== "name") next.set("sort", sort.value);
    if (currentPage > 1) next.set("page", String(currentPage));
    const query = next.toString();
    history[historyMode === "push" ? "pushState" : "replaceState"](null, "", query ? `${base}?${query}` : base);
    historyMode = "replace";
  };

  const updatePageSelect = (pageCount: number) => {
    if (!pageSelect) return;
    if (pageSelect.options.length !== pageCount) {
      pageSelect.replaceChildren(
        ...Array.from({ length: pageCount }, (_, index) => {
          const option = document.createElement("option");
          option.value = String(index + 1);
          option.textContent = String(index + 1);
          return option;
        }),
      );
    }
    pageSelect.value = String(currentPage);
  };

  const update = (resetPage = false) => {
    if (resetPage) currentPage = 1;
    updateCategoryUi();
    if (!catalogReady) return;
    const term = normalize(search?.value ?? "");
    const selectedStock = Boolean(stock?.checked);
    const selectedSubcategory = subcategory?.value ?? "";
    const visible = products.filter((product) => {
      const matchesSearch = !term || product.search.includes(term);
      const matchesCategory = !category || product.categorySlug === category;
      const matchesSubcategory = !selectedSubcategory || product.subcategorySlug === selectedSubcategory;
      const matchesStock = !selectedStock || product.inStock;
      return matchesSearch && matchesCategory && matchesSubcategory && matchesStock;
    });

    const mode = sort?.value ?? "name";
    visible.sort((left, right) => {
      if (mode === "category") {
        const categoryOrder = left.categorySlug.localeCompare(right.categorySlug, locale);
        if (categoryOrder !== 0) return categoryOrder;
      }
      return left.name.localeCompare(right.name, locale);
    });

    const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
    currentPage = Math.min(Math.max(1, currentPage), pageCount);
    const start = (currentPage - 1) * pageSize;
    const pageProducts = visible.slice(start, start + pageSize);
    if (grid) grid.replaceChildren(...pageProducts.map((product) => createCatalogProduct(product, locale)));

    if (resultCount) resultCount.textContent = numberFormatter.format(visible.length);
    if (empty) empty.hidden = visible.length > 0;
    if (grid) grid.hidden = visible.length === 0;
    if (pagination) pagination.hidden = visible.length <= pageSize;
    if (pageStart) pageStart.textContent = numberFormatter.format(visible.length ? start + 1 : 0);
    if (pageEnd) pageEnd.textContent = numberFormatter.format(visible.length ? Math.min(start + pageSize, visible.length) : 0);
    if (pageTotal) pageTotal.textContent = numberFormatter.format(visible.length);
    updatePageSelect(pageCount);
    if (previousPage) previousPage.disabled = currentPage === 1;
    if (nextPage) nextPage.disabled = currentPage === pageCount;
    syncUrl();
  };

  const scheduleUpdate = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void loadProducts().then(() => update(true));
    }, 90);
  };

  const scrollToGrid = () => {
    window.requestAnimationFrame(() => {
      if (!grid) return;
      const offset = window.matchMedia("(max-width: 1024px)").matches ? 84 : 112;
      const top = Math.max(0, window.scrollY + grid.getBoundingClientRect().top - offset);
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, top);
      root.style.scrollBehavior = previousScrollBehavior;
    });
  };

  const updateWithScroll = (resetPage: boolean) => {
    void loadProducts().then(() => {
      update(resetPage);
      scrollToGrid();
    });
  };

  const chooseCategory = (value: string) => {
    if (activeCategory && value !== activeCategory) {
      const catalogPath = locale === "en" ? "/en/shop/" : "/shop/";
      location.href = value ? `${catalogPath}?category=${encodeURIComponent(value)}` : catalogPath;
      return;
    }
    category = value;
    if (subcategory) subcategory.value = "";
    historyMode = "push";
    updateWithScroll(true);
  };

  const goToPage = (value: number) => {
    currentPage = Math.max(1, value);
    historyMode = "push";
    void loadProducts().then(() => {
      update();
      scrollToGrid();
    });
  };

  const applyUrl = () => {
    syncingUrl = true;
    const next = new URLSearchParams(location.search);
    category = activeCategory || next.get("category") || "";
    currentPage = Math.max(1, Number(next.get("page")) || 1);
    if (search) search.value = next.get("q") ?? "";
    if (stock) stock.checked = next.get("stock") === "1";
    if (sort) sort.value = next.get("sort") ?? "name";
    if (subcategory) subcategory.value = next.get("subcategory") ?? activeSubcategory;
    syncingUrl = false;
    const hasQuery = Boolean(
      next.get("q") ||
        (next.get("category") && !activeCategory) ||
        next.get("subcategory") ||
        next.get("stock") ||
        (next.get("sort") && next.get("sort") !== "name") ||
        next.get("page"),
    );
    if (catalogReady || hasQuery) {
      void loadProducts().then(() => update());
    } else {
      update();
    }
  };

  search?.addEventListener("input", () => {
    historyMode = "replace";
    scheduleUpdate();
  });
  stock?.addEventListener("change", () => {
    historyMode = "push";
    updateWithScroll(true);
  });
  sort?.addEventListener("change", () => {
    historyMode = "push";
    updateWithScroll(true);
  });
  subcategory?.addEventListener("change", () => {
    historyMode = "push";
    updateWithScroll(true);
  });
  categorySelect?.addEventListener("change", () => chooseCategory(categorySelect.value));
  pageSelect?.addEventListener("change", () => goToPage(Number(pageSelect.value)));
  previousPage?.addEventListener("click", () => goToPage(currentPage - 1));
  nextPage?.addEventListener("click", () => goToPage(currentPage + 1));

  catalog.querySelectorAll<HTMLButtonElement>("[data-filter-category]").forEach((button) => {
    button.addEventListener("click", () => chooseCategory(button.dataset.filterCategory ?? ""));
  });

  catalog.querySelectorAll<HTMLElement>("[data-catalog-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      category = activeCategory;
      if (search) search.value = "";
      if (stock) stock.checked = false;
      if (subcategory) subcategory.value = "";
      if (sort) sort.value = "name";
      historyMode = "push";
      updateWithScroll(true);
    });
  });

  const filterToggle = catalog.querySelector<HTMLButtonElement>("[data-filter-toggle]");
  const filterPanel = catalog.querySelector<HTMLElement>("[data-filter-panel]");
  filterToggle?.addEventListener("click", () => {
    const open = filterToggle.getAttribute("aria-expanded") !== "true";
    filterToggle.setAttribute("aria-expanded", String(open));
    filterPanel?.classList.toggle("is-open", open);
  });

  window.addEventListener("popstate", applyUrl);
  applyUrl();
};

document.querySelectorAll<HTMLElement>("[data-catalog]").forEach(initCatalog);

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const input = document.querySelector<HTMLInputElement>("[data-catalog-search]");
  const editable = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (event.key === "/" && !editable && !event.ctrlKey && !event.metaKey && !event.altKey && input) {
    event.preventDefault();
    input.focus();
  }
});

const initReveal = () => {
  const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -7%", threshold: 0.08 },
  );
  elements.forEach((element) => observer.observe(element));
};

const initHeader = () => {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const update = () => header?.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
  document.querySelectorAll<HTMLDetailsElement>(".desktop-nav .nav-menu").forEach((menu) => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      document.querySelectorAll<HTMLDetailsElement>(".desktop-nav .nav-menu").forEach((other) => {
        if (other !== menu) other.open = false;
      });
    });
  });
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(".desktop-nav")) return;
    document.querySelectorAll<HTMLDetailsElement>(".desktop-nav .nav-menu[open]").forEach((menu) => {
      menu.open = false;
    });
  });
};

const initMobileMenu = () => {
  const menu = document.querySelector<HTMLDetailsElement>(".mobile-menu");
  if (!menu) return;
  const summary = menu.querySelector<HTMLElement>("summary");
  const panel = menu.querySelector<HTMLElement>(".mobile-menu__panel");
  const closeButton = menu.querySelector<HTMLButtonElement>("[data-mobile-menu-close]");
  const background = [
    document.querySelector<HTMLElement>(".topline"),
    document.querySelector<HTMLElement>(".brand"),
    document.querySelector<HTMLElement>(".desktop-nav"),
    document.querySelector<HTMLElement>(".header-search"),
    document.querySelector<HTMLElement>(".header-phone"),
    document.querySelector<HTMLElement>("[data-cart-open]"),
    document.querySelector<HTMLElement>("main"),
    document.querySelector<HTMLElement>(".site-footer"),
  ].filter((element): element is HTMLElement => Boolean(element));
  let previousFocus: HTMLElement | null = null;

  const setOpenState = (open: boolean) => {
    document.body.classList.toggle("mobile-menu-open", open);
    summary?.setAttribute("aria-expanded", String(open));
    background.forEach((element) => {
      element.inert = open;
    });
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.requestAnimationFrame(() => closeButton?.focus());
    } else {
      previousFocus?.focus();
    }
  };

  menu.addEventListener("toggle", () => setOpenState(menu.open));
  closeButton?.addEventListener("click", () => {
    menu.open = false;
  });
  panel?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) menu.open = false;
  });
  panel?.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || !panel) return;
    const focusable = [...panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
};

const initTicker = () => {
  const ticker = document.querySelector<HTMLElement>(".ticker");
  const toggle = ticker?.querySelector<HTMLButtonElement>("[data-ticker-toggle]");
  if (ticker && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(([entry]) => ticker.classList.toggle("is-offscreen", !entry.isIntersecting), { threshold: 0 });
    observer.observe(ticker);
  }
  toggle?.addEventListener("click", () => {
    const paused = ticker?.classList.toggle("is-paused") ?? false;
    toggle.setAttribute("aria-label", paused ? (locale === "en" ? "Start motion" : "Запустить движение") : locale === "en" ? "Stop motion" : "Остановить движение");
    toggle.textContent = paused ? "▶" : "Ⅱ";
  });
};

initReveal();
initHeader();
initMobileMenu();
initTicker();
renderCart();
