"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Code,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Minimum editing height, e.g. "16rem". */
  minHeight?: string;
}

type BlockType = "paragraph" | "1" | "2" | "3" | "4" | "5" | "6";

const BLOCK_LABELS: Record<BlockType, string> = {
  paragraph: "Paragraph",
  "1": "Heading 1 (H1)",
  "2": "Heading 2 (H2)",
  "3": "Heading 3 (H3)",
  "4": "Heading 4 (H4)",
  "5": "Heading 5 (H5)",
  "6": "Heading 6 (H6)",
};

function currentBlock(editor: Editor): BlockType {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    if (editor.isActive("heading", { level })) return String(level) as BlockType;
  }
  return "paragraph";
}

/** Adds https:// to bare addresses; leaves paths, anchors, mailto: and tel: alone. */
function normaliseUrl(raw: string): string {
  const url = raw.trim();
  if (url === "" || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return url;
  return `https://${url}`;
}

/**
 * The shared TipTap editor: a WordPress-style visual editor with headings
 * (H1-H6), bold/italic/underline/strike, alignment, lists, quotes, links
 * (open in new tab), images by URL, a divider, undo/redo, and an HTML view
 * for pasting or fine-tuning markup.
 */
export function RichTextEditor({ value, onChange, placeholder, minHeight = "10rem" }: RichTextEditorProps) {
  const [panel, setPanel] = useState<"link" | "image" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [sourceMode, setSourceMode] = useState(false);
  const [source, setSource] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ HTMLAttributes: { loading: "lazy" } }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text-content px-4 py-3 focus:outline-none",
        style: `min-height:${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Follow value changes that come from outside (form reset, loaded record).
  useEffect(() => {
    if (editor && !editor.isFocused && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="rounded-md border border-border bg-surface-secondary" style={{ minHeight }} />;
  }

  const tool = (
    label: string,
    icon: React.ReactNode,
    active: boolean,
    run: () => void,
    disabled = false,
  ) => (
    <Button
      key={label}
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon"
      className="size-8"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled || sourceMode}
      onClick={run}
    >
      {icon}
    </Button>
  );

  const divider = (key: string) => <span key={key} className="mx-0.5 h-5 w-px bg-border" aria-hidden />;

  const openLink = () => {
    const attrs = editor.getAttributes("link");
    setLinkUrl((attrs.href as string) ?? "");
    setNewTab(attrs.target === "_blank");
    setPanel("link");
  };

  const applyLink = () => {
    const href = normaliseUrl(linkUrl);

    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href, target: newTab ? "_blank" : null, rel: "noopener noreferrer" })
        .run();
    }
    setPanel(null);
  };

  const applyImage = () => {
    const src = normaliseUrl(imageUrl);
    if (src !== "") editor.chain().focus().setImage({ src, alt: imageAlt }).run();
    setImageUrl("");
    setImageAlt("");
    setPanel(null);
  };

  const toggleSource = () => {
    if (!sourceMode) {
      setSource(editor.getHTML());
      setPanel(null);
    } else {
      editor.commands.setContent(source, { emitUpdate: true });
    }
    setSourceMode(!sourceMode);
  };

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-secondary p-1.5">
        <select
          aria-label="Block type"
          value={currentBlock(editor)}
          disabled={sourceMode}
          onChange={(event) => {
            const next = event.target.value as BlockType;
            const chain = editor.chain().focus();
            if (next === "paragraph") chain.setParagraph().run();
            else chain.setHeading({ level: Number(next) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
          }}
          className="mr-1 h-8 rounded-md border border-border bg-surface px-2 text-sm text-text-primary"
        >
          {(Object.keys(BLOCK_LABELS) as BlockType[]).map((key) => (
            <option key={key} value={key}>
              {BLOCK_LABELS[key]}
            </option>
          ))}
        </select>

        {tool("Bold", <Bold className="size-4" />, editor.isActive("bold"), () => editor.chain().focus().toggleBold().run())}
        {tool("Italic", <Italic className="size-4" />, editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run())}
        {tool("Underline", <UnderlineIcon className="size-4" />, editor.isActive("underline"), () => editor.chain().focus().toggleUnderline().run())}
        {tool("Strikethrough", <Strikethrough className="size-4" />, editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run())}
        {divider("d1")}
        {tool("Bullet list", <List className="size-4" />, editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run())}
        {tool("Numbered list", <ListOrdered className="size-4" />, editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run())}
        {tool("Quote", <Quote className="size-4" />, editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run())}
        {tool("Code block", <Code className="size-4" />, editor.isActive("codeBlock"), () => editor.chain().focus().toggleCodeBlock().run())}
        {divider("d2")}
        {tool("Align left", <AlignLeft className="size-4" />, editor.isActive({ textAlign: "left" }), () => editor.chain().focus().setTextAlign("left").run())}
        {tool("Align centre", <AlignCenter className="size-4" />, editor.isActive({ textAlign: "center" }), () => editor.chain().focus().setTextAlign("center").run())}
        {tool("Align right", <AlignRight className="size-4" />, editor.isActive({ textAlign: "right" }), () => editor.chain().focus().setTextAlign("right").run())}
        {divider("d3")}
        {tool("Insert link", <LinkIcon className="size-4" />, editor.isActive("link") || panel === "link", openLink)}
        {tool("Remove link", <Unlink className="size-4" />, false, () => editor.chain().focus().extendMarkRange("link").unsetLink().run(), !editor.isActive("link"))}
        {tool("Insert image", <ImagePlus className="size-4" />, panel === "image", () => setPanel(panel === "image" ? null : "image"))}
        {tool("Horizontal line", <Minus className="size-4" />, false, () => editor.chain().focus().setHorizontalRule().run())}
        {divider("d4")}
        {tool("Clear formatting", <RemoveFormatting className="size-4" />, false, () => editor.chain().focus().clearNodes().unsetAllMarks().run())}
        {tool("Undo", <Undo2 className="size-4" />, false, () => editor.chain().focus().undo().run(), !editor.can().undo())}
        {tool("Redo", <Redo2 className="size-4" />, false, () => editor.chain().focus().redo().run(), !editor.can().redo())}

        <Button
          type="button"
          variant={sourceMode ? "secondary" : "ghost"}
          size="sm"
          className="ml-auto h-8 gap-1.5"
          aria-pressed={sourceMode}
          onClick={toggleSource}
        >
          <Code2 className="size-4" />
          HTML
        </Button>
      </div>

      {panel === "link" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-shop-tint p-2">
          <Input
            aria-label="Link address"
            className="h-8 min-w-48 flex-1"
            placeholder="https://example.com or /products/slug"
            value={linkUrl}
            autoFocus
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input type="checkbox" checked={newTab} onChange={(event) => setNewTab(event.target.checked)} />
            Open in new tab
          </label>
          <Button type="button" size="sm" onClick={applyLink}>
            Apply
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {panel === "image" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-shop-tint p-2">
          <Input
            aria-label="Image address"
            className="h-8 min-w-48 flex-1"
            placeholder="Image URL (https://...)"
            value={imageUrl}
            autoFocus
            onChange={(event) => setImageUrl(event.target.value)}
          />
          <Input
            aria-label="Image description"
            className="h-8 w-48"
            placeholder="Description (alt text)"
            value={imageAlt}
            onChange={(event) => setImageAlt(event.target.value)}
          />
          <Button type="button" size="sm" onClick={applyImage}>
            Insert
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPanel(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      {sourceMode ? (
        <textarea
          aria-label="HTML source"
          value={source}
          spellCheck={false}
          onChange={(event) => {
            setSource(event.target.value);
            onChange(event.target.value);
          }}
          className="block w-full resize-y bg-surface px-4 py-3 font-mono text-xs text-text-primary focus:outline-none"
          style={{ minHeight }}
        />
      ) : (
        <EditorContent editor={editor} className={cn(!value && "text-text-muted")} placeholder={placeholder} />
      )}
    </div>
  );
}
