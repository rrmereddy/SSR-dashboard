"use client";
import React, { useState } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import PDFParser from "pdf-parse";

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
  const [view, setView] = useState<"upload" | "analysis">("upload");
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(
    null
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

  const readPDFContent = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfData = await PDFParser(uint8Array);
      return pdfData.text;
    } catch (error) {
      console.error("Error parsing PDF:", error);
      throw new Error("Failed to parse PDF content");
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

      // Extract text content from PDF
      const pdfContent = await readPDFContent(pdfFile);

      const genAI = new GoogleGenerativeAI(
        "AIzaSyDJwn0eXDfrWid2ocNycrFs6LaUya_StfY"
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
5. Flag or replace placeholders like [Year] with either actual dates or a clear prompt (e.g., “[complete date]”).
6. Preserve key industry terms (e.g., “Art Administration,” “Adobe Photoshop”).
7. Prioritize clarity, conciseness, and impact in all suggestions.
8. Maintain a professional and sophisticated tone.
9. Return only the resume text with inline [original]{suggestion} edits—no extra commentary.`;

      const result = await model.generateContent([prompt, pdfContent]);

      const response = await result.response;
      setAnalysisResult(response.text());
      parseModelResponse(response.text());
      setView("analysis");
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

  return (
    <div className="flex flex-col items-center min-h-screen p-8 relative">
      {view === "upload" ? (
        <div className="w-full max-w-2xl p-6 bg-white rounded-lg shadow-md">
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
          </div>
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

          <div className="w-80 bg-white rounded-lg shadow-md h-fit sticky top-8">
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

                  {suggestions[selectedSuggestion].accepted === undefined && (
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
    </div>
  );
};

export default Resume;
