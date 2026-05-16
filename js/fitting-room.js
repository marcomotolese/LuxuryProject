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
  var MIN_SLOTS_FOR_COMPLETE = 3;

  var STYLE_TIPS = {
    loud: [
      "Punta su silhouette nette, spalle strutturate e volumi decisi.",
      "Contrasti forti e pezzi statement completano il mood LOUD."
    ],
    silent: [
      "Privilegia tailoring, linee pulite e palette neutra.",
      "Meno è più: pochi capi iconici definiscono il mood SILENT."
    ],
    lazy: [
      "Knitwear morbido e layering rilassato sono la chiave LAZY.",
      "Comfort e texture naturali, senza forzare la silhouette."
    ]
  };

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

  function getAttitudeLabel(mode) {
    if (window.AttitudeSwitcher && AttitudeSwitcher.UI[mode]) {
      return AttitudeSwitcher.UI[mode].name;
    }
    return mode ? String(mode).toUpperCase() : "";
  }

  function FittingRoom(options) {
    this.products = options.products || [];
    this.getMode = options.getMode || function () { return "loud"; };
    this.palettePageSize = typeof options.palettePageSize === "number" ? options.palettePageSize : 5;
    this.palettePage = 0;
    this.root = typeof options.root === "string"
      ? document.querySelector(options.root)
      : options.root;
    this.outfit = { top: null, bottom: null, shoes: null, accessory: null };
    this.dragProductId = null;

    if (!this.root) return;

    this.paletteBodyEl = this.root.querySelector("[data-fitting-palette-body]");
    this.piecesEl = this.paletteBodyEl;
    this.currentEl = this.root.querySelector("[data-fitting-current]");
    this.stageEl = this.root.querySelector(".fitting-stage");
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

    if (this.paletteBodyEl) {
      this.paletteBodyEl.addEventListener("dragstart", function (event) {
        var card = event.target.closest("[data-fitting-piece]");
        if (!card) return;
        self.dragProductId = Number(card.getAttribute("data-fitting-piece"));
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", String(self.dragProductId));
        card.classList.add("is-dragging");
      });

      this.paletteBodyEl.addEventListener("dragend", function (event) {
        var card = event.target.closest("[data-fitting-piece]");
        if (card) card.classList.remove("is-dragging");
        self.dragProductId = null;
      });

      this.paletteBodyEl.addEventListener("click", function (event) {
        if (event.target.closest("[data-fitting-palette-prev]")) {
          event.preventDefault();
          self.setPalettePage(self.palettePage - 1);
          return;
        }
        if (event.target.closest("[data-fitting-palette-next]")) {
          event.preventDefault();
          self.setPalettePage(self.palettePage + 1);
          return;
        }
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

  FittingRoom.prototype.getGoalMode = function () {
    return this.getMode();
  };

  FittingRoom.prototype.getPaletteProducts = function () {
    var self = this;
    var goal = this.getGoalMode();
    var equippedIds = {};

    SLOT_ORDER.forEach(function (slot) {
      if (self.outfit[slot]) equippedIds[self.outfit[slot]] = true;
    });

    return this.products.slice().sort(function (a, b) {
      var aEquipped = equippedIds[a.id] ? 0 : 1;
      var bEquipped = equippedIds[b.id] ? 0 : 1;
      if (aEquipped !== bEquipped) return aEquipped - bEquipped;

      var aMatch = a.attitude === goal ? 0 : 1;
      var bMatch = b.attitude === goal ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;

      return a.name.localeCompare(b.name, "it");
    });
  };

  FittingRoom.prototype.setPalettePage = function (page) {
    var total = this.getPaletteProducts().length;
    var pageSize = this.palettePageSize;
    var maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
    this.palettePage = Math.max(0, Math.min(page, maxPage));
    this.renderPieces();
  };

  FittingRoom.prototype.renderPieceCard = function (product) {
    var goal = this.getGoalMode();
    var asset = getAsset(product);
    var slot = getSlot(product);
    var outOfGoal = product.attitude !== goal;

    return (
      '<article class="fitting-piece fitting-piece--tile' +
      (outOfGoal ? " fitting-piece--off-goal" : "") +
      '" data-fitting-piece="' +
      product.id +
      '" data-fitting-slot="' +
      slot +
      '" draggable="true" role="button" tabindex="0" aria-label="Indossa ' +
      escapeHtml(product.name) +
      '">' +
      '<span class="fitting-piece-check" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 12.5l4 4L18 8"></path>' +
      "</svg></span>" +
      '<div class="fitting-piece-media">' +
      '<img src="' +
      escapeHtml(asset) +
      '" alt="" loading="lazy" data-fitting-fallback="' +
      escapeHtml(product.name) +
      '">' +
      "</div>" +
      '<div class="fitting-piece-meta">' +
      '<span class="fitting-piece-name">' +
      escapeHtml(product.name) +
      "</span>" +
      '<span class="fitting-piece-slot">' +
      escapeHtml(SLOT_LABELS[slot] || slot) +
      "</span>" +
      "</div>" +
      "</article>"
    );
  };

  FittingRoom.prototype.analyzeOutfit = function () {
    var self = this;
    var goal = this.getGoalMode();
    var items = [];
    var aligned = 0;
    var occupied = 0;
    var totalPrice = 0;
    var mismatchedNames = [];
    var emptyCore = [];

    SLOT_ORDER.forEach(function (slot) {
      var productId = self.outfit[slot];
      if (!productId) {
        if (slot === "top" || slot === "bottom") emptyCore.push(SLOT_LABELS[slot]);
        return;
      }

      var product = findProduct(self.products, productId);
      if (!product) return;

      occupied += 1;
      totalPrice += product.price || 0;
      var isAligned = product.attitude === goal;
      if (isAligned) aligned += 1;
      else mismatchedNames.push(product.name);

      items.push({
        slot: slot,
        product: product,
        isAligned: isAligned
      });
    });

    var percent = occupied ? Math.round((aligned / occupied) * 100) : 0;
    var isComplete = occupied >= MIN_SLOTS_FOR_COMPLETE;
    var isPerfect = occupied > 0 && percent === 100;
    var tips = (STYLE_TIPS[goal] || []).slice(0, 2);
    var stylistLine = "";

    if (!occupied) {
      stylistLine = "Indossa almeno un capo per iniziare l'analisi del tuo look.";
    } else if (mismatchedNames.length) {
      stylistLine =
        "Hai " +
        mismatchedNames.length +
        (mismatchedNames.length === 1 ? " pezzo fuori" : " pezzi fuori") +
        " dall'obiettivo " +
        getAttitudeLabel(goal) +
        ": sostituiscili per aumentare l'allineamento.";
    } else if (isPerfect && isComplete) {
      stylistLine = "Look coerente: il tuo outfit parla chiaro in chiave " + getAttitudeLabel(goal) + ".";
    } else if (emptyCore.length) {
      stylistLine = "Completa " + emptyCore.join(" e ").toLowerCase() + " per equilibrare il look.";
    } else {
      stylistLine = "Buona base " + getAttitudeLabel(goal) + " — aggiungi un ultimo dettaglio se vuoi chiudere il look.";
    }

    return {
      goal: goal,
      goalLabel: getAttitudeLabel(goal),
      percent: percent,
      items: items,
      occupied: occupied,
      aligned: aligned,
      totalPrice: totalPrice,
      mismatchedNames: mismatchedNames,
      isComplete: isComplete,
      isPerfect: isPerfect,
      tips: tips,
      stylistLine: stylistLine
    };
  };

  FittingRoom.prototype.syncPieceEquippedState = function () {
    if (!this.paletteBodyEl) return;

    var equipped = {};
    var self = this;

    SLOT_ORDER.forEach(function (slot) {
      if (self.outfit[slot]) equipped[self.outfit[slot]] = true;
    });

    this.paletteBodyEl.querySelectorAll("[data-fitting-piece]").forEach(function (card) {
      var id = Number(card.getAttribute("data-fitting-piece"));
      card.classList.toggle("is-equipped", Boolean(equipped[id]));
    });
  };

  FittingRoom.prototype.flashZoneSuccess = function (slot) {
    var zone = this.zones[slot];
    if (!zone) return;

    zone.classList.remove("is-success");
    void zone.offsetWidth;
    zone.classList.add("is-success");

    window.setTimeout(function () {
      zone.classList.remove("is-success");
    }, 700);
  };

  FittingRoom.prototype.renderPieces = function () {
    if (!this.paletteBodyEl) return;

    var self = this;
    var all = this.getPaletteProducts();

    if (!all.length) {
      this.paletteBodyEl.innerHTML = '<p class="fitting-empty">Nessun pezzo disponibile.</p>';
      return;
    }

    var pageSize = this.palettePageSize;
    var totalPages = Math.max(1, Math.ceil(all.length / pageSize));

    if (this.palettePage >= totalPages) {
      this.palettePage = totalPages - 1;
    }

    var start = this.palettePage * pageSize;
    var pageProducts = all.slice(start, start + pageSize);
    var navHtml = "";

    if (totalPages > 1) {
      navHtml =
        '<nav class="fitting-palette-nav" aria-label="Pagina catalogo pezzi">' +
        '<button type="button" class="fitting-palette-nav-btn" data-fitting-palette-prev' +
        (this.palettePage <= 0 ? " disabled" : "") +
        ' aria-label="Pagina precedente"><span aria-hidden="true">←</span></button>' +
        '<span class="fitting-palette-nav-status">' +
        (this.palettePage + 1) +
        " / " +
        totalPages +
        "</span>" +
        '<button type="button" class="fitting-palette-nav-btn" data-fitting-palette-next' +
        (this.palettePage >= totalPages - 1 ? " disabled" : "") +
        ' aria-label="Pagina successiva"><span aria-hidden="true">→</span></button>' +
        "</nav>";
    }

    this.paletteBodyEl.innerHTML =
      navHtml +
      '<div class="fitting-pieces-grid" data-fitting-pieces>' +
      pageProducts
        .map(function (product) {
          return self.renderPieceCard(product);
        })
        .join("") +
      "</div>";

    this.paletteBodyEl.querySelectorAll("[data-fitting-fallback]").forEach(function (image) {
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

    this.syncPieceEquippedState();
  };

  FittingRoom.prototype.renderMannequin = function () {
    var self = this;
    var goal = this.getGoalMode();
    var analysis = this.analyzeOutfit();

    SLOT_ORDER.forEach(function (slot) {
      var zone = self.zones[slot];
      if (!zone) return;

      var layer = zone.querySelector("[data-fitting-layer]");
      var productId = self.outfit[slot];
      var product = productId ? findProduct(self.products, productId) : null;
      var isAligned = product && product.attitude === goal;

      zone.classList.toggle("is-filled", Boolean(product));
      zone.classList.toggle("is-mismatch", Boolean(product && !isAligned));
      zone.classList.toggle("is-aligned", Boolean(isAligned));
      zone.classList.remove("is-over");

      if (!layer) return;

      if (!product) {
        zone.classList.remove("is-mismatch", "is-aligned");
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

    if (self.stageEl) {
      self.stageEl.classList.toggle("is-look-complete", analysis.isComplete);
      self.stageEl.classList.toggle("is-look-perfect", analysis.isComplete && analysis.isPerfect);
    }
  };

  FittingRoom.prototype.renderCurrent = function () {
    if (!this.currentEl) return;

    var analysis = this.analyzeOutfit();

    if (!analysis.occupied) {
      this.currentEl.innerHTML =
        '<div class="fitting-style-coach">' +
        '<p class="fitting-coach-goal">Obiettivo · ' + escapeHtml(analysis.goalLabel) + "</p>" +
        '<p class="fitting-empty">Indossa i capi sul manichino per vedere allineamento e consigli.</p>' +
        '<ul class="fitting-coach-tips">' +
        analysis.tips.map(function (tip) {
          return "<li>" + escapeHtml(tip) + "</li>";
        }).join("") +
        "</ul>" +
        "</div>";
      if (this.stageEl) {
        this.stageEl.classList.remove("is-look-complete", "is-look-perfect");
      }
      return;
    }

    var completeHtml = "";
    if (analysis.isComplete) {
      completeHtml =
        '<div class="fitting-look-complete' +
        (analysis.isPerfect ? " fitting-look-complete--perfect" : "") +
        '">' +
        '<p class="fitting-look-complete-title">' +
        (analysis.isPerfect ? "Look completo · 100% allineato" : "Look in composizione") +
        "</p>" +
        '<p class="fitting-look-complete-total">Totale look · € ' +
        analysis.totalPrice.toLocaleString("it-IT") +
        "</p>" +
        "</div>";
    }

    var itemsHtml = analysis.items
      .map(function (item) {
        return (
          '<li class="fitting-current-item' +
          (item.isAligned ? " is-aligned" : " is-mismatch") +
          '">' +
          '<span class="fitting-current-slot">' +
          escapeHtml(SLOT_LABELS[item.slot] || item.slot) +
          "</span>" +
          '<span class="fitting-current-name">' +
          escapeHtml(item.product.name) +
          "</span>" +
          '<span class="fitting-current-status">' +
          (item.isAligned ? "In stile" : "Fuori stile") +
          "</span>" +
          '<button type="button" class="fitting-remove" data-fitting-remove="' +
          item.slot +
          '" aria-label="Rimuovi ' +
          escapeHtml(item.product.name) +
          '">Rimuovi</button>' +
          "</li>"
        );
      })
      .join("");

    this.currentEl.innerHTML =
      '<div class="fitting-style-coach">' +
      '<p class="fitting-coach-goal">Obiettivo · ' +
      escapeHtml(analysis.goalLabel) +
      "</p>" +
      '<div class="fitting-coach-score">' +
      '<span class="fitting-coach-percent">' +
      analysis.percent +
      "%</span>" +
      '<span class="fitting-coach-label">allineamento</span>' +
      "</div>" +
      '<div class="fitting-coach-bar" role="presentation"><span style="width:' +
      analysis.percent +
      '%"></span></div>' +
      '<p class="fitting-stylist-line">' +
      escapeHtml(analysis.stylistLine) +
      "</p>" +
      completeHtml +
      '<ul class="fitting-coach-tips">' +
      analysis.tips
        .map(function (tip) {
          return "<li>" + escapeHtml(tip) + "</li>";
        })
        .join("") +
      "</ul>" +
      '<ul class="fitting-current-list">' +
      itemsHtml +
      "</ul>" +
      "</div>";
  };

  FittingRoom.prototype.assignPiece = function (productId, targetSlot) {
    var product = findProduct(this.products, productId);
    if (!product) return;

    var slot = targetSlot || getSlot(product);
    if (getSlot(product) !== slot) return;

    this.outfit[slot] = product.id;
    this.renderMannequin();
    this.renderCurrent();
    this.syncPieceEquippedState();
    this.flashZoneSuccess(slot);
  };

  FittingRoom.prototype.removeSlot = function (slot) {
    if (!this.outfit[slot]) return;
    this.outfit[slot] = null;
    this.renderMannequin();
    this.renderCurrent();
    this.syncPieceEquippedState();
  };

  FittingRoom.prototype.reset = function () {
    this.outfit = { top: null, bottom: null, shoes: null, accessory: null };
    this.palettePage = 0;
    this.renderPieces();
    this.renderMannequin();
    this.renderCurrent();
  };

  FittingRoom.prototype.refresh = function () {
    this.palettePage = 0;
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
