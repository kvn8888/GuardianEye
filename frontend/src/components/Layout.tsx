import Navbar from "@/components/Navbar";
import { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background font-nunito">
    <Navbar />
    <main>{children}</main>
  </div>
);

export default Layout;
