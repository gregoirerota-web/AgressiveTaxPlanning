import { test, expect } from "@playwright/test";

test("solo firm: complete eight rounds without purchasing and reach final report", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Solo — je joue la Firme/ }).click();
  for (let i = 1; i <= 8; i++) {
    await expect(page.getByText(new RegExp("Tour " + i + "/8"))).toBeVisible();
    await page.getByRole("button", { name: "Ne pas candidater" }).click();
    await page.getByRole("button", { name: "Poursuivre le tour" }).click();
    await page.getByRole("button", { name: /Passer au cours|Terminer les investissements/ }).click();
  }
  await expect(page.getByText(/Fin de partie — 8 tours joués/)).toBeVisible();
  await expect(page.getByText("Journal de la partie")).toBeVisible();
  await expect(page.getByText(/Évolution des recettes et de l'activité/)).toBeVisible();
});

test("solo minister: do not issue permits; verify full eight-round flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Solo — je joue le Ministre/ }).click();
  for (let i = 1; i <= 8; i++) {
    await page.getByRole("button", { name: "Ne rien ouvrir ce tour" }).click();
    await page.getByRole("button", { name: /Passer au cours|Terminer les investissements/ }).click();
  }
  await expect(page.getByText(/Fin de partie — 8 tours joués/)).toBeVisible();
});

test("reload preserves turn, role and phase", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Solo — je joue la Firme/ }).click();
  await page.getByRole("button", { name: "Ne pas candidater" }).click();
  await page.reload();
  await expect(page.getByText(/Tour 1\/8/)).toBeVisible();
  await expect(page.getByText(/Aucune enveloppe/)).toBeVisible();
  await page.getByRole("button", { name: "Poursuivre le tour" }).click();
  await page.getByRole("button", { name: /Passer au cours|Terminer les investissements/ }).click();
  await expect(page.getByText(/Tour 2\/8/)).toBeVisible();
});
