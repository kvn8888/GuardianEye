import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, Mic, FileText, ChevronRight, Loader } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { mockScans, type ScanResult } from "@/data/mockData";
import { listScans } from "@/api/client";
import { adaptScanResult } from "@/api/adapters";

const typeIcons = { screenshot: Camera, voice: Mic, text: FileText };

const verdictBadge = {
  scam: "bg-destructive/10 text-destructive border-destructive/20",
  caution: "bg-accent/40 text-accent-foreground border-accent",
  safe: "bg-secondary/20 text-primary border-secondary",
};

const verdictLabel = { scam: "Scam", caution: "Caution", safe: "Safe" };

const MyScansPage = () => {
  const navigate = useNavigate();
  const [scans, setScans] = useState<ScanResult[]>(mockScans);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listScans().then((results) => {
      if (results.length > 0) {
        const adapted = results
          .filter((r) => r.verdict) // only completed scans
          .map(adaptScanResult);
        setScans(adapted.length > 0 ? adapted : mockScans);
      }
      setLoading(false);
    });
  }, []);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-foreground text-center mb-3">My Scans</h1>
        <p className="text-lg text-muted-foreground text-center mb-10">
          Review your previous scan results.
        </p>

        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader className="animate-spin text-primary" size={28} />
            </div>
          ) : (
          scans.map((scan) => {
            const Icon = typeIcons[scan.type];
            return (
              <Card
                key={scan.id}
                className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0 cursor-pointer hover:shadow-[0_8px_30px_rgba(63,154,174,0.15)] transition-shadow"
                onClick={() => navigate(`/verdict/${scan.id}`)}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={22} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-base truncate">{scan.input}</p>
                    <p className="text-sm text-muted-foreground">{scan.date}</p>
                  </div>
                  <Badge className={`${verdictBadge[scan.verdict]} text-sm rounded-lg border px-3 py-1`}>
                    {verdictLabel[scan.verdict]}
                  </Badge>
                  <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyScansPage;
