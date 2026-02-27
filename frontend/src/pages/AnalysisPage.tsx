import Layout from "@/components/Layout";
import { CheckCircle, Loader } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { analysisSteps, analysisFindings } from "@/data/mockData";
import { subscribeScanStatus, type ScanEvent } from "@/api/client";

// Map backend SSE step names to our UI step indices
const stepNameToIndex: Record<string, number> = {
  reka_vision: 0,
  voice_analysis: 0,
  gliner_extract: 1,
  tavily_search: 2,
  yutori_research: 3,
  verdict: 5,
};

const completionEvents: Record<string, number> = {
  reka_complete: 0,
  voice_complete: 0,
  gliner_complete: 1,
  tavily_complete: 2,
  yutori_complete: 3,
};

const AnalysisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as any) || {};
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [findings, setFindings] = useState<(string | null)[]>(new Array(analysisSteps.length).fill(null));
  const cleanupRef = useRef<(() => void) | null>(null);
  const scanId = routeState.scanId;
  const uploadStage = routeState.uploadStage;
  const isUploading = uploadStage === "uploading" && !scanId;

  useEffect(() => {
    if (!scanId) {
      // No scan ID — fall back to timer-based animation (demo mode)
      return;
    }

    const cleanup = subscribeScanStatus(
      scanId,
      (ev: ScanEvent) => {
        const { event, data } = ev;

        // Handle step start events
        if (event === "step" || event === "message") {
          const stepName = data?.step || data?.data?.step;
          if (stepName && stepNameToIndex[stepName] !== undefined) {
            setCurrentStep(stepNameToIndex[stepName]);
          }
        }

        // Handle step completion events
        if (completionEvents[event] !== undefined) {
          const idx = completionEvents[event];
          setCompletedSteps((prev) => [...new Set([...prev, idx])]);
          setCurrentStep((prev) => Math.max(prev, idx + 1));

          // Extract finding text from the event data
          if (event === "reka_complete" || event === "voice_complete") {
            const visual = data?.visual || data?.voice;
            if (visual) {
              const conf = visual.scam_confidence || visual.fraud_score || 0;
              setFindings((prev) => {
                const next = [...prev];
                next[idx] = conf > 60
                  ? `Detected suspicious patterns (confidence: ${conf}%)`
                  : `Analysis complete (confidence: ${conf}%)`;
                return next;
              });
            }
          }
          if (event === "gliner_complete") {
            const count = data?.entities?.length || 0;
            setFindings((prev) => {
              const next = [...prev];
              next[idx] = `Found ${count} entities (phone numbers, URLs, companies)`;
              return next;
            });
          }
          if (event === "tavily_complete") {
            const count = data?.results?.length || 0;
            setFindings((prev) => {
              const next = [...prev];
              next[idx] = `Checked ${count} scam databases`;
              return next;
            });
          }
          if (event === "yutori_complete") {
            const count = data?.results?.length || 0;
            setFindings((prev) => {
              const next = [...prev];
              next[idx] = `Deep research complete — ${count} entities investigated`;
              return next;
            });
          }
        }

        // Network mapping step (auto-complete since Neo4j stores happen at the end)
        if (event === "verdict") {
          setCompletedSteps((prev) => [...new Set([...prev, 4])]);
          setFindings((prev) => {
            const next = [...prev];
            next[4] = "Connected to known scam network";
            return next;
          });
        }
      },
      () => {
        // On complete — mark all done and navigate
        setCompletedSteps([0, 1, 2, 3, 4, 5]);
        setCurrentStep(analysisSteps.length);
        setTimeout(() => navigate(`/verdict/${scanId}`), 800);
      },
      () => {
        // On error — still navigate, verdict may be ready
        setTimeout(() => navigate(`/verdict/${scanId}`), 500);
      },
    );

    cleanupRef.current = cleanup;
    return () => cleanup();
  }, [scanId, navigate]);

  // Fallback: timer-based animation when no scanId (demo mode)
  useEffect(() => {
    if (scanId || isUploading) return; // SSE/upload state is handling it

    if (currentStep >= analysisSteps.length) {
      setTimeout(() => navigate(`/verdict/1`), 600);
      return;
    }

    const timer = setTimeout(() => {
      setCompletedSteps((prev) => [...prev, currentStep]);
      setCurrentStep((prev) => prev + 1);
    }, 2000 + Math.random() * 1500);

    return () => clearTimeout(timer);
  }, [currentStep, navigate, scanId]);

  return (
    <Layout>
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
          <CardContent className="p-8 md:p-12">
            <h2 className="text-center text-foreground mb-8">Analyzing Your Submission</h2>

            <div className="space-y-4">
              {isUploading && (
                <div className="flex items-start gap-4 p-4 rounded-xl bg-primary/5">
                  <div className="mt-0.5 flex-shrink-0">
                    <Loader size={24} className="text-destructive animate-spin-slow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground">Uploading Screenshot</p>
                    <p className="text-sm text-muted-foreground">
                      Sending your image to GuardianEye now. Analysis will begin as soon as the upload finishes.
                    </p>
                  </div>
                </div>
              )}
              {analysisSteps.map((step, i) => {
                const isComplete = completedSteps.includes(i);
                const isActive = !isUploading && currentStep === i;

                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 p-4 rounded-xl transition-all ${
                      isActive ? "bg-primary/5" : isComplete ? "bg-secondary/20" : "opacity-40"
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isComplete ? (
                        <CheckCircle size={24} className="text-primary" />
                      ) : isActive ? (
                        <Loader size={24} className="text-destructive animate-spin-slow" />
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground">{step.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {isComplete
                          ? (findings[i] || analysisFindings[i])
                          : step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-muted-foreground text-base mt-8">
              {isUploading
                ? "Large screenshots can take a moment to prepare and upload before analysis starts."
                : "Your first verdict should arrive quickly. Deeper background checks may continue after the result page opens."}
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AnalysisPage;
