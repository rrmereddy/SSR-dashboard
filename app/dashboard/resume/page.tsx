"use client";
import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

const Resume = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [parsedContent, setParsedContent] = useState<ParsedContent[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>(
    {}
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setPdfFile(file);
        setFileError("");
      } else {
        setFileError("Please upload a PDF file");
        setPdfFile(null);
      }
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const parseModelResponse = (response: string) => {
    const parts: ParsedContent[] = [];
    const newSuggestions: Record<string, Suggestion> = {};
    let currentIndex = 0;

    // Regular expression to match [original]{suggestion} pattern
    const regex = /\[(.*?)\]{(.*?)}/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(response)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: response.slice(lastIndex, match.index),
          type: "regular",
        });
      }

      const suggestionId = `suggestion-${currentIndex++}`;
      const suggestion: Suggestion = {
        id: suggestionId,
        original: match[1],
        suggestion: match[2],
      };

      newSuggestions[suggestionId] = suggestion;
      parts.push({
        text: match[1],
        type: "highlight",
        suggestionId,
      });

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < response.length) {
      parts.push({
        text: response.slice(lastIndex),
        type: "regular",
      });
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

  const analyzePDF = async () => {
    if (!pdfFile) return;

    try {
      setIsAnalyzing(true);
      setAnalysisResult("");

      const base64Data = await readFileAsBase64(pdfFile);

      const genAI = new GoogleGenerativeAI(
        "AIzaSyDJwn0eXDfrWid2ocNycrFs6LaUya_StfY"
      );
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      const prompt = `You are an expert resume editor. Review the entire resume and improve its professionalism, clarity, and formatting. When you replace text, wrap the original in [ ] and your improved replacement (phrase, sentence or multi-sentence) in { }. Examples:

• I [worked as a software engineer]{Served as a Software Engineer} at Google.  
• [Objective: I am seeking a position…]{Objective: Strategic Art Administration professional with hands-on gallery experience and strong organizational skills.}  

Guidelines:  
1. Only annotate text that truly needs revision—don’t over-annotate.  
2. Suggestions may be concise phrases or full sentences/paragraphs, as needed to convey a stronger, more professional alternative.  
3. Use action verbs, quantify achievements, and enforce consistent formatting (dates, headings).  
4. Flag or replace placeholders like [Year] with either actual dates or a clear prompt (e.g., “[complete date]”).  
5. Preserve key industry terms (e.g., “Art Administration,” “Adobe Photoshop”).  
6. Return only the resume text with inline [original]{suggestion} edits—no extra commentary.  `; // You can customize this prompt

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
      ]);

      const response = await result.response;
      setAnalysisResult(response.text());
      parseModelResponse(response.text());
    } catch (error) {
      console.error("Error analyzing PDF:", error);
      setFileError("Error analyzing PDF. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-4xl p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6 text-center">
          Upload Your Resume
        </h2>

        <div className="flex flex-col items-center gap-4">
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-8 h-8 mb-4 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500">PDF files only</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
            />
          </label>

          {fileError && <p className="text-red-500 text-sm">{fileError}</p>}

          {pdfFile && (
            <div className="text-sm text-gray-500">
              Selected file: {pdfFile.name}
            </div>
          )}

          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
            disabled={!pdfFile || isAnalyzing}
            onClick={analyzePDF}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Resume"}
          </button>

          {parsedContent.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-4">Resume Analysis:</h3>
              <div className="space-y-2">
                {parsedContent.map((part, index) => {
                  if (part.type === "regular") {
                    return <span key={index}>{part.text}</span>;
                  }

                  const suggestion = part.suggestionId
                    ? suggestions[part.suggestionId]
                    : null;
                  if (!suggestion) return null;

                  return (
                    <span key={index} className="relative group">
                      <span
                        className={`${
                          suggestion.accepted === undefined
                            ? "bg-yellow-200"
                            : suggestion.accepted
                            ? "bg-green-200"
                            : "bg-red-200"
                        } px-1 rounded cursor-pointer`}
                      >
                        {suggestion.accepted
                          ? suggestion.suggestion
                          : part.text}
                      </span>

                      {suggestion.accepted === undefined && (
                        <div className="absolute hidden group-hover:flex -top-8 left-0 bg-white border shadow-lg rounded p-2 z-10 gap-2">
                          <button
                            onClick={() =>
                              handleSuggestion(suggestion.id, true)
                            }
                            className="text-sm px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              handleSuggestion(suggestion.id, false)
                            }
                            className="text-sm px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                          >
                            Reject
                          </button>
                          <div className="text-sm text-gray-600">
                            Suggestion: {suggestion.suggestion}
                          </div>
                        </div>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Resume;
