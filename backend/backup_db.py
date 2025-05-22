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

def restore_database(backup_path):
    """Restore the database from a specified backup file."""
    try:
        if not os.path.exists(backup_path):
            logging.error(f"Backup file not found: {backup_path}")
            print(f"Error: Backup file not found at {backup_path}")
            return False
        
        # Backup the current database before restoring
        backup_database()
        
        # Restore the database
        shutil.copy2(backup_path, DATABASE_PATH)
        logging.info(f"Database restored from: {backup_path}")
        print(f"Database restored from {backup_path}")
        return True
    except Exception as e:
        logging.error(f"Restore failed: {str(e)}")
        print(f"Error during restore: {str(e)}")
        return False

if __name__ == "__main__":
    backup_database()
