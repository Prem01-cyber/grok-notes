import os
import shutil
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', filename='backup.log')

# Define paths
DATABASE_PATH = "./notes.db"
BACKUP_DIR = "./backups"

def ensure_backup_directory():
    """Ensure the backup directory exists."""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        logging.info(f"Created backup directory: {BACKUP_DIR}")

def backup_database():
    """Create a timestamped backup of the database."""
    try:
        ensure_backup_directory()
        timestamp = datetime.now().strftime("%Y-%m-%d")
        backup_filename = f"notes_backup_{timestamp}.db"
        backup_path = os.path.join(BACKUP_DIR, backup_filename)
        
        if os.path.exists(DATABASE_PATH):
            shutil.copy2(DATABASE_PATH, backup_path)
            logging.info(f"Backup successful: {backup_path}")
            print(f"Backup created at {backup_path}")
        else:
            logging.error(f"Database file not found: {DATABASE_PATH}")
            print(f"Error: Database file not found at {DATABASE_PATH}")
    except Exception as e:
        logging.error(f"Backup failed: {str(e)}")
        print(f"Error during backup: {str(e)}")

if __name__ == "__main__":
    backup_database()
