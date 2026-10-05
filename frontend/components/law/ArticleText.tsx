// Law text keeps its original line breaks (numbered paragraphs).
export function ArticleText({ children }: { children: string }) {
  return <p className="whitespace-pre-line leading-8">{children}</p>;
}
