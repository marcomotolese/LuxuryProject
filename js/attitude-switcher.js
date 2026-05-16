(function (global) {
  "use strict";

  var MODES_ORDER = ["loud", "silent", "lazy"];

  var ATTITUDE_UI = {
    loud: {
      name: "LOUD",
      tag: "Statement",
      keywords: "Pezzi statement · Silhouette forti · Colori decisi",
      tooltipShort: "Statement · Bold"
    },
    silent: {
      name: "SILENT",
      tag: "Tailoring",
      keywords: "Tailoring · Palette neutra · Iconico",
      tooltipShort: "Tailoring · Neutro"
    },
    lazy: {
      name: "LAZY",
      tag: "Relaxed",
      keywords: "Knitwear · Layering soft · Comfort luxury",
      tooltipShort: "Relaxed Luxury"
    }
  };

  function sync(mode) {
    document.querySelectorAll(".attitude-switcher").forEach(function (switcher) {
      switcher.setAttribute("data-active-mode", mode);

      switcher.querySelectorAll(".attitude-switcher-item").forEach(function (item) {
        var itemMode = item.getAttribute("data-mode");
        var isActive = itemMode === mode;
        item.classList.toggle("is-active", isActive);

        var keywords = item.querySelector(".attitude-keywords");
        if (keywords) {
          keywords.hidden = !isActive;
        }
      });

      switcher.querySelectorAll(".attitude-btn").forEach(function (btn) {
        var btnMode = btn.getAttribute("data-mode");
        btn.classList.toggle("is-active", btnMode === mode);
        btn.setAttribute("aria-pressed", btnMode === mode ? "true" : "false");
      });
    });
  }

  function getKeywords(mode) {
    return (ATTITUDE_UI[mode] && ATTITUDE_UI[mode].keywords) || "";
  }

  function getTooltipLine(mode) {
    var ui = ATTITUDE_UI[mode];
    if (!ui) return "";
    return ui.name + " — " + ui.tooltipShort;
  }

  global.AttitudeSwitcher = {
    sync: sync,
    getKeywords: getKeywords,
    getTooltipLine: getTooltipLine,
    UI: ATTITUDE_UI,
    ORDER: MODES_ORDER
  };
})(window);
