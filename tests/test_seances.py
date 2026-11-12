"""Test J3 : migration v1→v2, programme, éditeur, mode séance, chrono, reprise, historique, export."""
from commun import LANCEMENT, CAPTURES
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs, ok = [], True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                          has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())
    page.on("response", lambda r: print("   404:", r.url) if r.status == 404 else None)

    # --- Migration : une base J2 (version 1) avec un check-in doit survivre au passage en version 2
    page.goto(URL + "manifest.json")
    page.evaluate("""() => new Promise((res, rej) => {
        const q = indexedDB.open('athletics', 1);
        q.onupgradeneeded = () => { q.result.createObjectStore('checkins', {keyPath:'date'}); q.result.createObjectStore('reglages', {keyPath:'cle'}); };
        q.onsuccess = () => { const tx = q.result.transaction('checkins','readwrite');
            tx.objectStore('checkins').put({date:'2026-11-01', seance:'repos', cigarettes: 7, notes:'avant migration'});
            tx.oncomplete = () => { q.result.close(); res(); }; };
        q.onerror = () => rej(q.error);
    })""")
    page.goto(URL + "#/aujourdhui/2026-11-01")
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("migration : check-in J2 conservé", page.locator('[data-affiche="cigarettes"]').inner_text() == "7"
             and page.locator('[data-role="notes"]').input_value() == "avant migration")

    # --- Programme : état vide puis exemple
    page.click('.onglet[data-route="seances"]')
    page.wait_for_selector('[data-action="exemple"]')
    page.screenshot(path=CAPTURES + "j3-vide.png")
    page.click('[data-action="exemple"]')
    page.wait_for_selector('[data-action="demarrer"]')
    verifier("5 séances créées", page.locator('[data-action="demarrer"]').count() == 5)
    verifier("aucune charge imposée", page.evaluate("""async () => { const db = await new Promise(r => { const q = indexedDB.open('athletics'); q.onsuccess = () => r(q.result); });
        const s = await new Promise(r => { const q = db.transaction('seances').objectStore('seances').getAll(); q.onsuccess = () => r(q.result); }); db.close();
        return s.every(x => x.exercices.every(e => e.charge === null)); }"""))
    page.screenshot(path=CAPTURES + "j3-programme.png")

    # --- Éditeur : renommer, régler charge/repos, ajouter, déplacer, retirer
    page.click('text=Modifier >> nth=2')  # Jambes
    page.wait_for_selector('[data-role="nom-seance"]')
    verifier("éditeur ouvert sur Jambes", page.locator('[data-role="nom-seance"]').input_value() == "Jambes")
    page.fill('[data-role="nom-seance"]', "Jambes lourdes")
    page.fill('[data-ex="0"][data-champ="charge"]', "62,5")
    page.fill('[data-ex="0"][data-champ="series"]', "2")
    page.fill('[data-ex="0"][data-champ="repos"]', "2")
    page.fill('[data-ex="1"][data-champ="series"]', "1")
    page.fill('[data-ex="1"][data-champ="repos"]', "1")
    page.click('[data-action="ajouter"]')
    page.fill('[data-ex="5"][data-champ="nom"]', "Gainage")
    page.click('[data-action="monter"][data-ex="5"]')
    verifier("exercice déplacé", page.locator('[data-ex="4"][data-champ="nom"]').input_value() == "Gainage")
    for _ in range(4):  # ne garder que Squat et Presse
        page.click('[data-action="retirer"][data-ex="2"]')
    verifier("exercices retirés", page.locator('.exo-edit').count() == 2)
    page.screenshot(path=CAPTURES + "j3-editeur.png")
    page.click('.retour')
    page.wait_for_selector('text=Jambes lourdes')
    verifier("nom enregistré", True)

    # --- Mode séance
    page.click('[data-action="demarrer"] >> nth=2')
    page.wait_for_selector('[data-action="valider"]')
    verifier("pré-remplissage depuis le programme", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "62,5"
             and page.locator('.nombre__champ[data-champ="reps"]').input_value() == "8")
    verifier("pas de chrono au départ", page.locator('[data-role="repos"]').is_hidden())
    page.click('[data-action="pas"][data-champ="charge"][data-pas="1"]')
    page.click('[data-action="pas"][data-champ="reps"][data-pas="-1"]')
    verifier("ajustement en un appui", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "65"
             and page.locator('.nombre__champ[data-champ="reps"]').input_value() == "7")
    page.screenshot(path=CAPTURES + "j3-seance.png")
    page.click('[data-action="valider"]')
    verifier("chrono lancé", page.locator('[data-role="repos"]').is_visible() and page.locator('[data-role="repos-temps"]').inner_text() in ("0:02", "0:01"),
             page.locator('[data-role="repos-temps"]').inner_text())
    verifier("série 2 affichée, charge reportée", "Série 2 sur 2" in page.locator('.exo__serie').inner_text()
             and page.locator('.nombre__champ[data-champ="charge"]').input_value() == "65")
    page.click('[data-action="repos"][data-delta="15"]')
    t = page.locator('[data-role="repos-temps"]').inner_text()
    verifier("+15 s", t in ("0:17", "0:16"), t)
    page.screenshot(path=CAPTURES + "j3-chrono.png")

    # Reprise après fermeture : rechargement complet en pleine séance
    page.reload()
    page.wait_for_selector('[data-action="valider"]')
    verifier("séance reprise après rechargement", "Série 2 sur 2" in page.locator('.exo__serie').inner_text()
             and page.locator('[data-role="repos"]').is_visible())
    page.click('[data-action="repos-fin"]')
    verifier("passer le repos", page.locator('[data-role="repos"]').is_hidden())

    # Corriger une série validée
    page.click('[data-action="rouvrir"]')
    verifier("série rouverte", "Série 1 sur 2" in page.locator('.exo__serie').inner_text())
    page.click('[data-action="valider"]')
    page.click('[data-action="repos-fin"]')
    page.fill('.nombre__champ[data-champ="reps"]', "6")
    page.click('[data-action="valider"]')  # fin du squat → passe à la presse, repos 2 s
    verifier("passage à l'exercice suivant", page.locator('.exo__nom').inner_text() == "Presse à cuisses")
    page.wait_for_function("document.querySelector('[data-role=\"repos-temps\"]').textContent.includes('reparti')", timeout=5000)
    verifier("fin de repos signalée", page.locator('.chrono--fini').count() == 1)
    page.screenshot(path=CAPTURES + "j3-repos-fini.png")
    page.fill('.nombre__champ[data-champ="charge"]', "100")
    page.click('[data-action="valider"]')  # toute dernière série
    verifier("tout est fait : pas de repos, bouton principal", page.locator('[data-role="repos"]').is_hidden()
             and "bouton--secondaire" not in page.locator('[data-action="terminer"]').get_attribute("class"))
    page.click('[data-action="terminer"]')
    page.wait_for_selector('.annonce')
    verifier("message de fin", "3 séries" in page.locator('.annonce').inner_text(), page.locator('.annonce').inner_text())
    verifier("séance dans les dernières séances", page.locator('text=Dernières séances').count() == 1)
    page.screenshot(path=CAPTURES + "j3-fin.png", full_page=True)

    # Check-in du jour coché automatiquement
    page.click('.onglet[data-route="aujourdhui"]')
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("check-in : séance faite", page.locator('[data-champ="seance"][aria-pressed="true"]').inner_text() == "Faite")

    # Deuxième séance : pré-remplie avec la dernière fois ; puis historique
    page.click('.onglet[data-route="seances"]')
    page.click('[data-action="demarrer"] >> nth=2')
    page.wait_for_selector('[data-action="valider"]')
    verifier("pré-remplissage depuis la dernière fois", page.locator('.nombre__champ[data-champ="charge"]').input_value() == "65"
             and "La dernière fois : 65 kg × 7" in page.locator('.exo .carte__note').first.inner_text(),
             page.locator('.exo .carte__note').first.inner_text())
    page.click('[data-action="pas"][data-champ="charge"][data-pas="1"]')
    page.click('[data-action="valider"]')
    page.click('[data-action="terminer"]')  # séries restantes → confirmation acceptée
    page.wait_for_selector('.annonce')
    page.click('text=Modifier >> nth=2')
    page.click('text=Historique >> nth=0')
    page.wait_for_selector('.chiffres')
    texte = page.locator('#contenu').inner_text()
    verifier("historique : dernière charge et progression", "67,5 kg" in texte and "+ 2,5 kg" in texte and page.locator('#titre-ecran').inner_text() == "Squat", texte.replace("\n", " | ")[:200])
    page.screenshot(path=CAPTURES + "j3-historique.png")

    # Abandon : rien n'est enregistré
    page.goto(URL + "#/seances")
    page.wait_for_selector('[data-action="demarrer"]')
    page.click('[data-action="demarrer"] >> nth=0')
    page.wait_for_selector('[data-action="abandonner"]')
    page.click('[data-action="abandonner"]')
    page.wait_for_selector('[data-action="demarrer"]')
    nb = page.evaluate("""async () => { const db = await new Promise(r => { const q = indexedDB.open('athletics'); q.onsuccess = () => r(q.result); });
        const n = await new Promise(r => { const q = db.transaction('journal').objectStore('journal').count(); q.onsuccess = () => r(q.result); }); db.close(); return n; }""")
    verifier("abandon : journal inchangé", nb == 2, str(nb))

    # Export : contient programme et journal
    page.click('.onglet[data-route="reglages"]')
    page.wait_for_selector('[data-action="exporter"]')
    with page.expect_download() as dl:
        page.click('[data-action="exporter"]')
    d = json.load(open(dl.value.path(), encoding="utf-8"))["donnees"]
    verifier("export : 4 magasins", {"checkins", "reglages", "seances", "journal"} <= set(d) and len(d["seances"]) == 5 and len(d["journal"]) == 2)

    # Hors ligne
    ctx.set_offline(True)
    page.goto(URL + "#/seances")
    page.reload()
    page.wait_for_selector('[data-action="demarrer"]')
    verifier("programme disponible hors ligne", True)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
