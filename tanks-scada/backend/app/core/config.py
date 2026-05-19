from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    plc_host: str = "192.168.1.100"
    plc_port: int = 502
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "scada_tanks"
    mock_modbus: bool = True
    polling_interval: float = 1.0
    log_level: str = "INFO"

    model_config = {"env_file": ".env"}


settings = Settings()
