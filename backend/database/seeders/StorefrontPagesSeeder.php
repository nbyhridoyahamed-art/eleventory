<?php

namespace Database\Seeders;

use App\Models\Page;
use App\Models\Store;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * The full set of informational storefront pages (about, policies, help,
 * landing pages). Idempotent: keyed on store + slug, so it can be re-run to
 * refresh the copy. Run singly: db:seed --class=StorefrontPagesSeeder.
 */
class StorefrontPagesSeeder extends Seeder
{
    public function run(): void
    {
        $store = Store::query()->orderBy('id')->firstOrFail(); // the app serves a single store; don't depend on its (editable) slug
        $admin = User::where('email', 'admin@eleventory.test')->firstOrFail();

        foreach ($this->pages() as $slug => [$title, $content]) {
            Page::updateOrCreate(
                ['store_id' => $store->id, 'slug' => $slug],
                [
                    'title' => $title,
                    'content' => $this->toPlainText($content),
                    'status' => 'published',
                    'created_by' => $admin->id,
                ],
            );
        }
    }

    /**
     * The storefront page view renders `content` as plain text
     * (whitespace-pre-line), not HTML, so the markup below is flattened to
     * readable text: headings on their own line, bullets as "•", numbered
     * steps as "1.", and the title <h1> dropped (the page shows it already).
     */
    private function toPlainText(string $html): string
    {
        $text = preg_replace('#<h1>.*?</h1>#s', '', $html);

        $text = preg_replace_callback('#<ol>(.*?)</ol>#s', function (array $match) {
            $n = 0;

            return preg_replace_callback('#<li>(.*?)</li>#s', function (array $item) use (&$n) {
                return (++$n).'. '.$item[1]."\n";
            }, $match[1]);
        }, $text);

        $text = preg_replace('#<li>(.*?)</li>#s', "• $1\n", $text);
        $text = preg_replace('#</(p|ul|h[2-6])>#', "\n\n", $text);
        $text = preg_replace('#<h[2-6]>#', '', $text);
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5);

        return trim(preg_replace("/\n{3,}/", "\n\n", $text));
    }

    /** @return array<string, array{0: string, 1: string}> */
    private function pages(): array
    {
        return [
            'about-us' => ['About Us', <<<'HTML'
<h1>About Eleventory</h1>
<p>Eleventory is Bangladesh's trusted online store for electronics, fashion, home goods and everyday essentials. We started with a simple idea: shopping online should be easy, honest and reliable for everyone, from Dhaka to Sylhet.</p>
<h2>Our mission</h2>
<p>To bring genuine products, fair prices and dependable delivery to every doorstep in Bangladesh, with Cash on Delivery so you only pay when you are happy.</p>
<h2>Why shop with Eleventory</h2>
<ul>
<li><strong>100% genuine products</strong> sourced directly from brands and authorised distributors.</li>
<li><strong>Nationwide delivery</strong> across all 8 divisions, with Cash on Delivery available.</li>
<li><strong>Easy returns</strong> within 7 days of delivery on eligible items.</li>
<li><strong>Friendly support</strong> by phone, email and live chat, 7 days a week.</li>
</ul>
<h2>Our promise</h2>
<p>Every order is checked, packed and tracked with care. If something is not right, we make it right.</p>
HTML],

            'contact-us' => ['Contact Us', <<<'HTML'
<h1>Contact Us</h1>
<p>Questions about an order, a product or a return? Our team is happy to help.</p>
<h2>Customer support</h2>
<ul>
<li><strong>Phone:</strong> 09610-000000 (9am to 9pm, 7 days a week)</li>
<li><strong>Email:</strong> support@eleventory.test</li>
<li><strong>Live chat:</strong> available on the storefront during support hours</li>
</ul>
<h2>Head office</h2>
<p>Eleventory, Dhaka, Bangladesh.</p>
<h2>Before you write</h2>
<p>For the fastest reply, include your order number and the phone number used at checkout. You can also check <a href="/pages/track-order">Track Order</a> and the <a href="/pages/faq">FAQ</a> for quick answers.</p>
HTML],

            'privacy-policy' => ['Privacy Policy', <<<'HTML'
<h1>Privacy Policy</h1>
<p>Your privacy matters to Eleventory. This policy explains what information we collect and how we use it.</p>
<h2>Information we collect</h2>
<ul>
<li>Contact details you provide at checkout: name, phone number, email and delivery address.</li>
<li>Order history and support conversations.</li>
<li>Basic usage data such as pages viewed, to improve the store.</li>
</ul>
<h2>How we use it</h2>
<p>We use your information to process and deliver orders, provide support, prevent fraud and, if you opt in, send offers. We never sell your personal data to third parties.</p>
<h2>Sharing</h2>
<p>We share only what is necessary with delivery partners and payment providers to complete your order.</p>
<h2>Your choices</h2>
<p>You may request access to, correction of or deletion of your data, and unsubscribe from marketing at any time by contacting support@eleventory.test.</p>
HTML],

            'terms-conditions' => ['Terms & Conditions', <<<'HTML'
<h1>Terms &amp; Conditions</h1>
<p>By placing an order on Eleventory you agree to the terms below.</p>
<h2>Orders and pricing</h2>
<p>Prices are shown in Bangladeshi Taka (BDT) and may change without notice. An order is confirmed once our team verifies it. We may cancel orders affected by stock or pricing errors and will refund any payment made.</p>
<h2>Payment</h2>
<p>We accept Cash on Delivery and the online payment methods shown at checkout.</p>
<h2>Delivery</h2>
<p>Delivery times are estimates and depend on your location and courier conditions. See our <a href="/pages/shipping-policy">Shipping Policy</a>.</p>
<h2>Returns</h2>
<p>Returns and refunds are governed by our <a href="/pages/return-refund-policy">Return &amp; Refund Policy</a>.</p>
<h2>Accounts</h2>
<p>You are responsible for keeping your account details secure and for activity under your account.</p>
HTML],

            'shipping-policy' => ['Shipping Policy', <<<'HTML'
<h1>Shipping Policy</h1>
<p>Eleventory delivers to all 8 divisions of Bangladesh.</p>
<h2>Delivery times</h2>
<ul>
<li><strong>Inside Dhaka:</strong> 1 to 2 working days</li>
<li><strong>Outside Dhaka:</strong> 3 to 5 working days</li>
</ul>
<h2>Delivery charges</h2>
<p>Charges depend on your delivery zone and the weight of your order and are shown at checkout before you confirm. Free delivery offers are shown on eligible products and during promotions.</p>
<h2>Cash on Delivery</h2>
<p>Pay the delivery person in cash when you receive and check your parcel.</p>
<h2>Tracking</h2>
<p>Once your order is dispatched you will receive an update, and you can follow it any time on the <a href="/pages/track-order">Track Order</a> page.</p>
<h2>Failed delivery</h2>
<p>If we cannot reach you, the courier will attempt delivery again. Please keep your phone reachable on the day of delivery.</p>
HTML],

            'return-refund-policy' => ['Return & Refund Policy', <<<'HTML'
<h1>Return &amp; Refund Policy</h1>
<p>We want you to be happy with every purchase. If you are not, we make returns simple.</p>
<h2>Return window</h2>
<p>Most items can be returned within 7 days of delivery, unused and in original condition and packaging with all accessories and invoice.</p>
<h2>Not eligible</h2>
<ul>
<li>Items damaged through misuse</li>
<li>Personal care and intimate items once opened</li>
<li>Items marked non-returnable on the product page</li>
</ul>
<h2>How to return</h2>
<ol>
<li>Contact support@eleventory.test or 09610-000000 with your order number.</li>
<li>We confirm eligibility and arrange pickup or drop-off.</li>
<li>After inspection we issue your refund.</li>
</ol>
<h2>Refunds</h2>
<p>Refunds go to the original payment method or, if you prefer, to your Eleventory store credit, usually within 5 to 7 working days of inspection.</p>
<h2>Exchanges</h2>
<p>Need a different size or colour? Ask for an exchange and we will arrange it, subject to stock.</p>
HTML],

            'affiliate-policy' => ['Affiliate Policy', <<<'HTML'
<h1>Affiliate Policy</h1>
<p>The Eleventory affiliate programme lets creators and publishers earn a commission by recommending our products.</p>
<h2>How it works</h2>
<ol>
<li>Apply with your website or social profile.</li>
<li>Get your unique tracking link once approved.</li>
<li>Earn a commission on eligible orders placed through your link.</li>
</ol>
<h2>Rules</h2>
<ul>
<li>Be honest and clear that links are affiliate links.</li>
<li>No spam, misleading claims or self-referral orders.</li>
<li>No paid advertising on the Eleventory brand name without written approval.</li>
</ul>
<h2>Commission</h2>
<p>Commission is calculated on the product value of completed orders, excluding delivery fees, and is not paid on cancelled or returned orders. Eleventory may update rates or end participation for policy breaches.</p>
<h2>Apply</h2>
<p>Email support@eleventory.test with the subject "Affiliate Programme".</p>
HTML],

            'track-order' => ['Track Order', <<<'HTML'
<h1>Track Your Order</h1>
<p>Enter your order number and the phone number used at checkout to see the latest status of your parcel.</p>
<h2>Order stages</h2>
<ol>
<li><strong>Pending:</strong> we have received your order.</li>
<li><strong>Confirmed:</strong> your order has been verified.</li>
<li><strong>Packed &amp; shipped:</strong> it is on its way with our courier partner.</li>
<li><strong>Delivered:</strong> your parcel has arrived.</li>
</ol>
<p>Need help? Call 09610-000000 or email support@eleventory.test with your order number.</p>
HTML],

            'faq' => ['FAQ', <<<'HTML'
<h1>Frequently Asked Questions</h1>
<h2>Ordering</h2>
<h3>How do I place an order?</h3>
<p>Add products to your cart, go to checkout, enter your delivery details and choose a payment method.</p>
<h3>Can I order without an account?</h3>
<p>Yes. You can check out as a guest, though an account makes tracking and reordering easier.</p>
<h2>Payment</h2>
<h3>Do you offer Cash on Delivery?</h3>
<p>Yes, Cash on Delivery is available nationwide.</p>
<h2>Delivery</h2>
<h3>How long does delivery take?</h3>
<p>1 to 2 working days inside Dhaka and 3 to 5 working days outside Dhaka.</p>
<h3>How can I track my order?</h3>
<p>Use the <a href="/pages/track-order">Track Order</a> page with your order number.</p>
<h2>Returns</h2>
<h3>Can I return a product?</h3>
<p>Yes, eligible items can be returned within 7 days of delivery. See the <a href="/pages/return-refund-policy">Return &amp; Refund Policy</a>.</p>
<h3>Are your products genuine?</h3>
<p>Yes. Every product is sourced from brands or authorised distributors.</p>
HTML],

            'shop' => ['Shop', <<<'HTML'
<h1>Shop Eleventory</h1>
<p>Browse our full range of electronics, fashion, home goods and daily essentials. Use the filters to narrow by category, brand and price, and sort by what is new or popular.</p>
<p>Every item ships across Bangladesh with Cash on Delivery and easy 7-day returns on eligible products.</p>
HTML],

            'new-arrivals' => ['New Arrivals', <<<'HTML'
<h1>New Arrivals</h1>
<p>Fresh in at Eleventory: the latest gadgets, fashion and home picks, added every week. Check back often, as popular new items sell quickly.</p>
HTML],

            'brands' => ['Brands', <<<'HTML'
<h1>Our Brands</h1>
<p>Eleventory partners with trusted local and international brands so you always get genuine products with proper warranty and after-sales support.</p>
<p>Pick a brand to see everything we carry from them.</p>
HTML],

            'product-video' => ['Product Video', <<<'HTML'
<h1>Product Videos</h1>
<p>See our products in action. Watch unboxings, quick reviews and how-to guides to help you choose with confidence before you buy.</p>
HTML],

            'wishlist' => ['Wishlist', <<<'HTML'
<h1>Your Wishlist</h1>
<p>Save the products you love and come back to them any time. Sign in to keep your wishlist on every device.</p>
HTML],

            'custom-404' => ['Page Not Found', <<<'HTML'
<h1>Page Not Found</h1>
<p>Sorry, we could not find the page you were looking for. It may have moved or no longer exists.</p>
<p>Try the <a href="/shop">shop</a> or return to the <a href="/">homepage</a>.</p>
HTML],
        ];
    }
}
