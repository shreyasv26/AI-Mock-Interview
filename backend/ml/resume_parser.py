# backend/ml/resume_parser.py

import docx
import spacy
import re
import json
import fitz # PyMuPDF
import traceback # Import at top

# Load spaCy English model
try:
    nlp = spacy.load('en_core_web_sm')
except Exception as e:
    print(f"Warning: Could not load spaCy model 'en_core_web_sm'. NER features will be disabled. Error: {e}")
    print("To fix, run: python -m spacy download en_core_web_sm")
    # Set to None if loading fails to prevent runtime errors
    nlp = None 

# Replace the old extract_text function with this one
def extract_text(file_path):
    """Extract text from PDF (using PyMuPDF) or DOCX."""
    try:
        if file_path.endswith('.pdf'):
            text = ''
            # Use fitz (PyMuPDF)
            with fitz.open(file_path) as doc:
                for page in doc:
                    page_text = page.get_text("text") # Extract plain text
                    if page_text:
                        text += page_text + '\n'
            # Optional: Basic cleaning - remove excessive blank lines
            text = re.sub(r'\n\s*\n', '\n', text)
            print(f"DEBUG: PyMuPDF extracted {len(text)} characters from PDF.") # Add debug print
            return text.strip() # Return stripped text
        elif file_path.endswith('.docx'):
            doc = docx.Document(file_path)
            text = '\n'.join([para.text for para in doc.paragraphs if para.text])
            print(f"DEBUG: python-docx extracted {len(text)} characters from DOCX.") # Add debug print
            return text.strip()
        else:
            print(f"DEBUG: Unsupported file type: {file_path}")
            return ''
    except Exception as e:
        print(f"ERROR: Failed to extract text from file {file_path}. Error: {e}")
        traceback.print_exc() # Print full error details
        return ''

def extract_contact_info(text):
    """Extract emails and phone numbers."""
    emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text)
    # Improved phone regex
    phones = re.findall(r'(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}', text)
    return {'Emails': list(set(emails)), 'Phones': list(set(phones))}


def extract_entities(text):
    """Extract organizations and projects using spaCy NER."""
    if not nlp:
        print("DEBUG: spaCy nlp model not loaded. Skipping NER entity extraction.")
        return [], []
        
    doc = nlp(text)
    orgs = []
    projects = []

    for ent in doc.ents:
        if ent.label_ == 'ORG':
            orgs.append(ent.text)
        if ent.label_ in ['WORK_OF_ART', 'PRODUCT']: 
            projects.append(ent.text)

    return list(set(projects)), list(set(orgs))

# --- REFINED SECTION EXTRACTION (IMPROVED) ---
# ml/resume_parser.py
# ... (Keep imports and other functions like extract_text, extract_contact_info, etc.) ...
import re # Make sure re is imported

# --- COMPLETELY REWRITTEN extract_sections ---
def extract_sections(text):
    """
    Extracts content for predefined sections using regex splitting.
    Finds headers on their own lines and captures all content between them.
    Returns a dictionary: {'SectionName': ['line1', 'line2', ...]}
    """
    # --- 1. Define Section Keywords (Comprehensive - From User Version) ---
    SECTION_KEYWORDS = {
        # Canonical Name : [Keywords/Headers to look for (lowercase)]
        'Summary': ['summary', 'professional summary', 'career summary', 'profile', 'personal profile', 'objective', 'career objective', 'about me'],
        'Experience': ['experience', 'work experience', 'professional experience', 'employment history', 'work history', 'career history', 'professional background'],
        'Education': ['education', 'academic background', 'qualifications', 'academic credentials', 'academic training'],
        'Projects': ['projects', 'personal projects', 'academic projects', 'portfolio', 'sample projects', 'key projects'],
        'Skills': ['skills', 'technical skills', 'competencies', 'proficiencies', 'languages', 'technical expertise', 'technologies', 'tools', 'skills & tools', 'languages and technologies', 'skills and competencies'],
        'Achievements': ['achievements', 'awards', 'accomplishments', 'awards and honors', 'honors', 'recognitions'],
        'Certifications': ['certifications', 'certificates', 'licenses & certifications', 'courses'],
        'Publications': ['publications', 'papers', 'articles'],
        'References': ['references']
        # Add more if needed
    }

    # --- 2. Create Reverse Mapping ---
    # Maps any keyword variation (lowercase) back to the canonical section name
    keyword_to_section_name = {}
    for canonical_name, keywords in SECTION_KEYWORDS.items():
        for kw in keywords:
            keyword_to_section_name[kw] = canonical_name

    # --- 3. Create Master Regex ---
    # Sort by length, longest first, to match "professional experience" before "experience"
    all_keywords = sorted(keyword_to_section_name.keys(), key=len, reverse=True)
    
    # Pattern: ^\s* (Start of line, whitespace)
    #          (kw1|kw2|...) (Capturing group 1: any of the keywords)
    #          \s*[:]?\s*$ (Whitespace, optional colon, whitespace, end of line)
    pattern_str = r'^\s*(' + '|'.join(re.escape(kw) for kw in all_keywords) + r')\s*[:]?\s*$'
    pattern = re.compile(pattern_str, re.IGNORECASE | re.MULTILINE)

    print(f"\n--- DEBUG: Starting Section Extraction (Regex Split) ---") # DEBUG
    
    # --- 4. Split Text and Initialize ---
    # `pattern.split(text)` includes the captured group (the header) in the results
    parts = pattern.split(text)
    
    # Pre-populate with empty lists
    extracted_sections = {name: [] for name in SECTION_KEYWORDS.keys()}
    # Add a key for content before the first recognized section
    extracted_sections['Header'] = []

    
    # --- 5. Process Split Parts ---
    # The first part (parts[0]) is content *before* the first header
    header_content = [line.strip() for line in parts[0].split('\n') if line.strip()]
    if header_content:
        extracted_sections['Header'] = header_content
        print("DEBUG: Found 'Header' content (before first section).") # DEBUG
    
    # Process the rest: [header1, content1, header2, content2, ...]
    it = iter(parts[1:])
    for header in it:
        try:
            content_str = next(it) # This is the block of text for that header
            
            # Normalize the found header to match our map
            header_key = header.strip().lower().rstrip(':').strip()
            canonical_name = keyword_to_section_name.get(header_key)
            
            if canonical_name:
                print(f"DEBUG: Matched Header '{header.strip()}' -> Section '{canonical_name}'") # DEBUG
                # Split content into lines and strip them
                content_lines = [line.strip() for line in content_str.split('\n') if line.strip()]
                if content_lines:
                    # Use extend to handle sections appearing multiple times
                    extracted_sections[canonical_name].extend(content_lines)
            else:
                # This should be rare if the regex and map are in sync
                print(f"WARNING: Regex matched header '{header.strip()}' but no canonical name found.") # DEBUG
                
        except StopIteration:
            # This happens if there's a trailing header with no content
            print(f"DEBUG: Trailing header '{header.strip()}' with no content.") # DEBUG
            break
    
    print("--- DEBUG: Finished Section Extraction (Regex Split) ---") # DEBUG

    # --- 6. Clean up empty 'Header' section if nothing was collected there ---
    if not extracted_sections.get('Header'):
        del extracted_sections['Header']
            
    # --- 7. Final Debug Print & Return ---
    print("\n--- DEBUG (extract_sections - Regex Split): Sections Content ---")
    for k, v in extracted_sections.items():
        if v: # Only print sections that have content
            print(f"  '{k}': Found {len(v)} lines. First line: '{v[0]}'")
    print("----------------------------------------------------------")

    return extracted_sections # Return dict with lists of lines

# --- IMPROVED SKILLS EXTRACTION ---
def extract_skills(text, skill_keywords=None):
    """Extract skills based on a comprehensive set of keywords and simple regex matching."""
    
    # --- MASSIVELY EXPANDED KEYWORDS ---
    if skill_keywords is None:
        skill_keywords = [
            # Programming Languages
            'Python', 'Java', 'C++', 'C#', 'C', 'JavaScript', 'TypeScript', 
            'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin', 'Rust', 'Scala', 'Perl',
            'Shell', 'Bash', 'PowerShell', 'SQL',

            # Frontend Frameworks/Libraries
            'React', 'React.js', 'Angular', 'Vue', 'Vue.js', 'Svelte', 'Next.js',
            'Gatsby', 'Ember.js', 'Backbone.js', 'jQuery',
            
            # Backend Frameworks/Libraries
            'Node.js', 'NodeJS', 'Express.js', 'Django', 'Flask', 'Spring', 'Spring Boot',
            'Ruby on Rails', 'ASP.NET', '.NET', 'Laravel', 'Symfony', 'FastAPI',
            
            # Mobile
            'React Native', 'Flutter', 'SwiftUI', 'Android', 'iOS',

            # Web/Markup
            'HTML', 'HTML5', 'CSS', 'CSS3', 'Sass', 'LESS', 'Bootstrap',
            'Tailwind', 'Tailwind CSS', 'XML', 'JSON', 'AJAX', 'GraphQL',
            
            # Databases
            'MySQL', 'PostgreSQL', 'Microsoft SQL Server', 'MSSQL', 'SQLite', 
            'MongoDB', 'Redis', 'Cassandra', 'MariaDB', 'Oracle', 'NoSQL',
            'Firebase', 'DynamoDB', 'Elasticsearch',

            # Cloud Platforms
            'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', 
            'GCP', 'Google Cloud Platform', 'Heroku', 'Netlify', 'Vercel',
            'DigitalOcean',

            # DevOps & Tools
            'Docker', 'Kubernetes', 'K8s', 'Terraform', 'Ansible', 'Jenkins',
            'Git', 'GitHub', 'GitLab', 'Bitbucket', 'CI/CD', 'Jira',
            'Confluence', 'Nginx', 'Apache', 'Linux', 'Unix',

            # Data Science & ML
            'Machine Learning', 'Data Analysis', 'Data Science', 'Pandas', 'NumPy',
            'SciPy', 'Scikit-learn', 'TensorFlow', 'Keras', 'PyTorch', 
            'Tableau', 'Power BI', 'Excel', 'R', 'MATLAB', 'Spark', 'Hadoop',
            
            # Methodologies & Concepts
            'Agile', 'Scrum', 'Kanban', 'Waterfall', 'REST API', 'Microservices',
            'TDD', 'BDD', 'OOP', 'Functional Programming', 'Data Structures',
            'Algorithms'
        ]
        
    found_skills = set()
    text_lower = text.lower()
    
    # Use word boundary regex to match whole words 
    # (e.g., 'Go' but not 'Google', 'R' but not 'React')
    for skill in skill_keywords:
        skill_lower = skill.lower()
        # Create a regex that handles special characters like C++, C#, .NET
        # We escape the skill, then apply word boundaries.
        # For single-letter skills (like C or R), we need spaces/punctuation
        if len(skill_lower) == 1:
            pattern = r'(^|\s|[,.\(\)])' + re.escape(skill_lower) + r'($|\s|[,.\(\)])'
        else:
            pattern = r'\b' + re.escape(skill_lower) + r'\b'
            
        if re.search(pattern, text_lower, re.IGNORECASE):
            # Add the original capitalized version
            found_skills.add(skill)

    # Fallback to ensure the list is never completely empty
    if not found_skills:
        if any(term in text_lower for term in ['software', 'developer', 'engineer', 'programming']):
            found_skills.add('Software Development')
        elif any(term in text_lower for term in ['data', 'analysis', 'bi', 'science']):
            found_skills.add('Data Analysis')
        elif any(term in text_lower for term in ['marketing', 'sales', 'business', 'management']):
            found_skills.add('Business Acumen')
            
    if not found_skills and len(text) > 50: # If still nothing, but we have text
        found_skills.add('Generalist')
        
    return sorted(list(found_skills))

def parse_resume(file_path):
    """
    Main function using refined section extraction and careful fallback.
    Includes debugging prints.
    """
    # Define the default structure, including new sections
    default_result = {
        'Contact Info': {'Emails': [], 'Phones': []},
        'Skills': [],
        'Projects': [],
        'Organizations': [], # Usually extracted via NER
        'Education': [],
        'Experience': [],
        'Summary': [],
        'Achievements': [],
        'Certifications': [],
        'Publications': [],
        'Header': [] # For content before the first proper section
    }

    try:
        print(f"\n--- Parsing Resume: {file_path} ---") # DEBUG START
        text = extract_text(file_path)
        if not text or len(text) < 50:
            print("DEBUG: Text extraction failed or text too short.") # DEBUG
            return default_result

        # 1. Extract Atomic Info
        contact_info = extract_contact_info(text)
        # Run skills extraction on the *entire* text body
        skills_from_full_text = extract_skills(text)
        projects_ner, orgs_ner = extract_entities(text)

        print(f"\n--- DEBUG: Skills (from full text) ---") # DEBUG
        print(skills_from_full_text) # DEBUG
        print(f"--- DEBUG: NER Projects ---") # DEBUG
        print(projects_ner) # DEBUG
        print(f"--- DEBUG: NER Organizations ---") # DEBUG
        print(orgs_ner) # DEBUG
        print("-----------------------------------")


        # 2. Extract Sections based on Headers
        sections = extract_sections(text)
        print("\n--- DEBUG: Sections Found by extract_sections ---") # DEBUG
        # Print keys found and snippet of content
        for key, content_list in sections.items():
            if content_list:
                snippet = content_list[0] # content is now a list of lines
                print(f"  Section '{key}': Found {len(content_list)} lines. First line: '{snippet}'") # DEBUG
        print("-------------------------------------------------")


        # 3. Populate the result, prioritizing section content
        parsed_resume = {}
        parsed_resume['Contact Info'] = contact_info
        parsed_resume['Organizations'] = orgs_ner

        # Get all keys from our default list + any extras found (like 'Header')
        all_section_keys = list(default_result.keys())
        for k in sections.keys(): # Add any keys found that aren't in default (like Header)
            if k not in all_section_keys:
                all_section_keys.append(k)
        
        for section_key in all_section_keys:
            if section_key in ['Contact Info', 'Organizations']: # Already handled
                continue
                
            section_content = sections.get(section_key) # This is a LIST of lines
            
            if section_key == 'Skills':
                # For SKILLS: Use section content first, but supplement with full-text scan
                skills_from_section = []
                if section_content:
                    # --- FIX 1 ---
                    # `section_content` is a list of lines. Join them into one string.
                    skills_from_section_text = '\n'.join(section_content)
                    skills_from_section = extract_skills(skills_from_section_text)
                
                # Combine and deduplicate
                combined_skills = sorted(list(set(skills_from_section + skills_from_full_text)))
                parsed_resume[section_key] = combined_skills
                print(f"DEBUG: Assigning section 'Skills' with items: {combined_skills[:10]}...") # DEBUG
            
            elif section_content:
                # For all OTHER sections (Experience, Projects, etc.):
                
                # --- FIX 2 ---
                # `section_content` is ALREADY a list of lines. No split needed.
                items = section_content 
                
                print(f"DEBUG: Assigning section '{section_key}' with items: {items[:5]}...") # DEBUG
                parsed_resume[section_key] = items
            else:
                # Section was not found by extract_sections
                print(f"DEBUG: Section '{section_key}' not found by extract_sections.") # DEBUG
                # Initialize with default empty list if section not found
                parsed_resume[section_key] = default_result.get(section_key, [])

        if not parsed_resume.get('Projects') and projects_ner:
            print("DEBUG: Applying NER projects fallback.") # DEBUG
            parsed_resume['Projects'] = projects_ner

        # --- Final Checks ---
        if not any(parsed_resume.get(key) for key in ['Skills', 'Projects', 'Education', 'Experience', 'Achievements']):
            if len(text) > 100 :
                # If we found no sections, put the "Header" content into Experience as a fallback
                header_content = parsed_resume.get('Header', [])
                if header_content:
                        parsed_resume['Experience'] = header_content + ["Could not automatically segment major sections. Resume format might be non-standard."]
                else:
                        parsed_resume['Experience'] = ["Could not automatically segment major sections. Resume format might be non-standard."]
                print("DEBUG: Applied minimal 'could not segment' fallback.") # DEBUG

        # Ensure all major sections exist and are lists
        for key in default_result.keys():
            if key not in parsed_resume:
                parsed_resume[key] = default_result[key]
            elif not isinstance(parsed_resume[key], (list, dict)):
                if parsed_resume[key]:
                    parsed_resume[key] = [str(parsed_resume[key])]
                else:
                    parsed_resume[key] = []
            
        # Clean up the 'Header' key if it's empty and we used the fallback
        if not parsed_resume.get('Header') and 'Header' in parsed_resume:
            del parsed_resume['Header']


        print("\n--- DEBUG: Final Parsed Resume Structure (Before Return) ---") # DEBUG
        # Print structure, showing first few items per list
        debug_output = {}
        for k, v in parsed_resume.items():
            if isinstance(v, list):
                debug_output[k] = v[:3] # Show first 3 items
            else:
                debug_output[k] = v # Show dicts as is
        print(json.dumps(debug_output, indent=2)) # DEBUG
        print("----------------------------------------------------------\n") # DEBUG END

        return parsed_resume

    except Exception as e:
        print(f"ERROR: An exception occurred during parsing of {file_path}: {e}")
        traceback.print_exc()
        return default_result