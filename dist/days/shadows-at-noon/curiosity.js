const content = JSON.parse(
  document.querySelector("#curiosity-content").textContent,
);
const panels = [...document.querySelectorAll(".daily-panel")];
const links = [...document.querySelectorAll("[data-go]")];
function showPanel(name, focus = true) {
  if (!panels.some((panel) => panel.id === name)) return;
  panels.forEach((panel) => (panel.hidden = panel.id !== name));
  links.forEach((link) => {
    if (link.dataset.go === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.body.classList.toggle("reader-open", name === "reading");
  document.title = `${{ curiosity: content.title, reading: "Story", math: "Math", writing: "Writing", diorama: "Diorama", quiz: "Quiz", foldable: "Foldable" }[name]} · Wonder Daily`;
  document.dispatchEvent(new CustomEvent("subjectchange", { detail: name }));
  if (focus) {
    document.querySelector(`#${name}-heading`).focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}
links.forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showPanel(link.dataset.go);
  }),
);
showPanel("curiosity", false);

// The header print menu closes on Escape (focus back to its button) or an outside click.
const printMenu = document.querySelector(".print-menu");
if (printMenu) {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !printMenu.open) return;
    printMenu.open = false;
    printMenu.querySelector("summary").focus();
  });
  document.addEventListener("click", (event) => {
    if (printMenu.open && !printMenu.contains(event.target))
      printMenu.open = false;
  });
}

function sceneChooser(linkSelector, articleSelector, key) {
  const options = [...document.querySelectorAll(linkSelector)];
  const articles = [...document.querySelectorAll(articleSelector)];
  function choose(option) {
    articles.forEach(
      (article) =>
        (article.hidden = article.id !== option.getAttribute("href").slice(1)),
    );
    options.forEach((link) => {
      if (link.dataset[key] === option.dataset[key])
        link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }
  options.forEach((option) =>
    option.addEventListener("click", (event) => {
      event.preventDefault();
      choose(option);
      const scene = document.getElementById(
        option.getAttribute("href").slice(1),
      );
      scene.focus({ preventScroll: true });
      if (matchMedia("(max-width: 650px)").matches)
        scene.scrollIntoView({ block: "start", behavior: "instant" });
    }),
  );
  choose(options[0]);
}
sceneChooser("[data-question]", ".question-scene", "question");
sceneChooser("[data-writing-choice]", ".writing-scene", "writingChoice");

const draft = document.querySelector("#draft");
draft.addEventListener("input", () => {
  draft.style.height = "auto";
  draft.style.height = `${draft.scrollHeight + 2}px`;
});
// No persistence or transmission. Guard only an actual typed draft on page exit.
window.addEventListener("beforeunload", (event) => {
  if (!draft.value.trim()) return;
  event.preventDefault();
  event.returnValue = "";
});
// Quiz: immediate, gentle feedback. The key stays in the content data.
for (const fieldset of document.querySelectorAll("[data-quiz]")) {
  const question = content.quiz?.questions?.find(
    (q) => q.id === fieldset.dataset.quiz,
  );
  const feedback = fieldset.querySelector("[data-quiz-feedback]");
  if (!question || !feedback) continue;
  fieldset.addEventListener("change", (event) => {
    if (event.target.type !== "radio") return;
    const right = Number(event.target.value) === question.answerIndex;
    fieldset.dataset.result = right ? "right" : "try-again";
    feedback.textContent = right
      ? `Yes! ${question.answer}`
      : "Not quite. Look back at the pictures and try another answer.";
  });
}
const finish = document.querySelector("#finish-day");
finish.hidden = false;
finish.addEventListener("click", () => {
  document.querySelector("#completion").textContent =
    "You looked closely, shared a story, and gave an idea your words. That is enough for today.";
});

const download = document.querySelector("#fold-download");
const status = document.querySelector("#fold-status");
download.hidden = false;
download.addEventListener("click", async () => {
  if (download.disabled) return;
  download.disabled = true;
  download.setAttribute("aria-busy", "true");
  status.textContent = "Getting your little book…";
  try {
    const response = await fetch("./pdf/foldable.pdf", {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("missing foldable");
    const bytes = await response.arrayBuffer();
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${content.slug || "curiosity"}-foldable-story.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent =
      "Your book is ready. Print settings and fold steps are on page 8.";
  } catch {
    status.textContent =
      "The book could not be downloaded. Check your connection and try Download foldable story again, or use Print → Reading pages at the top.";
  } finally {
    download.disabled = false;
    download.removeAttribute("aria-busy");
  }
});
