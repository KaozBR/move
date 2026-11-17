(function () {
  "use strict";
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector("#menu-principal");
  const year = document.querySelector("#ano-atual");

  if (year) year.textContent = String(new Date().getFullYear());

  function closeMenu() {
    if (!menu || !toggle) return;
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menu");
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      const willOpen = !menu.classList.contains("open");
      menu.classList.toggle("open", willOpen);
      toggle.setAttribute("aria-expanded", String(willOpen));
      toggle.setAttribute(
        "aria-label",
        willOpen ? "Fechar menu" : "Abrir menu",
      );
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 690) closeMenu();
    });
  }
})();
