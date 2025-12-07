import os
import mysql.connector
from mysql.connector import pooling

# -------------------- DB CONFIGURATION --------------------
# CRITICAL: We load credentials from environment variables first (best practice).
# If the environment variables are not set (e.g., when running locally), 
# we use the specific credentials you provided as a fallback default.

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root") # Updated to use 'root' as the default
DB_PASSWORD = os.environ.get("DB_PASSWORD", "Sindhu@123") # Updated to use 'Sindhu@123' as the default
DB_DATABASE = os.environ.get("DB_DATABASE", "ai_interview") # Uses 'ai_interview' as the default

# Configuration dictionary used by the connection pool
dbconfig = {
    "host": DB_HOST,
    "user": DB_USER,
    "password": DB_PASSWORD,
    "database": DB_DATABASE
}
print("Connecting to DB with:", dbconfig)

# -------------------- CONNECTION POOL --------------------
# Create a global connection pool using the credentials loaded above.
connection_pool = pooling.MySQLConnectionPool(
    pool_name="interview_pool",
    pool_size=10, 
    **dbconfig
)

def get_connection():
    """
    Retrieves a connection object from the global connection pool.
    """
    try:
        return connection_pool.get_connection()
    except mysql.connector.Error as err:
        # Print the error for server-side logging
        print(f"Database Pool Connection Error: {err}")
        # Critical: Re-raise the error so the calling route handles the failure
        raise
