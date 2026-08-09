import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("foundation has no automatically detectable WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("topic selection, theme, dialog, and RTL controls work", async ({ page }) => {
  await page.goto("/");
  const topic = page.getByRole("button", { name: /Architecture/ });
  await expect(topic).toHaveAttribute("aria-pressed", "false");
  await topic.click();
  await expect(topic).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Use dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByLabel("Interface language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ماذا تريد");
});

test("health endpoint follows the shared envelope", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.version).toBe("1");
  expect(body.requestId).toBeTruthy();
  expect(body.data).toMatchObject({ status: "ok", accounts: false, userGeneratedContent: false });
});
