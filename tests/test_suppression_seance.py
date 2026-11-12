"""Test 1.4.1 : suppression d'une séance réalisée depuis « Dernières séances »."""
from commun import LANCEMENT, CAPTURES
import sys
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


def j(id_, date, nom):
    return dict(id=id_, date=date, seanceId="s", nomSeance=nom, debut=f"{date}T18:00:00Z", fin=f"{date}T19:00:00Z", courant=0, reposFin=None,
                exercices=[dict(exerciceId="e", nom="Squat", unite="reps", repos=90, cible=dict(series=1, reps=8, charge=None),
                                series=[dict(charge=60, reps=8, fait=True)])])


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    page = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    reponses = []
    page.on("dialog", lambda d: (reponses.append(d.message), d.accept() if len(reponses) > 1 else d.dismiss()))

    page.goto(URL + "#/seances")
    page.click('[data-action="plan-demarrer"]')
    page.wait_for_selector('.carte--plan')
    page.evaluate(METTRE, {
        "journal": [j("a", "2026-11-03", "Push · poussée"), j("b", "2026-11-05", "Legs · jambes"), j("c", "2026-11-05", "Upper · haut du corps")],
        "checkins": [dict(date="2026-11-03", seance="faite"), dict(date="2026-11-05", seance="faite")],
    })
    page.reload()
    page.wait_for_selector('[data-action="supprimer-faite"]')
    verifier("bouton Supprimer sur chaque séance", page.locator('[data-action="supprimer-faite"]').count() == 3)

    # Première tentative refusée : rien ne change
    page.click('[data-action="supprimer-faite"][data-id="a"]')
    page.wait_for_timeout(300)
    verifier("confirmation explicite", "ne peut pas être annulée" in reponses[0], reponses[0])
    verifier("refus : rien supprimé", len(page.evaluate(LIRE, "journal")) == 3)

    # Confirmation : suppression + check-in remis à vide
    page.click('[data-action="supprimer-faite"][data-id="a"]')
    page.wait_for_selector('.annonce:has-text("Séance supprimée.")')
    ids = sorted(x["id"] for x in page.evaluate(LIRE, "journal"))
    cks = {c["date"]: c for c in page.evaluate(LIRE, "checkins")}
    verifier("séance supprimée", ids == ["b", "c"], str(ids))
    verifier("check-in du jour remis à « non renseigné »", cks["2026-11-03"]["seance"] is None)

    # Deux séances le même jour : le check-in reste « faite »
    page.click('[data-action="supprimer-faite"][data-id="b"]')
    page.wait_for_function("document.querySelectorAll('[data-action=\"supprimer-faite\"]').length === 1")
    cks = {c["date"]: c for c in page.evaluate(LIRE, "checkins")}
    verifier("autre séance le même jour : check-in conservé", cks["2026-11-05"]["seance"] == "faite")

    # Records mis à jour
    page.goto(URL + "#/seances/records")
    page.wait_for_selector('.record')
    verifier("records recalculés", page.locator('.record').count() == 1)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
