// Time bounds for the browser tests. Linux WebKit can wedge a page so a
// promise from Playwright never settles; without a bound the CI job hangs
// silently until cancelled instead of failing.

/** Reject if `promise` has not settled within `ms`. */
export function bounded(promise, ms, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} did not finish within ${ms}ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Hard process deadline: a leaked browser cannot keep the job alive. */
export function watchdog(ms, label) {
  setTimeout(() => {
    console.error(`${label}: exceeded ${ms}ms, exiting with failure.`);
    process.exit(1);
  }, ms).unref();
}

/** The original readiness contract (fonts.ready + every img.decode()), bounded. */
export function imagesAndFontsReady(page, ms = 30_000) {
  return bounded(
    page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode()));
    }),
    ms,
    "fonts.ready + img.decode()",
  );
}
