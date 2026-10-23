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

/**
 * Run `fn(page)` in a fresh context. The body is raced against `bodyMs` (set
 * below the node:test timeout, which reports but does not cancel), so the
 * context is always closed. A close failure fails an otherwise passing test.
 */
export async function withContext(
  browser,
  options,
  fn,
  { bodyMs = 75_000, stepMs = 30_000 } = {},
) {
  const context = await bounded(
    browser.newContext(options),
    stepMs,
    "newContext",
  );
  let failure;
  try {
    const page = await bounded(context.newPage(), stepMs, "newPage");
    return await bounded(fn(page), bodyMs, "test body");
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      await bounded(context.close(), stepMs, "context.close");
    } catch (closeError) {
      if (!failure) throw closeError;
      failure.message += ` (and context.close failed: ${closeError.message})`;
    }
  }
}
