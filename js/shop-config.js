(function (global) {
  "use strict";

  global.ShopConfig = {
    name: "Nome dello shop",
    email: "info@nomedelloshop.it",
    address: "Via Roma 12, 87100 Cosenza"
  };

  function applyShopBrand() {
    var cfg = global.ShopConfig;
    if (!cfg || !document.body) return;

    document.querySelectorAll("[data-shop-name]").forEach(function (el) {
      el.textContent = cfg.name;
    });

    document.querySelectorAll("[data-shop-email]").forEach(function (el) {
      el.textContent = cfg.email;
    });

    if (document.title && document.title.indexOf(" — Prodotto") !== -1) {
      document.title = cfg.name + " — Prodotto";
    } else if (!document.querySelector("[data-product-name]")) {
      document.title = cfg.name;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyShopBrand);
  } else {
    applyShopBrand();
  }

  global.applyShopBrand = applyShopBrand;
})(window);
