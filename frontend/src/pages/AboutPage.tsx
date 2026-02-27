import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Search, Brain, Bell, Users } from "lucide-react";

const steps = [
  { icon: Search, title: "You share something suspicious", desc: "Upload a screenshot, record a phone call, or paste a text message you are not sure about." },
  { icon: Brain, title: "Our AI analyzes it", desc: "GuardianEye uses advanced AI to scan for fake logos, suspicious links, impersonated brands, and known scam patterns." },
  { icon: Shield, title: "We check our databases", desc: "Your submission is cross-referenced against 47 known scam databases, FTC reports, FBI IC3, and community reports." },
  { icon: Bell, title: "You get a clear answer", desc: "We tell you if it is safe, suspicious, or a confirmed scam — in plain English, with no confusing jargon." },
];

const AboutPage = () => {
  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <Shield size={48} className="text-primary mx-auto mb-4" />
          <h1 className="text-foreground mb-4">About GuardianEye</h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            GuardianEye is a free tool built to protect seniors and their families from the growing
            epidemic of AI-powered scams. Every year, billions of dollars are stolen from vulnerable
            people through phone calls, emails, and text messages designed to deceive.
          </p>
        </div>

        <h2 className="text-foreground text-center mb-8">How It Works</h2>

        <div className="space-y-6 mb-12">
          {steps.map((step, i) => (
            <Card key={i} className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
              <CardContent className="p-8 flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <step.icon size={26} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-foreground mb-2">
                    <span className="text-primary font-extrabold mr-2">{i + 1}.</span>
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-base leading-relaxed">{step.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-2xl shadow-[0_4px_20px_rgba(63,154,174,0.1)] border-0">
          <CardContent className="p-8 text-center">
            <Users size={32} className="text-primary mx-auto mb-4" />
            <h2 className="text-foreground mb-3">Our Mission</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-xl mx-auto">
              We believe everyone deserves to feel safe online. GuardianEye was built by a team of
              researchers and engineers who saw their own grandparents targeted by scammers. Our goal
              is simple: make scam detection as easy as taking a screenshot.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AboutPage;
