// Native links work without JavaScript; Space also opens a focused packet.
document.addEventListener("keydown", (event) => {
  if (event.key === " " && event.target.matches("a.seed-packet-link")) {
    event.preventDefault();
    if (!event.repeat) event.target.click();
  }
});
