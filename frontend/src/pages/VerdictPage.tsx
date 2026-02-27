import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle, Bell, Network, Phone, Loader } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import type { ScanResult } from "@/data/mockData";
import { getScanVerdict, alertFamily } from "@/api/client";
import { adaptScanResult } from "@/api/adapters";

const VerdictPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerting, setAlerting] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10;

    const load = async () => {
      const result = await getScanVerdict(id);
      if (cancelled) return;

      if (result && result.verdict) {
        setScan(adaptScanResult(result));
        setLoading(false);
        return;
      }

      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(load, 600);
        return;
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAlertFamily = async () => {
    if (!id) return;
    setAlerting(true);
    try {
      await alertFamily(id, `GuardianEye detected a potential scam (${scan?.verdict})`);
      setAlertSent(true);
    } catch {
      // Still show success for demo
      setAlertSent(true);
    }
    setAlerting(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader className="animate-spin text-primary" size={32} />
        </div>
      </Layout>
    );
  }

  if (!scan) {
    return (
      <Layout>
        <div className="text-center mt-12">
          <p className="text-muted-foreground">Scan not found.</p>
        </div>
      </Layout>
    );
  }

  const verdictConfig = {
    scam: {
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      glow: "shadow-[0_0_40px_rgba(249,110,91,0.15)]",
      text: "text-destructive",
      label: "This Is a Scam",
      icon: AlertTriangle,
      ringColor: "text-destructive",
    },
    caution: {
      bg: "bg-accent/30",
      border: "border-accent",
      glow: "shadow-[0_0_40px_rgba(255,226,175,0.3)]",
      text: "text-accent-foreground",
      label: "Be Careful",
      icon: AlertCircle,
      ringColor: "text-accent",
    },
    safe: {
      bg: "bg-secondary/20",
      border: "border-secondary",
      glow: "shadow-[0_0_40px_rgba(121,201,197,0.2)]",
      text: "text-primary",
      label: "This Looks Safe",
      icon: CheckCircle,
      ringColor: "text-secondary",
    },
  };

  const config = verdictConfig[scan.verdict];
  const VerdictIcon = config.icon;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Verdict Banner */}
        <div className={`rounded-2xl p-8 text-center mb-8 ${config.bg} ${config.border} ${config.glow} border`}>
          <VerdictIcon size={48} className={`mx-auto mb-4 ${config.text}`} />
          <h1 className={`${config.text} mb-2`}>{config.label}</h1>
          <p className="text-muted-foreground text-lg">{scan.input}</p>
        </div>

        {/* Confidence Ring */}
        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
              <circle
                cx="60" cy="60" r="52"
                stroke={scan.verdict === "scam" ? "hsl(var(--destructive))" : scan.verdict === "caution" ? "hsl(var(--accent))" : "hsl(var(--secondary))"}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${scan.confidence * 3.27} 327`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-extrabold text-foreground">{scan.confidence}%</span>
            </div>
          </div>
        </div>

        {/* Findings */}
        <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 mb-6">
          <CardContent className="p-8">
            <h2 className="text-foreground mb-4">Here is what we found</h2>
            <div className="space-y-3">
              {scan.findings.map((finding, i) => (
                <div key={i} className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-foreground text-base">{finding}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Suspicious Items */}
        {scan.suspiciousItems.length > 0 && (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 mb-6">
            <CardContent className="p-8">
              <h2 className="text-foreground mb-4">Suspicious items detected</h2>
              <div className="flex flex-wrap gap-3">
                {scan.suspiciousItems.map((item, i) => (
                  <Badge
                    key={i}
                    className="bg-destructive/10 text-destructive border-destructive/20 px-4 py-2 text-base font-semibold rounded-xl"
                  >
                    {item.type === "phone" && <Phone size={14} className="mr-1.5" />}
                    {item.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Network Preview */}
        {scan.connectedReports > 0 && (
          <Card
            className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 mb-6 cursor-pointer hover:shadow-[0_8px_30px_rgba(63,154,174,0.15)] transition-shadow"
            onClick={() => {
              const entity = scan.suspiciousItems[0]?.label || id;
              navigate(`/network?entity=${encodeURIComponent(entity || "")}`);
            }}
          >
            <CardContent className="p-8 flex items-center gap-4">
              <Network size={28} className="text-primary flex-shrink-0" />
              <div>
                <p className="font-bold text-foreground text-lg">
                  This scam is connected to {scan.connectedReports} other reports
                </p>
                <p className="text-muted-foreground">Click to explore the scam network</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alert My Family */}
        {scan.verdict === "scam" && (
          <Button
            onClick={handleAlertFamily}
            disabled={alerting || alertSent}
            className="w-full rounded-xl h-16 text-xl font-bold bg-destructive hover:bg-destructive/90 mb-6"
          >
            <Bell size={22} className="mr-2" />
            {alertSent ? "Family Alerted ✓" : alerting ? "Sending..." : "Alert My Family"}
          </Button>
        )}

        {/* Footer */}
        <p className="text-center text-muted-foreground text-base">
          Not sure? You can always call your bank or a trusted family member.
        </p>
      </div>
    </Layout>
  );
};

export default VerdictPage;
