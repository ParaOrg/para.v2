# Save this as clean_script.py
with open("main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the non-breaking space (U+00A0) with a standard space
cleaned_content = content.replace('\u00A0', ' ')

with open("main.py", "w", encoding="utf-8") as f:
    f.write(cleaned_content)

print("✅ main.py has been scrubbed of non-printable characters!")