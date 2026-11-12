"""Test J4 : migration v2→v3, saisie des mesures, période, graphique, bulle, rappel, export."""
from commun import LANCEMENT, CAPTURES
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1]
erreurs, ok = [], True


def verifier(nom, condition, detail=""):
    global ok
    ok = ok and bool(condition)
    print(("OK   " if condition else "ECHEC"), nom, detail)


JS_DB = """(args) => new Promise((res) => { const q = indexedDB.open('athletics'); q.onsuccess = () => {
    const db = q.result; const tx = db.transaction(args.magasin, args.mode || 'readonly'); const s = tx.objectStore(args.magasin);
    let r; if (args.mettre) args.mettre.forEach(v => s.put(v)); else r = s.getAll();
    tx.oncomplete = () => { db.close(); res(r ? r.result : null); }; }; })"""

with sync_playwright() as p:
    nav = p.chromium.launch(**LANCEMENT)
    ctx = nav.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True,
                          has_touch=True, accept_downloads=True)
    page = ctx.new_page()
    page.on("console", lambda m: erreurs.append(m.text) if m.type in ("error", "warning") and "404" not in m.text else None)
    page.on("response", lambda r: erreurs.append("404 " + r.url) if r.status == 404 and "favicon" not in r.url else None)
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("dialog", lambda d: d.accept())

    # --- Migration : base version 2 (J3) avec un check-in et une séance
    page.goto(URL + "manifest.json")
    page.evaluate("""() => new Promise((res) => {
        const q = indexedDB.open('athletics', 2);
        q.onupgradeneeded = () => { for (const [n,k] of [['checkins','date'],['reglages','cle'],['seances','id'],['journal','id']]) q.result.createObjectStore(n,{keyPath:k}); };
        q.onsuccess = () => { const tx = q.result.transaction(['checkins','seances'],'readwrite');
            tx.objectStore('checkins').put({date:'2026-11-01', seance:'repos', cigarettes: 4, notes:''});
            tx.objectStore('seances').put({id:'s1', ordre:1, nom:'Ma séance', exercices:[]});
            tx.oncomplete = () => { q.result.close(); res(); }; };
    })""")
    page.goto(URL + "#/aujourdhui")
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("rappel de première mesure à l'accueil", "Mesure de la semaine" in page.locator('#contenu').inner_text())
    page.goto(URL + "#/seances")
    page.wait_for_selector('text=Ma séance')
    verifier("migration : séance J3 conservée", True)

    # --- Écran vide
    page.click('.onglet[data-route="corps"]')
    page.wait_for_selector('[data-action="enregistrer"]')
    verifier("état vide", page.locator('text=La courbe apparaîtra dès la première mesure.').count() == 2)

    # --- Validation de saisie
    page.click('[data-action="enregistrer"]')
    verifier("rien saisi → message", "au moins" in page.locator('[data-role="message"]').inner_text())
    page.fill('[data-mesure="poids"]', "700")
    page.click('[data-action="enregistrer"]')
    verifier("valeur hors bornes → message", "entre 30 et 300" in page.locator('[data-role="message"]').inner_text())

    # --- Première mesure (aujourd'hui) : fige la période
    page.fill('[data-mesure="poids"]', "70,4")
    page.fill('[data-mesure="taille"]', "94")
    page.click('[data-action="enregistrer"]')
    page.wait_for_function("document.querySelector('[data-role=\"message\"]')?.textContent === 'Mesure enregistrée.'")
    reg = page.evaluate(JS_DB, {"magasin": "reglages"})
    periode = next(r["valeur"] for r in reg if r["cle"] == "periode")
    verifier("période figée sur 6 mois", periode["cible"][5:7] != periode["debut"][5:7] and "provisoire" not in periode, json.dumps(periode))
    verifier("un point par graphique", page.locator('.graph__point:not([data-role])').count() == 2)

    # --- Historique : 10 mesures hebdomadaires antérieures (baisse régulière) + un trou de taille
    debut = page.evaluate("() => { const d = new Date(); d.setDate(d.getDate() - 70); return d.toISOString().slice(0,10); }")
    mesures = page.evaluate("""() => { const r = []; for (let i = 10; i >= 1; i--) { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - 7*i);
        const c = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
        r.push({date: c, poids: Math.round((73 - (10-i)*0.25)*10)/10, taille: i === 5 ? null : Math.round((98 - (10-i)*0.4)*10)/10, majLe: null}); } return r; }""")
    page.evaluate(JS_DB, {"magasin": "mesures", "mode": "readwrite", "mettre": mesures})
    # Début de période ramené à la première mesure
    page.goto(URL + "#/corps")
    page.wait_for_selector('.graph')
    page.click('.depliable__titre')
    page.fill('[data-periode="debut"]', mesures[0]["date"])
    page.locator('[data-periode="debut"]').dispatch_event("change")
    page.wait_for_function("document.querySelector('[data-role=\"message-periode\"]')?.textContent === 'Enregistré.'")
    cible = page.locator('[data-periode="cible"]').input_value()
    verifier("date cible suit le début (+6 mois)", cible > mesures[0]["date"], f"{mesures[0]['date']} → {cible}")
    page.fill('[data-periode="poidsObjectif"]', "66")
    page.locator('[data-periode="poidsObjectif"]').dispatch_event("change")
    page.wait_for_function("document.querySelector('[data-graph=poids]')?.textContent.includes('Objectif 66')", timeout=5000)
    verifier("objectif tracé", "Objectif 66" in page.locator('[data-graph="poids"]').inner_text())
    verifier("pas d'objectif sur la taille", "Objectif" not in page.locator('[data-graph="taille"]').inner_text())

    verifier("11 points de poids, 10 de taille", page.locator('[data-graph="poids"] .graph__point:not([data-role])').count() == 11
             and page.locator('[data-graph="taille"] .graph__point:not([data-role])').count() == 10)
    verifier("tendance affichée", page.locator('.graph__tendance').count() == 2)
    txt = page.locator('section:has([data-graph="poids"]) .chiffres').inner_text().replace("\n", " ")
    verifier("résumé : dernière, écart, tendance/semaine", "70,4" in txt and "− 2,6" in txt and "− 0,3" in txt and "Par semaine" in txt, txt)

    # Bulle au toucher
    page.locator('[data-graph="poids"] svg').scroll_into_view_if_needed()
    box = page.locator('[data-graph="poids"] svg').bounding_box()
    page.mouse.click(box["x"] + box["width"] * 0.12, box["y"] + box["height"] * 0.5)
    bulle = page.locator('[data-graph="poids"] [data-role="bulle"]')
    verifier("bulle au toucher", bulle.is_visible() and "kg" in bulle.inner_text(), bulle.inner_text().replace("\n", " "))
    page.screenshot(path=CAPTURES + "j4-corps.png", full_page=True)
    page.mouse.click(5, 300)
    verifier("bulle refermée en touchant ailleurs", bulle.is_hidden())

    # Modifier une mesure existante via la liste
    page.click('.etat__ligne--3 >> nth=1 >> text=Modifier')
    page.wait_for_function("document.querySelector('[data-role=date]')?.value === '%s'" % mesures[-1]["date"])
    page.fill('[data-mesure="taille"]', "92,5")
    page.click('[data-action="enregistrer"]')
    page.wait_for_function("document.querySelector('[data-role=\"message\"]')?.textContent === 'Mesure enregistrée.'")
    toutes = page.evaluate(JS_DB, {"magasin": "mesures"})
    verifier("mise à jour de la taille sur une date passée", any(m["taille"] == 92.5 and m["poids"] == mesures[-1]["poids"] for m in toutes))

    # Suppression
    page.click('[data-action="supprimer"] >> nth=0')
    page.wait_for_function("document.querySelector('[data-role=\"message\"]')?.textContent === 'Mesure supprimée.'")
    verifier("suppression", len(page.evaluate(JS_DB, {"magasin": "mesures"})) == 10)

    # Rappel à l'accueil : dernière mesure il y a 7 jours → rappel affiché
    page.click('.onglet[data-route="aujourdhui"]')
    page.wait_for_selector('[data-rubrique="seance"]')
    verifier("rappel hebdomadaire à l'accueil", "Dernière mesure il y a 7 jours" in page.locator('#contenu').inner_text())

    # Export
    page.click('.onglet[data-route="reglages"]')
    page.wait_for_selector('[data-action="exporter"]')
    with page.expect_download() as dl:
        page.click('[data-action="exporter"]')
    d = json.load(open(dl.value.path(), encoding="utf-8"))["donnees"]
    verifier("export : mesures incluses", len(d["mesures"]) == 10 and any(r["cle"] == "periode" for r in d["reglages"]))

    # Hors ligne
    ctx.set_offline(True)
    page.goto(URL + "#/corps")
    page.reload()
    page.wait_for_selector('.graph')
    verifier("graphique disponible hors ligne", True)
    nav.close()

print("erreurs console:", erreurs)
print("RESULTAT:", "tout est bon" if ok and not erreurs else "à corriger")
sys.exit(0 if ok and not erreurs else 1)
