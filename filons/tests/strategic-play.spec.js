import { test, expect } from "@playwright/test";

const seeded = async page => {
  // Stable initial shuffle and commodity die; reserve block 2 is marginal (3 units).
  await page.addInitScript(() => { Math.random = () => 0.999999; });
};
async function investBlockTwo(page) {
  await page.getByRole("button", { name: /Bloc 2 : Offert, encore inconnu/ }).click();
  await page.getByRole("button", { name: "Retourner les cartes" }).click();
  await expect(page.getByText("Bloc 2 — Marginal").first()).toBeVisible();
  await page.getByRole("button", { name: /Conventionnelle/ }).first().click();
  await expect(page.getByText(/Mines équipées :/)).toBeVisible();
  await page.getByRole("button", { name: /Passer au cours|Terminer les investissements/ }).click();
  await page.getByRole("button", { name: "Lancer le dé de cours" }).click();
  await page.getByRole("button", { name: "Passer à la déclaration" }).click();
}
test("solo firm: permit, operating mine, declarations and government audit", async ({ page }) => {
  await seeded(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Solo — je joue la Firme/ }).click();
  await page.getByRole("button", { name: "Déposer l'enveloppe" }).click();
  await investBlockTwo(page);
  await page.getByRole("button", { name: "Rétablir les charges dans les zones sûres" }).click();
  await page.getByRole("button", { name: "Sceller les déclarations" }).click();
  await expect(page.getByText(/Temps 7 — les encaissements/)).toBeVisible();
  await expect(page.getByText(/SYNTHÈSE DU TOUR 1/)).toBeVisible();
  await page.getByRole("button", { name: /Valider le tour 1/ }).click();
  await expect(page.getByText(/Tour 2\/8/)).toBeVisible();
});

test("hotseat: Minister → firm → sealed bid → mine → fiscal audit → next round", async ({ page }) => {
  await seeded(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Hotseat — deux joueurs/ }).click();
  await expect(page.getByText(/Passage de main/)).toBeVisible();
  await page.getByRole("button", { name: /Je suis seul devant l'écran/ }).click();
  await page.getByRole("button", { name: "Sceller l'offre" }).click();
  await page.getByRole("button", { name: /Je suis seul devant l'écran/ }).click();
  await page.getByRole("button", { name: "Déposer l'enveloppe" }).click();
  await expect(page.getByText(/Décisions scellées/)).toBeVisible();
  await page.getByRole("button", { name: "Continuer" }).click();
  await investBlockTwo(page);
  // A second handoff protects the firm's confidential declaration.
  await expect(page.getByText(/Passage de main/)).toBeVisible();
  await page.getByRole("button", { name: /Je suis seul devant l'écran/ }).click();
  await page.getByRole("button", { name: "Sceller les déclarations" }).click();
  await expect(page.getByText(/Passage de main/)).toBeVisible();
  await page.getByRole("button", { name: /Je suis seul devant l'écran/ }).click();
  await page.getByRole("button", { name: /Documentation des prix de transfert/ }).click();
  await expect(page.getByRole("button", { name: /Confirmer le contrôle/ })).toBeEnabled();
  await page.getByRole("button", { name: /Confirmer le contrôle/ }).click();
  await expect(page.getByText(/SYNTHÈSE DU TOUR 1/)).toBeVisible();
  await page.getByRole("button", { name: /Valider le tour 1/ }).click();
  await expect(page.getByText(/Passage de main/)).toBeVisible();
});
