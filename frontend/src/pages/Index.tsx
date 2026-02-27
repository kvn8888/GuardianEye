import Layout from "@/components/Layout";
import { Upload, Mic, FileText, Shield, TrendingUp, Clock, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState, useCallback, useRef } from "react";
import { submitImageScan, submitVoiceScan, submitTextScan } from "@/api/client";

const stats = [
  { label: "$81.5B lost annually", icon: TrendingUp },
  { label: "1,210% surge in AI scams", icon: Shield },
  { label: "1 senior targeted every 3 seconds", icon: Clock },
];

const Index = () => {
  const navigate = useNavigate();
  const [textInput, setTextInput] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setLoading("screenshot");
    try {
      const { scan_id } = await submitImageScan(file);
      navigate("/analysis", { state: { type: "screenshot", scanId: scan_id } });
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  }, [navigate]);

  const handleVoiceUpload = useCallback(async (file: File) => {
    setLoading("voice");
    try {
      const { scan_id } = await submitVoiceScan(file);
      navigate("/analysis", { state: { type: "voice", scanId: scan_id } });
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  }, [navigate]);

  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;
    setLoading("text");
    try {
      const { scan_id } = await submitTextScan(textInput);
      navigate("/analysis", { state: { type: "text", scanId: scan_id } });
    } catch (err) {
      console.error(err);
      setLoading(null);
    }
  }, [textInput, navigate]);

  return (
    <Layout>
      {/* Hero */}
      <section className="px-4 pt-12 pb-8 md:pt-20 md:pb-12 text-center max-w-4xl mx-auto">
        <h1 className="text-foreground mb-4 leading-tight">
          Is This a Scam?<br />Let GuardianEye Check.
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Protecting families from AI-powered scams. Snap, record, or paste — get an answer in seconds.
        </p>
      </section>

      {/* Stats Bar */}
      <section className="max-w-4xl mx-auto px-4 pb-10">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-card rounded-2xl px-6 py-4 shadow-[0_4px_20px_rgba(63,154,174,0.1)] animate-fade-up"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <stat.icon size={22} className="text-primary flex-shrink-0" />
              <span className="text-base font-bold text-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Input Cards */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Screenshot Upload */}
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 hover:shadow-[0_8px_30px_rgba(63,154,174,0.15)] transition-shadow">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Camera size={28} className="text-primary" />
              </div>
              <h3 className="text-foreground mb-2">Analyze a Screenshot</h3>
              <p className="text-muted-foreground text-base mb-6">
                Upload a screenshot of a suspicious email, text, or website.
              </p>
              <div
                className={`w-full border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer ${
                  dragOver === "screenshot"
                    ? "border-primary bg-primary/5"
                    : "border-primary/30 hover:border-primary/60"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("screenshot"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const file = e.dataTransfer.files[0];
                  if (file) handleImageUpload(file);
                }}
                onClick={() => imageInputRef.current?.click()}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
                <Upload size={24} className="text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {loading === "screenshot" ? "Uploading..." : "Drag and drop or click to upload"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Voice Upload */}
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 hover:shadow-[0_8px_30px_rgba(63,154,174,0.15)] transition-shadow">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Mic size={28} className="text-primary" />
              </div>
              <h3 className="text-foreground mb-2">Analyze a Voice Call</h3>
              <p className="text-muted-foreground text-base mb-6">
                Upload a recording of a suspicious phone call.
              </p>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.aac,.opus"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVoiceUpload(file);
                }}
              />
              <Button
                onClick={() => audioInputRef.current?.click()}
                disabled={loading === "voice"}
                className="w-full rounded-xl h-14 text-lg font-bold bg-primary hover:bg-primary/90"
              >
                <Mic size={20} />
                {loading === "voice" ? "Uploading..." : "Upload Audio File"}
              </Button>
            </CardContent>
          </Card>

          {/* Text Input */}
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 hover:shadow-[0_8px_30px_rgba(63,154,174,0.15)] transition-shadow">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <FileText size={28} className="text-primary" />
              </div>
              <h3 className="text-foreground mb-2">Paste Suspicious Text</h3>
              <p className="text-muted-foreground text-base mb-6">
                Copy and paste the message you want us to check.
              </p>
              <Textarea
                placeholder="Paste the suspicious message here..."
                className="rounded-xl border-primary/20 focus:border-primary mb-4 min-h-[100px] text-base"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
              <Button
                onClick={handleTextSubmit}
                disabled={!textInput.trim() || loading === "text"}
                className="w-full rounded-xl h-14 text-lg font-bold bg-primary hover:bg-primary/90"
              >
                {loading === "text" ? "Submitting..." : "Analyze Text"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Monitoring Banner */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="bg-primary/5 rounded-2xl px-8 py-5 text-center">
          <p className="text-base text-muted-foreground">
            <Shield size={16} className="inline-block mr-2 text-primary -mt-0.5" />
            GuardianEye is actively monitoring FTC alerts, FBI IC3, Reddit, and ScamAdviser right now.
          </p>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
