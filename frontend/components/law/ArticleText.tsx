// Law text keeps its original line breaks (numbered paragraphs).
export function ArticleText({ children, className = "" }: { children: string; className?: string }) {
  return <p className={`max-w-[75ch] whitespace-pre-line ${className}`}>{children}</p>;
}
