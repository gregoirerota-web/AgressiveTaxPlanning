import { test, expect } from "@playwright/test";

test("remote firms see deposits, select three tax channels and receive a mine-level rent account",async ({browser})=>{
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  const [minister,firmA,firmB]=await Promise.all(contexts.map(ctx=>ctx.newPage()));
  try{
    for(const page of [minister,firmA,firmB]){
      await page.goto("/multiplayer.html");
      await expect(page.getByText("Serveur connecté")).toBeVisible();
    }
    await minister.getByPlaceholder("Nom de joueur").fill("Ministre Test");
    await minister.getByRole("button",{name:"Créer une partie (ministre)"}).click();
    await expect(minister.getByText(/Salle d’attente/)).toBeVisible();
    const code=(await minister.locator("header strong").innerText()).trim();
    for(const [page,name] of [[firmA,"Entreprise A"],[firmB,"Entreprise B"]]){
      await page.getByPlaceholder("Nom de joueur").fill(name);
      await page.getByPlaceholder("ABC123").fill(code);
      await page.getByRole("button",{name:"Rejoindre (firme)"}).click();
      await expect(page.getByText(/Salle d’attente/)).toBeVisible();
    }
    await minister.getByRole("button",{name:"Lancer la partie"}).click();
    await minister.getByRole("button",{name:"Publier le code minier"}).click();
    await firmA.getByLabel("Bloc demandé :").selectOption("0");
    await firmB.getByLabel("Bloc demandé :").selectOption("1");
    await firmA.getByRole("button",{name:"Sceller mon offre"}).click();
    await firmB.getByRole("button",{name:"Sceller mon offre"}).click();
    await expect(minister.getByText("Bloc 1",{exact:true}).first()).toBeVisible();
    await expect(minister.getByText(/Investissements/).first()).toBeVisible();
    for(const [page,id] of [[firmA,0],[firmB,1]]){
      const target=page.locator("label").filter({hasText:new RegExp("Bloc "+(id+1)+" —")}).locator("select");
      if(await target.count())await target.selectOption("2");
      await page.getByRole("button",{name:"Valider mes investissements"}).click();
    }
    await expect(firmA.getByRole("heading",{name:/Déclarations fiscales/})).toBeVisible();
    const pages=[firmA,firmB];
    let editable=0;
    for(const page of pages){
      const slider=page.getByRole("slider",{name:/Achats intragroupe bloc/}).first();
      if(await slider.count()){
        editable++;
        await expect(page.getByText(/Bénéfice imposable estimé/).first()).toBeVisible();
        await slider.focus();
        await slider.press("End");
      }
      await page.getByRole("button",{name:"Sceller toutes mes déclarations"}).click();
    }
    expect(editable).toBeGreaterThan(0);
    await expect(minister.getByRole("heading",{name:/Contrôle fiscal/})).toBeVisible();
    await minister.getByRole("button",{name:/Confirmer le contrôle et calculer la répartition/}).click();
    for(const page of [minister,firmA,firmB]){
      await expect(page.getByRole("heading",{name:"Concessions et mines attribuées"})).toBeVisible();
      await expect(page.getByRole("heading",{name:"Résultats mine par mine"})).toBeVisible();
      await expect(page.getByText("Profit économique des firmes")).toBeVisible();
      await expect(page.getByRole("heading",{name:"Résultat par entreprise"})).toBeVisible();
    }
    await expect(minister.getByText(/Votre déclaration — bloc/)).toHaveCount(0);
  }finally{await Promise.all(contexts.map(ctx=>ctx.close()));}
});
