import { generateZine, ZINE_PLATE_MAX_PX } from "./zine.js";

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
  document.title = `${{ curiosity: "A bean becomes.", reading: "Read together", math: "Math", writing: "Writing" }[name]} · Wonder Daily · Dogfood`;
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
const finish = document.querySelector("#finish-day");
finish.hidden = false;
finish.addEventListener("click", () => {
  document.querySelector("#completion").textContent =
    "You looked closely, shared a story, and gave an idea your words. That is enough for today.";
});

const download = document.querySelector("#fold-download");
const status = document.querySelector("#fold-status");
download.hidden = false;
let library;
function loadPdfLibrary() {
  if (globalThis.PDFLib) return Promise.resolve(globalThis.PDFLib);
  if (library) return library;
  library = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/pdf-lib.min.js";
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      library = undefined;
      reject(new Error("PDF library unavailable"));
    };
    const timer = setTimeout(fail, 15000);
    script.onload = () => {
      clearTimeout(timer);
      resolve(globalThis.PDFLib);
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return library;
}
let fontkitLibrary;
function loadFontkitLibrary() {
  if (globalThis.fontkit) return Promise.resolve(globalThis.fontkit);
  if (fontkitLibrary) return fontkitLibrary;
  fontkitLibrary = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/fontkit.umd.min.js";
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      fontkitLibrary = undefined;
      reject(new Error("Font library unavailable"));
    };
    const timer = setTimeout(fail, 15000);
    script.onload = () => {
      clearTimeout(timer);
      resolve(globalThis.fontkit);
    };
    script.onerror = fail;
    document.head.append(script);
  });
  return fontkitLibrary;
}
async function fetchAsset(src, message) {
  const response = await fetch(`./${src}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(message);
  return response;
}
async function loadPlate(src) {
  const response = await fetchAsset(src, "A story picture could not be loaded");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const width = Math.min(bitmap.width, ZINE_PLATE_MAX_PX);
    const height = Math.round((bitmap.height * width) / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("A story picture could not be prepared");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("A story picture could not be prepared")),
        "image/jpeg",
        0.88,
      ),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
download.addEventListener("click", async () => {
  if (download.disabled) return;
  download.disabled = true;
  download.setAttribute("aria-busy", "true");
  status.textContent = "Making your little book…";
  try {
    const [pdfLib, fontkit] = await Promise.all([
      loadPdfLibrary(),
      loadFontkitLibrary(),
    ]);
    const bytes = await generateZine(content, loadPlate, pdfLib, {
      fontkit,
      loadFont: async (src) =>
        new Uint8Array(
          await (
            await fetchAsset(src, "A print font could not be loaded")
          ).arrayBuffer(),
        ),
    });
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "a-bean-becomes-foldable-story.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent =
      "Your book is ready. Print settings and fold steps are on page 8.";
  } catch {
    status.textContent =
      "The book could not be made. Check your connection and try Download foldable story again. The Print story link is also available.";
  } finally {
    download.disabled = false;
    download.removeAttribute("aria-busy");
  }
});
