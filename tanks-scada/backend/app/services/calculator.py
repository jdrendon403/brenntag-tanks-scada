import math


def calculate_volume(diameter: float, height: float) -> float:
    """Volumen en litros. Diámetro y altura en metros."""
    volume_m3 = math.pi * (diameter / 2) ** 2 * height
    return volume_m3 * 1000


def calculate_weight(volume_liters: float, density: float) -> float:
    """Peso en kg. Densidad en kg/L."""
    return volume_liters * density


def calculate_percentage(current_height: float, max_height: float) -> float:
    """Porcentaje 0–100."""
    if max_height <= 0:
        return 0.0
    return min(100.0, max(0.0, (current_height / max_height) * 100))
