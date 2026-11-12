"""Test J2 : saisie du check-in, persistance, navigation entre jours, hors ligne, export JSON."""
from commun import LANCEMENT, CAPTURES
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs = []
ok = True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                          has_touch=True, accept_downloads=True, locale="fr-FR")
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.goto(URL)
    page.wait_for_selector('[data-rubrique="seance"]')
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=10000)

    prog = lambda: page.locator('[data-role="progression"]').inner_text()
    verifier("écran vierge", prog() == "0 rubrique sur 4", prog())
    page.screenshot(path=CAPTURES + "j2-vide.png", full_page=True)

    # Séance
    page.click('[data-champ="seance"][data-valeur=\'"faite"\']')
    verifier("séance faite", prog() == "1 rubrique sur 4", prog())
    # Sommeil
    page.fill('[data-heure="coucher"]', "23:30")
    page.fill('[data-heure="lever"]', "07:15")
    duree = page.locator('[data-role="duree"]').inner_text()
    verifier("durée de sommeil", duree == "7 h 45 de sommeil", duree)
    page.click('[data-champ="qualite"][data-valeur="4"]')
    # Alimentation
    for _ in range(3):
        page.click('[data-champ="repas"][data-pas="1"]')
    page.click('[data-champ="repas"][data-pas="-1"]')
    page.click('[data-champ="grignotage"][data-valeur="false"]')
    page.click('[data-champ="boissons"][data-valeur="true"]')
    page.fill('[data-role="notes"]', "Test <b>notes</b> & accents éà")
    page.locator('[data-role="notes"]').blur()
    # Cigarettes : − depuis vide = 0, puis +1 ×3, −1
    page.click('[data-champ="cigarettes"][data-pas="-1"]')
    verifier("cigarettes à zéro", page.locator('[data-affiche="cigarettes"]').inner_text() == "0")
    for _ in range(3):
        page.click('[data-champ="cigarettes"][data-pas="1"]')
    page.click('[data-champ="cigarettes"][data-pas="-1"]')
    verifier("check-in complet", prog() == "Check-in complet", prog())
    page.wait_for_timeout(300)
    page.screenshot(path=CAPTURES + "j2-rempli.png", full_page=True)

    # Persistance après rechargement
    page.reload()
    page.wait_for_selector('[data-rubrique="seance"]')
    etat = page.evaluate("""() => ({
        seance: document.querySelector('[data-champ="seance"][aria-pressed="true"]')?.textContent,
        coucher: document.querySelector('[data-heure="coucher"]').value,
        lever: document.querySelector('[data-heure="lever"]').value,
        qualite: document.querySelector('[data-champ="qualite"][aria-pressed="true"]')?.textContent,
        repas: document.querySelector('[data-affiche="repas"]').textContent,
        cig: document.querySelector('[data-affiche="cigarettes"]').textContent,
        notes: document.querySelector('[data-role="notes"]').value,
        prog: document.querySelector('[data-role="progression"]').textContent,
    })""")
    attendu = {"seance": "Faite", "coucher": "23:30", "lever": "07:15", "qualite": "4", "repas": "2", "cig": "2",
               "notes": "Test <b>notes</b> & accents éà", "prog": "Check-in complet"}
    verifier("persistance après rechargement", etat == attendu, json.dumps(etat, ensure_ascii=False))

    # Désélection d'un choix
    page.click('[data-champ="seance"][data-valeur=\'"faite"\']')
    verifier("désélection", prog() == "3 rubriques sur 4", prog())
    page.click('[data-champ="seance"][data-valeur=\'"faite"\']')

    # Jour précédent : vierge, avec proposition des heures d'hier… non (pas de jour antérieur)
    page.click('a[aria-label="Jour précédent"]')
    page.wait_for_function("document.querySelector('#titre-ecran').textContent === 'Hier'")
    verifier("hier est vierge", prog() == "0 rubrique sur 4", prog())
    verifier("pas de jour suivant au-delà d'aujourd'hui (flèche active hier)", page.locator('a[aria-label="Jour suivant"]').count() == 1)
    page.click('[data-champ="seance"][data-valeur=\'"repos"\']')
    page.click('a[aria-label="Jour suivant"]')
    page.wait_for_function("document.querySelector('#titre-ecran').textContent === \"Aujourd'hui\"")
    verifier("retour à aujourd'hui intact", prog() == "Check-in complet", prog())
    verifier("pas de flèche vers demain", page.locator('a[aria-label="Jour suivant"]').count() == 0)

    # Futur refusé
    page.goto(URL + "#/aujourdhui/2099-01-01")
    page.wait_for_timeout(300)
    verifier("date future ramenée à aujourd'hui", page.locator("#titre-ecran").text_content() == "Aujourd'hui")

    # Proposition « comme la dernière fois » : visible sur un jour sans heures quand un jour antérieur en a
    page.evaluate("""async () => {
        const db = await new Promise(r => { const q = indexedDB.open('athletics'); q.onsuccess = () => r(q.result); });
        const tx = db.transaction('checkins', 'readwrite');
        tx.objectStore('checkins').put({ date: '2020-01-01', coucher: '22:45', lever: '06:30', seance: null, qualite: null,
            repas: null, grignotage: null, boissons: null, notes: '', cigarettes: null, sommeilMin: 465, majLe: null });
        await new Promise(r => tx.oncomplete = r); db.close();
    }""")
    page.goto(URL + "#/aujourdhui")
    page.click('a[aria-label="Jour précédent"]')
    page.wait_for_selector('[data-role="habitude"]')
    page.click('[data-role="habitude"]')
    d = page.locator('[data-role="duree"]').inner_text()
    verifier("heures reprises en un geste", d == "7 h 45 de sommeil" and page.locator('[data-role="habitude"]').is_hidden(), d)

    # Export
    page.click('.onglet[data-route="reglages"]')
    page.wait_for_selector('[data-action="exporter"]')
    page.screenshot(path=CAPTURES + "j2-reglages.png", full_page=True)
    with page.expect_download() as dl:
        page.click('[data-action="exporter"]')
    chemin = dl.value.path()
    donnees = json.load(open(chemin, encoding="utf-8"))
    verifier("nom du fichier", dl.value.suggested_filename.startswith("athletics-sauvegarde-") and dl.value.suggested_filename.endswith(".json"), dl.value.suggested_filename)
    verifier("structure de l'export", donnees["application"] == "athletics" and donnees["format"] == 1 and {"checkins", "reglages"} <= set(donnees["donnees"]))
    verifier("3 check-ins exportés", len(donnees["donnees"]["checkins"]) == 3, str(len(donnees["donnees"]["checkins"])))
    auj = donnees["donnees"]["checkins"][-1]
    verifier("contenu exporté", auj["seance"] == "faite" and auj["sommeilMin"] == 465 and auj["cigarettes"] == 2 and auj["grignotage"] is False and auj["boissons"] is True, json.dumps(auj, ensure_ascii=False))
    page.wait_for_function("document.querySelector('.etat').textContent.includes(\"aujourd'hui\")")
    verifier("date du dernier export affichée", True)

    # Hors ligne : rechargement + saisie
    ctx.set_offline(True)
    page.goto(URL + "#/aujourdhui")
    page.reload()
    page.wait_for_selector('[data-rubrique="seance"]')
    page.click('[data-champ="cigarettes"][data-pas="1"]')
    page.wait_for_timeout(200)  # laisse l'écriture se terminer avant de recharger
    page.reload()
    page.wait_for_selector('[data-rubrique="seance"]')
    v = page.locator("[data-affiche=cigarettes]").inner_text(); verifier("saisie hors ligne conservée", v == "3", v)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
