import logging
import math
import struct
import time
from typing import Optional

from ..core.config import settings

logger = logging.getLogger(__name__)


class ModbusClientWrapper:
    """
    Wrapper async sobre pymodbus con reconexión automática.
    Con MOCK_MODBUS=true genera datos simulados sin conectar al PLC.

    Convención de registros (dirección 1-based):
      - Float32: FC03 read_holding_registers, 2 words, Big-Endian ABCD.
      - Bool:    FC01 read_coils, dirección = register - 1.
      - Coil:    FC05 write_coil.
      - Float32 write: FC16 write_registers.
    """

    def __init__(self) -> None:
        self._client = None
        self._connected = False

    async def connect(self) -> None:
        if settings.mock_modbus:
            self._connected = True
            return
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
        if settings.mock_modbus:
            return self._connected
        return bool(self._client and self._client.connected)

    async def _ensure_connected(self) -> bool:
        """Verifica la conexión real y reconecta si es necesario."""
        if self._client and self._client.connected:
            return True
        logger.warning("Modbus desconectado — reconectando a %s:%s…", settings.plc_host, settings.plc_port)
        try:
            from pymodbus.client import AsyncModbusTcpClient
            if self._client:
                self._client.close()
            self._client = AsyncModbusTcpClient(settings.plc_host, port=settings.plc_port)
            await self._client.connect()
            if self._client.connected:
                logger.info("Reconexión Modbus exitosa")
                return True
            logger.error("Reconexión Modbus fallida — PLC no responde")
            return False
        except Exception as exc:
            logger.error("Error en reconexión Modbus: %s", exc)
            return False

    # ------------------------------------------------------------------ #
    #  API pública                                                         #
    # ------------------------------------------------------------------ #

    async def read_float32(self, register: int) -> Optional[float]:
        """Lee un Float32 de 2 holding registers FC03 (dirección 1-based)."""
        if settings.mock_modbus:
            return self._mock_float(register)
        if not await self._ensure_connected():
            return None
        try:
            result = await self._client.read_holding_registers(register - 1, count=2, device_id=1)
            if result.isError():
                return None
            raw = struct.pack(">HH", result.registers[0], result.registers[1])
            return struct.unpack(">f", raw)[0]
        except Exception:
            return None

    async def read_bool(self, register: int) -> Optional[bool]:
        """Lee un coil FC01 (dirección 1-based → 0-based = register - 1)."""
        if settings.mock_modbus:
            return self._mock_bool(register)
        if not await self._ensure_connected():
            return None
        try:
            result = await self._client.read_coils(register - 1, count=1, device_id=1)
            if result.isError():
                return None
            return bool(result.bits[0])
        except Exception:
            return None

    async def write_coil(self, register: int, value: bool) -> bool:
        """Escribe un coil FC05 (dirección 1-based)."""
        if settings.mock_modbus:
            return True
        if not await self._ensure_connected():
            return False
        try:
            result = await self._client.write_coil(register - 1, value, device_id=1)
            return not result.isError()
        except Exception:
            return False

    async def write_float32(self, register: int, value: float) -> bool:
        """FC16: escribe un Float32 Big-Endian en dos holding registers (1-based)."""
        if settings.mock_modbus:
            logger.debug("MOCK write_float32 reg=%d val=%f", register, value)
            return True
        if not await self._ensure_connected():
            return False
        try:
            raw = struct.pack(">f", value)
            word_hi = struct.unpack(">H", raw[0:2])[0]
            word_lo = struct.unpack(">H", raw[2:4])[0]
            result = await self._client.write_registers(register - 1, [word_hi, word_lo], device_id=1)
            return not result.isError()
        except Exception as exc:
            logger.error("write_float32 error reg=%d: %s", register, exc)
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
