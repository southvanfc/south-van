document.addEventListener("DOMContentLoaded", () => {
  const menu = document.querySelector(".menu");
  if (!menu) return;

  menu.addEventListener("click", () => {
    const isExpanded = menu.getAttribute("aria-expanded") === "true";
    menu.setAttribute("aria-expanded", String(!isExpanded));
  });
});
