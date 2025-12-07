import os
import json
import re  # Kept for Gemini helpers
import jwt
import uuid
from datetime import datetime, timedelta, UTC
from flask import Flask, request, jsonify, g
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import mysql.connector
import google.generativeai as genai
# from google.api_core import exceptions # Removed - Unused
from flask_cors import CORS
from functools import wraps

# --- Local Imports ---
from db import get_connection
from ml.resume_parser import parse_resume
from utils import token_required

# --- CONFIGURATION ---
load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "default-secret-key-change-me")

UPLOAD_FOLDER = 'temp_resumes'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'pdf', 'docx'}
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- GEMINI LLM SETUP ---
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
chat_model = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('models/gemini-2.5-flash')
        chat_model = model
        app.logger.info("Gemini Model loaded successfully.")
    except Exception as e:
        app.logger.error(f"Error initializing Gemini: {e}")
else:
    app.logger.warning("GEMINI_API_KEY not set. AI features will be disabled.")

# -------------------- NEW: DATABASE HANDLER DECORATOR --------------------
def db_handler(dictionary_cursor=True, commit=False):
    """
    Decorator to handle database connection, cursor, exceptions, and cleanup.
    Passes 'conn' and 'cursor' to the decorated function.
    - dictionary_cursor: Set to True to get results as dictionaries.
    - commit: Set to True for routes that INSERT, UPDATE, or DELETE.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            conn = None
            cursor = None
            try:
                conn = get_connection()
                cursor = conn.cursor(dictionary=dictionary_cursor)
                
                # Pass conn and cursor to the route function
                result = f(cursor=cursor, conn=conn, *args, **kwargs)
                
                if commit:
                    conn.commit()
                
                return result

            except mysql.connector.Error as err:
                app.logger.error(f"Database error in {f.__name__}: {err}")
                if conn and commit:
                    conn.rollback()
                return jsonify({"error": f"Database error: {err.msg}"}), 500
            except Exception as e:
                app.logger.error(f"Error in {f.__name__}: {e}")
                if conn and commit:
                    conn.rollback()
                return jsonify({"error": "An unexpected server error occurred."}), 500
            finally:
                if cursor:
                    cursor.close()
                if conn:
                    conn.close()
        return decorated_function
    return decorator

# -------------------- HELPER FUNCTIONS --------------------

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def _clean_gemini_json(response_text):
    """Helper to extract JSON from Gemini's markdown-formatted response."""
    match = re.search(r"```(json)?(.*)```", response_text, re.DOTALL)
    if match:
        return match.group(2).strip()
    return response_text.strip() # Fallback

# --- GEMINI LLM HELPERS ---
def generate_gemini_questions(job_role, resume_data): # Pass the whole dictionary
    """
    Calls Gemini API to generate interview questions.
    Uses full resume context if available, otherwise generates role-based questions.
    """
    if not chat_model:
        app.logger.error("Gemini chat_model is not initialized.")
        return None # Return None explicitly on failure

    num_total_questions = 10 # Keep total at 10 for now

    # --- NEW: Check if core resume sections are substantially empty ---
    # Convert potential string content from parser back to lists for checking
    skills = resume_data.get('Skills', [])
    projects = resume_data.get('Projects', [])
    experience = resume_data.get('Experience', [])
    education = resume_data.get('Education', [])
    achievements = resume_data.get('Achievements', [])

    # Simple check: are skills, projects, AND experience all effectively empty?
    # (Checking list length, or string length if parser returned strings)
    is_resume_sparse = (not skills or len(skills) == 0 or (isinstance(skills, str) and len(skills) < 10)) and \
                       (not projects or len(projects) == 0 or (isinstance(projects, str) and len(projects) < 10)) and \
                       (not experience or len(experience) == 0 or (isinstance(experience, str) and len(experience) < 10))

    prompt = ""
    expected_categories = ["Resume-Based", "Role-Based"] # Default expectation

    if is_resume_sparse:
        # --- SCENARIO 1: Resume data is missing/sparse ---
        app.logger.warning("Resume data (Skills/Projects/Experience) is sparse. Generating only Role-Based questions.")
        num_role_based = num_total_questions
        expected_categories = ["Role-Based"] # Only expect Role-Based

        prompt = f"""
        You are an AI hiring manager for a "{job_role}" position.
        The candidate's resume details could not be fully extracted.

        Your task is to generate exactly {num_total_questions} standard interview questions appropriate for a candidate applying for the "{job_role}" role.
        These should be "Role-Based" questions covering technical knowledge, problem-solving, and behavioral aspects relevant to the role.

        Return the questions as a valid JSON list of objects, where each object has "text" and "category" (which should always be "Role-Based" in this case).
        IMPORTANT: Ensure the response contains exactly {num_total_questions} questions.
        """
    else:
        # --- SCENARIO 2: Resume data is available ---
        app.logger.info("Resume data found. Generating mixed Resume-Based and Role-Based questions.")
        num_resume_based = 6 # Keep the previous ratio
        num_role_based = 4

        # Include all available sections in the prompt context
        prompt = f"""
        You are an AI hiring manager for a "{job_role}" position.
        A candidate's resume includes the following details:
        - Skills: {skills}
        - Projects: {projects}
        - Experience: {experience}
        - Education: {education}
        - Achievements: {achievements}
        Consider all these sections as relevant background.

        Your task is to generate exactly {num_total_questions} interview questions for this candidate.
        - {num_resume_based} questions MUST be "Resume-Based", drawing connections from ANY part of their resume (Skills, Projects, Experience, Education, Achievements).
        - {num_role_based} questions MUST be "Role-Based" (e.g., standard technical or behavioral questions relevant to the "{job_role}").

        Return the questions as a valid JSON list of objects, where each object has "text" and "category" ("Resume-Based" or "Role-Based").
        IMPORTANT: Ensure the response contains exactly {num_total_questions} questions in the specified categories.
        """

    # --- Generation and Parsing Logic (mostly the same) ---
    try:
        response = chat_model.generate_content(prompt)
        app.logger.info(f"--- RAW GEMINI QUESTIONS RESPONSE (Scenario: {'Sparse Resume' if is_resume_sparse else 'Full Resume'}) ---")
        app.logger.info(response.text)
        app.logger.info("----------------------------------------------------------")

        json_str = _clean_gemini_json(response.text)
        questions = json.loads(json_str)

        if not isinstance(questions, list):
             app.logger.error(f"Gemini response was not a JSON list: {json_str}")
             raise ValueError("AI response format incorrect (not a list).")

        # Validate number of questions
        if len(questions) != num_total_questions:
             app.logger.warning(f"Gemini returned {len(questions)} questions, expected {num_total_questions}. Using fallback.")
             raise ValueError("Incorrect number of questions returned by AI.")

        # Validate categories based on the scenario
        for q in questions:
            if 'category' not in q or q['category'] not in expected_categories:
                 app.logger.warning(f"Question found with unexpected category '{q.get('category')}'. Expected: {expected_categories}. Question text: {q.get('text')}")
                 # Option: Correct the category or raise error? Let's allow it but log.
                 # q['category'] = expected_categories[0] # Force correction? Risky.

        return questions

    except Exception as e:
        app.logger.error(f"Error generating or parsing Gemini questions: {e}")
        # Fallback still provides 5 questions (mix might be inaccurate here)
        return [
            {"text": f"Tell me about a challenging project or academic experience. (Fallback 1)", "category": "Resume-Based"},
            {"text": f"Describe your familiarity with key technologies for a {job_role}. (Fallback 2)", "category": "Role-Based"},
            {"text": f"What interests you most about the {job_role} role? (Fallback 3)", "category": "Role-Based"},
            {"text": f"How do you approach learning new technical skills? (Fallback 4)", "category": "Role-Based"},
            {"text": f"Describe a time you worked effectively in a team. (Fallback 5)", "category": "Behavioral"} # Added Behavioral
        ]

def generate_gemini_feedback(job_role, transcript):
    if not chat_model:
        app.logger.error("Gemini chat_model is not initialized.")
        return None

    prompt = f"""
    You are an AI career coach providing feedback on a practice interview for a "{job_role}" role.
    Here is the full interview transcript (Question and Answer pairs):
    {transcript}

    Your task is to provide detailed, constructive feedback.
    Return a valid JSON object with the following structure:
    - "technical_score": A score from 0 to 5 (e.g., 3.5)
    - "communication_score": A score from 0 to 5 (e.g., 4.0)
    - "hr_score": A score from 0 to 5 (e.g., 4.5)
    - "overall_score": The average of the three scores.
    - "strengths": A string paragraph (2-3 sentences).
    - "areas_for_improvement": A string paragraph (2-3 sentences).
    - "detailed_feedback": A list of strings (one string per Q&A pair).
    """
    
    try:
        response = chat_model.generate_content(prompt)
        json_str = _clean_gemini_json(response.text)
        feedback = json.loads(json_str)
        
        # Ensure scores are valid floats
        feedback["technical_score"] = float(feedback.get("technical_score", 0))
        feedback["communication_score"] = float(feedback.get("communication_score", 0))
        feedback["hr_score"] = float(feedback.get("hr_score", 0))
        feedback["overall_score"] = float(feedback.get("overall_score", 0))
        
        return feedback
    except Exception as e:
        app.logger.error(f"Error generating Gemini feedback: {e}")
        return {"error": "Failed to parse AI feedback."}

# -------------------- AUTHENTICATION API --------------------

@app.route('/api/register', methods=['POST'])
@db_handler(commit=True) # Use new decorator, commit=True for INSERT
def register(cursor, conn): # Receives cursor and conn
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    if not all([name, email, password]):
        return jsonify({"error": "Missing required fields."}), 400

    # Check for existing user
    cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"error": "Email already registered."}), 409

    hashed_password = generate_password_hash(password)
    cursor.execute("INSERT INTO users (name, email, password) VALUES (%s, %s, %s)",
                   (name, email, hashed_password))
    
    return jsonify({"message": "User registered successfully."}), 201


@app.route('/api/login', methods=['POST'])
@db_handler() # Use new decorator, no commit needed for SELECT
def login(cursor, conn):
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({"error": "Missing email or password."}), 400

    cursor.execute("SELECT id, password, name FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()

    if user and check_password_hash(user['password'], password):
        token = jwt.encode({
            'user_id': user['id'],
            'exp': datetime.now(UTC) + timedelta(days=1)
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        return jsonify({
            "token": token,
            "user": {"name": user['name'], "email": email}
        }), 200
    else:
        return jsonify({"error": "Invalid email or password."}), 401

# -------------------- USER & RESUME API --------------------

@app.route('/api/user', methods=['GET'])
@token_required
@db_handler()
def get_user_data(user_id, cursor, conn):
    cursor.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    if not user:
        return jsonify({"error": "User not found."}), 404
    return jsonify(user), 200


@app.route('/api/upload-resume', methods=['POST'])
@token_required
@db_handler(commit=True) # commit=True for INSERT/UPDATE
def upload_resume(user_id, cursor, conn):
    if 'resume' not in request.files:
        return jsonify({"error": "No file part."}), 400
    
    file = request.files['resume']
    if file.filename == '':
        return jsonify({"error": "No selected file."}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"{user_id}_{filename}")
        file.save(filepath)

        # Parse the resume
        parsed_data = parse_resume(filepath)
        if not parsed_data:
            return jsonify({"error": "Failed to parse resume."}), 500

        skills = parsed_data.get('Skills', [])
        projects = parsed_data.get('Projects', [])
        experience = parsed_data.get('Experience', [])

        # Convert to JSON strings for database
        skills_json = json.dumps(skills)
        projects_json = json.dumps(projects)
        experience_json = json.dumps(experience)

        # Insert or update resume data
        sql = """
            INSERT INTO resumes (user_id, skills, projects, experience, uploaded_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON DUPLICATE KEY UPDATE
                skills = VALUES(skills),
                projects = VALUES(projects),
                experience = VALUES(experience),
                uploaded_at = NOW()
        """
        # Note: Assumes user_id is UNIQUE in resumes table or is the PRIMARY KEY.
        # Based on your schema, you need a unique constraint on user_id for ON DUPLICATE KEY to work.
        # Let's assume you'll add: ALTER TABLE resumes ADD UNIQUE (user_id);
        # For now, let's just insert, assuming one resume per user is handled by frontend
        
        # A safer approach without the unique key:
        cursor.execute("DELETE FROM resumes WHERE user_id = %s", (user_id,))
        cursor.execute(
            "INSERT INTO resumes (user_id, skills, projects, experience) VALUES (%s, %s, %s, %s)",
            (user_id, skills_json, projects_json, experience_json)
        )

        return jsonify({
            "message": "Resume uploaded and parsed successfully.",
            "skills": skills,
            "projects": projects,
            "experience": experience
        }), 201
    else:
        return jsonify({"error": "File type not allowed."}), 400

# -------------------- INTERVIEW CORE API --------------------

@app.route('/api/start-interview', methods=['POST'])
@token_required
@db_handler(commit=True)
def start_interview(user_id, cursor, conn):
    job_role = request.json.get('job_role')
    if not job_role:
        return jsonify({"error": "Job role is required."}), 400

    # 1. Fetch user's latest resume data (Keep this part)
    cursor.execute("SELECT skills, projects, experience, education, achievements FROM resumes WHERE user_id = %s ORDER BY uploaded_at DESC LIMIT 1", (user_id,))
    resume_row = cursor.fetchone() # Fetch as dictionary

    resume_data_dict = {} # Initialize empty dict
    if resume_row:
        # Attempt to parse JSON strings back into lists/objects, handle errors
        for key in ['skills', 'projects', 'experience', 'education', 'achievements']:
            json_string = resume_row.get(key)
            try:
                # Capitalize key for consistency with parser output
                parsed_list = json.loads(json_string) if json_string else []
                resume_data_dict[key.capitalize()] = parsed_list
            except json.JSONDecodeError:
                app.logger.warning(f"Could not decode JSON for resume key '{key}', user_id {user_id}. Content: {json_string}")
                resume_data_dict[key.capitalize()] = [json_string] if json_string else [] # Store raw string in list as fallback
            except Exception as e:
                 app.logger.error(f"Unexpected error processing resume key '{key}', user_id {user_id}: {e}")
                 resume_data_dict[key.capitalize()] = []
        app.logger.info(f"Fetched resume data for user {user_id}")
    else:
        # If no resume found in DB, pass an empty dict (triggers sparse resume logic in generate_gemini_questions)
        app.logger.warning(f"No resume found in DB for user {user_id}. Proceeding without resume context.")
        # Ensure default keys exist but are empty
        resume_data_dict = {'Skills': [], 'Projects': [], 'Experience': [], 'Education': [], 'Achievements': []}
        # return jsonify({"error": "No resume found. Please upload one first."}), 404 # Old behavior

    # 2. Create session ID (Keep this part)
    session_id = str(uuid.uuid4())
    cursor.execute("INSERT INTO sessions (session_id, user_id, job_role) VALUES (%s, %s, %s)",
                   (session_id, user_id, job_role))

    # 3. Call Gemini with the full resume_data dictionary
    generated_questions = generate_gemini_questions(job_role, resume_data_dict) # Pass dict

    if not generated_questions: # Check if None was returned on failure
        app.logger.error(f"Failed to generate questions for session {session_id}. generate_gemini_questions returned None.")
        return jsonify({"error": "Failed to generate interview questions due to an internal error."}), 500

    # 4. Insert questions into DB (Keep this part, maybe adjust category mapping)
    interview_questions = []
    for q in generated_questions:
        q_text = q.get('text')
        # Map category slightly differently if needed, or keep simple
        q_category = q.get('category', 'Role-Based') # Default to Role-Based if missing
        # Ensure category is one of the expected DB values if strict
        # db_category = 'Technical' if q_category == 'Role-Based' else 'Behavioral' # Example mapping

        cursor.execute(
            "INSERT INTO questions (role, text, category, difficulty) VALUES (%s, %s, %s, %s)",
            (job_role, q_text, q_category, 'Medium') # Storing original category ('Resume-Based' or 'Role-Based')
        )
        new_question_id = cursor.lastrowid

        interview_questions.append({
            "id": new_question_id,
            "text": q_text,
            "category": q_category
        })

    return jsonify({"session_id": session_id, "questions": interview_questions}), 200

@app.route('/api/submit-answer', methods=['POST'])
@token_required
@db_handler(commit=True) # commit=True for INSERT
def submit_answer(user_id, cursor, conn):
    data = request.get_json()
    session_id = data.get('session_id')
    question_id = data.get('question_id')
    answer_text = data.get('answer_text')

    if not all([session_id, question_id, answer_text]):
        return jsonify({"error": "Missing session_id, question_id, or answer_text"}), 400

    cursor.execute(
        "INSERT INTO answers (user_id, question_id, answer_text, session_id) VALUES (%s, %s, %s, %s)",
        (user_id, question_id, answer_text, session_id)
    )
    
    return jsonify({"message": "Answer submitted successfully."}), 201


@app.route('/api/end-interview', methods=['POST'])
@token_required
@db_handler(commit=True) # commit=True for INSERT (into progress)
def end_interview(user_id, cursor, conn):
    session_id = request.json.get('session_id')
    if not session_id:
        return jsonify({"error": "Session ID is required."}), 400

    # 1. Get the job role from the session
    cursor.execute("SELECT job_role FROM sessions WHERE session_id = %s AND user_id = %s", (session_id, user_id))
    session_info = cursor.fetchone()
    if not session_info:
        return jsonify({"error": "Invalid session."}), 404
    job_role = session_info['job_role']

    # 2. Get all Q&A for this session
    sql = """
        SELECT q.text AS question_text, a.answer_text
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE a.session_id = %s AND a.user_id = %s
    """
    cursor.execute(sql, (session_id, user_id))
    qa_pairs = cursor.fetchall()

    if not qa_pairs:
        return jsonify({"error": "No answers found for this session."}), 404

    # 3. Format transcript for GenAI
    transcript = "\n\n".join([f"Question: {pair['question_text']}\nAnswer: {pair['answer_text']}" for pair in qa_pairs])

    # 4. Call Gemini for feedback
    feedback_data = generate_gemini_feedback(job_role, transcript)
    if not feedback_data or 'error' in feedback_data:
        return jsonify(feedback_data or {"error": "Failed to get AI feedback."}), 500

    # 5. Store feedback in 'progress' table
    cursor.execute(
        """
        INSERT INTO progress (user_id, role, technical_score, communication_score, hr_score, overall_score)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (
            user_id, job_role,
            feedback_data.get('technical_score'),
            feedback_data.get('communication_score'),
            feedback_data.get('hr_score'),
            feedback_data.get('overall_score')
        )
    )
    
    return jsonify(feedback_data), 200

# -------------------- DASHBOARD & LEARN API --------------------
# --- NEW: Endpoint to get distinct roles for the Learn section ---
@app.route('/api/learn-roles', methods=['GET'])
@token_required
@db_handler(dictionary_cursor=False) # Get roles as simple list/tuples
def get_learn_roles(user_id, cursor, conn):
    """Fetches a distinct list of roles available in the learn_section table."""
    try:
        # Query distinct roles, ordering them alphabetically
        cursor.execute("SELECT DISTINCT role FROM learn_section ORDER BY role ASC")
        # Fetchall returns a list of tuples, e.g., [('Data Scientist',), ('Software Developer',)]
        roles_tuples = cursor.fetchall()
        # Convert list of tuples to a simple list of strings
        roles_list = [role[0] for role in roles_tuples if role[0]] # Ensure role is not None
        return jsonify({"roles": roles_list}), 200
    except Exception as e:
        app.logger.error(f"Error fetching distinct learn roles: {e}")
        # Return a fallback list in case of error
        return jsonify({"roles": ["Software Developer", "Data Scientist", "General Tech"], "error": "Failed to fetch full role list."}), 500
    
@app.route('/api/progress-data', methods=['GET'])
@token_required
@db_handler()
def get_progress_data(user_id, cursor, conn):
    cursor.execute(
        "SELECT role, overall_score, attempt_date FROM progress WHERE user_id = %s ORDER BY attempt_date DESC",
        (user_id,)
    )
    progress_data = cursor.fetchall()
    return jsonify({"progress_history": progress_data}), 200


@app.route('/api/learn-data', methods=['GET'])
@token_required
@db_handler()
def get_learn_data(user_id, cursor, conn):
    role = request.args.get('role', 'Software Developer') 
    
    sql = "SELECT skill, description, resource_link FROM learn_section WHERE role = %s LIMIT 10"
    cursor.execute(sql, (role,))
    learn_data = cursor.fetchall()
    
    if not learn_data:
         fallback_sql = "SELECT skill, description, resource_link FROM learn_section WHERE role = 'General Tech' LIMIT 10"
         cursor.execute(fallback_sql)
         learn_data = cursor.fetchall()
    
    return jsonify({"learn_resources": learn_data}), 200

# -------------------- MAIN APP EXECUTION --------------------

if __name__ == '__main__':
    with app.app_context():
        # This is needed so 'current_app' works in 'token_required'
        pass
    app.run(debug=True)