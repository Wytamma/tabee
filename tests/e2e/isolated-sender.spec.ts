import { expect, test } from "@playwright/test";

const APP = "http://127.0.0.1:5183/";
const RECEIVER = "http://localhost:5182/";

test("an isolated app stages a tree and the exchange tab sends it", async ({
  page,
  context,
}) => {
  await page.goto(APP);
  await expect(page.locator("#isolation")).toHaveAttribute("data-isolated", "true");

  const exchangePopup = page.waitForEvent("popup");
  await page.locator("#stage").click();
  const exchange = await exchangePopup;
  await exchange.waitForLoadState("domcontentloaded");

  await expect(exchange.locator("#isolation")).toHaveAttribute("data-isolated", "false");
  expect(await exchange.evaluate(() => window.opener === null)).toBe(true);
  await expect(exchange.locator("#staged-name")).toHaveText("isolated-sender tree");
  await expect(exchange.locator("#tree-preview")).toContainText("sample_1");

  // Staging must not open the receiver; only the exchange page's click does.
  expect(context.pages()).toHaveLength(2);

  await exchange.locator("#target").fill(RECEIVER);
  await expect(exchange.locator("#target-origin")).toHaveText("http://localhost:5182");

  const receiverPopup = exchange.waitForEvent("popup");
  await exchange.locator("#send").click();
  const receiver = await receiverPopup;
  await receiver.waitForLoadState("domcontentloaded").catch(() => undefined);

  await expect(
    receiver
      .locator("[data-tabee-consent] dd")
      .filter({ hasText: "http://127.0.0.1:5183" }),
  ).toHaveCount(1);
  await receiver.locator("[data-tabee-consent] button.accept").click();

  await expect(receiver.locator("#leaves")).toHaveAttribute("data-count", "4");
  await expect(exchange.locator("#status")).toContainText("Imported");
});

test("re-staging updates the open exchange tab instead of opening another", async ({
  page,
  context,
}) => {
  await page.goto(APP);

  const exchangePopup = page.waitForEvent("popup");
  await page.locator("#stage").click();
  const exchange = await exchangePopup;
  await exchange.waitForLoadState("domcontentloaded");
  await expect(exchange.locator("#tree-preview")).toContainText("sample_1");

  await page.locator("#tree-editor").fill("((alpha:1,beta:1):1,gamma:2);");
  await page.locator("#stage").click();

  await expect(exchange.locator("#tree-preview")).toContainText("alpha");
  await expect(exchange.locator("#staged-meta")).toContainText("tree.nwk");
  expect(context.pages()).toHaveLength(2);
});
