"""Test 1.4 : calendrier de régularité, records, max estimé, annonce des nouveaux records."""
from commun import LANCEMENT, CAPTURES
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs, ok = [], True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


METTRE = """(args) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const tx = db.transaction(Object.keys(args), 'readwrite');
    for (const [m, liste] of Object.entries(args)) liste.forEach(v => tx.objectStore(m).put(v));
    tx.oncomplete = () => { db.close(); res(); }; }; })"""


def ck(date, **v):
    base = dict(date=date, seance=None, coucher=None, lever=None, sommeilMin=None, qualite=None, repas=None,
                grignotage=None, boissons=None, notes="", cigarettes=None, majLe=None)
    base.update(v)
    return base


def seance_journal(id_, date, exercices):
    return dict(id=id_, date=date, seanceId="s1", nomSeance="Push · poussée", debut=f"{date}T18:00:00Z", fin=f"{date}T19:00:00Z",
                courant=0, reposFin=None, exercices=[dict(exerciceId=n, nom=n, unite="reps", repos=90, cible=dict(series=len(s), reps=8, charge=None),
                                                          series=[dict(charge=c, reps=r, fait=True) for c, r in s]) for n, s in exercices])


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, timezone_id="UTC")
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.clock.set_fixed_time("2026-11-18T10:00:00Z")  # mercredi 18 novembre

    page.goto(URL + "#/seances")
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    page.evaluate(METTRE, {
        "checkins": [ck("2026-11-03", seance="faite"), ck("2026-11-04", cigarettes=5), ck("2026-11-06", seance="repos"),
                     ck("2026-11-10", repas=2), ck("2026-10-28", seance="faite")],
        "journal": [seance_journal("j1", "2026-11-10", [("Développé couché", [(40, 8), (40, 8), (40, 7)])]),
                    seance_journal("j2", "2026-11-17", [("Développé couché", [(42.5, 8), (42.5, 6)]), ("Tirage vertical", [(35, 10)])])],
    })

    # --- Calendrier
    page.goto(URL + "#/bilan")
    page.wait_for_selector('.regularite')
    page.click('text=Calendrier du mois')
    page.wait_for_selector('.cal')
    verifier("titre du mois", page.locator('#titre-ecran').inner_text() == "Novembre 2026")
    etat = page.locator('.jours__etat').inner_text()
    verifier("résumé : 3 séances, 5 jours notés sur 18", etat == "3 séances · 5 jours notés sur 18", etat)
    jours = page.locator('.cal__jour:not(.cal__jour--vide)')
    verifier("30 jours, décalage du dimanche 1er", jours.count() == 30 and page.locator('.cal__jour--vide').count() == 6)
    cls = lambda n: jours.nth(n - 1).get_attribute("class")
    verifier("3 nov. séance (check-in)", "cal__jour--seance" in cls(3))
    verifier("4 nov. check-in rempli", "cal__jour--note" in cls(4))
    verifier("6 nov. repos", "cal__jour--repos" in cls(6))
    verifier("10 et 17 nov. séances (journal)", "cal__jour--seance" in cls(10) and "cal__jour--seance" in cls(17))
    verifier("aujourd'hui marqué, séance prévue (mercredi)", "cal__jour--aujourdhui" in cls(18) and "cal__jour--prevu" in cls(18))
    verifier("séances prévues à venir (jeudi 19, vendredi 20 non)", "cal__jour--prevu" in cls(19) and "cal__jour--prevu" not in cls(20))
    verifier("pas de mois suivant", page.locator('a[aria-label="Mois suivant"]').count() == 0)
    page.screenshot(path=CAPTURES + "cal-novembre.png", full_page=True)
    page.click('a[aria-label="Mois précédent"]')
    page.wait_for_function("document.querySelector('#titre-ecran').textContent === 'Octobre 2026'")
    verifier("octobre : 1 séance", page.locator('.jours__etat').inner_text().startswith("1 séance"))
    verifier("pas de mois avant les premières données", page.locator('a[aria-label="Mois précédent"]').count() == 0)
    page.goto(URL + "#/bilan/mois/2030-01")
    page.wait_for_selector('.cal')
    verifier("mois futur ramené au mois en cours", page.locator('#titre-ecran').inner_text() == "Novembre 2026")

    # --- Records
    page.goto(URL + "#/seances")
    page.wait_for_selector('.carte--plan')
    page.click('text=Records et force estimée')
    page.wait_for_selector('.record')
    txt = page.locator('#contenu').inner_text()
    # Max estimé : 42,5 × (1 + 8/30) = 53,8 → arrondi au 0,5 : 54
    verifier("records : meilleure charge et max estimé", "Meilleure charge : 42,5 kg × 8" in txt and "54 kg" in txt, txt.replace("\n", "|")[:200])
    verifier("records : deux exercices", page.locator('.record').count() == 2)
    page.screenshot(path=CAPTURES + "records.png")

    # --- Historique : max estimé
    page.goto(URL + "#/seances/exercice/Développé couché")
    page.wait_for_selector('.chiffres')
    verifier("historique : max estimé", "Max estimé" in page.locator('.chiffres').inner_text() and "54 kg" in page.locator('.chiffres').inner_text())

    # --- Séance avec nouveau record annoncé
    page.goto(URL + "#/seances")
    page.wait_for_selector('.carte--plan')
    page.evaluate(METTRE, {"seances": [dict(id="s9", ordre=9, nom="Test", jour=None, exercices=[
        dict(id="x1", nom="Développé couché", series=1, reps=8, charge=None, repos=10, unite="reps", consigne=""),
        dict(id="x2", nom="Tirage vertical", series=1, reps=10, charge=None, repos=10, unite="reps", consigne="")])]})
    page.reload()
    page.wait_for_selector('[data-action="demarrer"][data-id="s9"]')
    page.click('[data-action="demarrer"][data-id="s9"]')
    page.wait_for_selector('[data-action="valider"]')
    page.fill('.nombre__champ[data-champ="charge"]', "45")
    page.fill('.nombre__champ[data-champ="reps"]', "6")
    page.click('[data-action="valider"]')
    page.click('[data-action="repos-fin"]')
    page.fill('.nombre__champ[data-champ="charge"]', "30")  # pas de record sur le tirage
    page.click('[data-action="valider"]')
    page.click('[data-action="terminer"]')
    page.wait_for_selector('.annonce')
    annonce = page.locator('.annonce').inner_text()
    verifier("nouveau record annoncé (charge)", "Nouveau record : Développé couché 45 kg × 6." in annonce, annonce)
    verifier("pas de record pour le tirage", "Tirage" not in annonce)

    # Record de max estimé sans hausse de charge : 45 × 8 (> 45 × 6)
    page.click('[data-action="demarrer"][data-id="s9"]')
    page.wait_for_selector('[data-action="valider"]')
    page.fill('.nombre__champ[data-champ="charge"]', "45")
    page.fill('.nombre__champ[data-champ="reps"]', "8")
    page.click('[data-action="valider"]')
    page.click('[data-action="repos-fin"]')
    page.click('[data-action="terminer"]')
    page.wait_for_selector('.annonce')
    annonce = page.locator('.annonce').inner_text()
    verifier("record de max estimé (même charge, plus de répétitions)", "Développé couché 45 kg × 8" in annonce, annonce)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
