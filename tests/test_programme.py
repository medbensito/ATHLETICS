"""Test du programme sur-mesure PPL + Upper/Lower : adoption, jours, unités, progression, cardio, allègement, phases, mise à niveau."""
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
PHASE1 = ["Push · poussée", "Pull · tirage", "Legs · jambes", "Upper · haut du corps", "Lower · bas du corps"]


def reglages(page):
    return {r["cle"]: r["valeur"] for r in page.evaluate(LIRE, "reglages")}


def finir_exercice(page, charge=None, reps=None):
    """Valide toutes les séries restantes de l'exercice affiché (en passant le repos)."""
    while page.locator('[data-action="valider"]').count():
        nom = page.locator('.exo__nom').text_content()
        if charge is not None and page.locator('.nombre__champ[data-champ="charge"]').count():
            page.fill('.nombre__champ[data-champ="charge"]', charge)
        if reps is not None:
            page.fill('.nombre__champ[data-champ="reps"]', reps)
        page.click('[data-action="valider"]')
        if page.locator('[data-action="repos-fin"]').is_visible():
            page.click('[data-action="repos-fin"]')
        if page.locator('.exo__nom').text_content() != nom:
            return


def ouvrir(page, nom_exercice):
    page.click(f'button.etat__ligne--bouton:has-text("{nom_exercice}")')


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())

    # --- Démarrage depuis l'écran vide
    page.goto(URL + "#/seances")
    page.wait_for_selector('[data-action="plan-demarrer"]')
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    noms = page.locator('.seance__nom').all_text_contents()
    verifier("phase 1 : Push, Pull, Legs, Upper, Lower", noms == ["Fondations"] + PHASE1, json.dumps(noms, ensure_ascii=False))
    desc = page.locator('.seance__description').all_inner_texts()
    verifier("jours dans les descriptions", [d.split(' ·')[0] for d in desc] == ["Mardi", "Mercredi", "Jeudi", "Samedi", "Dimanche"], json.dumps(desc, ensure_ascii=False))
    r = reglages(page)
    verifier("plan version 2, phase 1", r["plan"]["version"] == 2 and r["plan"]["phase"] == 1)
    verifier("rappels sur mar, mer, jeu, sam, dim", sorted(r["rappels"]["jours"]) == [0, 2, 3, 4, 6], json.dumps(r["rappels"]))
    page.screenshot(path=CAPTURES + "ppl-liste.png")

    # --- Push : échauffement, développé couché, cardio sans charge
    page.click('[data-action="demarrer"] >> nth=0')
    page.wait_for_selector('[data-action="valider"]')
    verifier("échauffement en minutes, sans charge", page.locator('.nombre__libelle').all_text_contents() == ["Minutes"])
    finir_exercice(page)
    verifier("premier exercice : développé couché haltères", page.locator('.exo__nom').text_content() == "Développé couché haltères"
             and "Omoplates" in page.locator('.exo__consigne').inner_text())
    finir_exercice(page, charge="20", reps="10")
    ouvrir(page, "Cardio zone 2")
    verifier("cardio de fin : 15 min, sans charge", page.locator('.nombre__libelle').all_text_contents() == ["Minutes"]
             and page.locator('.nombre__champ[data-champ="reps"]').input_value() == "15")
    finir_exercice(page)
    page.click('[data-action="terminer"]')
    page.wait_for_selector('.fin')
    page.goto(URL + "#/seances")
    page.wait_for_selector('[data-action="demarrer"], .carte--plan')

    # --- Legs : planche en secondes, pas de 5
    page.click('[data-action="demarrer"] >> nth=2')
    page.wait_for_selector('[data-action="valider"]')
    ouvrir(page, "Planche")
    page.click('[data-action="pas"][data-champ="reps"][data-pas="1"]')
    verifier("planche : secondes, pas de 5", page.locator('.nombre__champ[data-champ="reps"]').input_value() == "35")
    page.click('[data-action="abandonner"]')
    page.wait_for_selector('.carte--plan')

    # --- Push à nouveau : progression proposée
    page.click('[data-action="demarrer"] >> nth=0')
    page.wait_for_selector('[data-action="valider"]')
    finir_exercice(page)
    verifier("progression : 22,5 kg proposés", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "22,5"
             and "+ 2,5 kg" in page.locator('.exo__progression').inner_text())
    page.screenshot(path=CAPTURES + "ppl-seance.png")
    page.click('[data-action="abandonner"]')
    page.wait_for_selector('.carte--plan')

    # --- Semaine 8 : allégée, phase 2 proposée
    debut = page.evaluate("""() => { const d = new Date(); d.setHours(12); const j = d.getDay(); d.setDate(d.getDate() - (j === 0 ? 6 : j - 1) - 49);
        return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }""")
    plan = reglages(page)["plan"]
    plan["debut"] = debut
    page.evaluate(METTRE, {"reglages": [{"cle": "plan", "valeur": plan}]})
    page.reload()
    page.wait_for_selector('.carte--plan')
    verifier("semaine 8 allégée, phase 2 proposée", "Semaine 8 sur 26 · semaine allégée" in page.locator('.carte--plan').inner_text()
             and page.locator('[data-action="phase-suivante"][data-phase="2"]').count() == 1)
    page.click('[data-action="phase-suivante"]')
    page.wait_for_function("document.querySelector('.carte--plan h2').textContent === 'Construction'")
    verifier("phase 2 : même répartition", page.locator('.seance__nom').all_text_contents()[1:] == PHASE1)

    # Upper phase 2 : intervalles en secondes, sans charge, non allégés ; muscu allégée
    page.click('[data-action="demarrer"] >> nth=3')
    page.wait_for_selector('[data-action="valider"]')
    finir_exercice(page)
    verifier("muscu allégée : 3 séries au lieu de 4", "Série 1 sur 3" in page.locator('.exo__serie').inner_text()
             and page.locator('.exo__nom').text_content() == "Développé militaire barre")
    ouvrir(page, "Intervalles")
    verifier("intervalles : 8 × 30 s, sans charge, non allégés", "Série 1 sur 8" in page.locator('.exo__serie').inner_text()
             and page.locator('.nombre__libelle').all_text_contents() == ["Secondes"]
             and page.locator('.nombre__champ[data-champ="reps"]').input_value() == "30")
    page.click('[data-action="valider"]')
    t = page.locator('[data-role="repos-temps"]').inner_text()
    verifier("phase lente de 90 s", t in ("1:30", "1:29"), t)
    page.screenshot(path=CAPTURES + "ppl-intervalles.png")
    page.click('[data-action="abandonner"]')
    page.wait_for_selector('.carte--plan')
    verifier("journal conservé", len(page.evaluate(LIRE, "journal")) == 1)
    nav.close()

    # --- Mise à niveau d'un programme adopté en 1.1 (version 1)
    nav = p.chromium.launch(**LANCEMENT)
    page = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    page.on("dialog", lambda d: d.accept())
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL + "#/seances")
    page.wait_for_selector('[data-action="vides"]')
    page.evaluate(METTRE, {
        "reglages": [{"cle": "plan", "valeur": {"id": "athletics-6m", "debut": "2026-11-02", "phase": 1}},
                     {"cle": "rappels", "valeur": {"heureCheckin": "22:00", "heureSeance": "19:00", "jours": [1, 2, 3, 4, 5]}}],
        "seances": [{"id": "ancienne", "ordre": 1, "nom": "Force A · corps entier", "exercices": [{"id": "e1", "nom": "Goblet squat", "series": 3, "reps": 10, "charge": None, "repos": 90}]}],
    })
    page.reload()
    page.wait_for_selector('[data-action="plan-mettre-a-jour"]')
    page.screenshot(path=CAPTURES + "ppl-mise-a-niveau.png")
    page.click('[data-action="plan-mettre-a-jour"]')
    page.wait_for_selector('.annonce')
    r = reglages(page)
    verifier("mise à niveau : séances PPL + UL", page.locator('.seance__nom').all_text_contents()[1:] == PHASE1)
    verifier("mise à niveau : début et phase conservés, version 2", r["plan"]["debut"] == "2026-11-02" and r["plan"]["phase"] == 1 and r["plan"]["version"] == 2)
    verifier("mise à niveau : heures des rappels conservées, jours mis à jour",
             r["rappels"]["heureSeance"] == "19:00" and r["rappels"]["heureCheckin"] == "22:00" and sorted(r["rappels"]["jours"]) == [0, 2, 3, 4, 6])
    verifier("plus de proposition de mise à niveau", page.locator('[data-action="plan-mettre-a-jour"]').count() == 0)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
