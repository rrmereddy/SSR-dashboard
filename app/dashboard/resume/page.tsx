"use client";
import React, { useState, useTransition, useRef, ChangeEvent } from "react";
import { 
    handleResumeUploadAndAnalyze, 
    handleTransferToBuilder,
    handleAnalyzeResumeScore 
} from '@/server/resumeActions'; // Ensure this path is correct
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { ParsedContent, Suggestion, Resume, ResumeScore, ResumeContact } from "@/types/resumeTypes";
import { toast } from "sonner";

const ResumePageClient = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  
  const [isProcessingAction, startTransition] = useTransition(); 

  const [analysisResultText, setAnalysisResultText] = useState<string>(""); 
  const [parsedContentForDisplay, setParsedContentForDisplay] = useState<ParsedContent[]>([]);
  const [suggestionsMap, setSuggestionsMap] = useState<Record<string, Suggestion>>({});
  const [currentResumeScore, setCurrentResumeScore] = useState<ResumeScore | null>(null);
  
  const [view, setView] = useState<"upload" | "analysis" | "builder">("upload");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const [resume, setResume] = useState<Resume>({
    contact: { name: "", email: "", phone: "", location: "" },
    sections: [],
  });
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const resumeRef = useRef<HTMLDivElement>(null);


  const views = {
    upload: "Upload Resume",
    builder: "Resume Builder",
    analysis: "AI Analysis",
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "application/pdf") {
        setPdfFile(file);
        setFileError("");
        setAnalysisResultText("");
        setParsedContentForDisplay([]);
        setSuggestionsMap({});
        setCurrentResumeScore(null);
        setSelectedSuggestionId(null);
      } else {
        toast.error("Please upload a PDF file");
        setPdfFile(null);
      }
    }
  };

  const parseTextForClientDisplay = (textFromServer: string) => {
    const parts: ParsedContent[] = [];
    const newSuggestions: Record<string, Suggestion> = {};
    let currentIndex = 0;
    const regex = /\[([\s\S]*?)\]{([\s\S]*?)}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(textFromServer)) !== null) {
      if (match.index > lastIndex) {
        const beforeText = textFromServer.slice(lastIndex, match.index);
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
    if (lastIndex < textFromServer.length) {
      const remainingText = textFromServer.slice(lastIndex);
      if (remainingText) parts.push({ text: remainingText, type: "regular" });
    }
    setParsedContentForDisplay(parts);
    setSuggestionsMap(newSuggestions);
  };

  const triggerResumeAnalysis = async () => {
    if (!pdfFile) {
      toast.error("Please select a PDF file.");
      return;
    }
    setFileError("");

    const formData = new FormData();
    formData.append("pdfFile", pdfFile);

    console.log("Client: Calling handleResumeUploadAndAnalyze...");
    startTransition(async () => {
      try {
        const result = await handleResumeUploadAndAnalyze(formData);
        console.log("Client: Received from handleResumeUploadAndAnalyze:", result);
        
        if (result && result.analyzedText && result.resumeScore) {
            setAnalysisResultText(result.analyzedText);
            parseTextForClientDisplay(result.analyzedText); 
            setCurrentResumeScore(result.resumeScore);
            setView("analysis");
        } else {
            throw new Error("Invalid response structure from server.");
        }
      } catch (err: unknown) {
        console.error("Client: Error in handleResumeUploadAndAnalyze:", err);
        if (err instanceof Error) {
          setFileError(err.message || "Error analyzing PDF.");
        } else {
          setFileError("Error analyzing PDF.");
        }
        toast.error(fileError)
      }
    });
  };

  const handleSuggestionClick = (suggestionId: string, accept: boolean) => {
    setSuggestionsMap(prev => {
        const newSuggestions = { ...prev };
        if (newSuggestions[suggestionId]) {
            newSuggestions[suggestionId] = { ...newSuggestions[suggestionId], accepted: accept };
        }
        return newSuggestions;
    });
  };
  
  const resetAnalysisView = () => {
    setPdfFile(null);
    setFileError("");
    setAnalysisResultText("");
    setParsedContentForDisplay([]);
    setSuggestionsMap({});
    setCurrentResumeScore(null);
    setSelectedSuggestionId(null);
    setView("upload");
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
        const canvas = await html2canvas(resumeRef.current, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff" });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
        pdf.save(`${resume.contact.name || "resume"}.pdf`);
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast.error("Error generating PDF.", {
          description: error instanceof Error ? error.message : "Unknown error occurred.",
        });
      }
    }
  };

  const triggerTransferToBuilder = async () => {
    let finalContent = "";
    parsedContentForDisplay.forEach((part) => {
      const text =
        part.suggestionId && suggestionsMap[part.suggestionId]?.accepted
          ? suggestionsMap[part.suggestionId].suggestion
          : part.text;
      finalContent += text;
    });

    if (!finalContent.trim() && analysisResultText.trim()){
        finalContent = analysisResultText;
    }
    if (!finalContent.trim()) {
        toast.error("No content available to transfer.");
        return;
    }
    
    console.log("Client: Calling handleTransferToBuilder with content:", finalContent.substring(0, 100) + "...");
    startTransition(async () => {
        try {
            const structuredResume = await handleTransferToBuilder(finalContent);
            console.log("Client: Received from handleTransferToBuilder:", structuredResume);
            
            if (structuredResume && structuredResume.contact && Array.isArray(structuredResume.sections)) {
                setResume(structuredResume);
                setView("builder");
            } else {
                 throw new Error("Invalid resume structure from server.");
            }
        } catch (err: unknown) {
            console.error("Client: Error in handleTransferToBuilder:", err);
            if (err instanceof Error) {
                setFileError(err.message || "Error transferring to builder.");
            } else {
                setFileError("Error transferring to builder.");
            }
            toast.error(fileError);
        }
    });
  };
  
  const startFreshBuilder = () => {
    setResume({
      contact: { name: "", email: "", phone: "", location: "" },
      sections: [],
    });
    setIsPreviewMode(false);
    setView("builder");
  };

  const triggerReanalyzeScore = async () => {
    let contentToScore = "";
    if (view === 'analysis' && parsedContentForDisplay.length > 0) {
        parsedContentForDisplay.forEach((part) => {
            const text =
              part.suggestionId && suggestionsMap[part.suggestionId]?.accepted
                ? suggestionsMap[part.suggestionId].suggestion
                : part.text;
            contentToScore += text;
        });
    } else if (analysisResultText) { 
        contentToScore = analysisResultText; 
    } else {
        contentToScore = `Contact: ${resume.contact.name} ${resume.contact.email} ${resume.contact.phone} ${resume.contact.location}\n\n` +
        resume.sections.map(s => `${s.type.toUpperCase()}:\n${s.title} ${s.subtitle || ""}\n${s.content}`).join("\n\n");
    }
    
    if (!contentToScore.trim()){
        toast.error("No content available to re-score.");
        return;
    }

    console.log("Client: Calling handleAnalyzeResumeScore with content:", contentToScore.substring(0,100)+"...");
    startTransition(async () => {
        try {
            const newScore = await handleAnalyzeResumeScore(contentToScore);
            console.log("Client: Received from handleAnalyzeResumeScore:", newScore);

            if (newScore && typeof newScore.overallScore === 'number' && Array.isArray(newScore.criteria)) {
                setCurrentResumeScore(newScore);
            } else {
                throw new Error("Invalid score structure from server.");
            }
        } catch (err: unknown) {
            console.error("Client: Error in handleAnalyzeResumeScore:", err);
            if (err instanceof Error) {
                setFileError(err.message || "Error re-analyzing score.");
            } else {
                setFileError("Error re-analyzing score.");
            }
            toast.error(fileError);
        }
    });
  };

  // --- JSX ---
  // The entire return () block below is your JSX.
  // You had this structure already, so I'm just including it within this component.
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#e8d5b9' }}>
      <nav className="border-b" style={{ borderColor: '#D4C5A9', backgroundColor: '#e8d5b9' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {Object.entries(views).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key as "upload" | "analysis" | "builder")}
                  className={`inline-flex items-center px-4 border-b-2 text-sm font-medium transition-all duration-200 ${
                    view === key
                      ? "text-black border-amber-800"
                      : "border-transparent text-black hover:text-black hover:border-amber-300"
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
              <div className="text-center">
                <h2 className="text-3xl font-bold text-black mb-2">Resume Analyzer</h2>
                <p className="text-black">Craft your perfect career story with AI</p>
              </div>

              <div className="w-full flex gap-6">
                <div className="flex-1 bg-white/60 backdrop-blur-sm border border-amber-200 rounded-xl p-6 hover:border-amber-300 transition-all duration-200 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 text-black">Create New Resume</h3>
                  <button
                    onClick={startFreshBuilder}
                    className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 transition-all duration-200 font-medium shadow-sm"
                  >
                    Start Fresh
                  </button>
                </div>

                <div className="flex-1 bg-white/60 backdrop-blur-sm border border-amber-200 rounded-xl p-6 hover:border-amber-300 transition-all duration-200 shadow-sm">
                  <h3 className="text-lg font-semibold mb-4 text-black">Import Existing</h3>
                  <label className="flex flex-col gap-3">
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={handleFileChange}
                    />
                    <div className="w-full px-4 py-3 border border-amber-200 rounded-lg text-center cursor-pointer hover:bg-amber-50 transition-colors text-black font-medium">
                      {pdfFile ? pdfFile.name : "Choose PDF"}
                    </div>
                  </label>
                  {pdfFile && (
                    <button
                      onClick={triggerResumeAnalysis}
                      disabled={isProcessingAction}
                      className="w-full mt-4 px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 disabled:from-amber-400 disabled:to-amber-500 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                    >
                      {isProcessingAction ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
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
            <div className="mb-6 flex justify-between items-center">
              <div>
                 <button
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="px-4 py-2 bg-white/60 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors text-black font-medium mr-2"
                  >
                    {isPreviewMode ? "Edit Mode" : "Preview Mode"}
                  </button>
                  <button
                    onClick={triggerReanalyzeScore}
                    disabled={isProcessingAction}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:bg-amber-300 transition-all duration-200 font-medium shadow-sm"
                  >
                    {isProcessingAction && currentResumeScore === null ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                          Scoring...
                        </div>
                      ) : "AI Re-Score & Review"}
                  </button>
              </div>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 transition-all duration-200 font-medium shadow-sm"
              >
                Export to PDF
              </button>
            </div>

            {isPreviewMode ? (
              <div ref={resumeRef} className="max-w-4xl mx-auto bg-white shadow-lg min-h-[11in] p-8 rounded-lg">
                {/* ... Preview Mode JSX ... (no changes here) */}
                <div className="text-center mb-8 border-b-2 border-amber-200 pb-6">
                  <h1 className="text-3xl font-bold text-black mb-2">
                    {resume.contact.name || "Your Name"}
                  </h1>
                  <div className="flex justify-center items-center space-x-4 text-sm text-black">
                    {resume.contact.email && <span>{resume.contact.email}</span>}
                    {resume.contact.phone && <span>&bull;</span>}
                    {resume.contact.phone && <span>{resume.contact.phone}</span>}
                    {resume.contact.location && <span>&bull;</span>}
                    {resume.contact.location && <span>{resume.contact.location}</span>}
                  </div>
                </div>
                <div className="space-y-6">
                  {resume.sections.map((section) => (
                    <div key={section.id} className="mb-6">
                      <h2 className="text-xl font-bold text-black mb-3 uppercase tracking-wide border-b border-amber-300 pb-1">
                        {section.type}
                      </h2>
                      <div className="mb-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-black">{section.title}</h3>
                            {section.subtitle && <p className="text-base font-medium text-black">{section.subtitle}</p>}
                          </div>
                          <div className="text-right text-sm text-black">
                            {(section.startDate || section.endDate) && <div>{section.startDate} - {section.endDate}</div>}
                            {section.location && <div className="mt-1">{section.location}</div>}
                          </div>
                        </div>
                        <div className="text-sm text-black leading-relaxed whitespace-pre-wrap">{section.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[300px_1fr] gap-8">
                {/* ... Edit Mode JSX ... (no changes here) */}
                <div className="space-y-4">
                  <div className="bg-white/60 backdrop-blur-sm border border-amber-200 rounded-lg shadow-sm">
                    <div className="p-4 border-b border-amber-200 bg-amber-50/50">
                      <h2 className="text-lg font-medium text-black">Contact Information</h2>
                    </div>
                    <div className="p-4">
                      {(Object.keys(resume.contact) as Array<keyof ResumeContact>).map((key) => (
                        <div key={key} className="mb-4 last:mb-0">
                          <label className="block text-sm font-medium text-black mb-1 capitalize">{key}</label>
                          <input
                            type="text"
                            value={resume.contact[key]}
                            onChange={(e) => setResume((prev) => ({ ...prev, contact: { ...prev.contact, [key]: e.target.value } }))}
                            className="w-full px-3 py-2 border border-amber-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm bg-white/80 text-black"
                            placeholder={`Enter ${key}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddSection}
                    className="w-full px-4 py-2 bg-white/60 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-50 transition-colors text-black"
                  >
                    Add New Section
                  </button>
                </div>
                <div className="space-y-6">
                  {resume.sections.map((section, index) => (
                    <div key={section.id} className="bg-white/60 backdrop-blur-sm border border-amber-200 rounded-lg shadow-sm">
                      <div className="p-4 border-b border-amber-200 flex items-center justify-between bg-amber-50/50">
                        <select
                          value={section.type}
                          onChange={(e) => {
                            const newSections = [...resume.sections];
                            newSections[index] = { ...newSections[index], type: e.target.value };
                            setResume((prev) => ({ ...prev, sections: newSections }));
                          }}
                          className="text-sm font-medium bg-transparent border-0 focus:ring-0 text-black"
                        >
                          <option value="experience">Experience</option>
                          <option value="education">Education</option>
                          <option value="skills">Skills</option>
                          <option value="projects">Projects</option>
                          <option value="certifications">Certifications</option>
                        </select>
                        <button
                          onClick={() => setResume((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== section.id) }))}
                          className="text-sm text-black hover:text-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="p-4 space-y-4">
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => {
                            const newSections = [...resume.sections];
                            newSections[index] = { ...newSections[index], title: e.target.value };
                            setResume((prev) => ({ ...prev, sections: newSections }));
                          }}
                          className="w-full px-3 py-2 text-lg font-medium border-0 focus:ring-0 focus:outline-none bg-transparent text-black placeholder-gray-500"
                          placeholder="Section Title"
                        />
                        <input
                          type="text"
                          value={section.subtitle || ""}
                          onChange={(e) => {
                            const newSections = [...resume.sections];
                            newSections[index] = { ...newSections[index], subtitle: e.target.value };
                            setResume((prev) => ({ ...prev, sections: newSections }));
                          }}
                          className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white/80 text-black placeholder-gray-500"
                          placeholder="Subtitle (optional)"
                        />
                        {(section.type === "experience" || section.type === "education") && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-black mb-1">Start Date</label>
                                <input
                                  type="text"
                                  value={section.startDate || ""}
                                  onChange={(e) => {
                                    const newSections = [...resume.sections];
                                    newSections[index] = { ...newSections[index], startDate: e.target.value };
                                    setResume((prev) => ({ ...prev, sections: newSections }));
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white/80 text-black placeholder-gray-500"
                                  placeholder="MM/YYYY"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-black mb-1">End Date</label>
                                <input
                                  type="text"
                                  value={section.endDate || ""}
                                  onChange={(e) => {
                                    const newSections = [...resume.sections];
                                    newSections[index] = { ...newSections[index], endDate: e.target.value };
                                    setResume((prev) => ({ ...prev, sections: newSections }));
                                  }}
                                  className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white/80 text-black placeholder-gray-500"
                                  placeholder="MM/YYYY or Present"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-black mb-1">Location</label>
                              <input
                                type="text"
                                value={section.location || ""}
                                onChange={(e) => {
                                  const newSections = [...resume.sections];
                                  newSections[index] = { ...newSections[index], location: e.target.value };
                                  setResume((prev) => ({ ...prev, sections: newSections }));
                                }}
                                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white/80 text-black placeholder-gray-500"
                                placeholder="City, State"
                              />
                            </div>
                          </>
                        )}
                        <textarea
                          value={section.content}
                          onChange={(e) => {
                            const newSections = [...resume.sections];
                            newSections[index] = { ...newSections[index], content: e.target.value };
                            setResume((prev) => ({ ...prev, sections: newSections }));
                          }}
                          rows={4}
                          className="w-full px-3 py-2 text-sm border border-amber-200 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white/80 text-black placeholder-gray-500"
                          placeholder="Enter section content..."
                        />
                      </div>
                    </div>
                  ))}
                  {resume.sections.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-amber-300 rounded-lg bg-white/30">
                      <p className="text-black">Click &quot;Add New Section&quot; to begin building your resume</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : ( // Analysis View
          <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
            <div className="flex-1 bg-white/60 backdrop-blur-sm border border-amber-200 rounded-lg shadow-sm min-w-0">
              <div className="p-6 border-b border-amber-200 bg-amber-50/50">
                <h3 className="text-xl font-semibold text-black">Resume Analysis</h3>
                <p className="text-sm text-amber-700 mt-1">Click on highlighted text to view suggestions.</p>
              </div>
              <div className="p-6 whitespace-pre-wrap text-black">
                {isProcessingAction && parsedContentForDisplay.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700 mb-4"></div>
                        <p className="text-amber-700">Analyzing your resume...</p>
                    </div>
                )}
                {!isProcessingAction && parsedContentForDisplay.length === 0 && analysisResultText && (
                  <p className="text-gray-600">Could not parse suggestions from the analyzed text. Displaying raw analysis: <br/> {analysisResultText}</p>
                )}
                {!isProcessingAction && parsedContentForDisplay.length === 0 && !analysisResultText && (
                    <p className="text-gray-600 text-center py-10">Analysis will appear here once a resume is processed.</p>
                )}
                {parsedContentForDisplay.map((part, index) => {
                  if (part.type === "regular") {
                    return <span key={index}>{part.text}</span>;
                  }
                  const suggestion = part.suggestionId ? suggestionsMap[part.suggestionId] : null;
                  if (!suggestion) return <span key={index} className="text-red-500 italic">[Error displaying part]</span>;

                  let displayClass = "bg-yellow-200/70 border border-yellow-400 text-yellow-900"; // Default highlight
                  if (suggestion.accepted === true) {
                    displayClass = "bg-green-200/70 border border-green-400 text-green-900";
                  } else if (suggestion.accepted === false) {
                    displayClass = "bg-red-200/70 border border-red-400 text-red-900 line-through";
                  }
                  const ringClass = selectedSuggestionId === suggestion.id ? "ring-2 ring-amber-600" : "";

                  return (
                    <span
                      key={index}
                      onClick={() => setSelectedSuggestionId(suggestion.id)}
                      className={`${displayClass} ${ringClass} px-1 py-0.5 rounded inline-block cursor-pointer hover:ring-2 hover:ring-amber-500`}
                    >
                      {suggestion.accepted ? suggestion.suggestion : part.text}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="w-full lg:w-96 space-y-4 flex-shrink-0"> {/* Increased width for better layout */}
              <div className="bg-white/60 backdrop-blur-sm border border-amber-200 rounded-lg shadow-sm h-fit sticky top-8">
                <div className="p-4 border-b border-amber-200 bg-amber-50/50">
                    <h4 className="font-medium text-black">Suggestion Details</h4>
                </div>
                {selectedSuggestionId && suggestionsMap[selectedSuggestionId] ? (
                  <div className="p-4 text-black">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-amber-800">Original Text:</p>
                        <p className="text-sm mt-1 bg-yellow-100/80 p-2 rounded border border-yellow-300">{suggestionsMap[selectedSuggestionId].original}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-amber-800">Suggested Change:</p>
                        <p className="text-sm mt-1 bg-amber-100/80 p-2 rounded border border-amber-300">{suggestionsMap[selectedSuggestionId].suggestion}</p>
                      </div>
                      {suggestionsMap[selectedSuggestionId].accepted === undefined && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleSuggestionClick(selectedSuggestionId, true)} className="flex-1 text-sm px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">Accept</button>
                          <button onClick={() => handleSuggestionClick(selectedSuggestionId, false)} className="flex-1 text-sm px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Reject</button>
                        </div>
                      )}
                       {suggestionsMap[selectedSuggestionId].accepted !== undefined && (
                         <p className={`text-sm font-medium mt-3 p-2 rounded border ${suggestionsMap[selectedSuggestionId].accepted ? 'bg-green-100/80 border-green-300 text-green-700' : 'bg-red-100/80 border-red-300 text-red-700'}`}>
                            {suggestionsMap[selectedSuggestionId].accepted ? "Suggestion Accepted" : "Suggestion Rejected"}
                         </p>
                       )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-center text-amber-700">Click on a highlighted text to view and manage suggestions.</div>
                )}
                <div className="p-4 border-t border-amber-200">
                  <button
                    onClick={triggerTransferToBuilder}
                    disabled={isProcessingAction}
                    className="w-full px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-lg hover:from-amber-700 hover:to-amber-800 disabled:from-amber-400 disabled:to-amber-500 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm"
                    >
                    {isProcessingAction && view === 'analysis' ? (
                      <div className="flex items-center justify-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Transferring...</div>
                    ) : "Apply & Transfer to Builder"}
                  </button>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-sm border border-amber-200 rounded-lg shadow-sm">
                <div className="p-4 border-b border-amber-200 bg-amber-50/50 flex items-center justify-between">
                  <h4 className="font-medium text-black">Resume Score</h4>
                  <button
                    onClick={triggerReanalyzeScore}
                    disabled={isProcessingAction}
                    className="px-3 py-1 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed transition-colors"
                  >
                     {isProcessingAction && currentResumeScore === null ? (
                      <div className="flex items-center"><div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>Scoring...</div>
                     ) : "Reanalyze Score"}
                  </button>
                </div>
                {isProcessingAction && currentResumeScore === null && (
                    <div className="p-4 text-center text-amber-700">
                        <div className="flex items-center justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mr-2"></div>
                            Analyzing score...
                        </div>
                    </div>
                )}
                {!isProcessingAction && currentResumeScore && currentResumeScore.criteria && Array.isArray(currentResumeScore.criteria) ? (
                  <div className="p-4 text-black">
                    <div className="text-center mb-4">
                      <div className={`text-3xl font-bold ${currentResumeScore.overallScore >= 70 ? 'text-green-600' : currentResumeScore.overallScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {currentResumeScore.overallScore}/100
                      </div>
                      <div className="text-sm text-amber-700">Overall Score</div>
                    </div>
                    <div className="space-y-3">
                      {currentResumeScore.criteria.map((criterion, index) => (
                        <div key={index} className="border border-amber-200 rounded-lg p-3 bg-white/50">
                          <div className="flex justify-between items-center mb-1">
                            <h5 className="font-medium text-sm text-amber-800">{criterion.name}</h5>
                            <span className={`font-semibold ${criterion.score >= 70 ? 'text-green-600' : criterion.score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {criterion.score}/100
                            </span>
                          </div>
                          <div className="w-full bg-amber-100 rounded-full h-2.5 mb-2">
                            <div
                                className={`h-2.5 rounded-full transition-all duration-300 ${criterion.score >= 70 ? 'bg-green-500' : criterion.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${criterion.score}%` }}>
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 mb-1">{criterion.feedback}</p>
                          {criterion.improvements && Array.isArray(criterion.improvements) && criterion.improvements.length > 0 && (
                            <div className="text-xs">
                              <strong className="text-amber-700">Improvements:</strong>
                              <ul className="list-disc list-inside text-gray-600 mt-1">
                                {criterion.improvements.map((improvement, idx) => <li key={idx}>{improvement}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  !isProcessingAction && (
                    <div className="p-4 text-center text-sm text-amber-700">
                      {currentResumeScore && currentResumeScore.overallScore === 0 && (!currentResumeScore.criteria || currentResumeScore.criteria.length === 0)
                      ? "Could not retrieve valid score details. Please try reanalyzing."
                      : "Resume score will appear here after analysis."}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {view === "analysis" && (
          <button
            onClick={resetAnalysisView}
            title="Upload New or Start Fresh"
            className="fixed bottom-6 right-6 bg-amber-600 text-white rounded-full p-3 shadow-lg hover:bg-amber-700 transition-colors z-20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5l3 3m0 0l3-3m-3 3v-6m1.06-4.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </button>
        )}

        {/* Removed the global loading overlay */}
      </div>
    </div>
  );
};

export default ResumePageClient;