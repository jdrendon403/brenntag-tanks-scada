"""
Script de extracción de tablas de aforo desde PDFs de calibración SGS.

Uso:
    pip install pdfplumber  # o: pip install pdf2image pytesseract
    python extract_aforo.py

Los PDFs deben estar en:
    TABLA DE AFORO TANQUES/TABLA DE AFORO TANQUES/

Los archivos de salida (CSV y JSON) se generan en:
    ../app/data/calibration/

Nota sobre el mapeo de tanques:
    Tanque 14 PDF → tank_13.json  (no existe tanque físico 13)

Formato del CSV de salida (también sirve para cargar desde la UI):
    height_mm,volume_l
    0,0.0
    10,18.5
    ...

Las alturas de los PDFs se unifican a mm. Los volúmenes se convierten de
galones US a litros (1 gal US = 3.78541 L).
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

GALLON_TO_LITER = 3.78541

# Mapeo nombre de PDF → tank_id del SCADA
PDF_TO_TANK_ID: dict[str, int] = {
    "Tanque 1 Delante": 1,
    "Tanque 1 Respaldo": 1,   # continuación del mismo tanque
    "Tanque 2": 2,
    "Tanque 3": 3,
    "Tanque 4": 4,
    "Tanque 5": 5,
    "Tanque 6": 6,
    "Tanque 7": 7,
    "Tanque 8": 8,
    "Tanque 9": 9,
    "Tanque 10": 10,
    "Tanque 11": 11,
    "Tanque 12": 12,
    "Tanque 14": 13,  # Tanque 14 físico = TK13 en el SCADA
}

PDF_DIR = Path(__file__).parent.parent.parent.parent.parent / \
    "TABLA DE AFORO TANQUES" / "TABLA DE AFORO TANQUES"
OUT_DIR = Path(__file__).parent.parent / "app" / "data" / "calibration"


# ---------------------------------------------------------------------------
# Extracción con pdfplumber (PDFs con texto seleccionable)
# ---------------------------------------------------------------------------

def extract_with_pdfplumber(pdf_path: Path) -> list[tuple[float, float]] | None:
    try:
        import pdfplumber
    except ImportError:
        return None

    rows: list[tuple[float, float]] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    try:
                        h, v = _parse_row(row)
                        rows.append((h, v))
                    except (TypeError, ValueError):
                        continue
    return rows or None


def _parse_row(row: list) -> tuple[float, float]:
    """Extrae (height_mm, volume_l) de una fila de tabla."""
    nums = [_to_float(c) for c in row if c and _to_float(c) is not None]
    if len(nums) < 2:
        raise ValueError("fila sin suficientes números")
    # Asume que el primer número es altura y el segundo volumen en galones
    h_raw, vol_gal = nums[0], nums[1]
    # Detectar unidad de altura: si < 1000 probablemente está en cm
    h_mm = h_raw * 10 if h_raw < 1000 else h_raw
    return h_mm, vol_gal * GALLON_TO_LITER


def _to_float(val: object) -> float | None:
    if val is None:
        return None
    s = str(val).strip().replace(",", ".").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Extracción con OCR (pdfimages escaneadas)
# ---------------------------------------------------------------------------

def extract_with_ocr(pdf_path: Path) -> list[tuple[float, float]] | None:
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError:
        return None

    rows: list[tuple[float, float]] = []
    images = convert_from_path(str(pdf_path), dpi=300)
    for img in images:
        text = pytesseract.image_to_string(img, lang="spa+eng")
        for line in text.splitlines():
            nums = re.findall(r"\d+[.,]?\d*", line)
            if len(nums) >= 2:
                try:
                    h, v = _parse_row(nums[:2])
                    rows.append((h, v))
                except ValueError:
                    continue
    return rows or None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def process_tank(tank_id: int, pdf_paths: list[Path]) -> None:
    combined: list[tuple[float, float]] = []

    for pdf_path in pdf_paths:
        print(f"  Procesando: {pdf_path.name}")
        rows = extract_with_pdfplumber(pdf_path) or extract_with_ocr(pdf_path)
        if rows:
            combined.extend(rows)
        else:
            print(f"  [AVISO] No se pudo extraer texto de {pdf_path.name}. "
                  "Genera plantilla CSV vacía para relleno manual.")

    if not combined:
        _write_template(tank_id)
        return

    # Deduplicar y ordenar por altura
    seen: set[float] = set()
    unique: list[tuple[float, float]] = []
    for h, v in sorted(combined):
        if h not in seen:
            seen.add(h)
            unique.append((h, v))

    _write_csv(tank_id, unique)
    _write_json(tank_id, unique)
    print(f"  → tank_{tank_id}: {len(unique)} puntos escritos")


def _write_csv(tank_id: int, rows: list[tuple[float, float]]) -> None:
    path = OUT_DIR / f"tank_{tank_id}.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["height_mm", "volume_l"])
        for h, v in rows:
            w.writerow([round(h, 1), round(v, 3)])
    print(f"  CSV: {path}")


def _write_json(tank_id: int, rows: list[tuple[float, float]]) -> None:
    data = {
        "tank_id": tank_id,
        "source": "SGS Calibration Certificate — Planta Barranquilla",
        "table": [{"height_mm": round(h, 1), "volume_l": round(v, 3)} for h, v in rows],
    }
    path = OUT_DIR / f"tank_{tank_id}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  JSON: {path}")


def _write_template(tank_id: int) -> None:
    path = OUT_DIR / f"tank_{tank_id}.csv"
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["height_mm", "volume_l"])
        w.writerow(["# RELLENAR MANUALMENTE", ""])
        w.writerow([0, 0.0])
    print(f"  Plantilla vacía: {path}")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if not PDF_DIR.exists():
        print(f"ERROR: No se encontró el directorio de PDFs:\n  {PDF_DIR}")
        sys.exit(1)

    # Agrupar PDFs por tank_id
    by_tank: dict[int, list[Path]] = {}
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        stem = pdf.stem
        tid = PDF_TO_TANK_ID.get(stem)
        if tid is None:
            print(f"[IGNORADO] Sin mapeo para: {pdf.name}")
            continue
        by_tank.setdefault(tid, []).append(pdf)

    print(f"Tanques a procesar: {sorted(by_tank)}\n")
    for tank_id in sorted(by_tank):
        print(f"--- TK{tank_id} ---")
        process_tank(tank_id, by_tank[tank_id])

    print("\nListo. Revise los CSV en:", OUT_DIR)
    print("Para cargar en el sistema:")
    print("  1. Reinicie el backend (lee los JSON automáticamente al arrancar)")
    print("  2. O suba cada CSV desde Configuración → Tabla de Aforo en la UI")


if __name__ == "__main__":
    main()
