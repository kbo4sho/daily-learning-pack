// Optional browser-only nicknames. No forms, requests, cookies or URL state.
for (const id of ["big", "little"]) {
  const key = `wonder-daily.family.nickname.${id}`;
  const displays = document.querySelectorAll(`[data-nickname="${id}"]`);
  const editor = document.querySelector(`[data-editor="${id}"]`);
  const input = editor?.querySelector("input");
  const render = (value) => {
    for (const display of displays) {
      display.textContent = value;
      display.hidden = !value;
    }
    if (input) input.value = value;
  };
  try {
    render((localStorage.getItem(key) || "").slice(0, 40));
  } catch {
    /* Storage may be disabled. */
  }
  if (!editor) continue;
  editor.hidden = false;
  const status = editor.querySelector("[data-status]");
  const save = (value) => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
      render(value);
      status.textContent = value
        ? "Saved in this browser."
        : "Nickname cleared.";
    } catch {
      status.textContent =
        "This browser cannot save nicknames. Your doors still work.";
    }
  };
  editor
    .querySelector("[data-save]")
    .addEventListener("click", () => save(input.value.trim().slice(0, 40)));
  editor
    .querySelector("[data-clear]")
    .addEventListener("click", () => save(""));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save(input.value.trim().slice(0, 40));
    }
  });
}
