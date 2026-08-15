import os

REQUIRED_VARS = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB",
                  "POSTGRES_HOST", "POSTGRES_PORT", "DATABASE_URL"]


def validate_env() -> None:
    missing = [v for v in REQUIRED_VARS if not os.environ.get(v)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}. "
            f"Copy .env.example to .env and fill these in before running "
            f"`docker compose up` or any data_infra script."
        )


if __name__ == "__main__":
    validate_env()
    print("Environment OK — all required variables are set.")