"use client";
import React, { useState, useTransition, useRef, ChangeEvent } from "react";
import {
  handleResumeUploadAndAnalyze,
  handleTransferToBuilder,
  handleAnalyzeResumeScore,
} from "@/server/resumeActions"; // Ensure this path is correct
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type {
  ParsedContent,
  Suggestion,
  Resume,
  ResumeScore,
  ResumeContact,
} from "@/types/resumeTypes";

const ResumePageClient = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");

  const [isProcessingAction, startTransition] = useTransition();

  const [analysisResultText, setAnalysisResultText] = useState<string>("");
  const [parsedContentForDisplay, setParsedContentForDisplay] = useState<
    ParsedContent[]
  >([]);
  const [suggestionsMap, setSuggestionsMap] = useState<
    Record<string, Suggestion>
  >({});
  const [currentResumeScore, setCurrentResumeScore] =
    useState<ResumeScore | null>(null);

  const [view, setView] = useState<"upload" | "analysis" | "builder">("upload");
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const [resume, setResume] = useState<Resume>({
    contact: { name: "", email: "", phone: "", location: "" },
    sections: [],
  });
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<
    string | null
  >(null);
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
        setFileError("Please upload a PDF file");
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
        newSuggestions[suggestionId] = {
          id: suggestionId,
          original,
          suggestion: suggestionText,
        };
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
      setFileError("Please select a PDF file.");
      return;
    }
    setFileError("");

    const formData = new FormData();
    formData.append("pdfFile", pdfFile);

    console.log("Client: Calling handleResumeUploadAndAnalyze...");
    startTransition(async () => {
      try {
        const result = await handleResumeUploadAndAnalyze(formData);
        console.log(
          "Client: Received from handleResumeUploadAndAnalyze:",
          result
        );

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
      }
    });
  };

  const handleSuggestionClick = (suggestionId: string, accept: boolean) => {
    setSuggestionsMap((prev) => {
      const newSuggestions = { ...prev };
      if (newSuggestions[suggestionId]) {
        newSuggestions[suggestionId] = {
          ...newSuggestions[suggestionId],
          accepted: accept,
        };
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
        alert("Error generating PDF. Please try again.");
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

    if (!finalContent.trim() && analysisResultText.trim()) {
      finalContent = analysisResultText;
    }
    if (!finalContent.trim()) {
      setFileError("No content to transfer to builder.");
      return;
    }

    console.log(
      "Client: Calling handleTransferToBuilder with content:",
      finalContent.substring(0, 100) + "..."
    );
    startTransition(async () => {
      try {
        const structuredResume = await handleTransferToBuilder(finalContent);
        console.log(
          "Client: Received from handleTransferToBuilder:",
          structuredResume
        );

        if (
          structuredResume &&
          structuredResume.contact &&
          Array.isArray(structuredResume.sections)
        ) {
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
    if (view === "analysis" && parsedContentForDisplay.length > 0) {
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
      contentToScore =
        `Contact: ${resume.contact.name} ${resume.contact.email} ${resume.contact.phone} ${resume.contact.location}\n\n` +
        resume.sections
          .map(
            (s) =>
              `${s.type.toUpperCase()}:\n${s.title} ${s.subtitle || ""}\n${
                s.content
              }`
          )
          .join("\n\n");
    }

    if (!contentToScore.trim()) {
      setFileError("No content available to re-score.");
      return;
    }

    console.log(
      "Client: Calling handleAnalyzeResumeScore with content:",
      contentToScore.substring(0, 100) + "..."
    );
    startTransition(async () => {
      try {
        const newScore = await handleAnalyzeResumeScore(contentToScore);
        console.log(
          "Client: Received from handleAnalyzeResumeScore:",
          newScore
        );

        if (
          newScore &&
          typeof newScore.overallScore === "number" &&
          Array.isArray(newScore.criteria)
        ) {
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
      }
    });
  };

  // --- JSX ---
  // The entire return () block below is your JSX.
  // You had this structure already, so I'm just including it within this component.
  return (
    <div className="flex flex-col min-h-screen bg-white">
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
        {fileError && (
          <p className="text-red-500 text-center mb-4">{fileError}</p>
        )}
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
                    onClick={startFreshBuilder}
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
                      onClick={triggerResumeAnalysis}
                      disabled={isProcessingAction}
                      className="w-full mt-4 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isProcessingAction ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Processing...
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
                disabled={isProcessingAction} // You might want a different state for PDF export if it's purely client-side and can overlap
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Export to PDF
              </button>
            </div>

            {isPreviewMode ? (
              <div
                ref={resumeRef}
                className="max-w-4xl mx-auto bg-white shadow-lg min-h-[11in] p-8"
              >
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
                <div className="space-y-6">
                  {Object.entries(
                    resume.sections.reduce((groups, section) => {
                      const type = section.type;
                      if (!groups[type]) {
                        groups[type] = [];
                      }
                      groups[type].push(section);
                      return groups;
                    }, {} as Record<string, typeof resume.sections>)
                  ).map(([sectionType, sectionsOfType]) => (
                    <div key={sectionType} className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4 uppercase tracking-wide border-b border-gray-300 pb-1">
                        {sectionType}
                      </h2>
                      <div className="space-y-4">
                        {sectionsOfType.map((section) => (
                          <div key={section.id} className="mb-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                {section.title && (
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {section.title}
                                  </h3>
                                )}
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
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[300px_1fr] gap-8">
                <div className="space-y-4">
                  <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-neutral-200">
                      <h2 className="text-lg font-medium">
                        Contact Information
                      </h2>
                    </div>
                    <div className="p-4">
                      {(
                        Object.keys(resume.contact) as Array<
                          keyof ResumeContact
                        >
                      ).map((key) => (
                        <div key={key} className="mb-4 last:mb-0">
                          <label className="block text-sm font-medium text-neutral-700 mb-1 capitalize">
                            {key}
                          </label>
                          <input
                            type="text"
                            value={resume.contact[key]}
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
                            const newSections = [...resume.sections];
                            newSections[index] = {
                              ...newSections[index],
                              type: e.target.value,
                            };
                            setResume((prev) => ({
                              ...prev,
                              sections: newSections,
                            }));
                          }}
                          className="text-sm font-medium bg-transparent border-0 focus:ring-0"
                        >
                          <option value="experience">Experience</option>
                          <option value="education">Education</option>
                          <option value="skills">Skills</option>
                          <option value="projects">Projects</option>
                          <option value="certifications">Certifications</option>
                        </select>
                        <button
                          onClick={() =>
                            setResume((prev) => ({
                              ...prev,
                              sections: prev.sections.filter(
                                (s) => s.id !== section.id
                              ),
                            }))
                          }
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
                            const newSections = [...resume.sections];
                            newSections[index] = {
                              ...newSections[index],
                              title: e.target.value,
                            };
                            setResume((prev) => ({
                              ...prev,
                              sections: newSections,
                            }));
                          }}
                          className="w-full px-3 py-2 text-lg font-medium border-0 focus:ring-0 focus:outline-none"
                          placeholder="Section Title"
                        />
                        <input
                          type="text"
                          value={section.subtitle || ""}
                          onChange={(e) => {
                            const newSections = [...resume.sections];
                            newSections[index] = {
                              ...newSections[index],
                              subtitle: e.target.value,
                            };
                            setResume((prev) => ({
                              ...prev,
                              sections: newSections,
                            }));
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
                                    const newSections = [...resume.sections];
                                    newSections[index] = {
                                      ...newSections[index],
                                      startDate: e.target.value,
                                    };
                                    setResume((prev) => ({
                                      ...prev,
                                      sections: newSections,
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
                                    const newSections = [...resume.sections];
                                    newSections[index] = {
                                      ...newSections[index],
                                      endDate: e.target.value,
                                    };
                                    setResume((prev) => ({
                                      ...prev,
                                      sections: newSections,
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
                                  const newSections = [...resume.sections];
                                  newSections[index] = {
                                    ...newSections[index],
                                    location: e.target.value,
                                  };
                                  setResume((prev) => ({
                                    ...prev,
                                    sections: newSections,
                                  }));
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
                            const newSections = [...resume.sections];
                            newSections[index] = {
                              ...newSections[index],
                              content: e.target.value,
                            };
                            setResume((prev) => ({
                              ...prev,
                              sections: newSections,
                            }));
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
          // Analysis View
          <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
            {" "}
            {/* Adjusted for responsiveness */}
            <div className="flex-1 bg-white rounded-lg shadow-md min-w-0">
              {" "}
              {/* Added min-w-0 for flex child */}
              <div className="p-6 border-b">
                <h3 className="text-xl font-semibold">Resume Analysis</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Click on highlighted text to view suggestions
                </p>
              </div>
              <div className="p-6 whitespace-pre-wrap overflow-x-auto">
                {" "}
                {/* Added overflow-x-auto */}
                {parsedContentForDisplay.map((part, index) => {
                  if (part.type === "regular") {
                    return <span key={index}>{part.text}</span>;
                  }
                  const suggestion = part.suggestionId
                    ? suggestionsMap[part.suggestionId]
                    : null;
                  if (!suggestion)
                    return (
                      <span key={index} className="text-red-500 italic">
                        [Error displaying part]
                      </span>
                    );

                  const displayClass =
                    suggestion.accepted === undefined
                      ? "bg-yellow-200"
                      : suggestion.accepted
                      ? "bg-green-200 text-green-800"
                      : "bg-red-200 text-red-800 line-through";
                  const ringClass =
                    selectedSuggestionId === suggestion.id
                      ? "ring-2 ring-blue-400"
                      : "";

                  return (
                    <span
                      key={index}
                      onClick={() => setSelectedSuggestionId(suggestion.id)}
                      className={`${displayClass} ${ringClass} px-1 py-0.5 rounded inline-block cursor-pointer hover:ring-2 hover:ring-blue-300`}
                    >
                      {
                        suggestion.accepted
                          ? suggestion.suggestion
                          : part.text /* Show original if rejected, suggestion if accepted */
                      }
                    </span>
                  );
                })}
                {analysisResultText &&
                  parsedContentForDisplay.length === 0 &&
                  !isProcessingAction && (
                    <p className="text-gray-500">
                      Could not parse suggestions from the analyzed text.
                      Displaying raw analysis: <br /> {analysisResultText}
                    </p>
                  )}
              </div>
            </div>
            <div className="w-full lg:w-80 space-y-4 flex-shrink-0">
              {" "}
              {/* Adjusted for responsiveness */}
              <div className="bg-white rounded-lg shadow-md h-fit sticky top-8">
                <div className="p-4 border-b">
                  <h4 className="font-medium">Suggestion Details</h4>
                </div>
                {selectedSuggestionId &&
                suggestionsMap[selectedSuggestionId] ? (
                  <div className="p-4">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Original Text:
                        </p>
                        <p className="text-sm mt-1 bg-yellow-100 p-2 rounded border border-yellow-300">
                          {suggestionsMap[selectedSuggestionId].original}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Suggestion:
                        </p>
                        <p className="text-sm mt-1 bg-blue-100 p-2 rounded border border-blue-300">
                          {suggestionsMap[selectedSuggestionId].suggestion}
                        </p>
                      </div>
                      {suggestionsMap[selectedSuggestionId].accepted ===
                        undefined && (
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() =>
                              handleSuggestionClick(selectedSuggestionId, true)
                            }
                            className="flex-1 text-sm px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() =>
                              handleSuggestionClick(selectedSuggestionId, false)
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
                    onClick={triggerTransferToBuilder}
                    disabled={isProcessingAction}
                    className="w-full px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessingAction && view === "analysis" ? ( // Be more specific for loading text
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
              <div className="bg-white rounded-lg shadow-md">
                <div className="p-4 border-b flex items-center justify-between">
                  <h4 className="font-medium">Resume Score</h4>
                  <button
                    onClick={triggerReanalyzeScore}
                    disabled={isProcessingAction}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessingAction && currentResumeScore === null ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-b border-white mr-1"></div>
                        Scoring...
                      </div>
                    ) : (
                      "Reanalyze"
                    )}
                  </button>
                </div>
                {currentResumeScore &&
                currentResumeScore.criteria &&
                Array.isArray(currentResumeScore.criteria) ? (
                  <div className="p-4">
                    <div className="text-center mb-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {currentResumeScore.overallScore}/100
                      </div>
                      <div className="text-sm text-gray-500">Overall Score</div>
                    </div>
                    <div className="space-y-4">
                      {currentResumeScore.criteria.map((criterion, index) => (
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
                          {criterion.improvements &&
                            Array.isArray(criterion.improvements) && (
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
                            )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    {isProcessingAction && currentResumeScore === null ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                        Analyzing score...
                      </div>
                    ) : currentResumeScore &&
                      currentResumeScore.overallScore === 0 &&
                      (!currentResumeScore.criteria ||
                        currentResumeScore.criteria.length === 0) ? (
                      "Could not retrieve valid score details. Please try reanalyzing."
                    ) : (
                      "Resume score will appear here after analysis."
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {view === "analysis" && (
          <button
            onClick={resetAnalysisView}
            className="fixed bottom-6 right-6 bg-blue-500 text-white rounded-full p-4 shadow-lg hover:bg-blue-600 transition-colors z-20"
          >
            {" "}
            {/* Added z-index */}
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

        {isProcessingAction && ( // Single loading overlay
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-sm mx-4 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">
                Processing Request...
              </h3>
              <p className="text-gray-600">Please wait a moment.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumePageClient;
