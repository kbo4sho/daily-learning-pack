// Count intervals, not day labels. The table is deliberately a pretend record.
const controls = document.querySelector("[data-day-controls]");
if (controls) {
  const days = [...document.querySelectorAll(".bean-day-line li")];
  const next = document.querySelector("#next-day");
  const feedback = document.querySelector("#day-feedback");
  let index = 0;
  function showDay() {
    days.forEach((day, i) => {
      if (i === index) day.setAttribute("aria-current", "step");
      else day.removeAttribute("aria-current");
      day.classList.toggle("day-passed", i > 0 && i <= index);
    });
    feedback.textContent =
      index === 0
        ? "Start on Day 4. No days have passed yet."
        : `Day ${days[index].textContent}. ${index} ${index === 1 ? "day has" : "days have"} passed.${index === days.length - 1 ? " Nine labels, eight spaces. 12 − 4 = 8 days." : " Count one space for each day."}`;
    next.disabled = index === days.length - 1;
  }
  next.addEventListener("click", () => {
    if (index < days.length - 1) {
      index++;
      showDay();
    }
  });
  document.querySelector("#reset-days").addEventListener("click", () => {
    index = 0;
    showDay();
  });
  controls.hidden = false;
  showDay();
}
