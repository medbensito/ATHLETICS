"""Test 2.1 : rappel de sauvegarde à l'accueil (export en un geste, « Plus tard »)
et repos (anneau) qui ne masque pas les champs de la série, sur grand et petit écran."""
from commun import LANCEMENT, CAPTURES
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs, ok = [], True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


LIRE_REGLAGE = """(cle) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const r = db.transaction('reglages').objectStore('reglages').get(cle);
    r.onsuccess = () => { db.close(); res(r.result ? r.result.valeur : null); }; }; })"""
METTRE = """(args) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const tx = db.transaction(Object.keys(args), 'readwrite');
    for (const [m, liste] of Object.entries(args)) liste.forEach(v => tx.objectStore(m).put(v));
    tx.oncomplete = () => { db.close(); res(); }; }; })"""
EFFACER_REGLAGE = """(cle) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const tx = db.transaction('reglages', 'readwrite'); tx.objectStore('reglages').delete(cle);
    tx.oncomplete = () => { db.close(); res(); }; }; })"""

CARTE = '[data-role="sauvegarde"]'


def visibles_au_dessus_du_bouton(page):
    """Le champ Répétitions est-il entièrement visible au-dessus du bouton « Série faite » ?"""
    return page.evaluate("""() => {
        const champ = document.querySelectorAll('.exo .nombre')[1] || document.querySelector('.exo .nombre');
        const bouton = document.querySelector('.barre-action');
        const a = champ.getBoundingClientRect(), b = bouton.getBoundingClientRect();
        return { bas: Math.round(a.bottom), bouton: Math.round(b.top), ok: a.bottom <= b.top };
    }""")


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))

    # --- Rappel de sauvegarde ---
    page.goto(URL)
    page.wait_for_selector('.jours')
    verifier("pas de rappel sans données", page.locator(CARTE).count() == 0)

    page.evaluate(METTRE, {"checkins": [dict(date=f"2026-10-0{i}", seance="repos") for i in range(1, 3)]})
    page.reload()
    page.wait_for_selector('.jours')
    verifier("pas de rappel avec 2 check-ins seulement", page.locator(CARTE).count() == 0)

    page.evaluate(METTRE, {"checkins": [dict(date="2026-10-03", seance="repos")]})
    page.reload()
    page.wait_for_selector(CARTE)
    texte = page.locator(CARTE).inner_text()
    verifier("rappel affiché, jamais exporté", "Dernier export : jamais" in texte and "3 check-ins" in texte, texte.replace("\n", "|"))
    page.screenshot(path=CAPTURES + "sauvegarde-rappel.png")

    # « Plus tard » : masqué 3 jours, même après rechargement
    page.click('[data-action="reporter-sauvegarde"]')
    page.wait_for_function(f"!document.querySelector('{CARTE}')")
    reportee = page.evaluate(LIRE_REGLAGE, "sauvegardeReportee")
    verifier("report enregistré", reportee is not None, str(reportee))
    page.reload()
    page.wait_for_selector('.jours')
    verifier("toujours masqué après rechargement", page.locator(CARTE).count() == 0)

    # Report échu : le rappel revient, et l'export se fait depuis l'accueil
    page.evaluate(EFFACER_REGLAGE, "sauvegardeReportee")
    page.reload()
    page.wait_for_selector(CARTE)
    with page.expect_download() as dl:
        page.locator('[data-action="exporter-accueil"]').tap()
    verifier("fichier exporté depuis l'accueil", dl.value.suggested_filename.startswith("athletics-sauvegarde-"), dl.value.suggested_filename)
    page.wait_for_selector(f'{CARTE} [role="status"]')
    verifier("confirmation affichée", "Sauvegarde faite" in page.locator(CARTE).inner_text())
    verifier("date d'export enregistrée", page.evaluate(LIRE_REGLAGE, "dernierExport") is not None)
    page.reload()
    page.wait_for_selector('.jours')
    verifier("plus de rappel après un export récent", page.locator(CARTE).count() == 0)

    # --- Chrono compact : le champ Répétitions reste visible pendant le repos ---
    page.goto(URL + "#/seances")
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    page.locator('[data-action="demarrer"]').first.click()
    page.wait_for_selector('.exo')
    # Aller au premier exercice avec charge et répétitions (après l'échauffement)
    for k in range(6):
        page.click(f'[data-action="aller"][data-index="{k}"] >> nth=-1')
        page.wait_for_timeout(150)
        if page.locator('.exo .nombre').count() >= 2:
            break
    page.click('[data-action="valider"]')
    page.wait_for_selector('[data-role="repos"]:not([hidden])')
    page.evaluate("window.scrollTo(0, 0)")
    verifier("anneau de repos affiché", page.locator('[data-role="anneau"]').count() == 1)
    position = visibles_au_dessus_du_bouton(page)
    verifier("champ Répétitions visible au-dessus de la barre « Série faite » pendant le repos", position["ok"], str(position))
    page.screenshot(path=CAPTURES + "seance-repos-compact.png")
    nav.close()

    # Petit écran (iPhone SE) : bouton dans le flux, jamais par-dessus un champ
    nav = p.chromium.launch(**LANCEMENT)
    page = nav.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True).new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL + "#/seances")
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    page.locator('[data-action="demarrer"]').first.click()
    page.wait_for_selector('.exo')
    for k in range(6):
        page.click(f'[data-action="aller"][data-index="{k}"] >> nth=-1')
        page.wait_for_timeout(150)
        if page.locator('.exo .nombre').count() >= 2:
            break
    page.click('[data-action="valider"]')
    page.wait_for_selector('[data-role="repos"]:not([hidden])')
    page.evaluate("window.scrollTo(0, 0)")
    position = visibles_au_dessus_du_bouton(page)
    verifier("petit écran : champ Répétitions visible pendant le repos", position["ok"], str(position))
    page.screenshot(path=CAPTURES + "seance-repos-petit.png")
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
