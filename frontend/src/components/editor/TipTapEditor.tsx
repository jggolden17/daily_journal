import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TurndownService from 'turndown';
import { marked } from 'marked';

export interface TipTapEditorHandle {
  focus: () => void;
}

interface TipTapEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  onCursorChange?: (position: number) => void;
  placeholder?: string;
  autoSaveDelay?: number;
  fullScreen?: boolean;
  noBorder?: boolean;
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

export const TipTapEditor = forwardRef<TipTapEditorHandle, TipTapEditorProps>(({
  value,
  onChange,
  onSave,
  onCursorChange,
  placeholder = 'Start writing...',
  autoSaveDelay = 2000,
  fullScreen = false,
  noBorder = false,
}, ref) => {
  const saveTimeoutRef = useRef<number | null>(null);
  const previousValueRef = useRef<string>(value);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const onSaveRef = useRef(onSave);
  const onCursorChangeRef = useRef(onCursorChange);

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
      const markdown = turndownService.turndown(html);
      return markdown.trim();
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
        // Disable built-in link to avoid duplicate extension warning
        link: false,
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
        class: `prose prose-sm max-w-none focus:outline-none ${fullScreen ? 'p-8 min-h-full' : noBorder ? 'py-0 px-0 entry-block' : 'p-4 min-h-[400px]'}`,
      },
      handleKeyDown: (view, event) => {
        // Handle Command+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          
          if (onSaveRef.current && editorRef.current) {
            // Capture current cursor position before save
            const { from, to } = editorRef.current.state.selection;
            
            // Get HTML from the ProseMirror content element
            const proseMirrorElement = view.dom.querySelector('.ProseMirror') || view.dom;
            const html = proseMirrorElement.innerHTML;
            const markdown = htmlToMarkdown(html);
            
            // Clear any pending debounced save
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              saveTimeoutRef.current = null;
            }
            
            // Immediately save
            onSaveRef.current(markdown);
            
            // Restore cursor position after save (content doesn't change, so position should be preserved)
            // Use setTimeout to ensure the save callback has completed
            setTimeout(() => {
              if (editorRef.current && !editorRef.current.isDestroyed) {
                try {
                  // Ensure cursor position is still valid (in case content changed)
                  const docLength = editorRef.current.state.doc.content.size;
                  const safeFrom = Math.min(from, docLength);
                  const safeTo = Math.min(to, docLength);
                  editorRef.current.commands.setTextSelection({ from: safeFrom, to: safeTo });
                } catch (error) {
                  // If restoring selection fails, just ensure editor is focused
                  editorRef.current.view.focus();
                }
              }
            }, 0);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      
      // Track cursor position in markdown
      if (onCursorChangeRef.current) {
        try {
          const { from } = editor.state.selection;
          // Get plain text content up to cursor position
          const textBeforeCursor = editor.state.doc.textBetween(0, from);
          // Use text length as approximation for markdown position
          // This works reasonably well since we're mainly interested in which entry section the cursor is in
          const position = textBeforeCursor.length;
          onCursorChangeRef.current(position);
        } catch (error) {
          // Fallback: use markdown length as approximation
          if (onCursorChangeRef.current) {
            onCursorChangeRef.current(markdown.length);
          }
        }
      }
      
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
    onSelectionUpdate: ({ editor }) => {
      // Track cursor position on selection changes (cursor moves, clicks, etc.)
      if (onCursorChangeRef.current) {
        try {
          const { from } = editor.state.selection;
          const textBeforeCursor = editor.state.doc.textBetween(0, from);
          const position = textBeforeCursor.length;
          onCursorChangeRef.current(position);
        } catch (error) {
          // Fallback: use current markdown length
          const markdown = htmlToMarkdown(editor.getHTML());
          onCursorChangeRef.current(markdown.length);
        }
      }
    },
  });

  // Store editor reference and update refs
  useEffect(() => {
    editorRef.current = editor;
    onSaveRef.current = onSave;
    onCursorChangeRef.current = onCursorChange;
  }, [editor, onSave, onCursorChange]);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (editor && !editor.isDestroyed) {
        editor.commands.setTextSelection(0);
        editor.view.focus();
      }
    },
  }), [editor]);

  // Update editor content when value prop changes externally
  useEffect(() => {
    if (editor && value !== previousValueRef.current) {
      const html = markdownToHtml(value);
      const currentHtml = editor.getHTML();
      
      // Only update if the content is actually different
      if (html !== currentHtml) {
        // Capture current selection before updating content
        const { from, to } = editor.state.selection;
        
        // Update content
        editor.commands.setContent(html);
        
        // Restore cursor position if content is the same length (user likely just saved)
        // Otherwise, preserve position if it's still valid
        setTimeout(() => {
          if (editor && !editor.isDestroyed) {
            try {
              const docLength = editor.state.doc.content.size;
              // If content length is similar, try to restore position
              // Otherwise, place cursor at end
              if (docLength > 0) {
                const safeFrom = Math.min(from, docLength);
                const safeTo = Math.min(to, docLength);
                editor.commands.setTextSelection({ from: safeFrom, to: safeTo });
              }
            } catch (error) {
              // If restoring fails, place cursor at end
              try {
                const docLength = editor.state.doc.content.size;
                if (docLength > 0) {
                  editor.commands.setTextSelection(docLength);
                }
              } catch {
                // Fallback: just focus
                editor.view.focus();
              }
            }
          }
        }, 0);
        
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

  const containerClasses = fullScreen
    ? 'h-full overflow-auto'
    : noBorder
    ? 'w-full'
    : 'h-full border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent';

  return (
    <div className={containerClasses}>
      <EditorContent editor={editor} />
    </div>
  );
});

