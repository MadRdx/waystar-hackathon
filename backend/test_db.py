import os
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

uri = os.getenv("MONGODB_URI")

if not uri:
    print("Error: MONGODB_URI not found in .env file.")
    exit(1)

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))

# Send a ping to confirm a successful connection
print(f"Attempting to connect to: {uri.split('@')[-1]}")
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(f"Connection failed: {e}")
