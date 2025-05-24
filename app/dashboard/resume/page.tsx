"use client";
import React, { useState, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfToText from "react-pdftotext";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Suggestion = {
  id: string;
  original: string;
  suggestion: string;
  accepted?: boolean;
};

interface ParsedContent {
  text: string;
  type: "regular" | "highlight";
  suggestionId?: string;
}

type Section = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  content: string;
  startDate?: string;
  endDate?: string;
  location?: string;
};

type ScoreCriteria = {
  name: string;
  score: number;
  feedback: string;
  improvements: string[];
};

type ResumeScore = {
  overallScore: number;
  criteria: ScoreCriteria[];
};

type Resume = {
  contact: {
    name: string;
    email: string;
    phone: string;
    location: string;
  };
  sections: Section[];
};

const Resume = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [parsedContent, setParsedContent] = useState<ParsedContent[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>(
    {}
  );
  const [view, setView] = useState<"upload" | "analysis" | "builder">("upload");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [resume, setResume] = useState<Resume>({
    contact: { name: "", email: "", phone: "", location: "" },
    sections: [],
  });
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null
  );
  const resumeRef = useRef<HTMLDivElement>(null);
  const [resumeScore, setResumeScore] = useState<ResumeScore | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  const views = {
    upload: "Upload Resume",
    builder: "Resume Builder",
    analysis: "AI Analysis",
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setPdfFile(file);
        setFileError("");
        // Clear previous analysis results and score when new file is selected
        setAnalysisResult("");
        setParsedContent([]);
        setSuggestions({});
        setResumeScore(null);
        setSelectedSuggestion(null);
      } else {
        setFileError("Please upload a PDF file");
        setPdfFile(null);
      }
    }
  };

  const readPDFContent = async (file: File): Promise<string> => {
    try {
      const text = await pdfToText(file);
      if (!text.trim()) {
        throw new Error("No text content found in PDF");
      }
      return text;
    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new Error("Failed to extract text from PDF. Please try again.");
    }
  };

  const parseModelResponse = (response: string) => {
    const parts: ParsedContent[] = [];
    const newSuggestions: Record<string, Suggestion> = {};
    let currentIndex = 0;

    // Updated regex to handle multiline content and nested brackets
    const regex = /\[([\s\S]*?)\]{([\s\S]*?)}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(response)) !== null) {
      // Add text before the match, preserving whitespace
      if (match.index > lastIndex) {
        const beforeText = response.slice(lastIndex, match.index);
        if (beforeText) {
          parts.push({
            text: beforeText,
            type: "regular",
          });
        }
      }

      const original = match[1].trim();
      const suggestion = match[2].trim();

      if (original && suggestion) {
        const suggestionId = `suggestion-${currentIndex++}`;
        newSuggestions[suggestionId] = {
          id: suggestionId,
          original,
          suggestion,
        };

        parts.push({
          text: original,
          type: "highlight",
          suggestionId,
        });
      }

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < response.length) {
      const remainingText = response.slice(lastIndex);
      if (remainingText) {
        parts.push({
          text: remainingText,
          type: "regular",
        });
      }
    }

    setParsedContent(parts);
    setSuggestions(newSuggestions);
  };

  const handleSuggestion = (suggestionId: string, accept: boolean) => {
    const suggestion = suggestions[suggestionId];
    const newSuggestions = { ...suggestions };
    newSuggestions[suggestionId] = { ...suggestion, accepted: accept };
    setSuggestions(newSuggestions);
  };

  const resetAnalysis = () => {
    setPdfFile(null);
    setFileError("");
    setAnalysisResult("");
    setParsedContent([]);
    setSuggestions({});
    setView("upload");
  };

  const analyzePDF = async () => {
    if (!pdfFile) return;

    try {
      setIsAnalyzing(true);
      setAnalysisResult("");
      // Clear previous score when starting new analysis
      setResumeScore(null);

      // Extract text content from PDF
      const pdfContent = await readPDFContent(pdfFile);

      const genAI = new GoogleGenerativeAI(
        process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
      );
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const prompt = `You are an expert resume editor. Review the entire resume and improve its professionalism, clarity, impact, and formatting, focusing on actionable improvements. When you replace text, wrap the original in [ ] and your improved replacement (phrase, sentence or multi-sentence) in { }. Examples:

• I [worked as a software engineer]{Served as a Software Engineer} at Google.
• [Objective: I am seeking a position…]{Objective: Strategic Art Administration professional with hands-on gallery experience and strong organizational skills.}

Guidelines:
1. Focus on high-impact revisions; avoid over-annotation.
2. Suggestions should be concise phrases or full sentences/paragraphs, as needed to convey a stronger, more professional alternative.
3. Use strong action verbs, quantify achievements with metrics, and ensure consistent formatting (dates, headings, bullet points).
4. Identify and correct vague language, clichés, and generic statements.
5. Flag or replace placeholders like [Year] with either actual dates or a clear prompt (e.g., "[complete date]").
6. Preserve key industry terms (e.g., "Art Administration," "Adobe Photoshop").
7. Prioritize clarity, conciseness, and impact in all suggestions.
8. Maintain a professional and sophisticated tone.
9. Return only the resume text with inline [original]{suggestion} edits—no extra commentary.`;

      const result = await model.generateContent([prompt, pdfContent]);

      const response = await result.response;
      setAnalysisResult(response.text());
      parseModelResponse(response.text());
      setView("analysis");

      // Automatically analyze resume score after text analysis
      await analyzeResumeScore(pdfContent);
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      setFileError(
        error instanceof Error
          ? `Error analyzing PDF: ${error.message}`
          : "Error analyzing PDF. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddSection = () => {
    setResume((prev) => ({
      ...prev,
      sections: [
        ...prev.sections,
        {
          id: `section-${Date.now()}`,
          type: "experience",
          title: "",
          subtitle: "",
          content: "",
          startDate: "",
          endDate: "",
          location: "",
        },
      ],
    }));
  };

  const exportToPDF = async () => {
    if (resumeRef.current) {
      try {
        const canvas = await html2canvas(resumeRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        // Add additional pages if needed
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`${resume.contact.name || "resume"}.pdf`);
      } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please try again.");
      }
    }
  };

  const transferToBuilder = async () => {
    try {
      setIsTransferring(true);

      // Get the accepted content from suggestions
      let finalContent = "";
      parsedContent.forEach((part) => {
        const text =
          part.suggestionId && suggestions[part.suggestionId]?.accepted
            ? suggestions[part.suggestionId].suggestion
            : part.text;
        finalContent += text;
      });

      const genAI = new GoogleGenerativeAI(
        process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY ||
          "AIzaSyDJwn0eXDfrWid2ocNycrFs6LaUya_StfY"
      );
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const prompt = `Parse this resume into structured sections. Extract the following information in JSON format:

{
  "contact": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "phone number",
    "location": "city, state"
  },
  "sections": [
    {
      "type": "experience|education|skills|projects|certifications",
      "title": "Job Title or Section Title",
      "subtitle": "Company Name or Institution",
      "content": "Detailed description or bullet points",
      "startDate": "MM/YYYY or Month Year",
      "endDate": "MM/YYYY or Month Year or Present",
      "location": "City, State (if applicable)"
    }
  ]
}

Instructions:
1. Extract contact information from the top of the resume
2. Identify distinct sections (Experience, Education, Skills, Projects, etc.)
3. For each experience/education entry, extract start date, end date, and location if available
4. Keep the content detailed but clean
5. Use "Present" for current positions
6. Return only valid JSON, no additional text

Resume content:
${finalContent}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonResponse = response.text();

      try {
        // Clean the response to extract just the JSON
        const cleanJson = jsonResponse
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        const parsedResume = JSON.parse(cleanJson);

        // Update resume state with parsed data
        setResume({
          contact: parsedResume.contact || {
            name: "",
            email: "",
            phone: "",
            location: "",
          },
          sections:
            parsedResume.sections.map((section: Section, index: number) => ({
              ...section,
              id: `section-${Date.now()}-${index}`,
            })) || [],
        });

        // Switch to builder view
        setView("builder");
      } catch (parseError) {
        console.error("Error parsing JSON response:", parseError);
        // Fallback to simple parsing if JSON parsing fails
        fallbackTransferToBuilder();
      }
    } catch (error) {
      console.error("Error extracting sections:", error);
      // Fallback to simple parsing
      fallbackTransferToBuilder();
    } finally {
      setIsTransferring(false);
    }
  };

  const fallbackTransferToBuilder = () => {
    // Simple parsing logic as fallback
    const newSections: Section[] = [];
    let currentSection: Partial<Section> = {};

    parsedContent.forEach((part) => {
      const text =
        part.suggestionId && suggestions[part.suggestionId]?.accepted
          ? suggestions[part.suggestionId].suggestion
          : part.text;

      // Simple parsing logic - you might want to enhance this
      if (text.toLowerCase().includes("experience")) {
        currentSection = {
          type: "experience",
          title: "Experience",
          content: "",
        };
        newSections.push(currentSection as Section);
      } else if (text.toLowerCase().includes("education")) {
        currentSection = { type: "education", title: "Education", content: "" };
        newSections.push(currentSection as Section);
      } else if (text.toLowerCase().includes("skills")) {
        currentSection = { type: "skills", title: "Skills", content: "" };
        newSections.push(currentSection as Section);
      } else if (currentSection) {
        currentSection.content = (currentSection.content || "") + text;
      }
    });

    // Update resume state with parsed sections
    setResume((prev) => ({
      ...prev,
      sections: newSections.map((section) => ({
        ...section,
        id: `section-${Date.now()}-${Math.random()}`,
      })),
    }));

    // Switch to builder view
    setView("builder");
  };

  const startFresh = () => {
    // Reset resume to empty state
    setResume({
      contact: { name: "", email: "", phone: "", location: "" },
      sections: [],
    });

    // Reset preview mode to edit mode
    setIsPreviewMode(false);

    // Switch to builder view
    setView("builder");
  };

  const analyzeResumeScore = async (originalPdfContent?: string) => {
    try {
      setIsScoring(true);

      // Use the original PDF content if provided, otherwise try to reconstruct
      let resumeContent = "";

      if (originalPdfContent) {
        // Use the original PDF content directly (for first analysis)
        resumeContent = originalPdfContent;
      } else if (parsedContent.length > 0) {
        // Get the accepted content from suggestions (for reanalysis)
        parsedContent.forEach((part) => {
          const text =
            part.suggestionId && suggestions[part.suggestionId]?.accepted
              ? suggestions[part.suggestionId].suggestion
              : part.text;
          resumeContent += text;
        });
      } else {
        // Fallback to current resume state (last resort)
        resumeContent = `
Contact: ${resume.contact.name} ${resume.contact.email} ${
          resume.contact.phone
        } ${resume.contact.location}

${resume.sections
  .map(
    (section) => `
${section.type.toUpperCase()}:
${section.title} ${section.subtitle || ""} ${
      section.startDate ? `(${section.startDate} - ${section.endDate})` : ""
    } ${section.location || ""}
${section.content}
`
  )
  .join("\n")}
        `;
      }

      const genAI = new GoogleGenerativeAI(
        process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY ||
          "AIzaSyDJwn0eXDfrWid2ocNycrFs6LaUya_StfY"
      );
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const prompt = `You are a professional HR manager and resume expert. You will analyze the SPECIFIC resume content provided below and give HONEST, REALISTIC scores based on what you actually see in this resume. DO NOT give generic or average scores.

CRITICAL INSTRUCTIONS:
- READ the entire resume content carefully
- Base scores ONLY on what is actually written in THIS specific resume
- Give low scores (20-50) for poor resumes, medium scores (50-75) for average resumes, high scores (75-95) for excellent resumes
- Be critical and honest - most resumes have room for improvement
- Scores should vary significantly based on actual content quality
- Look for specific evidence of achievements, quantified results, proper formatting, etc.

IMPORTANT JSON FORMAT REQUIREMENTS:
- Return ONLY valid JSON
- Do NOT include any explanatory text before or after the JSON
- Do NOT include phrases like "Here is the analysis:" or "Based on my review:"
- Do NOT include conversational responses
- Start your response immediately with the opening brace {
- End your response immediately with the closing brace }

Return ONLY this JSON format with NO additional text:

{
  "overallScore": [ACTUAL_CALCULATED_AVERAGE],
  "criteria": [
    {
      "name": "Content Quality & Impact",
      "score": [0-100 based on actual achievements, quantified results, action verbs, impact statements in THIS resume],
      "feedback": "Specific assessment of what you see in this resume's content quality",
      "improvements": ["Specific suggestion based on what's missing", "Another specific improvement", "Third improvement"]
    },
    {
      "name": "Professional Language & Writing",
      "score": [0-100 based on actual grammar, word choice, clarity, professional tone in THIS resume],
      "feedback": "Specific assessment of the writing quality in this resume",
      "improvements": ["Specific language improvement", "Another writing suggestion"]
    },
    {
      "name": "Relevant Experience & Skills",
      "score": [0-100 based on actual experience relevance, skills listed, career progression shown in THIS resume],
      "feedback": "Assessment of the actual experience and skills shown",
      "improvements": ["Specific experience improvement", "Skill enhancement suggestion"]
    },
    {
      "name": "Structure & Organization",
      "score": [0-100 based on actual organization, section flow, formatting consistency in THIS resume],
      "feedback": "Assessment of how well this specific resume is organized",
      "improvements": ["Specific structural improvement", "Organization enhancement"]
    }
  ]
}

SCORING CRITERIA - ANALYZE THIS SPECIFIC RESUME:

Content Quality & Impact (Be Critical):
- Are achievements quantified with numbers/percentages? (Low=0-30, Medium=30-70, High=70-100)
- Are strong action verbs used? 
- Are accomplishments specific and detailed?
- Is impact clearly demonstrated?

Professional Language & Writing:
- Grammar and spelling errors? (Deduct heavily for errors)
- Professional tone maintained?
- Clear and concise writing?
- Industry-appropriate terminology?

Relevant Experience & Skills:
- Does experience match common job requirements?
- Are skills current and in-demand?
- Is there clear career progression?
- Are transferable skills highlighted?

Structure & Organization:
- Is information logically organized?
- Are sections clearly defined?
- Is formatting consistent?
- Is the resume the right length?

ANALYZE THIS SPECIFIC RESUME CONTENT:
${resumeContent}

Remember: Give REALISTIC scores based on what you actually see. Most resumes are not excellent and should score 60-80. Only truly outstanding resumes should score 85+. Poor resumes should score below 60.

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT:`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonResponse = response.text();

      try {
        // Clean the response to extract just the JSON
        let cleanJson = jsonResponse
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        console.log(
          "Original response:",
          jsonResponse.substring(0, 300) + "..."
        );

        // More aggressive JSON extraction
        // Look for the JSON object pattern
        const jsonStartPattern = /\{\s*["']overallScore["']/;
        const jsonStartMatch = cleanJson.search(jsonStartPattern);

        if (jsonStartMatch !== -1) {
          // Find the matching closing brace by counting braces
          let braceCount = 0;
          let jsonEnd = -1;

          for (let i = jsonStartMatch; i < cleanJson.length; i++) {
            if (cleanJson[i] === "{") {
              braceCount++;
            } else if (cleanJson[i] === "}") {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i;
                break;
              }
            }
          }

          if (jsonEnd !== -1) {
            cleanJson = cleanJson.substring(jsonStartMatch, jsonEnd + 1);
          }
        } else {
          // Fallback: try to find any JSON object
          const jsonStart = cleanJson.indexOf("{");
          const jsonEnd = cleanJson.lastIndexOf("}");

          if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
            cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
          }
        }

        console.log("Cleaned JSON:", cleanJson.substring(0, 300) + "...");

        const scoreData = JSON.parse(cleanJson);

        // Validate the parsed data has required structure
        if (
          scoreData.overallScore !== undefined &&
          scoreData.criteria &&
          Array.isArray(scoreData.criteria)
        ) {
          setResumeScore(scoreData);
        } else {
          throw new Error("Invalid score data structure");
        }
      } catch (parseError) {
        console.error("Error parsing score JSON:", parseError);
        console.error("Failed to parse response:", jsonResponse);

        // Set a default score if parsing fails
        setResumeScore({
          overallScore: 0,
          criteria: [
            {
              name: "Content Quality & Impact",
              score: 0,
              feedback:
                "Unable to analyze due to parsing error. Please try again.",
              improvements: ["Reanalyze the resume"],
            },
            {
              name: "Professional Language & Writing",
              score: 0,
              feedback:
                "Unable to analyze due to parsing error. Please try again.",
              improvements: ["Reanalyze the resume"],
            },
            {
              name: "Relevant Experience & Skills",
              score: 0,
              feedback:
                "Unable to analyze due to parsing error. Please try again.",
              improvements: ["Reanalyze the resume"],
            },
            {
              name: "Structure & Organization",
              score: 0,
              feedback:
                "Unable to analyze due to parsing error. Please try again.",
              improvements: ["Reanalyze the resume"],
            },
          ],
        });
      }
    } catch (error) {
      console.error("Error analyzing resume score:", error);
    } finally {
      setIsScoring(false);
    }
  };

  const handleReanalyzeScore = () => {
    analyzeResumeScore(); // Call without original PDF content for reanalysis
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {Object.entries(views).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    setView(key as "upload" | "analysis" | "builder")
                  }
                  className={`inline-flex items-center px-4 border-b-2 text-sm font-medium ${
                    view === key
                      ? "border-black text-black"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 container mx-auto px-4 py-8">
        {view === "upload" ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="w-full max-w-2xl flex flex-col items-center gap-8">
              <h2 className="text-[32px] font-bold">Resume Builder</h2>

              <div className="w-full flex gap-6">
                <div className="flex-1 border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
                  <h3 className="text-lg font-semibold mb-4">
                    Create New Resume
                  </h3>
                  <button
                    onClick={startFresh}
                    className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Start Fresh
                  </button>
                </div>

                <div className="flex-1 border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
                  <h3 className="text-lg font-semibold mb-4">
                    Import Existing
                  </h3>
                  <label className="flex flex-col gap-2">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg text-center cursor-pointer hover:bg-gray-50">
                      Choose PDF
                    </div>
                  </label>
                  {pdfFile && (
                    <button
                      onClick={analyzePDF}
                      disabled={isAnalyzing}
                      className="w-full mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isAnalyzing ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Analyzing...
                        </div>
                      ) : (
                        "Import & Analyze"
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : view === "builder" ? (
          <div className="max-w-7xl mx-auto">
            <div className="mb-4 flex justify-between">
              <button
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="px-4 py-2 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                {isPreviewMode ? "Edit Mode" : "Preview Mode"}
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Export to PDF
              </button>
            </div>

            {isPreviewMode ? (
              /* Resume Preview */
              <div
                ref={resumeRef}
                className="max-w-4xl mx-auto bg-white shadow-lg min-h-[11in] p-8"
              >
                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-gray-200 pb-6">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {resume.contact.name || "Your Name"}
                  </h1>
                  <div className="flex justify-center items-center space-x-4 text-sm text-gray-600">
                    {resume.contact.email && (
                      <span>{resume.contact.email}</span>
                    )}
                    {resume.contact.phone && <span>&bull;</span>}
                    {resume.contact.phone && (
                      <span>{resume.contact.phone}</span>
                    )}
                    {resume.contact.location && <span>&bull;</span>}
                    {resume.contact.location && (
                      <span>{resume.contact.location}</span>
                    )}
                  </div>
                </div>

                {/* Sections */}
                <div className="space-y-6">
                  {resume.sections.map((section) => (
                    <div key={section.id} className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-3 uppercase tracking-wide border-b border-gray-300 pb-1">
                        {section.type}
                      </h2>

                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {section.title}
                            </h3>
                            {section.subtitle && (
                              <p className="text-base font-medium text-gray-700">
                                {section.subtitle}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-sm text-gray-600">
                            {(section.startDate || section.endDate) && (
                              <div>
                                {section.startDate} - {section.endDate}
                              </div>
                            )}
                            {section.location && (
                              <div className="mt-1">{section.location}</div>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {section.content}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Resume Editor */
              <div className="grid grid-cols-[300px_1fr] gap-8">
                {/* Sidebar */}
                <div className="space-y-4">
                  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-neutral-200">
                      <h2 className="text-lg font-medium">
                        Contact Information
                      </h2>
                    </div>
                    <div className="p-4">
                      {Object.entries(resume.contact).map(([key, value]) => (
                        <div key={key} className="mb-4 last:mb-0">
                          <label className="block text-sm font-medium text-neutral-700 mb-1 capitalize">
                            {key}
                          </label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              setResume((prev) => ({
                                ...prev,
                                contact: {
                                  ...prev.contact,
                                  [key]: e.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-neutral-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black text-sm"
                            placeholder={`Enter ${key}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddSection}
                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-sm font-medium hover:bg-neutral-50"
                  >
                    Add New Section
                  </button>
                </div>

                {/* Main Content */}
                <div className="space-y-6">
                  {resume.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className="bg-white border border-neutral-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                        <select
                          value={section.type}
                          onChange={(e) => {
                            const sections = [...resume.sections];
                            sections[index] = {
                              ...section,
                              type: e.target.value,
                            };
                            setResume((prev) => ({ ...prev, sections }));
                          }}
                          className="text-sm font-medium bg-transparent border-0 focus:ring-0"
                        >
                          <option value="experience">Experience</option>
                          <option value="education">Education</option>
                          <option value="skills">Skills</option>
                          <option value="projects">Projects</option>
                        </select>
                        <button
                          onClick={() => {
                            setResume((prev) => ({
                              ...prev,
                              sections: prev.sections.filter(
                                (s) => s.id !== section.id
                              ),
                            }));
                          }}
                          className="text-sm text-neutral-500 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const sections = [...resume.sections];
                            sections[index] = {
                              ...section,
                              title: e.target.value,
                            };
                            setResume((prev) => ({ ...prev, sections }));
                          }}
                          className="w-full px-3 py-2 text-lg font-medium border-0 focus:ring-0 focus:outline-none"
                          placeholder="Section Title"
                        />
                        <input
                          type="text"
                          value={section.subtitle || ""}
                          onChange={(e) => {
                            const sections = [...resume.sections];
                            sections[index] = {
                              ...section,
                              subtitle: e.target.value,
                            };
                            setResume((prev) => ({ ...prev, sections }));
                          }}
                          className="w-full px-3 py-2 text-sm text-neutral-500 border-0 focus:ring-0 focus:outline-none"
                          placeholder="Subtitle (optional)"
                        />

                        {(section.type === "experience" ||
                          section.type === "education") && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                  Start Date
                                </label>
                                <input
                                  type="text"
                                  value={section.startDate || ""}
                                  onChange={(e) => {
                                    const sections = [...resume.sections];
                                    sections[index] = {
                                      ...section,
                                      startDate: e.target.value,
                                    };
                                    setResume((prev) => ({
                                      ...prev,
                                      sections,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                  placeholder="MM/YYYY"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">
                                  End Date
                                </label>
                                <input
                                  type="text"
                                  value={section.endDate || ""}
                                  onChange={(e) => {
                                    const sections = [...resume.sections];
                                    sections[index] = {
                                      ...section,
                                      endDate: e.target.value,
                                    };
                                    setResume((prev) => ({
                                      ...prev,
                                      sections,
                                    }));
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                  placeholder="MM/YYYY or Present"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Location
                              </label>
                              <input
                                type="text"
                                value={section.location || ""}
                                onChange={(e) => {
                                  const sections = [...resume.sections];
                                  sections[index] = {
                                    ...section,
                                    location: e.target.value,
                                  };
                                  setResume((prev) => ({ ...prev, sections }));
                                }}
                                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                                placeholder="City, State"
                              />
                            </div>
                          </>
                        )}

                        <textarea
                          value={section.content}
                          onChange={(e) => {
                            const sections = [...resume.sections];
                            sections[index] = {
                              ...section,
                              content: e.target.value,
                            };
                            setResume((prev) => ({ ...prev, sections }));
                          }}
                          rows={4}
                          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                          placeholder="Enter section content..."
                        />
                      </div>
                    </div>
                  ))}

                  {resume.sections.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-neutral-200 rounded-lg">
                      <p className="text-neutral-500">
                        Click &quot;Add New Section&quot; to begin building your
                        resume
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-6xl flex gap-6">
            <div className="flex-1 bg-white rounded-lg shadow-md">
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold">Resume Analysis</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Click on highlighted text to view suggestions
                </p>
              </div>

              <div className="p-6 whitespace-pre-wrap">
                {parsedContent.map((part, index) => {
                  if (part.type === "regular") {
                    return <span key={index}>{part.text}</span>;
                  }

                  const suggestion = part.suggestionId
                    ? suggestions[part.suggestionId]
                    : null;
                  if (!suggestion) return null;

                  return (
                    <span
                      key={index}
                      onClick={() => setSelectedSuggestion(suggestion.id)}
                      className={`
                      ${
                        suggestion.accepted === undefined
                          ? "bg-yellow-200"
                          : suggestion.accepted
                          ? "bg-green-200"
                          : "bg-red-200"
                      }
                      ${
                        selectedSuggestion === suggestion.id
                          ? "ring-2 ring-blue-400"
                          : ""
                      }
                      px-1 py-0.5 rounded inline-block cursor-pointer hover:ring-2 hover:ring-blue-300
                    `}
                    >
                      {suggestion.accepted ? suggestion.suggestion : part.text}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Resume Score Panel */}
            <div className="w-80 space-y-4">
              {/* Suggestion Details Card */}
              <div className="bg-white rounded-lg shadow-md h-fit sticky top-8">
                <div className="p-4 border-b">
                  <h4 className="font-medium">Suggestion Details</h4>
                </div>

                {selectedSuggestion ? (
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Original Text:
                        </p>
                        <p className="text-sm mt-1 bg-yellow-50 p-2 rounded">
                          {suggestions[selectedSuggestion].original}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Suggestion:
                        </p>
                        <p className="text-sm mt-1 bg-blue-50 p-2 rounded">
                          {suggestions[selectedSuggestion].suggestion}
                        </p>
                      </div>

                      {suggestions[selectedSuggestion].accepted ===
                        undefined && (
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() =>
                              handleSuggestion(selectedSuggestion, true)
                            }
                            className="flex-1 text-sm px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              handleSuggestion(selectedSuggestion, false)
                            }
                            className="flex-1 text-sm px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    Click on a highlighted text to view and manage suggestions
                  </div>
                )}
                <div className="p-4 border-t">
                  <button
                    onClick={transferToBuilder}
                    disabled={isTransferring}
                    className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTransferring ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Transferring...
                      </div>
                    ) : (
                      "Transfer to Builder"
                    )}
                  </button>
                </div>
              </div>

              {/* Resume Score Card */}
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b flex items-center justify-between">
                  <h4 className="font-medium">Resume Score</h4>
                  <button
                    onClick={handleReanalyzeScore}
                    disabled={isScoring}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isScoring ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                        Scoring...
                      </div>
                    ) : (
                      "Reanalyze"
                    )}
                  </button>
                </div>

                {resumeScore ? (
                  <div className="p-4">
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {resumeScore.overallScore}/100
                      </div>
                      <div className="text-sm text-gray-500">Overall Score</div>
                    </div>

                    <div className="space-y-4">
                      {resumeScore.criteria.map((criterion, index) => (
                        <div key={index} className="border rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-medium text-sm">
                              {criterion.name}
                            </h5>
                            <span className="font-semibold text-blue-600">
                              {criterion.score}/100
                            </span>
                          </div>

                          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${criterion.score}%` }}
                            ></div>
                          </div>

                          <p className="text-xs text-gray-600 mb-2">
                            {criterion.feedback}
                          </p>

                          <div className="text-xs">
                            <strong>Improvements:</strong>
                            <ul className="list-disc list-inside text-gray-600 mt-1">
                              {criterion.improvements.map(
                                (improvement, idx) => (
                                  <li key={idx}>{improvement}</li>
                                )
                              )}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {isScoring ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                        Analyzing resume score...
                      </div>
                    ) : (
                      "Click 'Reanalyze' to get your resume score"
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "analysis" && (
          <button
            onClick={resetAnalysis}
            className="fixed bottom-6 right-6 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}

        {/* Loading Overlay for Transfer */}
        {isTransferring && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">
                Transferring Resume
              </h3>
              <p className="text-gray-600">
                Please wait while we process your resume sections...
              </p>
            </div>
          </div>
        )}

        {/* Loading Overlay for Analysis */}
        {isAnalyzing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Analyzing Resume</h3>
              <p className="text-gray-600">
                Please wait while AI analyzes your resume and generates
                improvement suggestions...
              </p>
            </div>
          </div>
        )}

        {/* Loading Overlay for Scoring */}
        {isScoring && !isAnalyzing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">Scoring Resume</h3>
              <p className="text-gray-600">
                Analyzing resume quality across 4 key criteria...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Resume;
