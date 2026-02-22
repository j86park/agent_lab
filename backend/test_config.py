import os
from app.config import settings

print(f"Current Working Directory: {os.getcwd()}")
print(f"AGENT_LAB_TAVILY_API_KEY in env: {os.environ.get('AGENT_LAB_TAVILY_API_KEY')}")
print(f"settings.tavily_api_key: {settings.tavily_api_key}")
