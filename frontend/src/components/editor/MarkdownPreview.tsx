import ReactMarkdown from 'react-markdown';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div className="text-gray-400 italic p-4">
        No content to preview
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none p-4 h-full overflow-y-auto">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

