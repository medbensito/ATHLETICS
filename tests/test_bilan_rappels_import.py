"""Test J5 : bilan hebdomadaire, rappels dans l'app, fichier calendrier, import JSON."""
from commun import LANCEMENT, CAPTURES
import json, sys, tempfile, os
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
LIRE = """(m) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const r = db.transaction(m).objectStore(m).getAll(); r.onsuccess = () => { db.close(); res(r.result); }; }; })"""


def ck(date, **v):
    base = dict(date=date, seance=None, coucher=None, lever=None, sommeilMin=None, qualite=None, repas=None,
                grignotage=None, boissons=None, notes="", cigarettes=None, majLe=None)
    base.update(v)
    return base


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                          has_touch=True, accept_downloads=True, timezone_id="UTC")
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    # Mercredi 11 novembre 2026, 21 h 30
    page.clock.set_fixed_time("2026-11-11T21:30:00Z")

    page.goto(URL + "#/bilan")
    page.wait_for_selector('.message-semaine')
    verifier("bilan vide : message d'accueil", "Nouvelle semaine" in page.locator('.message-semaine').inner_text(),
             page.locator('.message-semaine').inner_text())

    # --- Données : semaine en cours (lun. 9 → mer. 11) et semaine précédente
    seances = [dict(id=f"s{i}", ordre=i, nom=f"Séance {i}", exercices=[]) for i in range(1, 6)]
    page.evaluate(METTRE, {
        "seances": seances,
        "checkins": [
            ck("2026-11-09", seance="faite", coucher="23:00", lever="07:00", sommeilMin=480, qualite=4, repas=2, cigarettes=6, grignotage=False, boissons=False),
            ck("2026-11-10", seance="repos", coucher="00:00", lever="07:00", sommeilMin=420, qualite=3, repas=3, cigarettes=4, grignotage=True, boissons=False),
            ck("2026-11-03", cigarettes=10, sommeilMin=360),
            ck("2026-11-05", seance="faite", cigarettes=8, sommeilMin=400),
        ],
        "journal": [dict(id="j1", date="2026-11-11", seanceId="s1", nomSeance="Séance 1", debut="2026-11-11T18:00:00Z",
                         fin="2026-11-11T19:00:00Z", exercices=[], courant=0, reposFin=None)],
    })
    page.reload()
    page.wait_for_selector('.regularite')
    texte = page.locator('#contenu').inner_text()
    msg = page.locator('.message-semaine').inner_text()
    verifier("titre et période", page.locator('#titre-ecran').text_content() == "Cette semaine" and "9 nov" in page.locator('#sur-titre').inner_text().lower())
    verifier("séances 2 / 5 (journal + check-in)", "2\n / 5" in texte or "2 / 5" in texte, texte[:200].replace("\n", "|"))
    verifier("check-ins 2 / 3 jours", "2\n / 3" in texte or "2 / 3" in texte)
    verifier("sommeil moyen 7 h 30", "7 h 30" in texte)
    verifier("comparaison sommeil", "Semaine précédente : 6 h 20" in texte)
    verifier("qualité 3,5 / 5", "3,5 / 5" in texte)
    verifier("cigarettes 5 par jour vs 9", "Semaine précédente : 9 par jour" in texte and "\n5\n" in texte)
    verifier("repas équilibrés 83 %", "83 %" in texte and "5 sur 6" in texte)
    verifier("grignotage / boissons", "1 / 2" in texte and "2 / 2" in texte)
    verifier("message factuel et encourageant", "contre 1 la semaine précédente" in msg and "Moins de cigarettes" in msg, msg)
    page.screenshot(path=CAPTURES + "j5-bilan.png", full_page=True)

    page.click('a[aria-label="Semaine précédente"]')
    page.wait_for_function("document.querySelector('#titre-ecran').textContent.includes('Semaine du')")
    texte2 = page.locator('#contenu').inner_text()
    verifier("semaine précédente", "Semaine terminée" in texte2 and "6 h 20" in texte2 and "9" in texte2)
    verifier("pas de semaine avant les premières données", page.locator('a[aria-label="Semaine précédente"]').count() == 0)

    # Repas par jour = 4 → 5 sur 8
    page.click('.onglet[data-route="reglages"]')
    page.wait_for_selector('[data-repas="1"]')
    page.click('[data-repas="1"]')
    page.wait_for_timeout(200)
    page.click('.onglet[data-route="bilan"]')
    page.wait_for_selector('.regularite')
    verifier("repas par jour réglable", "5 sur 8" in page.locator('#contenu').inner_text())

    # --- Rappels dans l'app (21 h 30, mercredi)
    page.click('.onglet[data-route="aujourdhui"]')
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("rappel du check-in du soir", page.locator('[data-rappel="checkin"]').is_visible())
    verifier("pas de rappel de séance (déjà faite via le journal ? non : check-in vide)", page.locator('[data-rappel="seance"]').is_visible())
    page.click('[data-champ="seance"][data-valeur=\'"faite"\']')
    verifier("rappel de séance masqué une fois la séance notée", page.locator('[data-rappel="seance"]').is_hidden())
    page.fill('[data-heure="coucher"]', "23:00"); page.fill('[data-heure="lever"]', "07:00")
    page.click('[data-champ="qualite"][data-valeur="4"]')
    page.click('[data-champ="repas"][data-pas="1"]')
    page.click('[data-champ="grignotage"][data-valeur="false"]')
    page.click('[data-champ="boissons"][data-valeur="false"]')
    page.click('[data-champ="cigarettes"][data-pas="-1"]')
    verifier("rappel du check-in masqué une fois complet", page.locator('[data-rappel="checkin"]').is_hidden())

    # Avant l'heure : pas de rappel
    page.clock.set_fixed_time("2026-11-11T12:00:00Z")
    page.goto(URL + "#/aujourdhui/2026-11-10")
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("pas de rappel à midi", page.locator('[data-rappel]').count() == 0)
    # Samedi : pas de rappel de séance (jours lun.–ven. par défaut)
    page.clock.set_fixed_time("2026-11-14T18:30:00Z")
    page.goto(URL + "#/aujourdhui/2026-11-13")
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("pas de rappel de séance un samedi", page.locator('[data-rappel="seance"]').count() == 0)
    page.clock.set_fixed_time("2026-11-11T21:30:00Z")

    # --- Réglages des rappels et fichier calendrier
    page.goto(URL + "#/reglages")
    page.wait_for_selector('[data-jour="6"]')
    page.click('[data-jour="6"]')  # ajoute samedi
    page.click('[data-jour="3"]')  # retire mercredi
    page.fill('[data-rappel="heureSeance"]', "07:15")
    page.locator('[data-rappel="heureSeance"]').dispatch_event("change")
    page.wait_for_timeout(200)
    reg = {r["cle"]: r["valeur"] for r in page.evaluate(LIRE, "reglages")}
    verifier("réglages des rappels enregistrés", reg["rappels"]["jours"] == [1, 2, 4, 5, 6] and reg["rappels"]["heureSeance"] == "07:15", json.dumps(reg["rappels"]))
    with page.expect_download() as dl:
        page.click('[data-action="calendrier"]')
    ics = open(dl.value.path(), "rb").read().decode("utf-8")
    verifier("fichier .ics", dl.value.suggested_filename == "athletics-rappels.ics" and ics.startswith("BEGIN:VCALENDAR\r\n") and ics.endswith("END:VCALENDAR\r\n"))
    verifier(".ics : check-in quotidien 21 h", "RRULE:FREQ=DAILY" in ics and "DTSTART:20261112T210000" in ics)
    verifier(".ics : séance lun mar jeu ven sam 7 h 15", "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,TH,FR,SA" in ics and "DTSTART:20261112T071500" in ics)
    verifier(".ics : alarmes", ics.count("BEGIN:VALARM") == 2)
    page.wait_for_selector('.annonce')

    # --- Import : export, modification, puis restauration
    with page.expect_download() as dl:
        page.click('[data-action="exporter"]')
    sauvegarde = dl.value.path()
    page.wait_for_selector('.annonce:has-text("Fichier téléchargé")')  # l'écran se redessine après l'export
    page.evaluate(METTRE, {"checkins": [ck("2026-11-01", notes="ajouté après export")], "mesures": [dict(date="2026-11-01", poids=80, taille=None)]})
    avant = len(page.evaluate(LIRE, "checkins"))

    # Fichier invalide
    tmp = tempfile.mkdtemp()
    faux = os.path.join(tmp, "faux.json")
    open(faux, "w").write('{"application":"autre","donnees":{}}')
    page.set_input_files('[data-role="import"]', faux)
    page.wait_for_selector('[data-role="import-zone"] .carte__note')
    verifier("fichier étranger refusé", "pas une sauvegarde Athletics" in page.locator('[data-role="import-zone"]').inner_text())
    abime = os.path.join(tmp, "abime.json")
    open(abime, "w").write('{"application":"athletics","format":1,"donnees":{"checkins":[{"pas_de_date":1}]}}')
    page.set_input_files('[data-role="import"]', abime)
    page.wait_for_function("document.querySelector('[data-role=import-zone]').textContent.includes('abîmée')")
    verifier("fichier abîmé refusé", True)
    verifier("données intactes après refus", len(page.evaluate(LIRE, "checkins")) == avant)

    # Vrai fichier : aperçu puis remplacement
    page.set_input_files('[data-role="import"]', sauvegarde)
    page.wait_for_selector('[data-action="importer"]')
    apercu = page.locator('.apercu').inner_text()
    verifier("aperçu de la sauvegarde", "Check-ins" in apercu and "Séances au programme\n5" in apercu.replace("\t", "\n"), apercu.replace("\n", "|"))
    page.screenshot(path=CAPTURES + "j5-import.png")
    page.click('[data-action="importer"]')
    page.wait_for_selector('.annonce:has-text("Sauvegarde importée")')
    cks = page.evaluate(LIRE, "checkins")
    verifier("import : données restaurées", len(cks) == avant - 1 and not any(c.get("notes") == "ajouté après export" for c in cks)
             and len(page.evaluate(LIRE, "mesures")) == 0 and len(page.evaluate(LIRE, "seances")) == 5)
    reg = {r["cle"]: r["valeur"] for r in page.evaluate(LIRE, "reglages")}
    verifier("import : réglages restaurés", reg["rappels"]["heureSeance"] == "07:15" and reg["repasParJour"] == 4)
    page.click('.onglet[data-route="bilan"]')
    page.wait_for_selector('.regularite')
    verifier("bilan cohérent après import", "7 h 40" in page.locator('#contenu').inner_text())
    page.click('.onglet[data-route="reglages"]')
    page.wait_for_selector('[data-jour="1"]')
    page.screenshot(path=CAPTURES + "j5-reglages.png")

    # Hors ligne
    ctx.set_offline(True)
    page.goto(URL + "#/bilan")
    page.reload()
    page.wait_for_selector('.regularite')
    verifier("bilan disponible hors ligne", True)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
