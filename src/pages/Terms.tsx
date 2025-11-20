import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last Updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Agreement to Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using Academic Annual ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these Terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Description of Service</h2>
            <p className="text-muted-foreground">
              Academic Annual provides a platform for accessing and subscribing to academic calendars from educational institutions. The Service aggregates publicly available calendar information and allows users to integrate this data with their personal calendar applications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">User Accounts</h2>
            <p className="text-muted-foreground mb-3">When you create an account with us, you must provide accurate and complete information. You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Maintaining the security of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Acceptable Use</h2>
            <p className="text-muted-foreground mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any portion of the Service</li>
              <li>Use automated systems to access the Service without permission</li>
              <li>Misrepresent your affiliation with any institution</li>
              <li>Collect or harvest any information from other users</li>
              <li>Transmit viruses, malware, or other harmful code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Calendar Data Accuracy</h2>
            <p className="text-muted-foreground">
              We strive to provide accurate calendar information, but we do not guarantee the accuracy, completeness, or timeliness of calendar data. Educational institutions may change dates without notice. Users should verify important dates directly with their institutions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-muted-foreground">
              Our Service may integrate with third-party services (such as Google Calendar). Your use of these services is subject to their respective terms and conditions. We are not responsible for the availability, content, or practices of third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Intellectual Property</h2>
            <p className="text-muted-foreground">
              The Service and its original content, features, and functionality are owned by Academic Annual and are protected by international copyright, trademark, and other intellectual property laws. Calendar data sourced from educational institutions remains the property of those institutions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Disclaimer of Warranties</h2>
            <p className="text-muted-foreground">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, ACADEMIC ANNUAL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless Academic Annual and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses arising out of or in any way connected with your access to or use of the Service or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Service Modifications and Termination</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify, suspend, or discontinue the Service at any time without notice. We may also terminate or suspend your account for any reason, including violation of these Terms, without prior notice or liability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
            <p className="text-muted-foreground">
              We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Governing Law</h2>
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the appropriate courts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Severability</h2>
            <p className="text-muted-foreground">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Information</h2>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us at: legal@academicannual.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Terms;
