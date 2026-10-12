<?php

namespace App\Support;

use DOMDocument;
use DOMElement;
use DOMNode;

/**
 * Allow-list HTML cleaner for content written in the admin's rich-text
 * editor (product descriptions). Keeps formatting, headings, lists, links,
 * images and tables; removes scripts, styles, frames, event handlers and
 * javascript: links, so stored HTML is safe to render on the storefront.
 */
class HtmlSanitizer
{
    private const ALLOWED_TAGS = [
        'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'span',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'a', 'img',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
        'figure', 'figcaption', 'div',
    ];

    /** Tags removed together with everything inside them. */
    private const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'link', 'meta', 'base', 'noscript', 'template'];

    private const ALLOWED_ATTRS = [
        'a' => ['href', 'title', 'target', 'rel'],
        'img' => ['src', 'alt', 'title', 'width', 'height'],
        'td' => ['colspan', 'rowspan'],
        'th' => ['colspan', 'rowspan', 'scope'],
        '*' => ['class'],
    ];

    public static function clean(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return $html;
        }

        // Plain text (no tags) is left exactly as written.
        if ($html === strip_tags($html)) {
            return $html;
        }

        $previous = libxml_use_internal_errors(true);
        $doc = new DOMDocument('1.0', 'UTF-8');
        $doc->loadHTML('<?xml encoding="UTF-8"><div id="__root">'.$html.'</div>', LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $doc->getElementById('__root');

        if (! $root) {
            return strip_tags($html);
        }

        self::walk($root);

        $out = '';
        foreach ($root->childNodes as $child) {
            $out .= $doc->saveHTML($child);
        }

        // The editor leaves an empty paragraph after the last block; it only adds blank space.
        $out = preg_replace('#(?:<p>(?:\s|&nbsp;|<br\s*/?>)*</p>\s*)+$#i', '', trim($out)) ?? $out;

        return trim($out);
    }

    private static function walk(DOMNode $node): void
    {
        // Snapshot: the live child list changes while nodes are removed or unwrapped.
        foreach (iterator_to_array($node->childNodes) as $child) {
            if (! $child instanceof DOMElement) {
                if ($child->nodeType === XML_COMMENT_NODE) {
                    $node->removeChild($child);
                }

                continue;
            }

            $tag = strtolower($child->tagName);

            if (in_array($tag, self::DROP_WITH_CONTENT, true)) {
                $node->removeChild($child);

                continue;
            }

            self::walk($child);

            if (! in_array($tag, self::ALLOWED_TAGS, true)) {
                // Unknown wrapper: keep its (already cleaned) children, drop the tag.
                while ($child->firstChild) {
                    $node->insertBefore($child->firstChild, $child);
                }
                $node->removeChild($child);

                continue;
            }

            self::cleanAttributes($child, $tag);
        }
    }

    private static function cleanAttributes(DOMElement $el, string $tag): void
    {
        $allowed = array_merge(self::ALLOWED_ATTRS[$tag] ?? [], self::ALLOWED_ATTRS['*']);

        foreach (iterator_to_array($el->attributes) as $attr) {
            $name = strtolower($attr->name);

            if (! in_array($name, $allowed, true)) {
                $el->removeAttribute($attr->name);

                continue;
            }

            if (in_array($name, ['href', 'src'], true) && ! self::safeUrl($attr->value, $name === 'src')) {
                $el->removeAttribute($attr->name);
            }
        }

        if ($tag === 'a' && $el->getAttribute('target') === '_blank') {
            $el->setAttribute('rel', 'noopener noreferrer');
        } elseif ($tag === 'a') {
            $el->removeAttribute('target');
        }
    }

    private static function safeUrl(string $url, bool $isImage): bool
    {
        $url = trim(preg_replace('/[\x00-\x20]+/', '', $url) ?? '');

        if ($url === '' || str_starts_with($url, '#') || str_starts_with($url, '/')) {
            return true;
        }

        if (preg_match('#^(https?:)?//#i', $url)) {
            return true;
        }

        if (! $isImage && preg_match('/^(mailto|tel):/i', $url)) {
            return true;
        }

        return ! preg_match('/^[a-z][a-z0-9+.\-]*:/i', $url); // relative path, no scheme
    }
}
