(function (global) {
  "use strict";

  var SLOT_BY_TAG = {
    Blazer: "top",
    Top: "top",
    Knitwear: "top",
    Gonna: "bottom",
    Pantaloni: "bottom",
    Calzature: "shoes",
    Borse: "accessory",
    Accessories: "accessory"
  };

  var SLOT_LABELS = {
    top: "Top · Maglia",
    bottom: "Gonna · Pantaloni",
    shoes: "Scarpe",
    accessory: "Accessori · Borsa"
  };

  var SLOT_ORDER = ["top", "bottom", "shoes", "accessory"];

  function resetLayer(layer) {
    layer.onerror = null;
    layer.onload = null;
    layer.alt = "";
    layer.removeAttribute("data-fitting-src");
    layer.removeAttribute("src");
    layer.removeAttribute("hidden");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getSlot(product) {
    if (product.fittingSlot) return product.fittingSlot;
    return SLOT_BY_TAG[product.tag] || "top";
  }

  function getAsset(product) {
    if (product.fitting) return product.fitting;
    return "img/fitting/" + product.id + ".png";
  }

  function findProduct(products, id) {
    return products.find(function (item) {
      return item.id === id;
    }) || null;
  }

  function FittingRoom(options) {
    this.products = options.products || [];
    this.getMode = options.getMode || function () { return "loud"; };
    this.root = typeof options.root === "string"
      ? document.querySelector(options.root)
      : options.root;
    this.outfit = { top: null, bottom: null, shoes: null, accessory: null };
    this.dragProductId = null;

    if (!this.root) return;

    this.piecesEl = this.root.querySelector("[data-fitting-pieces]");
    this.currentEl = this.root.querySelector("[data-fitting-current]");
    this.zones = {};
    var self = this;

    this.root.querySelectorAll("[data-fitting-zone]").forEach(function (zone) {
      var slot = zone.getAttribute("data-fitting-zone");
      self.zones[slot] = zone;
    });

    this.bind();
    this.renderPieces();
    this.renderMannequin();
    this.renderCurrent();
  }

  FittingRoom.prototype.bind = function () {
    var self = this;

    if (this.piecesEl) {
      this.piecesEl.addEventListener("dragstart", function (event) {
        var card = event.target.closest("[data-fitting-piece]");
        if (!card) return;
        self.dragProductId = Number(card.getAttribute("data-fitting-piece"));
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", String(self.dragProductId));
        card.classList.add("is-dragging");
      });

      this.piecesEl.addEventListener("dragend", function (event) {
        var card = event.target.closest("[data-fitting-piece]");
        if (card) card.classList.remove("is-dragging");
        self.dragProductId = null;
      });

      this.piecesEl.addEventListener("click", function (event) {
        var card = event.target.closest("[data-fitting-piece]");
        if (!card) return;
        self.assignPiece(Number(card.getAttribute("data-fitting-piece")));
      });
    }

    SLOT_ORDER.forEach(function (slot) {
      var zone = self.zones[slot];
      if (!zone) return;

      zone.addEventListener("dragover", function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        zone.classList.add("is-over");
      });

      zone.addEventListener("dragleave", function () {
        zone.classList.remove("is-over");
      });

      zone.addEventListener("drop", function (event) {
        event.preventDefault();
        zone.classList.remove("is-over");
        var raw = event.dataTransfer.getData("text/plain");
        var productId = raw ? Number(raw) : self.dragProductId;
        if (!productId) return;
        self.assignPiece(productId, slot);
      });
    });

    if (this.currentEl) {
      this.currentEl.addEventListener("click", function (event) {
        var removeBtn = event.target.closest("[data-fitting-remove]");
        if (!removeBtn) return;
        event.preventDefault();
        event.stopPropagation();
        self.removeSlot(removeBtn.getAttribute("data-fitting-remove"));
      });
    }
  };

  FittingRoom.prototype.getVisibleProducts = function () {
    var mode = this.getMode();
    return this.products.filter(function (product) {
      return product.attitude === mode;
    });
  };

  FittingRoom.prototype.renderPieces = function () {
    if (!this.piecesEl) return;

    var products = this.getVisibleProducts();
    if (!products.length) {
      this.piecesEl.innerHTML = '<p class="fitting-empty">Nessun pezzo per questa attitude.</p>';
      return;
    }

    this.piecesEl.innerHTML = products.map(function (product) {
      var asset = getAsset(product);
      var slot = getSlot(product);
      return (
        '<article class="fitting-piece" data-fitting-piece="' + product.id + '" data-fitting-slot="' + slot + '" draggable="true" role="button" tabindex="0" aria-label="Indossa ' + escapeHtml(product.name) + '">' +
        '<div class="fitting-piece-media">' +
        '<img src="' + escapeHtml(asset) + '" alt="" loading="lazy" data-fitting-fallback="' + escapeHtml(product.name) + '">' +
        "</div>" +
        '<div class="fitting-piece-meta">' +
        '<span class="fitting-piece-name">' + escapeHtml(product.name) + "</span>" +
        '<span class="fitting-piece-slot">' + escapeHtml(SLOT_LABELS[slot] || slot) + "</span>" +
        "</div>" +
        "</article>"
      );
    }).join("");

    this.piecesEl.querySelectorAll("[data-fitting-fallback]").forEach(function (image) {
      image.addEventListener("error", function onError() {
        image.removeEventListener("error", onError);
        var label = image.getAttribute("data-fitting-fallback") || "Pezzo";
        image.replaceWith(
          Object.assign(document.createElement("span"), {
            className: "fitting-piece-fallback",
            textContent: label
          })
        );
      });
    });
  };

  FittingRoom.prototype.renderMannequin = function () {
    var self = this;

    SLOT_ORDER.forEach(function (slot) {
      var zone = self.zones[slot];
      if (!zone) return;

      var layer = zone.querySelector("[data-fitting-layer]");
      var productId = self.outfit[slot];
      var product = productId ? findProduct(self.products, productId) : null;

      zone.classList.toggle("is-filled", Boolean(product));
      zone.classList.remove("is-over");

      if (!layer) return;

      if (!product) {
        resetLayer(layer);
        return;
      }

      var asset = getAsset(product);
      layer.alt = product.name;
      layer.removeAttribute("hidden");
      layer.onerror = function () {
        self.outfit[slot] = null;
        self.renderMannequin();
        self.renderCurrent();
      };
      if (layer.getAttribute("data-fitting-src") !== asset) {
        layer.setAttribute("data-fitting-src", asset);
        layer.src = asset;
      }
    });
  };

  FittingRoom.prototype.renderCurrent = function () {
    if (!this.currentEl) return;

    var self = this;
    var items = SLOT_ORDER.map(function (slot) {
      var productId = self.outfit[slot];
      if (!productId) return null;
      var product = findProduct(self.products, productId);
      if (!product) return null;
      return { slot: slot, product: product };
    }).filter(Boolean);

    if (!items.length) {
      this.currentEl.innerHTML = '<p class="fitting-empty">Nessun pezzo selezionato</p>';
      return;
    }

    this.currentEl.innerHTML =
      '<ul class="fitting-current-list">' +
      items.map(function (item) {
        return (
          '<li class="fitting-current-item">' +
          '<span class="fitting-current-slot">' + escapeHtml(SLOT_LABELS[item.slot] || item.slot) + "</span>" +
          '<span class="fitting-current-name">' + escapeHtml(item.product.name) + "</span>" +
          '<button type="button" class="fitting-remove" data-fitting-remove="' + item.slot + '" aria-label="Rimuovi ' + escapeHtml(item.product.name) + '">Rimuovi</button>' +
          "</li>"
        );
      }).join("") +
      "</ul>";
  };

  FittingRoom.prototype.assignPiece = function (productId, targetSlot) {
    var product = findProduct(this.products, productId);
    if (!product) return;

    var slot = targetSlot || getSlot(product);
    if (getSlot(product) !== slot) return;

    this.outfit[slot] = product.id;
    this.renderMannequin();
    this.renderCurrent();
  };

  FittingRoom.prototype.removeSlot = function (slot) {
    if (!this.outfit[slot]) return;
    this.outfit[slot] = null;
    this.renderMannequin();
    this.renderCurrent();
  };

  FittingRoom.prototype.reset = function () {
    this.outfit = { top: null, bottom: null, shoes: null, accessory: null };
    this.renderPieces();
    this.renderMannequin();
    this.renderCurrent();
  };

  FittingRoom.prototype.refresh = function () {
    this.renderPieces();
    this.renderMannequin();
    this.renderCurrent();
  };

  global.FittingRoom = {
    init: function (options) {
      return new FittingRoom(options);
    }
  };
})(window);
