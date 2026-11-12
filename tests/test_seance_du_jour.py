"""Test 1.3 : séance du jour à l'accueil, jour dans l'éditeur, remplacement d'exercice en séance."""
from commun import LANCEMENT, CAPTURES
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs, ok = [], True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


LIRE = """(m) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const r = db.transaction(m).objectStore(m).getAll(); r.onsuccess = () => { db.close(); res(r.result); }; }; })"""
METTRE = """(args) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const tx = db.transaction(Object.keys(args), 'readwrite');
    for (const [m, liste] of Object.entries(args)) liste.forEach(v => tx.objectStore(m).put(v));
    tx.oncomplete = () => { db.close(); res(); }; }; })"""


def finir_exercice(page, charge=None):
    while page.locator('[data-action="valider"]').count():
        nom = page.locator('.exo__nom').text_content()
        if charge is not None and page.locator('.nombre__champ[data-champ="charge"]').count():
            page.fill('.nombre__champ[data-champ="charge"]', charge)
        page.click('[data-action="valider"]')
        if page.locator('[data-action="repos-fin"]').is_visible():
            page.click('[data-action="repos-fin"]')
        if page.locator('.exo__nom').text_content() != nom:
            return


def accueil(page):
    page.goto(URL + "#/seances")
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('[data-rubrique="seance"]')


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="UTC")
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.clock.set_fixed_time("2026-11-10T10:00:00Z")  # mardi

    # Sans programme : pas de carte de séance
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("sans programme : pas de carte de séance du jour", page.locator('.seance-jour').count() == 0)

    # Adoption du programme
    page.goto(URL + "#/seances")
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    jours = [s["jour"] for s in sorted(page.evaluate(LIRE, "seances"), key=lambda s: s["ordre"])]
    verifier("jours enregistrés sur les séances", jours == [2, 3, 4, 6, 0], str(jours))

    # --- Mardi : Push à l'accueil
    accueil(page)
    carte = page.locator('.seance-jour')
    verifier("mardi : Push proposé", "ce soir" in carte.inner_text().lower() and "Push · poussée · 7 exercices" in carte.inner_text()
             and "Démarrer la séance" in carte.inner_text(), carte.inner_text().replace("\n", "|"))
    page.screenshot(path=CAPTURES + "jour-accueil.png")
    page.click('[data-action="demarrer-seance"]')
    page.wait_for_selector('[data-action="valider"]')
    verifier("démarrage direct en mode séance", page.locator('#titre-ecran').text_content() == "Push · poussée")
    accueil(page)
    verifier("séance en cours : Reprendre", "séance en cours" in page.locator('.seance-jour').inner_text().lower()
             and page.locator('.seance-jour a.bouton').inner_text() == "Reprendre")
    page.click('.seance-jour a.bouton')
    page.wait_for_selector('[data-action="valider"]')
    finir_exercice(page)  # échauffement

    # --- Remplacement pour cette séance
    verifier("remplacer disponible avant la première série", page.locator('[data-action="remplacer-ouvrir"]').count() == 1)
    page.click('[data-action="remplacer-ouvrir"]')
    pilules = page.locator('[data-action="remplacer-choisir"]').all_inner_texts()
    verifier("alternatives proposées", "Développé couché machine" in pilules and "Pompes" in pilules and "Développé couché" in pilules, json.dumps(pilules, ensure_ascii=False))
    page.click('[data-action="remplacer-valider"][data-duree="seance"]')
    verifier("choix obligatoire", "Choisis un exercice" in page.locator('.remplacer').inner_text())
    page.click('[data-action="remplacer-choisir"]:has-text("Développé couché machine")')
    page.screenshot(path=CAPTURES + "jour-remplacer.png")
    page.click('[data-action="remplacer-valider"][data-duree="seance"]')
    verifier("exercice remplacé", page.locator('.exo__nom').text_content() == "Développé couché machine"
             and "Remplace : Développé couché haltères" in page.locator('.exo').inner_text())
    verifier("pas de charge reprise (jamais fait)", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "")
    page.fill('.nombre__champ[data-champ="charge"]', "40")
    page.click('[data-action="valider"]')
    page.click('[data-action="repos-fin"]')
    verifier("plus de remplacement après une série", page.locator('[data-action="remplacer-ouvrir"]').count() == 0)
    finir_exercice(page, charge="40")

    # --- Remplacement durable, saisie libre
    verifier("exercice suivant", page.locator('.exo__nom').text_content() == "Développé militaire haltères assis")
    page.click('[data-action="remplacer-ouvrir"]')
    page.fill('[data-role="remplacer-libre"]', "Développé militaire à la Smith")
    page.click('[data-action="remplacer-valider"][data-duree="toujours"]')
    page.wait_for_function("document.querySelector('.exo__nom').textContent.includes('Smith')", timeout=5000)
    verifier("remplacement libre", page.locator('.exo__nom').text_content() == "Développé militaire à la Smith", page.locator('.exo__nom').text_content() + " | " + page.locator('.exo').inner_text()[:200].replace("\n", "|"))
    finir_exercice(page, charge="20")
    page.click('[data-action="terminer"]')
    page.wait_for_selector('.fin')
    page.goto(URL + "#/seances")
    page.wait_for_selector('[data-action="demarrer"], .carte--plan')

    push = next(s for s in page.evaluate(LIRE, "seances") if s["nom"] == "Push · poussée")
    noms = [e["nom"] for e in push["exercices"]]
    verifier("programme : seul le remplacement durable est enregistré", noms[1] == "Développé couché haltères" and noms[2] == "Développé militaire à la Smith", json.dumps(noms, ensure_ascii=False))
    j = page.evaluate(LIRE, "journal")[0]
    verifier("journal : exercice réellement fait", j["exercices"][1]["nom"] == "Développé couché machine" and j["exercices"][1]["series"][0]["charge"] == 40)

    # Accueil après la séance : plus de carte, rubrique « Faite »
    accueil(page)
    verifier("séance faite : carte retirée", page.locator('.seance-jour').count() == 0
             and page.locator('[data-champ="seance"][aria-pressed="true"]').inner_text() == "Faite")

    # Le remplaçant retrouve son historique
    page.goto(URL + "#/seances")
    page.click('[data-action="demarrer"] >> nth=0')
    page.wait_for_selector('[data-action="valider"]')
    finir_exercice(page)
    page.click('[data-action="remplacer-ouvrir"]')
    page.click('[data-action="remplacer-choisir"]:has-text("Développé couché machine")')
    page.click('[data-action="remplacer-valider"][data-duree="seance"]')
    verifier("charge reprise de la dernière fois", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "40"
             and "La dernière fois : 40 kg" in page.locator('.exo').inner_text())
    # Le militaire Smith (remplacé durablement) retrouve aussi ses charges
    page.click('button.etat__ligne--bouton:has-text("Smith")')
    verifier("remplacement durable : charges reprises", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "22,5"
             or page.locator('.nombre__champ[data-champ="charge"]').input_value() == "20")
    page.click('[data-action="abandonner"]')
    page.wait_for_selector('.carte--plan')

    # --- Repos coché : carte masquée
    accueil(page)
    page.evaluate(METTRE, {"journal": []})  # (rien) — on vérifie seulement sur un mercredi vierge
    page.clock.set_fixed_time("2026-11-11T10:00:00Z")  # mercredi
    accueil(page)
    verifier("mercredi : Pull proposé", "Pull · tirage" in page.locator('.seance-jour').inner_text())
    page.click('[data-champ="seance"][data-valeur=\'"repos"\']')
    verifier("« Repos » masque la carte", page.locator('.seance-jour').is_hidden())

    # --- Vendredi : jour de repos
    page.clock.set_fixed_time("2026-11-13T10:00:00Z")
    accueil(page)
    verifier("vendredi : jour de repos", "vendredi · jour de repos" in page.locator('.seance-jour').inner_text().lower())

    # --- Éditeur : changer le jour de Push → vendredi
    page.goto(URL + "#/seances")
    page.click('text=Modifier >> nth=0')
    page.wait_for_selector('[data-role="jour-seance"]')
    page.select_option('[data-role="jour-seance"]', "5")
    page.wait_for_timeout(600)
    accueil(page)
    verifier("jour modifié dans l'éditeur", "Push · poussée" in page.locator('.seance-jour').inner_text())

    # --- Programme v2 adopté avant l'enregistrement des jours : correspondance par ordre
    seances = page.evaluate(LIRE, "seances")
    for s in seances:
        s.pop("jour", None)
    page.evaluate(METTRE, {"seances": seances})
    page.clock.set_fixed_time("2026-11-15T10:00:00Z")  # dimanche
    accueil(page)
    verifier("ancien programme : dimanche = Lower", "Lower · bas du corps" in page.locator('.seance-jour').inner_text())
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
