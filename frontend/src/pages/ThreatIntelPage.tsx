import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Phone, Globe, Network, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockThreatFeed, scamTrendData, type ThreatFeedItem } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useState, useEffect } from "react";
import { getRecentThreats, getScoutStatus, createScout } from "@/api/client";
import { adaptThreatsToFeed } from "@/api/adapters";

const ThreatIntelPage = () => {
  const [feed, setFeed] = useState<ThreatFeedItem[]>(mockThreatFeed);
  const [stats, setStats] = useState({ threats: "47", numbers: "12", sites: "3", networks: "23" });
  const [scoutCount, setScoutCount] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // Fetch real threats, fall back to mock
    getRecentThreats().then(({ threats }) => {
      if (threats.length > 0) {
        setFeed(adaptThreatsToFeed(threats));
        const highCount = threats.filter((t) => t.reports > 10).length;
        setStats({
          threats: String(threats.length),
          numbers: String(threats.filter((t) => t.entityType === "PhoneNumber").length),
          sites: String(threats.filter((t) => t.entityType === "URL").length),
          networks: String(highCount),
        });
      }
    });
    getScoutStatus().then(({ count }) => setScoutCount(count));
  }, []);

  const handleCreateScout = async () => {
    setCreating(true);
    try {
      await createScout();
      setScoutCount((prev) => prev + 1);
    } catch {}
    setCreating(false);
  };

  const statCards = [
    { label: "Threats Today", value: stats.threats, icon: AlertTriangle },
    { label: "New Scam Numbers", value: stats.numbers, icon: Phone },
    { label: "New Phishing Sites", value: stats.sites, icon: Globe },
    { label: "Networks Mapped", value: stats.networks, icon: Network },
  ];

  const severityClasses: Record<string, string> = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-accent/40 text-accent-foreground border-accent",
    low: "bg-secondary/20 text-primary border-secondary",
  };
  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-foreground mb-3">
            <Shield size={32} className="inline-block mr-3 text-primary -mt-1" />
            Threat Intelligence
          </h1>
          <p className="text-lg text-muted-foreground">
            GuardianEye is watching so you do not have to.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {statCards.map((stat, i) => (
            <Card key={i} className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
              <CardContent className="p-6 text-center">
                <stat.icon size={28} className="text-primary mx-auto mb-3" />
                <p className="text-3xl font-extrabold text-foreground">{stat.value}</p>
                <p className="text-sm text-muted-foreground font-semibold">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Threat Feed */}
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
            <CardContent className="p-6">
              <h2 className="text-foreground mb-4">Live Threat Feed</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {feed.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl bg-background border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-foreground text-sm">{item.type}</span>
                      <Badge className={`${severityClasses[item.severity]} text-xs rounded-lg border`}>
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mb-1">{item.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.source}</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Trending Chart */}
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
            <CardContent className="p-6">
              <h2 className="text-foreground mb-4">Trending Scam Types</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={scamTrendData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 14, fill: "hsl(215, 18%, 51%)" }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={28}>
                    {scamTrendData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-muted-foreground text-base mt-8">
          Powered by Yutori autonomous web agents — monitoring threat sources continuously.
          {scoutCount > 0 && ` ${scoutCount} scout(s) active.`}
        </p>
        <div className="flex justify-center mt-4">
          <Button
            onClick={handleCreateScout}
            disabled={creating}
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            {creating ? "Creating..." : `+ Deploy New Scout (${scoutCount} active)`}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default ThreatIntelPage;
