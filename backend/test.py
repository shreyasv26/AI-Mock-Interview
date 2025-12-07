# import google.generativeai as genai
# genai.configure(api_key="AIzaSyDi0Isq7sZwTc_xCIongEUfu45gHoMAbRw")

# model = genai.GenerativeModel("gemini-2.5-pro")
# response = model.generate_content("Say hello in one word.")
# print(response.text)

import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load the API key from your .env file
load_dotenv()
api_key = os.environ.get("GEMINI_API_KEY")

if api_key:
    genai.configure(api_key=api_key)
    print("Models that support 'generateContent':")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
else:
    print("Error: GEMINI_API_KEY not found in .env file.")