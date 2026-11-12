"""Configuration commune des tests.

Variables d'environnement facultatives :
  CHROME_PATH : chemin d'un Chrome / Chromium à utiliser (sinon, celui installé par Playwright)
  CAPTURES    : dossier où enregistrer les captures d'écran (par défaut : tests/captures/)
"""
import os

_ici = os.path.dirname(os.path.abspath(__file__))

CAPTURES = os.environ.get("CAPTURES") or os.path.join(_ici, "captures") + os.sep
if not CAPTURES.endswith(os.sep):
    CAPTURES += os.sep
os.makedirs(CAPTURES, exist_ok=True)

LANCEMENT = {"args": ["--no-sandbox"]}
if os.environ.get("CHROME_PATH"):
    LANCEMENT["executable_path"] = os.environ["CHROME_PATH"]
