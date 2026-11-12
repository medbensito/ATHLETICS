"""Lance toutes les suites de tests de l'app.

Usage (depuis la racine du projet) :
    python tests/lancer.py              toutes les suites
    python tests/lancer.py corps bilan  seulement les suites dont le nom contient « corps » ou « bilan »

Le script démarre un petit serveur local sur le dossier du projet, exécute chaque suite
(tests/test_*.py) dans un navigateur mobile simulé, puis affiche un résumé.
Code de sortie : 0 si tout passe, 1 sinon.
"""
import glob
import http.server
import os
import socket
import subprocess
import sys
import threading
import time

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(ICI)
DELAI_MAX = 300  # secondes par suite


def port_libre():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Silencieux(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RACINE, **kwargs)

    def log_message(self, *args):
        pass


def main():
    filtres = sys.argv[1:]
    suites = sorted(glob.glob(os.path.join(ICI, "test_*.py")))
    if filtres:
        suites = [s for s in suites if any(f in os.path.basename(s) for f in filtres)]
    if not suites:
        print("Aucune suite trouvée.")
        return 1

    port = port_libre()
    serveur = http.server.ThreadingHTTPServer(("127.0.0.1", port), Silencieux)
    threading.Thread(target=serveur.serve_forever, daemon=True).start()
    url = f"http://localhost:{port}/"

    resultats = []
    for suite in suites:
        nom = os.path.basename(suite)[5:-3]
        debut = time.time()
        try:
            proc = subprocess.run([sys.executable, suite, url], cwd=ICI, capture_output=True, text=True, timeout=DELAI_MAX)
            reussi = proc.returncode == 0
            sortie = proc.stdout + proc.stderr
        except subprocess.TimeoutExpired:
            reussi, sortie = False, f"Délai dépassé ({DELAI_MAX} s)."
        duree = time.time() - debut
        resultats.append((nom, reussi))
        print(f"{'OK   ' if reussi else 'ECHEC'} {nom} ({duree:.0f} s)")
        if not reussi:
            # Détail de l'échec : contrôles en échec et fin de la sortie.
            lignes = [l for l in sortie.splitlines() if l.startswith("ECHEC") or "Error" in l]
            for l in (lignes or sortie.splitlines())[-15:]:
                print("      " + l)

    serveur.shutdown()
    echecs = [n for n, r in resultats if not r]
    print()
    print(f"{len(resultats) - len(echecs)} suite(s) sur {len(resultats)} réussie(s).")
    return 1 if echecs else 0


if __name__ == "__main__":
    sys.exit(main())
