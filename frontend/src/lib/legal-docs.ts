/**
 * Platform legal documents (Terms of Service, Privacy Policy, Data Processing Agreement).
 *
 * THESE ARE DRAFT TEMPLATES, NOT LEGAL ADVICE. They describe how the platform actually behaves (so the
 * facts match the code) but have not been reviewed by a lawyer. Everything in [square brackets] must be
 * filled in, and a qualified lawyer in your jurisdiction must review the whole text before launch.
 *
 * Bump LEGAL_VERSION whenever wording changes in a way people should re-accept; the API records which
 * version each person accepted (config/legal.php must hold the same value).
 */
export const LEGAL_VERSION = "2026-11-draft";

export const COMPANY = {
  name: "[Company legal name]",
  address: "[Registered address]",
  email: "[legal@your-domain]",
  privacyEmail: "[privacy@your-domain]",
  jurisdiction: "[Bangladesh / your jurisdiction: confirm with your lawyer]",
};

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalDoc {
  slug: "terms" | "privacy" | "dpa";
  title: string;
  summary: string;
  sections: LegalSection[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    summary: "The agreement between you and us when you run a store on the platform.",
    sections: [
      {
        heading: "1. Who we are and what this covers",
        body: [
          `The platform is provided by ${COMPANY.name}, ${COMPANY.address} ("we", "us"). These terms apply to anyone who creates an account or runs a store on it ("you"). If you accept on behalf of a business, you confirm you can bind it.`,
        ],
      },
      {
        heading: "2. Your account and store",
        body: [
          "You must give accurate details and keep your password safe. You are responsible for everything done through your account and for the people you add as staff.",
          "Each account can have one or more stores. Your store gets a free address on our domain and, on plans that include it, your own domain that you must own or control.",
        ],
      },
      {
        heading: "3. What you may sell and how you must behave",
        body: [
          "You are the seller. You are responsible for your products, prices, descriptions, delivery, refunds and for following the laws that apply to your business, including consumer, tax and product-safety laws.",
          "You may not sell illegal or counterfeit goods, use the platform for fraud, send spam, attack or probe other people's systems, or try to get around plan limits. We may remove content or suspend a store that breaks these rules (section 8).",
        ],
      },
      {
        heading: "4. Payments from your customers",
        body: [
          "Online payments from your customers go through payment providers you connect with your own accounts (for example SSLCommerz or Stripe). Those providers' terms apply, and the money is settled to you by them. We are not a bank or payment processor and we do not hold your customers' money.",
          "Cash on delivery and manual payments are recorded by you; we do not collect them.",
        ],
      },
      {
        heading: "5. Plans, fees and billing",
        body: [
          "Paid plans, their limits and prices are shown on the pricing and billing screens. A free trial may be offered. Fees are charged in advance for the period you choose and are [non-refundable except where the law requires / describe your refund policy].",
          "If a payment is missed we send reminders, allow a grace period, and then take your store offline until the invoice is paid. Your data is kept while a store is suspended for non-payment.",
          "We may change prices or plan limits with at least [30] days' notice before they apply to you.",
        ],
      },
      {
        heading: "6. Your data and ours",
        body: [
          "Your store's data (products, orders, customers, files) belongs to you. You give us permission to host and process it to provide the service. We do not sell it. Our Privacy Policy and Data Processing Agreement explain how personal data is handled.",
          "The platform software, design and brand belong to us. You get a limited, non-exclusive right to use them while your account is active.",
        ],
      },
      {
        heading: "7. Availability and support",
        body: [
          "We work to keep the service running but do not promise it will be uninterrupted or error-free. Planned maintenance is announced when we can. Support channels and hours are described in the help centre.",
        ],
      },
      {
        heading: "8. Suspension and ending the agreement",
        body: [
          "We may suspend or close a store for non-payment, breach of these terms, legal requirements or abuse reports we have reason to believe. Where reasonable we tell you why and how to fix it.",
          "You can ask to delete your account at any time from Settings. Deletion starts a 14-day grace period in which your store is offline and you can cancel the request; after that your store data is permanently deleted. You can export your data first. Billing records we are required to keep are retained (see the Privacy Policy).",
        ],
      },
      {
        heading: "9. Liability",
        body: [
          "To the extent the law allows, we are not liable for lost profits, lost sales or indirect losses, and our total liability for any claim is limited to the fees you paid us in the [12] months before it arose. Nothing here limits liability that cannot be limited by law.",
        ],
      },
      {
        heading: "10. Changes, law and contact",
        body: [
          `We may update these terms; for material changes we will tell you before they apply and ask you to accept the new version. These terms are governed by the laws of ${COMPANY.jurisdiction}, and disputes go to the courts there unless the law gives you another right.`,
          `Questions: ${COMPANY.email}.`,
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "What personal data we handle, why, who sees it and how long we keep it.",
    sections: [
      {
        heading: "1. Two roles",
        body: [
          "For the details of the people who sign up to run a store (you and your staff), we decide how the data is used: we are the controller.",
          "For your store's customers (names, phones, addresses, orders), you decide why and how it is used and we process it for you: you are the controller and we are your processor. The Data Processing Agreement covers that.",
        ],
      },
      {
        heading: "2. What we collect",
        body: [
          "Account data: name, email, phone, password (stored hashed, never readable), the stores you belong to and your role.",
          "Store data you put in: products, orders, customers, files, settings. Payment-provider keys you enter are stored encrypted and are never shown again.",
          "Billing data: plan, invoices and payment status. Card numbers are handled by the payment provider and never stored by us.",
          "Technical data: IP address, browser, pages and API calls (logs), and security events, kept to run, secure and debug the service.",
        ],
      },
      {
        heading: "3. Why we use it",
        body: [
          "To provide and secure the service, bill you, send service emails (sign-in, billing, security, important changes), prevent abuse, and meet legal duties. We do not sell personal data and do not use your customers' data for our own marketing.",
        ],
      },
      {
        heading: "4. Who else sees it",
        body: [
          "Only service providers we need to run the platform (hosting, email delivery, error monitoring, backups, payment providers you connect) under contracts that protect it, and authorities when the law requires. The current list is in the Data Processing Agreement.",
        ],
      },
      {
        heading: "5. How long we keep it",
        body: [
          "While your account is open. After you ask to delete it we wait 14 days (so you can change your mind), then permanently delete your store data and files; encrypted backups age out within [30] days.",
          "We keep invoices and payment records for [number] years because accounting and tax law require it, and security logs for [number] days.",
        ],
      },
      {
        heading: "6. Your rights",
        body: [
          "You can see, correct and export your data from the dashboard (Settings, Your data) and ask us to delete it. Your customers should contact you (the store) first; we help you respond. You can also ask us at the address below, and complain to the data-protection authority where you live.",
        ],
      },
      {
        heading: "7. Security",
        body: [
          "Data is encrypted in transit, secrets are encrypted at rest, every store's data is kept separate from other stores, access by our staff is limited and recorded, and we keep encrypted backups. No system is perfectly secure; if a breach affects you we will tell you without undue delay.",
        ],
      },
      {
        heading: "8. Cookies",
        body: [
          "We use cookies and similar storage that are needed to sign you in and remember your settings and cart. Stores may add their own analytics; that is the store's responsibility and is described in its own policy.",
        ],
      },
      {
        heading: "9. Contact and changes",
        body: [`Privacy questions: ${COMPANY.privacyEmail}. We will tell you about material changes to this policy before they apply.`],
      },
    ],
  },
  {
    slug: "dpa",
    title: "Data Processing Agreement",
    summary: "How we handle your store customers' personal data on your behalf.",
    sections: [
      {
        heading: "1. Scope and roles",
        body: [
          "This agreement applies when we process personal data of your store's customers and visitors on your behalf to provide the service. You are the controller; we are the processor.",
        ],
      },
      {
        heading: "2. What we do with the data",
        body: [
          "We store, display, back up, transmit and delete the data only to provide the platform as described in the Terms and your instructions (your use of the dashboard and API). Categories: customer names, phone numbers, emails, delivery addresses, order and payment records. Duration: while your account is open, plus the deletion period in the Privacy Policy.",
        ],
      },
      {
        heading: "3. Our commitments",
        body: [
          "We process the data only on your documented instructions unless the law requires otherwise, and tell you if an instruction appears unlawful.",
          "People with access are bound by confidentiality.",
          "We apply the security measures in section 5 and keep each store's data separate from every other store's.",
          "We help you answer requests from people exercising their rights, using the export and deletion tools in the dashboard, and we help with security and impact-assessment obligations on request.",
          "We tell you about a personal-data breach affecting your data without undue delay [and within 72 hours of becoming aware].",
          "When your account is deleted we delete the data (and, at your choice, return it first as an export), except what the law requires us to keep.",
        ],
      },
      {
        heading: "4. Subprocessors",
        body: [
          "You authorise us to use the subprocessors below. We will tell you before adding or replacing one and you may object.",
          "[Hosting provider: name, country]. [Email delivery provider: name, country]. [Backup storage provider: name, country]. [Error-monitoring provider: name, country]. Payment providers you connect (for example SSLCommerz, Stripe) act as independent controllers for the payments they handle.",
        ],
      },
      {
        heading: "5. Security measures",
        body: [
          "Encryption in transit; encryption of stored secrets and backups; per-store data separation enforced in the application and tested; role-based access with audit records of staff and support access to a store; daily backups with restore drills; monitoring and alerting; rate limiting and abuse controls.",
        ],
      },
      {
        heading: "6. International transfers and audits",
        body: [
          "Data is hosted in [region]. Where it is transferred elsewhere we use appropriate safeguards. We will give you reasonable information to show we meet this agreement and allow audits [once a year, with notice, at your cost] where the law requires.",
        ],
      },
      {
        heading: "7. Term",
        body: ["This agreement lasts as long as we process the data for you and is part of the Terms of Service."],
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((doc) => doc.slug === slug);
}
