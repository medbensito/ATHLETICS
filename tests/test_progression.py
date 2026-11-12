"""Test 2.2 : courbe de progression par exercice (charge, max estimé, durée),
bulle au toucher, accès depuis les records."""
from commun import LANCEMENT, CAPTURES
import sys
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


def seance(id_, date, exercices):
    return dict(id=id_, date=date, seanceId="s", nomSeance="Push · poussée", debut=f"{date}T18:00:00Z", fin=f"{date}T19:00:00Z",
                courant=0, reposFin=None, exercices=exercices)


def dc(charge, reps):
    return dict(exerciceId="dc", nom="Développé couché haltères", unite="reps", repos=90,
                cible=dict(series=3, reps=10, charge=None),
                series=[dict(charge=charge, reps=r, fait=True) for r in reps])


def planche(secondes):
    return dict(exerciceId="pl", nom="Planche", unite="s", repos=60, cible=dict(series=2, reps=30, charge=None),
                series=[dict(charge=None, reps=s, fait=True) for s in secondes])


def unique():
    return dict(exerciceId="un", nom="Face pull", unite="reps", repos=60, cible=dict(series=2, reps=12, charge=None),
                series=[dict(charge=15, reps=12, fait=True)])


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    page = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True).new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL)
    page.wait_for_selector('.jours')
    page.evaluate(METTRE, {"journal": [
        seance("a", "2026-10-06", [dc(20, [10, 10, 10]), planche([30, 30]), unique()]),
        seance("b", "2026-10-13", [dc(22.5, [8, 8, 7]), planche([35, 30])]),
        seance("c", "2026-10-20", [dc(22.5, [10, 10, 9])]),
        seance("d", "2026-10-27", [dc(25, [8, 7, 7]), planche([45, 40])]),
    ]})

    # Résumé des séries (module pur)
    resume = page.evaluate("""async () => { const m = await import('./js/progression.js');
        return [m.resumeSeries([{charge:22.5,reps:10},{charge:22.5,reps:9}]),
                m.resumeSeries([{charge:20,reps:10},{charge:22.5,reps:8}]),
                m.resumeSeries([{charge:null,reps:30},{charge:null,reps:25}], 's')]; }""")
    verifier("résumé des séries", resume == ["22,5 kg × 10, 9", "20 kg × 10 · 22,5 kg × 8", "30 s, 25 s"], str(resume))

    # --- Exercice avec charge : deux mesures au choix
    page.goto(URL + "#/seances/exercice/dc")
    page.wait_for_selector('.progression svg')
    verifier("bouton Retour sans texte brut", "${" not in page.locator('.retour').inner_text(), page.locator('.retour').inner_text())
    choix = page.locator('[data-mesure]')
    verifier("deux mesures : Charge et Max estimé", choix.count() == 2 and choix.nth(0).inner_text() == "Charge" and choix.nth(1).inner_text() == "Max estimé")
    visible = page.locator('[data-graph]:not([hidden])')
    verifier("une seule courbe visible (charge)", visible.count() == 1 and visible.get_attribute("data-graph") == "charge")
    verifier("4 points sur la courbe", page.locator('[data-graph="charge"] circle.graph__point:not([data-role])').count() == 4)
    etiquette = page.locator('[data-graph="charge"] .graph__txt--valeur').text_content()
    verifier("dernière valeur écrite au bout", etiquette == "25 kg", etiquette)

    # Bulle au toucher sur le premier point
    boite = page.locator('[data-graph="charge"] svg').bounding_box()
    page.touchscreen.tap(boite["x"] + boite["width"] * 0.12, boite["y"] + boite["height"] / 2)
    bulle = page.locator('[data-graph="charge"] [data-role="bulle"]')
    page.wait_for_timeout(150)
    texte = bulle.inner_text() if bulle.is_visible() else ""
    verifier("bulle : valeur, date, séries", "20 kg" in texte and "× 10, 10, 10" in texte, texte.replace("\n", "|"))
    page.screenshot(path=CAPTURES + "progression-charge.png")

    # Max estimé : 22,5 × 10 → 30 kg ; 25 × 8 → 31,5 kg
    page.click('[data-mesure="max"]')
    verifier("bascule sur le max estimé", page.locator('[data-graph="max"]').is_visible() and not page.locator('[data-graph="charge"]').is_visible())
    verifier("note du max estimé", page.locator('[data-note="max"]').is_visible())
    verifier("dernier max estimé", page.locator('[data-graph="max"] .graph__txt--valeur').text_content() == "31,5 kg",
             page.locator('[data-graph="max"] .graph__txt--valeur').text_content())
    page.screenshot(path=CAPTURES + "progression-max.png", full_page=True)

    # --- Exercice en secondes : une seule mesure, sans bascule
    page.goto(URL + "#/seances/exercice/pl")
    page.wait_for_selector('.progression svg')
    verifier("planche : courbe de durée, sans bascule", page.locator('[data-mesure]').count() == 0 and page.locator('[data-graph="quantite"]').count() == 1)
    verifier("planche : dernière durée", page.locator('.graph__txt--valeur').text_content() == "45 s", page.locator('.graph__txt--valeur').text_content())

    # --- Une seule séance : message d'attente
    page.goto(URL + "#/seances/exercice/un")
    page.wait_for_selector('.progression')
    verifier("une séance : pas encore de courbe", "deuxième séance" in page.locator('.progression').inner_text() and page.locator('.progression svg').count() == 0)

    # --- Records : chaque exercice ouvre sa fiche
    page.goto(URL + "#/seances/records")
    page.wait_for_selector('.record__lien')
    verifier("records : retour sans texte brut", "${" not in page.locator('.retour').inner_text())
    page.locator('.record__lien', has_text="Développé couché").click()
    page.wait_for_selector('.progression svg')
    verifier("record → fiche de l'exercice", page.url.endswith("#/seances/exercice/dc"), page.url)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
