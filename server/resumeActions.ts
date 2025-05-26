"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import type { Section, ParsedContent, Suggestion, ResumeScore, ResumeAnalysisPayload, ResumeStructurePayload } from "@/types/resumeTypes";

// Initialize the Google Generative AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!); 

function parseSuggestionsFromAnalyzedText(text: string): { parts: ParsedContent[], suggestionsObject: Record<string, Suggestion> } {
    const parts: ParsedContent[] = [];
    const newSuggestions: Record<string, Suggestion> = {};
    let currentIndex = 0;
    const regex = /\[([\s\S]*?)\]{([\s\S]*?)}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText) parts.push({ text: beforeText, type: "regular" });
      }
      const original = match[1].trim();
      const suggestionText = match[2].trim();
      if (original && suggestionText) {
        const suggestionId = `suggestion-${currentIndex++}`;
        newSuggestions[suggestionId] = { id: suggestionId, original, suggestion: suggestionText };
        parts.push({ text: original, type: "highlight", suggestionId });
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex);
      if (remainingText) parts.push({ text: remainingText, type: "regular" });
    }
    return { parts, suggestionsObject: newSuggestions };
}

async function callGemini(prompt: string, content?: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Using 2.0 flash as an example
  try {
    const fullPrompt = content ? [prompt, content] : [prompt];
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to communicate with the AI model.");
  }
}

function cleanJsonResponse(jsonText: string) {
    let cleanJson = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonStartPattern = /\{\s*["'](overallScore|contact)["']/;
    const jsonStartMatch = cleanJson.search(jsonStartPattern);

    if (jsonStartMatch !== -1) {
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStartMatch; i < cleanJson.length; i++) {
            if (cleanJson[i] === "{") braceCount++;
            else if (cleanJson[i] === "}") {
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
      const genericJsonStart = cleanJson.indexOf("{");
      const genericJsonEnd = cleanJson.lastIndexOf("}");
      if (genericJsonStart !== -1 && genericJsonEnd > genericJsonStart) {
        cleanJson = cleanJson.substring(genericJsonStart, genericJsonEnd + 1);
      } else {
        console.warn("Could not reliably find JSON object in response for cleaning:", cleanJson.substring(0,100));
      }
    }
    try {
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Failed to parse cleaned JSON during action:", cleanJson.substring(0,300), e);
      // Return an empty object or a specific error structure if parsing fails completely
      return { error: "Failed to parse AI response as JSON." };
    }
}


export async function handleResumeUploadAndAnalyze(formData: FormData): Promise<ResumeAnalysisPayload> {
  const pdfFile = formData.get("pdfFile") as File;
  if (!pdfFile) {
    throw new Error("No PDF file uploaded.");
  }
  if (pdfFile.type !== "application/pdf") {
    throw new Error("Invalid file type. Please upload a PDF.");
  }

  const fileBuffer = await pdfFile.arrayBuffer();
  const pdfData = await pdfParse(Buffer.from(fileBuffer));
  const pdfContent = pdfData.text;

  if (!pdfContent.trim()) {
    throw new Error("No text content found in the PDF.");
  }

  const analysisPrompt = `You are an expert resume editor. Review the entire resume and improve its professionalism, clarity, impact, and formatting, focusing on actionable improvements. When you replace text, wrap the original in [ ] and your improved replacement (phrase, sentence or multi-sentence) in { }. Examples:

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

  const analyzedText = await callGemini(analysisPrompt, pdfContent);
  const { parts, suggestionsObject } = parseSuggestionsFromAnalyzedText(analyzedText);

  const scoringPrompt = `You are a professional HR manager and resume expert. Analyze this resume and provide a comprehensive score based on key criteria. 

Rate the resume on a scale of 0-100 for each criterion and provide specific feedback and improvements.

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT:

{
  "overallScore": number,
  "criteria": [
    {
      "name": "Content Quality",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Formatting & Structure", 
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Professional Impact",
      "score": number,
      "feedback": "string", 
      "improvements": ["string", "string"]
    },
    {
      "name": "Keyword Optimization",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Completeness",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    }
  ]
}

Scoring Guidelines:
- Content Quality (0-100): Clarity, relevance, and impact of achievements
- Formatting & Structure (0-100): Professional layout, consistency, readability
- Professional Impact (0-100): Use of action verbs, quantified results, industry relevance
- Keyword Optimization (0-100): Inclusion of relevant industry keywords and skills
- Completeness (0-100): All necessary sections present and well-developed

Calculate overallScore as the average of all criteria scores.`;
  const scoreJsonResponse = await callGemini(scoringPrompt, analyzedText); // Score based on the AI-analyzed text
  let resumeScore: ResumeScore | null = null;
  try {
    resumeScore = cleanJsonResponse(scoreJsonResponse) as ResumeScore;
  } catch (e) {
    console.error("Error processing resume score from AI:", e);
    // Optionally, provide a default error score structure
    resumeScore = { overallScore: 0, criteria: [], feedback: "Error scoring resume." } as ResumeScore;
  }

  return { analyzedText, suggestions: suggestionsObject, parsedContent: parts, resumeScore };
}

export async function handleTransferToBuilder(resumeText: string): Promise<ResumeStructurePayload> {
    const structuringPrompt = `Parse this resume into structured sections. Extract the following information in JSON format:
{
  "contact": { "name": "Full Name", "email": "email@example.com", "phone": "phone number", "location": "city, state" },
  "sections": [ { "type": "experience|education|skills|projects|certifications", "title": "Job Title or Section Title", "subtitle": "Company Name or Institution", "content": "Detailed description or bullet points", "startDate": "MM/YYYY or Month Year", "endDate": "MM/YYYY or Month Year or Present", "location": "City, State (if applicable)" } ]
}
Instructions:
1. Extract contact information from the top of the resume.
2. Identify distinct sections (Experience, Education, Skills, Projects, etc.).
3. For each experience/education entry, extract start date, end date, and location if available.
4. Keep the content detailed but clean.
5. Use "Present" for current positions.
6. Return only valid JSON, no additional text.

Resume content:
${resumeText}`;

    const jsonResponse = await callGemini(structuringPrompt);
    try {
        const parsedResume = cleanJsonResponse(jsonResponse);
        return {
            contact: parsedResume.contact || { name: "", email: "", phone: "", location: "" },
            sections: (parsedResume.sections || []).map((section: Section, index: number) => ({
                ...section,
                id: `section-${Date.now()}-${index}`,
            })),
        };
    } catch (e) {
        console.error("Error parsing structured resume from AI:", e);
        throw new Error("Failed to structure resume data from AI.");
    }
}

export async function handleAnalyzeResumeScore(resumeText: string): Promise<ResumeScore> {
    const scoringPrompt = `You are a professional HR manager and resume expert. Analyze this resume and provide a comprehensive score based on key criteria. 

Rate the resume on a scale of 0-100 for each criterion and provide specific feedback and improvements.

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT:

{
  "overallScore": number,
  "criteria": [
    {
      "name": "Content Quality",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Formatting & Structure", 
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Professional Impact",
      "score": number,
      "feedback": "string", 
      "improvements": ["string", "string"]
    },
    {
      "name": "Keyword Optimization",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    },
    {
      "name": "Completeness",
      "score": number,
      "feedback": "string",
      "improvements": ["string", "string"]
    }
  ]
}

Scoring Guidelines:
- Content Quality (0-100): Clarity, relevance, and impact of achievements
- Formatting & Structure (0-100): Professional layout, consistency, readability
- Professional Impact (0-100): Use of action verbs, quantified results, industry relevance
- Keyword Optimization (0-100): Inclusion of relevant industry keywords and skills
- Completeness (0-100): All necessary sections present and well-developed

Calculate overallScore as the average of all criteria scores.`;
    const jsonResponse = await callGemini(scoringPrompt, resumeText);
     try {
        const parsedScoreData = cleanJsonResponse(jsonResponse);
        if (parsedScoreData && typeof parsedScoreData.overallScore === 'number' && Array.isArray(parsedScoreData.criteria)) {
            return parsedScoreData as ResumeScore;
        } else {
            console.warn("Parsed score from AI (reanalyze) has invalid structure. Defaulting.", parsedScoreData);
            return { overallScore: 0, criteria: [] };
        }
    } catch (e) {
        console.error("Error parsing resume score from AI (reanalyze):", e);
        return { overallScore: 0, criteria: [] }; // Return default on error
    }
}