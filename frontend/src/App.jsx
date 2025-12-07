import React, { useState, useEffect,useContext, createContext, useMemo, useRef } from 'react';
import { ArrowLeft, User, LogOut, CheckCircle, XCircle, UploadCloud, Briefcase, PlayCircle, Send, Loader, Info, BarChart, History,Mic, MicOff, Volume2, VolumeX ,BookOpen, ExternalLink,Filter} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// =========================================================================
// 1. GLOBAL CONFIGURATION & CONTEXT
// =========================================================================
const BASE_URL = 'http://127.0.0.1:5000';

const AuthContext = createContext();

// Helper to retrieve token consistently
const getToken = () => localStorage.getItem('token');
const useAuth = () => useContext(AuthContext);

// --- API Utility: Fetch Progress Data (FIXED) ---
export const getProgressData = async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Authentication token not found.');

    const response = await fetch(`${BASE_URL}/api/progress-data`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch progress data with status: ${response.status}`);
    }

    return response.json();
};

// =========================================================================
// 2. AUTHENTICATION PROVIDER & COMPONENTS
// =========================================================================

// --- AUTH PROVIDER ---
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                // Check if token is expired
                if (payload.exp * 1000 > Date.now()) {
                    // In a real app, you'd fetch user data here
                    // For now, let's store a mock user or re-fetch
                    // For this app, let's just set authenticated
                    setIsAuthenticated(true);
                    // Let's try to get user info from local storage if saved
                    const savedUser = localStorage.getItem('user');
                    if (savedUser) {
                        setUser(JSON.parse(savedUser));
                    }
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            } catch (error) {
                console.error("Invalid token:", error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setIsLoading(false);
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
    };

    const authValue = useMemo(() => ({
        user,
        isAuthenticated,
        isLoading,
        login,
        logout
    }), [user, isAuthenticated, isLoading]);

    return (
        <AuthContext.Provider value={authValue}>
            {children}
        </AuthContext.Provider>
    );
};

// --- AUTH PAGE (Login/Register) ---
const AuthPage = ({ setPage }) => {
    const [isLoginView, setIsLoginView] = useState(true);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-2xl">
                <div className="flex justify-center mb-6">
                    <Briefcase className="w-16 h-16 text-sky-600" />
                </div>
                <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">
                    {isLoginView ? 'Welcome Back' : 'Create Account'}
                </h2>
                {isLoginView ? <Login setPage={setPage} /> : <Register setPage={setPage} />}
                <p className="mt-6 text-center text-sm text-gray-600">
                    {isLoginView ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setIsLoginView(!isLoginView)}
                        className="font-medium text-sky-600 hover:text-sky-500"
                    >
                        {isLoginView ? 'Sign Up' : 'Sign In'}
                    </button>
                </p>
            </div>
        </div>
    );
};

// --- LOGIN COMPONENT ---
const Login = ({ setPage }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const { login } = useAuth();

    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!email || !password) {
            setMessage('Please fill in all fields.');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                login(data.token, data.user);
                setPage('dashboard');
            } else {
                setMessage(data.error || 'Login failed.');
            }
        } catch (error) {
            setMessage('Network error: Could not connect to server.');
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleLogin}>
            {message && <div className={`p-3 rounded-lg text-sm ${message.includes('fail') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</div>}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            <button type="submit" className="w-full py-2 px-4 rounded-lg text-white bg-sky-600 hover:bg-sky-700 font-medium">Sign In</button>
        </form>
    );
};

// --- REGISTER COMPONENT ---
const Register = ({ setPage }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setMessage('');
        if (!name || !email || !password) {
            setMessage('Please fill in all fields.');
            return;
        }

        try {
            const response = await fetch(`${BASE_URL}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await response.json();
            if (response.ok) {
                setMessage('Registration successful! Please log in.');
                // Optionally auto-login or just show success
            } else {
                setMessage(data.error || 'Registration failed.');
            }
        } catch (error) {
            setMessage('Network error: Could not connect to server.');
        }
    };

    return (
        <form className="space-y-4" onSubmit={handleRegister}>
            {message && <div className={`p-3 rounded-lg text-sm ${message.includes('fail') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{message}</div>}
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500" />
            <button type="submit" className="w-full py-2 px-4 rounded-lg text-white bg-sky-600 hover:bg-sky-700 font-medium">Sign Up</button>
        </form>
    );
};

// =========================================================================
// 3. CORE APPLICATION COMPONENTS
// =========================================================================

// --- NAVBAR ---
const Navbar = ({ setPage, handleLogout }) => {
    const { user } = useAuth();
    return (
        <nav className="bg-white shadow-md w-full">
            <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
                <div 
                    className="flex items-center space-x-2 cursor-pointer" 
                    onClick={() => setPage('dashboard')}
                >
                    <Briefcase className="w-8 h-8 text-sky-600" />
                    <span className="text-xl font-bold text-gray-800">AI Interview Prep</span>
                </div>
                <div className="flex items-center space-x-6">
                    <button onClick={() => setPage('dashboard')} className="text-gray-600 hover:text-sky-600 font-medium">Dashboard</button>
                    <button onClick={() => setPage('progress')} className="text-gray-600 hover:text-sky-600 font-medium">Progress</button>
                    <button onClick={() => setPage('learn')} className="text-gray-600 hover:text-sky-600 font-medium">Learn</button>
                    <div className="flex items-center space-x-2 text-gray-700">
                        <User className="w-5 h-5" />
                        <span>{user?.name || 'User'}</span>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="flex items-center text-sm px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                    >
                        <LogOut className="w-4 h-4 mr-1" /> Logout
                    </button>
                </div>
            </div>
        </nav>
    );
};

// --- UPLOAD RESUME (FIXED) ---
const UploadResume = ({ onResumeParsed }) => {
    const [file, setFile] = useState(null);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef(null); // Use 'useRef' directly

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const allowed = ['pdf', 'docx'];
            const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
            if (allowed.includes(fileExtension)) {
                setFile(selectedFile);
                setMessage('');
            } else {
                setFile(null);
                setMessage('Only PDF and DOCX files are allowed.');
            }
        }
    };
    
    const handleParseSaveResume = async () => {
        if (!file) {
            setMessage('Please select a file to upload.');
            return;
        }

        setIsLoading(true);
        setMessage('Uploading and parsing resume...'); 
        
        const token = getToken();
        if (!token) {
            setMessage('Authentication token not found. Please log in.');
            setIsLoading(false);
            return;
        }

        const formData = new FormData();
        formData.append('resume', file);

        try {
            const response = await fetch(`${BASE_URL}/api/upload-resume`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setMessage('Resume successfully parsed and saved!');
                // Pass the backend's *actual* response to the parent
                onResumeParsed(data); 
            } else {
                setMessage(`Failed to upload resume: ${data.error || 'Unknown server error.'}`);
            }
        } catch (error) {
            console.error('Upload Error:', error);
            setMessage('Network error: Could not connect to the server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <UploadCloud className="w-6 h-6 mr-2 text-sky-500" /> Upload Resume
            </h3>
            <p className="text-gray-600 mb-4 text-sm">Upload your **PDF or DOCX** resume to personalize your interview experience.</p>
            
            <div className="space-y-4">
                <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-sky-500 transition duration-150"
                    onClick={() => fileInputRef.current.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,.docx"
                        className="hidden"
                    />
                    <UploadCloud className="w-8 h-8 text-sky-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">
                        {file ? file.name : 'Click to select a PDF or DOCX file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Max 5MB. Only .pdf and .docx allowed.</p>
                </div>

                <button
                    onClick={handleParseSaveResume}
                    disabled={isLoading || !file}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-md text-base font-medium text-white bg-green-500 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-200 disabled:opacity-50"
                >
                    {isLoading ? <Loader className="animate-spin h-5 w-5 mr-3" /> : 'Parse and Save Resume'}
                </button>
            </div>
            
            {message && (
                <div className={`mt-4 p-3 rounded-lg text-sm ${message.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message}
                </div>
            )}
        </div>
    );
};

// --- RESUME PREVIEW (FIXED) ---
const ResumePreview = ({ jobTitle, parsedData, onStartInterview }) => {
    const hasData = parsedData && (parsedData.skills || parsedData.projects || parsedData.experience);

    const displayData = {
        Skills: parsedData?.skills || [],
        Projects: parsedData?.projects || [],
        Experience: parsedData?.experience || []
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 h-full flex flex-col">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <Briefcase className="w-6 h-6 mr-2 text-sky-500" />
                Role: <span className="ml-2 font-bold text-sky-600">{jobTitle || 'N/A'}</span>
            </h3>

            {hasData ? (
                <div className="flex-grow overflow-y-auto pr-2 space-y-4 text-sm text-gray-700 custom-scrollbar">
                    {Object.entries(displayData).map(([key, value]) => {
                        if (Array.isArray(value) && value.length > 0) {
                            return (
                                <div key={key} className="p-3 bg-gray-50 rounded-lg">
                                    <h4 className="font-bold text-md mb-1 border-b border-sky-200 text-sky-700">{key} ({value.length})</h4>
                                    <ul className="list-disc ml-5 space-y-1">
                                        {value.map((item, index) => (
                                            <li key={index} className="text-gray-700 break-words">{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        }
                        return null;
                    })}
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center">
                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg text-center">
                        <Info className="w-5 h-5 mr-2 inline" />
                        <p className="font-semibold">No Resume Data Found</p>
                        <p className="text-sm mt-1">Please upload your resume to see the parsed results here.</p>
                    </div>
                </div>
            )}
            
            <button
                onClick={onStartInterview}
                disabled={!hasData || !jobTitle}
                className="mt-4 w-full flex items-center justify-center py-3 px-4 rounded-lg shadow-xl text-lg font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <PlayCircle className="w-6 h-6 mr-2" /> Start Personalized Interview
            </button>
        </div>
    );
};

// --- DASHBOARD (FIXED) ---
const Dashboard = ({ setPage, onStartInterview }) => {
    const [resumeData, setResumeData] = useState(null); 
    const [jobTitle, setJobTitle] = useState(''); 
    const [message, setMessage] = useState('');
    const { user } = useAuth();

    const handleStartClick = () => {
        if (!resumeData) {
            setMessage('Please upload a resume first.');
            return;
        }
        if (!jobTitle) {
            setMessage('Please enter a target job title.');
            return;
        }
        onStartInterview(jobTitle);
    };

    const handleResumeParsed = (data) => {
        setResumeData(data);
        setMessage(''); 
    };
    
    return (
        <div className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-120px)]">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-8">
                Welcome back, <span className="text-sky-600">{user?.name || 'User'}</span>!
            </h1>
            
            {message && (
                <div className={`mb-4 p-3 rounded-lg text-sm bg-red-100 text-red-800`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                {/* Left Column: Upload & Job Title */}
                <div className="lg:col-span-1 space-y-6">
                    <UploadResume onResumeParsed={handleResumeParsed} />

                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h3 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <Briefcase className="w-6 h-6 mr-2 text-sky-500" /> Target Role
                        </h3>
                        <p className="text-gray-600 mb-4 text-sm">Specify the job title you are targeting. This will be used to generate role-specific questions.</p>
                        <div>
                            <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 mb-1">Target Job Title</label>
                            <input
                                id="jobTitle"
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder="e.g., Data Scientist"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500"
                                required
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview and Start */}
                <div className="lg:col-span-1 min-h-[500px] flex flex-col">
                    <ResumePreview 
                        jobTitle={jobTitle} 
                        parsedData={resumeData} 
                        onStartInterview={handleStartClick} 
                    />
                </div>
            </div>
        </div>
    );
};


const InterviewPage = ({ setPage, interviewSession, endInterviewSession }) => {
    
    const [session, setSession] = useState(interviewSession);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');

    // --- NEW: STT States ---
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef(null); // To hold the SpeechRecognition instance

    // --- NEW: TTS States ---
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef(null); // To hold the SpeechSynthesisUtterance instance
    const synthRef = useRef(window.speechSynthesis); // Hold the synthesis engine

    // --- Existing Logic ---
    const currentQuestionIndex = session.current_question_index;
    const currentQuestion = session.questions[currentQuestionIndex];

    // --- NEW: TTS Effect - Speak Question on Load ---
    useEffect(() => {
        // Automatically speak the question when it changes
        if (currentQuestion?.text) {
            handleSpeakQuestion(currentQuestion.text);
        }
        // Cleanup function to stop speaking if component unmounts or question changes
        return () => {
            if (synthRef.current && synthRef.current.speaking) {
                synthRef.current.cancel();
                setIsSpeaking(false);
            }
        };
    }, [currentQuestionIndex]); // Rerun when the question changes

    // --- NEW: STT Initialization ---
    useEffect(() => {
        // Check if browser supports SpeechRecognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Browser doesn't support Speech Recognition.");
            setMessage("Your browser doesn't support voice input.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening even after pauses
        recognition.interimResults = true; // Get results as they come in
        recognition.lang = 'en-US'; // Set language

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Update the text area with the final transcript, adding to existing text
            // Or replace interim results if needed
            setCurrentAnswer(prev => prev + finalTranscript); 
            // You could also display interimTranscript somewhere if you want live feedback
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setMessage(`Speech recognition error: ${event.error}`);
            setIsRecording(false);
        };

        recognition.onend = () => {
            // Only set isRecording to false if it wasn't manually stopped
            // This allows continuous listening until stop button is pressed
            // For true continuous, you might need to restart it here, but let's keep it simple
             if (recognitionRef.current) { // Check if it still exists (might be stopped manually)
                 setIsRecording(false);
                 console.log("Speech recognition ended.");
             }
        };

        recognitionRef.current = recognition;

        // Cleanup: Stop recognition if component unmounts
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null; // Clean up ref
            }
        };
    }, []); // Run only once on mount

    // --- NEW: STT Control Functions ---
    const handleToggleRecording = () => {
        if (!recognitionRef.current) {
            setMessage("Speech recognition not available.");
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
            console.log("Stopped recording manually.");
        } else {
            // Clear the answer area before starting a new recording? Optional.
            // setCurrentAnswer(''); 
            recognitionRef.current.start();
            setIsRecording(true);
            setMessage("Listening... Click the mic again to stop.");
            console.log("Started recording.");
        }
    };

    // --- NEW: TTS Control Function ---
    const handleSpeakQuestion = (textToSpeak) => {
        if (!synthRef.current || !textToSpeak) return;

        // If already speaking, stop the current one first
        if (synthRef.current.speaking) {
            synthRef.current.cancel();
        }

        utteranceRef.current = new SpeechSynthesisUtterance(textToSpeak);
        utteranceRef.current.lang = 'en-US';
        utteranceRef.current.rate = 0.9; // Slightly slower can be clearer
        
        utteranceRef.current.onstart = () => setIsSpeaking(true);
        utteranceRef.current.onend = () => setIsSpeaking(false);
        utteranceRef.current.onerror = (e) => {
             console.error("Speech synthesis error:", e);
             setIsSpeaking(false);
        };

        synthRef.current.speak(utteranceRef.current);
    };

    const handleStopSpeaking = () => {
        if (synthRef.current && synthRef.current.speaking) {
            synthRef.current.cancel();
            setIsSpeaking(false);
        }
    };


    // --- Existing Submission Logic (No changes needed here) ---
    const handleSubmitAnswer = async () => {
        // ... (Keep this exactly as it was) ...
         if (!currentAnswer.trim()) {
            setMessage('Please provide an answer before submitting.');
            return;
        }
        // Stop recording if active before submitting
        if (isRecording && recognitionRef.current) {
             recognitionRef.current.stop();
             setIsRecording(false);
        }
        // Stop speaking if active
        handleStopSpeaking(); 

        setIsSubmitting(true);
        setMessage('');
        const token = getToken();

        try {
            const response = await fetch(`${BASE_URL}/api/submit-answer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ 
                    session_id: session.session_id, 
                    question_id: currentQuestion.id,
                    answer_text: currentAnswer.trim()
                }),
            });

            const data = await response.json();

            if (response.ok) {
                const nextIndex = currentQuestionIndex + 1;
                
                if (nextIndex >= session.questions.length) {
                    setMessage('Interview finished! Generating feedback...');
                    endInterviewSession(session.session_id);
                } else {
                    setSession(prev => ({ 
                        ...prev, 
                        current_question_index: nextIndex 
                    }));
                    setCurrentAnswer(''); // Clear answer for next question
                    // Message removed, TTS will announce next question
                }
            } else {
                setMessage(`Failed to submit answer: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Submission Error:', error);
            setMessage('Network error: Could not submit answer to the server.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Existing Force End Logic ---
    const handleForceEnd = () => {
        // Stop any active recording or speaking
        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
        handleStopSpeaking();
        endInterviewSession(session.session_id);
    }

    // --- Existing Loading/Error State ---
    if (!currentQuestion) {
        // ... (Keep this as it was) ...
          return (
            <div className="flex items-center justify-center h-full p-8 text-red-600">
                <XCircle className="w-8 h-8 mr-3" />
                <p>Error: Could not load the current question.</p>
            </div>
        );
    }

    // --- UPDATED RENDER ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            {/* --- Header (No changes) --- */}
             <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                    <Briefcase className="w-7 h-7 mr-2 text-sky-600" /> AI Interview: {session.job_title}
                </h1>
                <button 
                    onClick={handleForceEnd}
                    className="flex items-center text-sm px-4 py-2 bg-red-100 text-red-600 border border-red-300 rounded-lg hover:bg-red-200 transition duration-150"
                >
                    <XCircle className="w-4 h-4 mr-1" /> End Interview Now
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* --- Left Panel: Question and Answer (UPDATED) --- */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-xl space-y-6">
                    <div className="text-lg font-medium text-sky-700">
                        Question {currentQuestionIndex + 1} of {session.questions.length}:
                    </div>

                    {/* --- Current Question with TTS Button --- */}
                    <div className="bg-sky-50 border-l-4 border-sky-500 p-4 rounded-r-lg flex items-start justify-between">
                        <p className="text-2xl font-semibold text-gray-800 mr-4">
                            {currentQuestion.text}
                        </p>
                        {/* TTS Play/Stop Button */}
                        <button 
                            onClick={() => isSpeaking ? handleStopSpeaking() : handleSpeakQuestion(currentQuestion.text)}
                            className={`p-2 rounded-full transition duration-150 ${isSpeaking ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-sky-100 text-sky-600 hover:bg-sky-200'}`}
                            title={isSpeaking ? "Stop Speaking" : "Read Question Aloud"}
                        >
                            {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* --- Answer Area with STT Button --- */}
                    <div>
                        <label htmlFor="answer" className="block text-lg font-medium text-gray-700 mb-2">Your Answer</label>
                        <div className="relative"> {/* Added relative positioning */}
                             <textarea
                                id="answer"
                                rows="10"
                                value={currentAnswer}
                                onChange={(e) => setCurrentAnswer(e.target.value)}
                                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500 text-base pr-12" // Added padding-right
                                placeholder="Type or record your answer here..."
                            />
                            {/* STT Record/Stop Button */}
                            <button 
                                onClick={handleToggleRecording}
                                className={`absolute top-3 right-3 p-2 rounded-full transition duration-150 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-sky-500 text-white hover:bg-sky-600'}`}
                                title={isRecording ? "Stop Recording" : "Record Answer"}
                                disabled={!recognitionRef.current} // Disable if STT not supported
                            >
                                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* --- Submit Button (No changes) --- */}
                    <button
                        onClick={handleSubmitAnswer}
                        disabled={isSubmitting || !currentAnswer.trim()}
                        className="w-full flex items-center justify-center py-3 px-4 rounded-lg shadow-md text-lg font-medium text-white bg-sky-600 hover:bg-sky-700 transition duration-200 disabled:opacity-50"
                    >
                         {isSubmitting ? (
                            <Loader className="animate-spin h-5 w-5 mr-3" />
                        ) : (
                            <Send className="w-5 h-5 mr-2" />
                        )}
                        Submit Answer
                    </button>

                    {/* --- Message Area (No changes) --- */}
                    {message && (
                        <div className={`mt-4 p-3 rounded-lg text-sm ${message.includes('success') || message.includes('Listening') ? 'bg-blue-100 text-blue-800' : message.includes('finish') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {message}
                        </div>
                    )}
                </div>

                {/* --- Right Panel: Progress (No changes) --- */}
                <div className="lg:col-span-1 bg-gray-50 p-6 rounded-xl shadow-lg h-fit">
                    {/* ... (Keep this exactly as it was) ... */}
                     <h3 className="text-xl font-semibold text-gray-800 mb-4">Interview Progress</h3>
                    <ul className="space-y-2">
                        {session.questions.map((q, index) => (
                            <li key={q.id} className="flex items-center">
                                {index < currentQuestionIndex ? (
                                    <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                                ) : index === currentQuestionIndex ? (
                                    <PlayCircle className="w-5 h-5 mr-2 text-sky-500 animate-pulse" />
                                ) : (
                                    <History className="w-5 h-5 mr-2 text-gray-400" />
                                )}
                                <span className={`font-medium ${index === currentQuestionIndex ? 'text-sky-600' : index < currentQuestionIndex ? 'text-gray-500 line-through' : 'text-gray-600'}`}>
                                    Question {index + 1}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};


// --- FEEDBACK PAGE (FIXED) ---
const FeedbackPage = ({ sessionId, jobRole, setPage }) => {
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!sessionId) {
            setError("No session ID found. Cannot load feedback.");
            setLoading(false);
            return;
        }

        const getFeedback = async () => {
            const token = getToken();
            if (!token) {
                setError("Authentication error. Please log in again.");
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await fetch(`${BASE_URL}/api/end-interview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ session_id: sessionId })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch feedback.');
                }
                
                setFeedback(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        getFeedback();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh]">
                <Loader className="w-16 h-16 animate-spin text-sky-600" />
                <p className="text-lg text-gray-700 mt-4">Analyzing your answers and generating feedback...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4 text-center">
                <XCircle className="w-16 h-16 text-red-500" />
                <p className="text-lg text-red-700 mt-4">Error: {error}</p>
                <button
                    onClick={() => setPage('dashboard')}
                    className="mt-6 py-2 px-4 rounded-lg text-white bg-sky-600 hover:bg-sky-700"
                >
                    Back to Dashboard
                </button>
            </div>
        );
    }
    
    if (!feedback) return null;

    const { 
        technical_score, 
        communication_score, 
        hr_score,
        strengths, 
        areas_for_improvement, 
        detailed_feedback 
    } = feedback;

    const techPercent = (technical_score / 5) * 100;
    const commPercent = (communication_score / 5) * 100;
    const hrPercent = (hr_score / 5) * 100;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center">
                <CheckCircle className="w-8 h-8 mr-2 text-green-600" /> Interview Feedback
            </h1>
            <p className="text-xl text-gray-600 mb-8">Role: <span className="font-bold text-sky-600">{jobRole}</span></p>

            <div className="bg-white p-6 rounded-xl shadow-2xl border-t-4 border-green-500 mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">Overall Performance Summary</h2>
                <p className="text-lg text-gray-700 leading-relaxed mb-2">
                    <strong>Strengths:</strong> {strengths || "No specific strengths identified."}
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                    <strong>Areas for Improvement:</strong> {areas_for_improvement || "No specific areas for improvement identified."}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Detailed Score Breakdown (Out of 5)</h3>
                        
                        <ScoreBar title="Technical Depth" score={technical_score} percent={techPercent} />
                        <ScoreBar title="Communication Clarity" score={communication_score} percent={commPercent} />
                        <ScoreBar title="HR & Behavioral" score={hr_score} percent={hrPercent} />
                        
                        <div className="mt-6 text-sm text-gray-500 italic">Scores are generated by an AI model and should be used for guidance only.</div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <Info className="w-5 h-5 mr-2 text-sky-500" /> Actionable Recommendations
                        </h3>
                        <ul className="space-y-3">
                            {detailed_feedback && detailed_feedback.length > 0 ? (
                                detailed_feedback.map((rec, index) => (
                                    <li key={index} className="flex items-start text-gray-700">
                                        <CheckCircle className="w-5 h-5 mt-1 mr-3 text-green-500 flex-shrink-0" />
                                        <p>{rec}</p>
                                    </li>
                                ))
                            ) : (
                                <p className="text-gray-500">No detailed recommendations available.</p>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="lg:col-span-1 bg-sky-50 p-6 rounded-xl shadow-lg border border-sky-200 h-fit">
                    <h3 className="text-xl font-bold text-sky-800 mb-4">What's Next?</h3>
                    <div className="space-y-4">
                        <button
                            onClick={() => setPage('dashboard')}
                            className="w-full flex items-center justify-center py-3 px-4 rounded-lg shadow-md text-base font-medium text-white bg-sky-600 hover:bg-sky-700 transition duration-200"
                        >
                            <ArrowLeft className="w-5 h-5 mr-2" /> Start a New Interview
                        </button>
                        <button
                            onClick={() => setPage('progress')}
                            className="w-full flex items-center justify-center py-3 px-4 rounded-lg shadow-md text-base font-medium text-sky-800 bg-sky-200 hover:bg-sky-300 transition duration-200"
                        >
                            <BarChart className="w-5 h-5 mr-2" /> View Overall Progress
                        </button>
                        <button
                            onClick={() => setPage('learn')}
                            className="w-full flex items-center justify-center py-3 px-4 rounded-lg shadow-md text-base font-medium text-green-800 bg-green-200 hover:bg-green-300 transition duration-200"
                        >
                            <Info className="w-5 h-5 mr-2" /> Focus on Learning
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProgressPage = ({ setPage }) => {
    const [progressData, setProgressData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null); // Clear previous errors
                const token = getToken();
                if (!token) throw new Error('Authentication token not found.');

                const response = await fetch(`${BASE_URL}/api/progress-data`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                // Ensure data is sorted by date ascending for the chart
                const sortedData = (data.progress_history || []).sort((a, b) => new Date(a.attempt_date) - new Date(b.attempt_date));
                setProgressData(sortedData);

            } catch (err) {
                console.error("Failed to fetch progress data:", err);
                setError(err.message || "An unexpected error occurred.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []); // Fetch only once on mount

    // Prepare data for the chart
    const chartData = useMemo(() => {
        return progressData.map((item, index) => ({
            // Use index or formatted date for X-axis label
            name: `Attempt ${index + 1} (${new Date(item.attempt_date).toLocaleDateString('en-CA')})`,
            // Ensure score is a number
            score: parseFloat(item.overall_score) || 0,
            role: item.role
        }));
    }, [progressData]);

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-8 flex items-center">
                <BarChart className="w-8 h-8 mr-2 text-sky-600" /> Your Progress Over Time
            </h1>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <Loader className="animate-spin w-12 h-12 text-sky-500" />
                    <p className="ml-4 text-lg text-gray-600">Loading progress history...</p>
                </div>
            )}

            {/* Error State */}
            {!loading && error && (
                 <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg text-center">
                    <XCircle className="w-6 h-6 mr-2 inline" />
                    <p className="font-semibold">Failed to load progress data:</p>
                    <p className="text-sm mt-1">{error}</p>
                 </div>
            )}

            {/* Success State - Data Loaded */}
            {!loading && !error && progressData.length === 0 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg text-center">
                    <Info className="w-6 h-6 mr-2 inline" />
                    <p className="font-semibold">No interview attempts found.</p>
                    <p className="text-sm mt-1">Complete an interview on the dashboard to see your progress here.</p>
                 </div>
            )}

            {!loading && !error && progressData.length > 0 && (
                <div className="grid grid-cols-1 gap-8">
                    {/* Chart Section */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overall Score Trend</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                                data={chartData}
                                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis 
                                    dataKey="name" 
                                    angle={-15} // Angle labels slightly if too long
                                    textAnchor="end"
                                    height={50} // Increase height for angled labels
                                    fontSize={10} // Smaller font size
                                    interval={0} // Show all labels initially (adjust if too crowded)
                                />
                                <YAxis domain={[0, 5]} label={{ value: 'Overall Score (Out of 5)', angle: -90, position: 'insideLeft', offset: 10 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '8px', boxShadow: '2px 2px 10px rgba(0,0,0,0.1)' }} 
                                    formatter={(value, name, props) => [`Score: ${value.toFixed(1)}/5`, `Role: ${props.payload.role}`]}
                                    labelFormatter={(label) => label.split(' (')[0]} // Show "Attempt X" in tooltip title
                                />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="score" 
                                    stroke="#0284c7" // Sky blue color
                                    strokeWidth={2} 
                                    activeDot={{ r: 8, fill: '#0284c7' }} 
                                    dot={{ stroke: '#0284c7', strokeWidth: 1, r: 4, fill: '#ffffff' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Table Section */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 overflow-x-auto">
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Interview History</h2>
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role Attempted</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Score</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {/* Display latest attempts first in the table */}
                                {[...progressData].reverse().map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {new Date(item.attempt_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.role}</td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${parseFloat(item.overall_score) >= 4 ? 'text-green-600' : parseFloat(item.overall_score) >= 2.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                                            {/* Ensure score is displayed with one decimal place */}
                                            {parseFloat(item.overall_score).toFixed(1)} / 5
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
// --- LEARN PAGE (WITH ROLE SELECTION) ---

const Learn = ({ setPage }) => {
    const [resources, setResources] = useState([]);
    const [loadingResources, setLoadingResources] = useState(true); // Renamed for clarity
    const [loadingRoles, setLoadingRoles] = useState(true); // Loading state for roles
    const [error, setError] = useState(null);

    // State for selected role - Initialize from localStorage or default
    const [selectedRole, setSelectedRole] = useState(
        localStorage.getItem('lastSelectedLearnRole') || 'Software Developer' // Keep a sensible default
    );

    // --- NEW: State for available roles (fetched from backend) ---
    const [availableRoles, setAvailableRoles] = useState([]);

    // --- NEW: useEffect to fetch available roles on mount ---
    useEffect(() => {
        const fetchRoles = async () => {
            const token = getToken();
            if (!token) {
                setError("Not authenticated."); // Set error for roles loading
                setLoadingRoles(false);
                setLoadingResources(false); // Stop resource loading too
                return;
            }
            try {
                setLoadingRoles(true);
                setError(null);
                const response = await fetch(`${BASE_URL}/api/learn-roles`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setAvailableRoles(data.roles || []); // Set the fetched roles

                // Ensure the currently selected role exists in the fetched list,
                // otherwise reset to the first available role or the default.
                if (data.roles && data.roles.length > 0 && !data.roles.includes(selectedRole)) {
                    setSelectedRole(data.roles[0]); // Select the first role from the fetched list
                    localStorage.setItem('lastSelectedLearnRole', data.roles[0]); // Update localStorage
                } else if (data.roles && data.roles.length === 0) {
                     // Handle case where no roles are returned
                     setError("No roles found in the learning section.");
                }

            } catch (err) {
                console.error("Failed to fetch learn roles:", err);
                setError(err.message || "Failed to load roles.");
                setAvailableRoles(['Software Developer', 'Data Scientist', 'General Tech']); // Fallback roles on error
            } finally {
                setLoadingRoles(false);
            }
        };
        fetchRoles();
    }, []); // Run only once on mount to get the roles list

    // --- UPDATED: useEffect to fetch resources (depends on selectedRole) ---
    useEffect(() => {
        // Don't fetch resources until roles are loaded and a role is selected
        if (loadingRoles || !selectedRole) {
            setLoadingResources(false); // Ensure loading stops if prerequisites aren't met
            return;
        }

        const fetchLearnData = async () => {
            const token = getToken();
            if (!token) {
                setError("Not authenticated.");
                setLoadingResources(false);
                return;
            }
            try {
                setLoadingResources(true);
                setError(null); // Clear previous resource-specific errors
                const response = await fetch(`${BASE_URL}/api/learn-data?role=${encodeURIComponent(selectedRole)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                     const errorData = await response.json();
                     // Keep existing roles, just show error for resources
                     throw new Error(errorData.error || `HTTP error fetching resources! status: ${response.status}`);
                }
                const data = await response.json();
                setResources(data.learn_resources || []);

                // Save the selected role for next time only after successful resource fetch
                localStorage.setItem('lastSelectedLearnRole', selectedRole);

            } catch (err) {
                 console.error("Failed to fetch learn data:", err);
                 setError(err.message || "An unexpected error occurred while fetching resources.");
                 setResources([]); // Clear resources on error
            } finally {
                setLoadingResources(false);
            }
        };
        fetchLearnData();
    }, [selectedRole, loadingRoles]); // Re-run when selectedRole changes OR after roles finish loading

    // Handler for dropdown change
    const handleRoleChange = (event) => {
        setSelectedRole(event.target.value);
    };

    // --- UPDATED RENDER ---
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-8">
                 <h1 className="text-4xl font-extrabold text-gray-900 mb-2 flex items-center">
                    <BookOpen className="w-8 h-8 mr-2 text-green-600" /> Learn & Prepare
                 </h1>
                 {/* --- Role Selection Dropdown (Now dynamic) --- */}
                 <div className="flex items-center space-x-2 mt-4 md:mt-0">
                     <Filter className="w-5 h-5 text-gray-500" />
                     <label htmlFor="roleSelect" className="text-sm font-medium text-gray-700">Filter by Role:</label>
                     <select
                         id="roleSelect"
                         value={selectedRole}
                         onChange={handleRoleChange}
                         // Disable dropdown while roles are loading
                         disabled={loadingRoles || availableRoles.length === 0}
                         className="block w-full md:w-auto pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md shadow-sm disabled:opacity-50 disabled:bg-gray-100"
                     >
                        {/* Option shown while loading roles */}
                        {loadingRoles && <option>Loading roles...</option>}

                        {/* Options populated from fetched roles */}
                        {!loadingRoles && availableRoles.length > 0 && availableRoles.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}

                         {/* Message shown if loading failed or no roles found */}
                         {!loadingRoles && availableRoles.length === 0 && <option>No roles available</option>}
                     </select>
                 </div>
            </div>

            {/* Combined Loading State for Resources */}
            {loadingResources && (
                 <div className="flex items-center justify-center min-h-[300px]">
                    <Loader className="animate-spin w-12 h-12 text-green-500" />
                    <p className="ml-4 text-lg text-gray-600">Loading resources for {selectedRole}...</p>
                </div>
            )}

            {/* Error State (Handles both role and resource errors) */}
            {error && !loadingResources && ( // Show error only when not actively loading resources
                 <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg text-center">
                    <XCircle className="w-6 h-6 mr-2 inline" />
                    <p className="font-semibold">Error:</p>
                    <p className="text-sm mt-1">{error}</p>
                 </div>
            )}

            {/* Success State - No Resources Found for selected role */}
            {!loadingResources && !error && resources.length === 0 && availableRoles.length > 0 && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-lg text-center">
                    <Info className="w-6 h-6 mr-2 inline" />
                    <p className="font-semibold">No learning resources found for "{selectedRole}".</p>
                    <p className="text-sm mt-1">Try selecting a different role, or add resources for this role to the database.</p>
                 </div>
            )}

             {/* Success State - Resources Loaded and Displayed */}
            {!loadingResources && !error && resources.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {resources.map((resource, index) => (
                        <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 flex flex-col justify-between hover:shadow-xl transition-shadow duration-200">
                           <div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">{resource.skill}</h3>
                                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{resource.description || "No description available."}</p>
                           </div>
                           {resource.resource_link && (
                                <a
                                    href={resource.resource_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center mt-auto px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                    Learn More <ExternalLink className="w-4 h-4 ml-2" />
                                </a>
                           )}
                           {!resource.resource_link && (
                               <p className="mt-auto text-xs text-gray-400 italic">No link available</p>
                           )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
// =========================================================================
// 4. MAIN APP COMPONENT (FIXED)
// =========================================================================
const App = () => {
    const { isAuthenticated, isLoading, logout } = useAuth();
    const [page, setPage] = useState('auth');
    const [interviewSession, setInterviewSession] = useState(null);
    const [currentJobRole, setCurrentJobRole] = useState(''); // To pass to feedback page

    useEffect(() => {
        if (!isLoading) {
            setPage(isAuthenticated ? 'dashboard' : 'auth');
        }
    }, [isAuthenticated, isLoading]);

    const handleLogout = () => {
        logout();
        setPage('auth');
    };

    // Called from Dashboard
    const startNewInterview = async (jobTitle) => {
        const token = getToken();
        try {
            const response = await fetch(`${BASE_URL}/api/start-interview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ job_role: jobTitle })
            });

            const data = await response.json();
            if (response.ok) {
                setInterviewSession({
                    session_id: data.session_id,
                    questions: data.questions,
                    current_question_index: 0,
                    job_title: jobTitle
                });
                setCurrentJobRole(jobTitle); // Save job role
                setPage('interview');
            } else {
                alert(`Error: ${data.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        }
    };

    // Called from InterviewPage
    const endInterviewSession = (sessionId) => {
        // We just need to move to the feedback page.
        // The feedback page will use the sessionId to fetch its own data.
        setInterviewSession(prev => ({ ...prev, session_id: sessionId }));
        setPage('feedback');
    };

    // --- Page Content Renderer ---
    const PageContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center min-h-screen"><Loader className="animate-spin w-8 h-8" /></div>;
        }

        switch (page) {
            case 'auth':
                return <AuthPage setPage={setPage} />;
            case 'dashboard':
                // THIS IS THE LINE THAT WAS FIXED
                return <Dashboard setPage={setPage} onStartInterview={startNewInterview} />;
            case 'interview':
                return <InterviewPage 
                            setPage={setPage} 
                            interviewSession={interviewSession} 
                            endInterviewSession={endInterviewSession} 
                        />;
            case 'feedback':
                return <FeedbackPage 
                            sessionId={interviewSession?.session_id} 
                            jobRole={currentJobRole} 
                            setPage={setPage} 
                        />;
            case 'progress':
                return <ProgressPage setPage={setPage} />;
            case 'learn':
                return <Learn setPage={setPage} />;
            default:
                return <AuthPage setPage={setPage} />;
        }
    };

    return (
        <div className="min-h-screen font-sans bg-gray-50 flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>
            {isAuthenticated && page !== 'auth' && (
                <Navbar 
                    setPage={setPage} 
                    handleLogout={handleLogout} 
                />
            )}
            <main className="flex-grow">
                <PageContent />
            </main>
            {!isAuthenticated && page === 'auth' ? null : (
                <footer className="bg-gray-800 text-white p-4 text-center text-sm">
                    © 2024 AI Interview Prep. All Rights Reserved.
                </footer> 
            )}
        </div>
    );
};

// --- SCORE BAR HELPER (Was at the very end) ---
const ScoreBar = ({ title, score, percent }) => {
    const getBarColor = () => {
        if (percent >= 80) return 'bg-green-500';
        if (percent >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };
    
    const getTextColor = () => {
        if (percent >= 80) return 'text-green-600';
        if (percent >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-gray-700">{title}</span>
                <span className={`font-bold text-lg ${getTextColor()}`}>
                    {Number(score).toFixed(1)} / 5
                </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                    className={`h-2.5 rounded-full ${getBarColor()}`} 
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    );
};

// --- Main Export ---
// We wrap the entire App in the AuthProvider
const RootApp = () => (
    <AuthProvider>
        <App />
    </AuthProvider>
);

export default RootApp;