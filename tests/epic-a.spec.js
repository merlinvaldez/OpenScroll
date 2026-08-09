import AxeBuilder from "@axe-core/playwright"; import { expect, test } from "@playwright/test";
async function boot(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") failures.push(`console: ${message.text()}`); });
  page.on("requestfailed", (request) => failures.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto("/");
  try { await expect(page.locator("html")).toHaveAttribute("data-hydrated","true", { timeout: 5000 }); }
  catch { throw new Error(`OpenScroll did not hydrate. ${failures.join(" | ") || "No browser error was reported."}`); }
}
test("critical path is keyboard operable and has no serious axe violations", async ({ page }) => { await boot(page); await expect(page.getByRole("heading",{name:/explore|explorar|استكشاف/i})).toBeVisible(); let results=await new AxeBuilder({page}).analyze(); expect(results.violations.filter(v=>["critical","serious"].includes(v.impact))).toEqual([]); await page.getByLabel("Interest").fill("Morocco"); await page.getByRole("button",{name:"Continue"}).click(); await page.getByRole("button",{name:/Build feed/}).click(); await expect(page.locator(".feed-card").first()).toBeInViewport(); results=await new AxeBuilder({page}).analyze(); expect(results.violations.filter(v=>["critical","serious"].includes(v.impact))).toEqual([]); });
test("RTL mirrors controls and persists locale", async ({ page }) => { await boot(page); await page.locator('select[aria-label="Language"]:visible').selectOption("ar"); await expect(page.locator("html")).toHaveAttribute("dir","rtl"); await page.reload(); await expect(page.locator("html")).toHaveAttribute("data-hydrated","true"); await expect(page.locator("html")).toHaveAttribute("dir","rtl"); });
test("dark theme and 200 percent zoom remain usable", async ({ page }) => { await boot(page); await page.locator('button[aria-label="Change theme"]:visible').click(); await expect(page.locator("html")).toHaveAttribute("data-theme","dark"); await page.evaluate(()=>document.body.style.zoom="2"); await expect(page.getByRole("textbox")).toBeVisible(); });
test("focus returns after stepping back", async ({ page }) => { await boot(page); const input=page.getByLabel("Interest"); await input.fill("Morocco"); await page.getByRole("button",{name:"Continue"}).click(); await page.getByRole("button",{name:"Back"}).click(); await expect(input).toBeFocused(); });
