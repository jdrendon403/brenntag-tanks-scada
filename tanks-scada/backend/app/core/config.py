from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    plc_host: str = "192.168.1.100"
    plc_port: int = 502
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "scada_tanks"
    mock_modbus: bool = True
    modbus_word_swap: bool = False   # True → orden CDAB en vez de ABCD para Float32
    polling_interval: float = 1.0
    log_level: str = "INFO"
    auth_user: str = "admin"
    auth_password: str = "scada1234"
    auth_secret: str = "cambia-este-secreto-en-produccion"

    model_config = {"env_file": ".env"}


settings = Settings()
