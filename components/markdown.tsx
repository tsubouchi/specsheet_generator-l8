"use client"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

export function Markdown({ content }: { content: string }) {
  // 共通のスタイル
  const baseTextStyle = "text-black font-mono"
  const baseHeadingStyle = `${baseTextStyle} font-bold`
  const codeBlockStyle =
    "text-xs font-mono whitespace-pre-wrap overflow-x-auto p-4 bg-gray-50 text-black border border-gray-200 rounded-md my-2"

  return (
    <div className="markdown-content w-full max-w-full overflow-hidden bg-white text-black font-mono">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode } & any) {
            return !inline ? (
              <div className={codeBlockStyle}>{String(children).replace(/\n$/, "")}</div>
            ) : (
              <code
                className="font-mono bg-gray-50 text-black px-1 py-0.5 rounded text-xs border border-gray-200"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre({ children, ...props }: { children?: React.ReactNode } & any) {
            return (
              <pre className={codeBlockStyle} {...props}>
                {children}
              </pre>
            )
          },
          table({ node, ...props }) {
            return <table className="min-w-full border-collapse border border-gray-200 my-4">{props.children}</table>
          },
          thead({ node, ...props }) {
            return <thead className="bg-gray-50">{props.children}</thead>
          },
          tbody({ node, ...props }) {
            return <tbody>{props.children}</tbody>
          },
          tr({ node, ...props }) {
            return <tr className="border-b border-gray-200">{props.children}</tr>
          },
          th({ node, ...props }) {
            return (
              <th className={`${baseTextStyle} font-bold p-2 text-left border-r border-gray-200 last:border-r-0`}>
                {props.children}
              </th>
            )
          },
          td({ node, ...props }) {
            return (
              <td className={`${baseTextStyle} p-2 text-left border-r border-gray-200 last:border-r-0`}>
                {props.children}
              </td>
            )
          },
          p({ node, children, ...props }) {
            return (
              <p className={`${baseTextStyle} whitespace-pre-wrap break-words w-full my-2`} {...props}>
                {children}
              </p>
            )
          },
          ul({ node, children, ...props }) {
            return (
              <ul className={`${baseTextStyle} my-2 pl-4 list-disc`} {...props}>
                {children}
              </ul>
            )
          },
          ol({ node, children, ...props }) {
            return (
              <ol className={`${baseTextStyle} my-2 pl-4 list-decimal`} {...props}>
                {children}
              </ol>
            )
          },
          li({ node, children, ...props }) {
            return (
              <li className={`${baseTextStyle} whitespace-pre-wrap break-words w-full ml-4 my-1`} {...props}>
                {children}
              </li>
            )
          },
          h1({ node, children, ...props }) {
            return (
              <h1 className={`${baseHeadingStyle} text-xl my-4 border-b border-gray-200 pb-1`} {...props}>
                {children}
              </h1>
            )
          },
          h2({ node, children, ...props }) {
            return (
              <h2 className={`${baseHeadingStyle} text-lg my-3 border-b border-gray-200 pb-1`} {...props}>
                {children}
              </h2>
            )
          },
          h3({ node, children, ...props }) {
            return (
              <h3 className={`${baseHeadingStyle} text-base my-2`} {...props}>
                {children}
              </h3>
            )
          },
          h4({ node, children, ...props }) {
            return (
              <h4 className={`${baseHeadingStyle} text-sm my-2`} {...props}>
                {children}
              </h4>
            )
          },
          h5({ node, children, ...props }) {
            return (
              <h5 className={`${baseHeadingStyle} text-sm my-1`} {...props}>
                {children}
              </h5>
            )
          },
          h6({ node, children, ...props }) {
            return (
              <h6 className={`${baseHeadingStyle} text-sm my-1`} {...props}>
                {children}
              </h6>
            )
          },
          blockquote({ node, children, ...props }) {
            return (
              <blockquote className={`${baseTextStyle} border-l-4 border-gray-200 pl-4 my-2 italic`} {...props}>
                {children}
              </blockquote>
            )
          },
          hr({ node, ...props }) {
            return <hr className="my-4 border-t border-gray-200" {...props} />
          },
          a({ node, children, ...props }) {
            return (
              <a className={`${baseTextStyle} text-blue-600 underline`} {...props}>
                {children}
              </a>
            )
          },
          img({ node, ...props }) {
            return <span className={`${baseTextStyle}`}>[画像: {props.alt || "イメージ"}]</span>
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
