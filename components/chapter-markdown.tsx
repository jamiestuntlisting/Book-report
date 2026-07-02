import ReactMarkdown from "react-markdown";

// Renders chapter Markdown with book-style prose. Shared by the workspace,
// the book preview, the print page, and the public share view.
export function ChapterMarkdown({ text }: { text: string }) {
  return (
    <div className="prose-book max-w-none">
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
