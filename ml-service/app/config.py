import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg2://transitops:transitops@localhost:5432/transitops"
)
PORT = int(os.environ.get("PORT", "8000"))
