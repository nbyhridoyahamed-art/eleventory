export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  steps: string[];
  /** Where in the dashboard this happens, for a "Take me there" link. */
  link?: { href: string; label: string };
}

/**
 * The help centre skeleton: short task-based articles that match the screens as they are today.
 * Expand and add screenshots as the product settles; keep each article to one task.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started: from sign-up to your first order",
    summary: "The five things to do after creating your store.",
    steps: [
      "Confirm your email address using the link we send you, then sign in.",
      "Work through the checklist on your Dashboard: it shows what is done and what is next.",
      "Add your first product (Catalog > Products) with a price, a photo and stock.",
      "Set your delivery zones and rates (Delivery), so customers see a delivery charge at checkout.",
      "Open your store address and place a test order with cash on delivery to see what your customers see.",
    ],
    link: { href: "/dashboard", label: "Open the dashboard" },
  },
  {
    slug: "add-products",
    title: "Add products and manage stock",
    summary: "Create products, variants and keep stock correct.",
    steps: [
      "Go to Catalog > Products and choose Add product.",
      "Enter the name, price and description, and upload photos from your media library.",
      "For sizes or colours, add variants; each variant has its own stock.",
      "Set the opening stock for your warehouse. Use Inventory to adjust it later; every change is recorded.",
      "Set the status to Active when you want it to appear in your store.",
    ],
    link: { href: "/dashboard/catalog/products", label: "Go to Products" },
  },
  {
    slug: "custom-domain",
    title: "Connect your own domain",
    summary: "Use shop.yourbrand.com or yourbrand.com instead of the free address.",
    steps: [
      "Open Settings > Domains and add your domain.",
      "At the company where you bought the domain, add the two DNS records we show: a TXT record that proves it is yours, and a CNAME that points visitors to us.",
      "For a bare domain such as yourbrand.com your provider may call the CNAME an ALIAS or ANAME. If it offers neither, point www.yourbrand.com and redirect the bare domain to it.",
      "Press Verify. DNS changes can take from a few minutes up to a day. HTTPS is set up for you automatically once verified.",
      "Choose which address is your main one; the others redirect to it.",
    ],
    link: { href: "/dashboard/settings/domains", label: "Open Domains" },
  },
  {
    slug: "take-payments",
    title: "Take online payments",
    summary: "Connect your own payment provider account.",
    steps: [
      "Open Settings > Payments. Online payments are included from the Growth plan.",
      "Pick a provider (SSLCommerz for cards, bKash, Nagad and bank payments; Stripe for international cards) and enter the keys from your own account. Keys are stored encrypted and are never shown again.",
      "Switch on Test mode first and place a test order. Switch it off when you are ready for real money.",
      "Copy the webhook address shown on the card into your provider's dashboard so payments are confirmed even if a customer closes the browser.",
      "Tick Offer at checkout. Customers can then pay online or choose cash on delivery.",
    ],
    link: { href: "/dashboard/settings/payments", label: "Open Payments" },
  },
  {
    slug: "plans-and-billing",
    title: "Plans, invoices and what happens if a payment is missed",
    summary: "How billing works.",
    steps: [
      "Settings > Billing shows your plan, what you have used against its limits, and your invoices.",
      "You can upgrade at any time. Moving to a smaller plan is only allowed when you fit inside its limits.",
      "Before a trial or period ends we send reminders. If a payment is missed there is a short grace period; after that your store goes offline until the invoice is paid. Nothing is deleted.",
    ],
    link: { href: "/dashboard/settings/billing", label: "Open Billing" },
  },
  {
    slug: "export-and-delete",
    title: "Export your data or delete your account",
    summary: "You own your data. Take a copy, or remove it.",
    steps: [
      "Settings > Your data > Export creates a zip of spreadsheets (products, customers, orders and more). It is ready in a moment and the download link works for 7 days.",
      "To delete your account choose Delete account and type your store name to confirm. Your store goes offline straight away.",
      "You have 14 days to change your mind: sign in and choose Cancel deletion. After that everything is permanently deleted and cannot be recovered.",
      "Invoices and payment records we must keep by law are retained as explained in the Privacy Policy.",
    ],
    link: { href: "/dashboard/settings/data", label: "Open Your data" },
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
