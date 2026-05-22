import math


def calculate_volume_from_table(height_m: float, table: list[dict]) -> float:
    """Interpolación lineal en tabla de aforo. height_m en metros."""
    height_mm = height_m * 1000
    if not table or height_mm <= 0:
        return 0.0
    if height_mm >= table[-1]["height_mm"]:
        return float(table[-1]["volume_l"])
    for i in range(len(table) - 1):
        lo, hi = table[i], table[i + 1]
        if lo["height_mm"] <= height_mm <= hi["height_mm"]:
            t = (height_mm - lo["height_mm"]) / (hi["height_mm"] - lo["height_mm"])
            return lo["volume_l"] + t * (hi["volume_l"] - lo["volume_l"])
    return 0.0


def get_max_volume(table: list[dict]) -> float:
    return float(table[-1]["volume_l"]) if table else 0.0


def calculate_volume(diameter: float, height: float, table: list | None = None) -> float:
    """Volumen en litros. Con tabla usa interpolación; sin tabla usa fórmula cilíndrica."""
    if table:
        return calculate_volume_from_table(height, table)
    volume_m3 = math.pi * (diameter / 2) ** 2 * height
    return volume_m3 * 1000


def calculate_weight(volume_liters: float, density: float) -> float:
    """Peso en kg. Densidad en kg/L."""
    return volume_liters * density


def calculate_percentage(current_height: float, max_height: float) -> float:
    """Porcentaje 0–100 basado en altura (fallback sin tabla)."""
    if max_height <= 0:
        return 0.0
    return min(100.0, max(0.0, (current_height / max_height) * 100))


def calculate_percentage_volume(volume: float, max_volume: float) -> float:
    """Porcentaje 0–100 basado en volumen real (más preciso con fondo cónico)."""
    if max_volume <= 0:
        return 0.0
    return min(100.0, max(0.0, (volume / max_volume) * 100))
