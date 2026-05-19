import math
import struct
import time
from typing import Optional

from ..core.config import settings


class ModbusClientWrapper:
    """
    Wrapper async sobre pymodbus.
    Con MOCK_MODBUS=true genera datos simulados sin conectar al PLC.

    Convención de registros (dirección 1-based, igual que en la documentación):
      - Float32: FC04 read_input_registers, 2 words, orden Big-Endian (ABCD).
      - Bool:    FC02 read_discrete_inputs.
      - Coil:    FC05 write_coil (reset alarma).
    """

    def __init__(self) -> None:
        self._client = None
        self._connected = False

    async def connect(self) -> None:
        if settings.mock_modbus:
            self._connected = True
            return
        # Import lazy: pymodbus solo es necesario en modo real
        from pymodbus.client import AsyncModbusTcpClient

        self._client = AsyncModbusTcpClient(settings.plc_host, port=settings.plc_port)
        await self._client.connect()
        self._connected = self._client.connected

    async def disconnect(self) -> None:
        if self._client:
            self._client.close()
        self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    # ------------------------------------------------------------------ #
    #  API pública                                                         #
    # ------------------------------------------------------------------ #

    async def read_float32(self, register: int) -> Optional[float]:
        """Lee un Float32 de 2 input registers consecutivos (dirección 1-based)."""
        if settings.mock_modbus:
            return self._mock_float(register)
        try:
            result = await self._client.read_input_registers(register - 1, count=2, slave=1)
            if result.isError():
                return None
            raw = struct.pack(">HH", result.registers[0], result.registers[1])
            return struct.unpack(">f", raw)[0]
        except Exception:
            return None

    async def read_bool(self, register: int) -> Optional[bool]:
        """Lee un discrete input (dirección 1-based)."""
        if settings.mock_modbus:
            return self._mock_bool(register)
        try:
            result = await self._client.read_discrete_inputs(register - 1, count=1, slave=1)
            if result.isError():
                return None
            return bool(result.bits[0])
        except Exception:
            return None

    async def write_coil(self, register: int, value: bool) -> bool:
        """Escribe un coil (dirección 1-based). Retorna True si tuvo éxito."""
        if settings.mock_modbus:
            return True
        try:
            result = await self._client.write_coil(register - 1, value, slave=1)
            return not result.isError()
        except Exception:
            return False

    # ------------------------------------------------------------------ #
    #  Mock                                                                #
    # ------------------------------------------------------------------ #

    def _mock_float(self, register: int) -> float:
        t = time.time()

        # Altura TK1-TK13: registros 10001-10026 (2 por tanque)
        if 10001 <= register <= 10026:
            tank_idx = (register - 10001) // 2
            base = 4.5
            amplitude = 2.0
            period = 90  # segundos por ciclo completo
            phase = tank_idx * (2 * math.pi / 13)
            return max(0.0, base + amplitude * math.sin(2 * math.pi * t / period + phase))

        # Sobrellenado TK1-TK13: registros 10027-10052 (valor fijo de 7.5 m)
        if 10027 <= register <= 10052:
            return 7.5

        return 0.0

    def _mock_bool(self, register: int) -> bool:
        return False


modbus_client = ModbusClientWrapper()
