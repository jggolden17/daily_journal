import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { marked } from 'marked';

interface TipTapEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  autoSaveDelay?: number;
}

// Initialize Turndown service for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Configure Turndown to handle code blocks properly
turndownService.addRule('codeBlock', {
  filter: 'pre',
  replacement: (_content, node) => {
    const codeNode = node as HTMLElement;
    const code = codeNode.querySelector('code');
    if (!code) return '';
    const language = code.className?.replace('language-', '') || '';
    const codeContent = code.textContent || '';
    return `\n\`\`\`${language}\n${codeContent}\n\`\`\`\n`;
  },
});

export function TipTapEditor({
  value,
  onChange,
  onSave,
  placeholder = 'Start writing...',
  autoSaveDelay = 2000,
}: TipTapEditorProps) {
  const saveTimeoutRef = useRef<number | null>(null);
  const previousValueRef = useRef<string>(value);

  // Convert markdown to HTML for TipTap
  const markdownToHtml = (markdown: string): string => {
    if (!markdown.trim()) {
      return '<p></p>';
    }
    try {
      return marked.parse(markdown, { breaks: true }) as string;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      return '<p></p>';
    }
  };

  // Convert HTML to markdown for storage
  const htmlToMarkdown = (html: string): string => {
    if (!html.trim() || html === '<p></p>') {
      return '';
    }
    try {
      return turndownService.turndown(html).trim();
    } catch (error) {
      console.error('Error converting HTML to markdown:', error);
      return '';
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default code block and use our custom handling
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none p-4 min-h-[400px]',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      
      // Only call onChange if the markdown actually changed
      if (markdown !== previousValueRef.current) {
        previousValueRef.current = markdown;
        onChange(markdown);

        // Debounced autosave
        if (onSave) {
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          saveTimeoutRef.current = window.setTimeout(() => {
            onSave(markdown);
          }, autoSaveDelay);
        }
      }
    },
  });

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== previousValueRef.current) {
      const html = markdownToHtml(value);
      const currentHtml = editor.getHTML();
      
      // Only update if the content is actually different
      if (html !== currentHtml) {
        editor.commands.setContent(html);
        previousValueRef.current = value;
      }
    }
  }, [value, editor]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <div className="w-full h-full border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      <EditorContent editor={editor} />
    </div>
  );
}

