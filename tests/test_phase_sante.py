"""Test 3.1 : bilan de phase (calculs, écran, annonces de l'accueil) et pesée collée depuis Santé."""
from commun import LANCEMENT, CAPTURES
import sys
from datetime import date, timedelta
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

aujourdhui = date.today()
lundi = aujourdhui - timedelta(days=aujourdhui.weekday())
cle = lambda d: d.isoformat()


def plan(debut):
    return {"cle": "plan", "valeur": {"id": "athletics-6m", "version": 2, "debut": cle(debut), "phase": 1}}


def seance(id_, jour, charge, reps):
    return dict(id=id_, date=cle(jour), seanceId="s", nomSeance="Push · poussée",
                debut=f"{cle(jour)}T18:00:00Z", fin=f"{cle(jour)}T19:00:00Z", courant=0, reposFin=None,
                exercices=[dict(exerciceId="dc", nom="Développé couché haltères", unite="reps", repos=90,
                                cible=dict(series=3, reps=10, charge=None),
                                series=[dict(charge=charge, reps=r, fait=True) for r in reps])])


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=URL.rstrip("/"))
    page = ctx.new_page()
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL)
    page.wait_for_selector('.jours')

    # --- Calculs purs
    pesees = page.evaluate("""async () => { const m = await import('./js/corps.js');
        return ['72,4', '72.40 kg', 'Poids : 81,3 kg', '160 lb', 'abc', '7', ''].map(m.lirePeseeCollee); }""")
    verifier("lecture des pesées collées", pesees == [72.4, 72.4, 81.3, None, None, None, None], str(pesees))

    annonces = page.evaluate("""async () => { const m = await import('./js/phase.js');
        const plan = { debut: '2026-11-09', phase: 1 };
        return [m.annoncePlan(plan, '2026-12-07'), m.annoncePlan(plan, '2026-12-13'), m.annoncePlan(plan, '2026-12-14'),
                m.annoncePlan(plan, '2026-12-27'), m.annoncePlan(plan, '2027-02-01'), m.annoncePlan(plan, '2026-11-20')]; }""")
    verifier("annonces : fin de phase 1 (semaine 5)", annonces[0] == {"type": "fin-phase", "numero": 1} and annonces[1] == {"type": "fin-phase", "numero": 1}, str(annonces[:2]))
    verifier("annonces : rien au 2e jour de la semaine 6", annonces[2] is None, str(annonces[2]))
    verifier("annonces : veille de la semaine allégée 8", annonces[3] == {"type": "allegee", "semaine": 8}, str(annonces[3]))
    verifier("annonces : fin de phase 2 (semaine 13)", annonces[4] == {"type": "fin-phase", "numero": 2}, str(annonces[4]))
    verifier("annonces : rien en pleine phase", annonces[5] is None)

    bilan = page.evaluate("""async () => { const m = await import('./js/phase.js');
        const plan = { debut: '2026-11-09', phase: 1 };
        const s = (id, d, c, reps) => ({ id, date: d, debut: d + 'T18:00:00Z', fin: d + 'T19:00:00Z',
          exercices: [{ nom: 'Développé couché haltères', unite: 'reps', series: reps.map(r => ({ charge: c, reps: r, fait: true })) }] });
        const b = m.bilanPhase({ plan, numero: 1, aujourdhui: '2026-12-10',
          mesures: [{ date: '2026-11-08', poids: 75 }, { date: '2026-11-22', poids: 74.2, taille: 96 }, { date: '2026-12-06', poids: 73.5, taille: 95 }],
          journal: [s('a', '2026-11-10', 20, [10, 10, 10]), s('b', '2026-11-17', 22.5, [10, 10, 9]), s('c', '2026-12-08', 30, [10])],
          checkins: [{ date: '2026-11-11', seance: 'faite' }, { date: '2026-11-12', qualite: 3 }] });
        return { debut: b.debut, fin: b.fin, terminee: b.terminee, faites: b.seancesFaites, prevues: b.seancesPrevues,
                 checkins: b.checkinsRemplis, poids: b.poids, taille: b.taille, progres: b.progres, suivante: b.suivante && b.suivante.numero }; }""")
    verifier("bornes de la phase 1", bilan["debut"] == "2026-11-09" and bilan["fin"] == "2026-12-06" and bilan["terminee"], f"{bilan['debut']} → {bilan['fin']}")
    verifier("séances : journal + check-in « faite », hors phase exclue", bilan["faites"] == 3 and bilan["prevues"] == 20, f"{bilan['faites']}/{bilan['prevues']}")
    verifier("check-ins remplis", bilan["checkins"] == 2, str(bilan["checkins"]))
    verifier("poids : mesure de la veille comme départ", bilan["poids"]["debut"] == 75 and bilan["poids"]["fin"] == 73.5 and bilan["poids"]["ecart"] == -1.5, str(bilan["poids"]))
    verifier("tour de taille", bilan["taille"]["debut"] == 96 and bilan["taille"]["ecart"] == -1, str(bilan["taille"]))
    progres = bilan["progres"]
    verifier("progrès : max estimé 26,5 → 30 (séance hors phase ignorée)", len(progres) == 1 and progres[0]["de"] == 26.5 and progres[0]["a"] == 30, str(progres))
    verifier("phase suivante", bilan["suivante"] == 2)

    # --- Accueil en semaine 5 : annonce du bilan de la phase 1
    debut = lundi - timedelta(weeks=4)
    page.evaluate(METTRE, {
        "reglages": [plan(debut)],
        "journal": [seance("a", debut + timedelta(days=1), 20, [10, 10, 10]), seance("b", debut + timedelta(days=8), 22.5, [10, 10, 10])],
        "mesures": [dict(date=cle(debut), poids=78.0, taille=98.0), dict(date=cle(debut + timedelta(days=21)), poids=76.6, taille=96.5)],
    })
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('.jours')
    verifier("accueil : carte « Phase 1 terminée »", page.locator('.annonce-phase').count() == 1 and "phase 1 terminée" in page.locator('.annonce-phase').inner_text().lower())
    page.screenshot(path=CAPTURES + "phase-annonce.png")
    page.click('.annonce-phase')
    page.wait_for_selector('text=Progrès en salle')
    verifier("écran du bilan de phase", page.locator('#titre-ecran').text_content() == "Phase 1 · Fondations", page.locator('#titre-ecran').text_content())
    texte = page.locator('#contenu').inner_text()
    verifier("bilan : séances, corps, progrès, suite", "2 / 20" in texte.replace("\n", " ") and "78 → 76,6 kg" in texte and "+ 3,5 kg" in texte and "Construction" in texte, texte[:300].replace("\n", "|"))
    page.screenshot(path=CAPTURES + "phase-bilan.png", full_page=True)

    # Bilan de la semaine : lien vers le bilan de phase
    page.goto(URL + "#/bilan")
    page.wait_for_selector('text=Calendrier du mois')
    verifier("bilan hebdo : lien vers la phase en cours", page.locator('a[href="#/bilan/phase/2"]').count() == 1)

    # --- Veille d'une semaine allégée (fin de la semaine 7)
    debut_allegee = aujourdhui + timedelta(days=1) - timedelta(weeks=7)
    page.evaluate(METTRE, {"reglages": [plan(debut_allegee)]})
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('.jours')
    verifier("accueil : annonce de la semaine allégée", page.locator('[data-role="annonce-allegee"]').count() == 1)

    # --- Pesée collée depuis Santé
    page.goto(URL + "#/corps")
    page.wait_for_selector('[data-action="coller-pesee"]')
    page.evaluate("navigator.clipboard.writeText('72,4')")
    page.click('[data-action="coller-pesee"]')
    page.wait_for_function("document.querySelector('[data-mesure=\"poids\"]').value === '72,4'")
    verifier("pesée collée dans le champ", page.locator('[data-mesure="poids"]').input_value() == "72,4")
    verifier("message de vérification", "Pesée collée" in page.locator('[data-role="message"]').inner_text())
    page.evaluate("navigator.clipboard.writeText('160 lb')")
    page.click('[data-action="coller-pesee"]')
    page.wait_for_function("document.querySelector('[data-role=\"message\"]').textContent.includes('Aucune pesée')")
    verifier("livres refusées", True)

    page.goto(URL + "#/reglages")
    page.wait_for_selector('text=Pesée depuis Santé')
    verifier("mode d'emploi dans Réglages", page.locator('summary', has_text="Pesée depuis Santé").count() == 1)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
